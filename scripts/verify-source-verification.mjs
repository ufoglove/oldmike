import assert from "node:assert/strict";
import { parseHorizonResponse } from "../lib/assist-contract.ts";
import { validateOutboundUrl, verifySourceCandidate } from "../lib/source-verifier.ts";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];
const source = (url, extra = {}) => ({ title: "A verified metadata fixture", url, sourceType: "journal", status: "UNVERIFIED", ...extra });

let fetchCount = 0;
const neverFetch = async () => { fetchCount += 1; throw new Error("blocked URL must not be fetched"); };

const blockedUrls = [
  "https://localhost/article",
  "https://127.0.0.1/article",
  "https://[::1]/article",
  "https://0.0.0.0/article",
  "https://10.1.2.3/article",
  "https://172.16.1.2/article",
  "https://192.168.1.2/article",
  "https://100.64.1.2/article",
  "https://169.254.169.254/latest/meta-data",
  "https://service-oldmike.zeabur.internal/v1",
  "https://gateway.internal/v1",
  "https://2130706433/article",
  "https://127.0.0.1%2eexample/article",
  "https://example.org:8443/article",
  "https://user:password@example.org/article",
];
for (const url of blockedUrls) {
  const result = await verifySourceCandidate(source(url), { fetchImpl: neverFetch, resolver: publicResolver });
  assert.equal(result.status, "BLOCKED", url);
  assert.equal(result.sourceIdentityStatus, "BLOCKED", url);
  assert.equal(fetchCount, 0, `blocked URL was fetched: ${url}`);
}

const dnsPrivate = await verifySourceCandidate(source("https://publisher.example/article", { doi: "10.1234/private" }), {
  fetchImpl: neverFetch,
  resolver: async () => [{ address: "192.168.10.20", family: 4 }],
});
assert.equal(dnsPrivate.status, "BLOCKED");
assert.equal(dnsPrivate.sourceIdentityStatus, "BLOCKED");
assert.equal(fetchCount, 0, "DNS-to-private result must not be fetched");

let redirectFetches = 0;
const redirectPrivate = await verifySourceCandidate(source("https://publisher.example/article", { doi: "10.1234/redirect" }), {
  resolver: publicResolver,
  fetchImpl: async (input) => {
    redirectFetches += 1;
    assert.match(String(input), /^https:\/\/api\.crossref\.org\/works\//);
    return new Response("", { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } });
  },
});
assert.equal(redirectPrivate.status, "BLOCKED");
assert.equal(redirectPrivate.sourceIdentityStatus, "BLOCKED");
assert.equal(redirectFetches, 1, "redirect-to-private must stop before the second request");

const metadataBody = {
  message: {
    DOI: "10.1234/metadata",
    title: ["A verified metadata fixture"],
    publisher: "Trusted Publisher",
    published: { "date-parts": [[2026, 1, 2]] },
  },
};
let crossrefUrl = "";
const verified = await verifySourceCandidate(source("https://publisher.example/article", {
  doi: "10.1234/metadata", publisher: "Trusted Publisher", publishedAt: "2026-01-02",
}), {
  resolver: publicResolver,
  fetchImpl: async (input) => {
    crossrefUrl = String(input);
    return new Response(JSON.stringify(metadataBody), { status: 200, headers: { "content-type": "application/json" } });
  },
});
assert.match(crossrefUrl, /^https:\/\/api\.crossref\.org\/works\//);
assert.equal(verified.sourceIdentityStatus, "SOURCE_METADATA_VERIFIED");
assert.equal(verified.claimSupportStatus, "CLAIM_UNVERIFIED");
assert.equal(verified.verificationMethod, "trusted_api_crossref");
assert.equal(verified.verificationOutcome, "SOURCE_METADATA_VERIFIED");
assert.equal(verified.resolvedUrl, crossrefUrl);

const ordinaryPublisher = await verifySourceCandidate(source("https://publisher.example/article"), { fetchImpl: neverFetch, resolver: publicResolver });
assert.equal(ordinaryPublisher.sourceIdentityStatus, "UNVERIFIED");
assert.equal(ordinaryPublisher.claimSupportStatus, "CLAIM_UNVERIFIED");
assert.equal(fetchCount, 0, "ordinary publisher URL must remain display-only");

const invalidDoi = await verifySourceCandidate(source("https://publisher.example/article", { doi: "not-a-doi" }), { fetchImpl: neverFetch, resolver: publicResolver });
assert.equal(invalidDoi.sourceIdentityStatus, "UNVERIFIED");
assert.equal(fetchCount, 0);

for (const url of ["https://127.0.0.1", "https://[::1]", "https://10.0.0.1", "https://100.64.0.1", "https://169.254.169.254", "https://service-test.zeabur.internal", "https://example.org:8443", "https://u:p@example.org"]) {
  const checked = await validateOutboundUrl(url, publicResolver);
  assert.equal(checked.ok, false, `outbound validator accepted ${url}`);
}

const modelClaim = parseHorizonResponse(JSON.stringify({
  status: "success", mode: "UNVERIFIED", searchWindow: "36 months",
  items: [{ title: "x", summary: "y", status: "EMERGING", sources: [{ title: "x", url: "https://example.org/x", sourceType: "journal", status: "UNVERIFIED", sourceIdentityStatus: "SOURCE_METADATA_VERIFIED" }], unknowns: [] }],
  searchLog: [],
}));
assert.equal(modelClaim.status, "error", "model sourceIdentityStatus must not be accepted");

const modelMode = parseHorizonResponse(JSON.stringify({
  status: "success", mode: "VERIFIED", searchWindow: "36 months",
  items: [{ title: "x", summary: "y", status: "EMERGING", sources: [], unknowns: [] }],
  searchLog: [],
}));
assert.equal(modelMode.status, "error", "model VERIFIED mode must not be accepted");

console.log("PASS source verification: fixed allowlist, DNS/IP/redirect SSRF cases, metadata/claim split and model self-assertion rejection");

