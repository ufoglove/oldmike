import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalDomains, outputTrackIds } from "../lib/research-config.ts";
import { evidenceMessages, fieldAssistMessages, horizonMessages, s0DraftMessages, topicLabMessages } from "../lib/assist-prompts.ts";
import { finalizeTopicLab } from "../lib/assist-finalize.ts";
import { parseEvidenceResponse, parseFieldAssistResponse, parseHorizonInput, parseHorizonResponse, parseQuickStartInput, parseS0DraftInput, parseS0DraftResponse, parseTopicLabResponse } from "../lib/assist-contract.ts";

const source = { title: "Proposed source", url: "https://example.org/paper", sourceType: "primary-study", status: "AI_PROPOSED" };
const candidate = (index) => ({
  candidateId: `candidate-${index}`, chineseTitle: `研究題目 ${index}`, englishTitle: `Research candidate ${index}`, coreQuestion: "What is the measurable research question?", practicalProblem: "A bounded practical problem.", researchPopulation: "Defined research population", whyNow: "Recent context requires dated verification.", theoryOrMechanism: "A provisional mechanism.", possibleMethods: ["mixed methods"], requiredData: ["de-identified data"], feasibility: "Requires feasibility confirmation.", ethicsPrivacySiteRisks: ["ethics review required"], trackFit: { NSTC: "grant fit", MOE: "education fit", SCI: "technical fit", SSCI: "social science fit" }, noveltyStatus: "PROVISIONAL", sources: [source], unknowns: ["fresh search remains required"], uniqueNextAction: "Run a fresh source verification." });
const topicPayload = { status: "success", mode: "AI_PROPOSED", searchWindow: "36 months", checkedAt: "2026-08-16", candidates: [1, 2, 3].map(candidate) };
const intake = { workingTitle: "Research draft", domain: canonicalDomains[0], outputTrack: "NSTC", problemContext: "Known background", targetUsers: "Defined population", expectedContribution: "Provisional contribution", existingData: "Not yet verified", availableData: "Data access pending", methodIdea: "Methods idea", timeline: "12 months", constraints: "Resources pending", ethicsPrivacyRisks: "Review pending", unresolvedItems: "Open decisions" };

for (const domain of canonicalDomains) for (const outputTrack of outputTrackIds) assert.equal(parseQuickStartInput({ domain, outputTrack, direction: "a research direction", noIdea: false }).ok, true);
assert.equal(parseQuickStartInput({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "", noIdea: true }).ok, true);
assert.equal(parseQuickStartInput({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "", noIdea: true, verificationMode: "AI_CONCEPT" }).ok, true);
assert.equal(parseQuickStartInput({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "direction", noIdea: false, verificationMode: "FRESH_VERIFIED" }).ok, true);
assert.equal(parseQuickStartInput({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "direction", noIdea: false, verificationMode: "VERIFIED" }).ok, false);
assert.equal(parseTopicLabResponse(JSON.stringify(topicPayload)).candidates?.length, 3);
delete process.env.OPENCLAW_EXTERNAL_SEARCH;
const conceptModeResult = await finalizeTopicLab(parseTopicLabResponse(JSON.stringify(topicPayload)));
assert.equal(conceptModeResult.status, "success");
assert.equal(conceptModeResult.candidates?.every((item) => item.sources.every((entry) => entry.sourceIdentityStatus === "UNVERIFIED" && entry.claimSupportStatus === "CLAIM_UNVERIFIED")), true);
const freshModeResult = await finalizeTopicLab(parseTopicLabResponse(JSON.stringify(topicPayload)), true);
assert.equal(freshModeResult.kind, "blocked", "fresh verified mode must fail closed without search");
assert.equal(parseTopicLabResponse(JSON.stringify({ ...topicPayload, candidates: [{ ...candidate(1), sources: [{ ...source, status: "VERIFIED" }] }, candidate(2), candidate(3)] })).status, "error", "model VERIFIED source must be rejected");
assert.equal(parseTopicLabResponse('{"status":"success","mode":"AI_PROPOSED","candidates":[]}').status, "error");
assert.equal(parseHorizonResponse(JSON.stringify({ status: "success", mode: "UNVERIFIED", searchWindow: "36 months", items: [{ title: "Emerging issue", summary: "Dated summary", status: "EMERGING", sources: [source], unknowns: ["unknown"] }], searchLog: ["not connected"] })).status, "success");
assert.equal(parseHorizonResponse(JSON.stringify({ status: "success", mode: "VERIFIED", searchWindow: "36 months", items: [], searchLog: [] }).replace('"items":[]', '"items":[{"title":"x","summary":"y","status":"EMERGING","sources":[],"unknowns":[]}]')).status, "error", "model VERIFIED mode must be rejected");
assert.equal(parseHorizonInput({ domain: canonicalDomains[0], keywords: ["AI"], synonyms: [], months: 36, direction: "direction" }).ok, true);
assert.equal(parseFieldAssistResponse('{"status":"success","mode":"AI_PROPOSED","field":"problemContext","action":"options","suggestions":["A","B"]}', "problemContext", "options").status, "success");
assert.equal(parseS0DraftInput({ domain: canonicalDomains[0], outputTrack: "NSTC", workingTitle: "partial" }).ok, true);
const draft = Object.fromEntries(Object.keys(intake).map((field) => [field, { value: intake[field], status: "AI_PROPOSED" }]));
assert.equal(parseS0DraftResponse(JSON.stringify({ status: "success", mode: "AI_PROPOSED", draft })).status, "success");
assert.equal(parseEvidenceResponse(JSON.stringify({ status: "blocked", mode: "BLOCKED", searchStrategy: "not run", sources: [], ledger: [] })).status, "blocked");
const evidencePayload = { status: "success", mode: "UNVERIFIED", searchStrategy: "dated search", sources: [source], ledger: [{ claim: "claim", sourceTitle: source.title, url: source.url, verificationStatus: "AI_PROPOSED", relationship: "SUPPORTS" }] };
assert.equal(parseEvidenceResponse(JSON.stringify(evidencePayload)).status, "success");
assert.equal(parseEvidenceResponse(JSON.stringify({ ...evidencePayload, mode: "VERIFIED" })).status, "error", "model VERIFIED evidence mode must be rejected");
assert.equal(parseEvidenceResponse(JSON.stringify({ ...evidencePayload, ledger: [{ ...evidencePayload.ledger[0], verificationStatus: "VERIFIED" }] })).status, "error", "model VERIFIED ledger must be rejected");

const promptSet = [topicLabMessages({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "direction", noIdea: false }), horizonMessages({ domain: canonicalDomains[0], outputTrack: "NSTC", keywords: ["AI"], synonyms: [], months: 36, direction: "direction" }), fieldAssistMessages({ field: "problemContext", action: "options", mode: "formal", intake }), s0DraftMessages(intake), evidenceMessages({ domain: canonicalDomains[0], direction: "direction", months: 36, keywords: ["AI"] })];
for (const messages of promptSet) {
  assert.match(messages[0].content, /exactly one JSON object/);
  assert.match(messages[0].content, /AI_PROPOSED/);
  assert.doesNotMatch(messages[1].content, /OPENCLAW_GATEWAY_TOKEN|SESSION_SECRET|PORTAL_PASSWORD/);
}
assert.match(topicLabMessages({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "direction", noIdea: false })[0].content, /topic-innovation-lab/);
assert.match(topicLabMessages({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "", noIdea: true, verificationMode: "AI_CONCEPT" })[1].content, /AI concept ideation/);
assert.match(topicLabMessages({ domain: canonicalDomains[0], outputTrack: "NSTC", direction: "direction", noIdea: false, verificationMode: "FRESH_VERIFIED" })[1].content, /Fresh verified topic mode/);
assert.match(evidenceMessages({ domain: canonicalDomains[0], direction: "direction", months: 36, keywords: ["AI"] })[0].content, /verificationMethod/);
for (const filename of ["topic-lab.schema.json", "horizon-radar.schema.json", "field-assist.schema.json", "s0-draft.schema.json", "evidence-center.schema.json"]) {
  const schema = JSON.parse(await readFile(new URL(`../contracts/${filename}`, import.meta.url), "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.additionalProperties, false, `${filename} must close top-level contract`);
}
console.log("assist contracts: PASS (model cannot self-verify; raw source labels; prompt/schema/parser boundary; enums and S0 paths)");
