import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SourceIdentityStatus, ClaimSupportStatus, SourceRef } from "./assist-contract.ts";

export const SOURCE_SEARCH_NOT_CONNECTED = "尚未連接真實來源檢索";
export const SOURCE_SEARCH_NOT_CONNECTED_EXACT = "尚未連接真實來源檢索";
export const llmSourceStatuses = ["AI_PROPOSED", "UNVERIFIED", "CONTRADICTED", "BLOCKED"] as const;
export type LlmSourceStatus = (typeof llmSourceStatuses)[number];

/**
 * This is intentionally a program-owned allowlist. Model output and user input
 * can never add an origin to it. Publisher and journal URLs are display-only.
 */
export const TRUSTED_RESEARCH_API_ALLOWLIST = Object.freeze([
  { id: "crossref", origin: "https://api.crossref.org", host: "api.crossref.org", pathPrefix: "/works/", port: 443 },
] as const);

export type SourceCandidate = {
  title: string;
  url: string;
  sourceType: string;
  status: LlmSourceStatus;
  publisher?: string;
  publishedAt?: string;
  doi?: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;
type VerificationOptions = { fetchImpl?: FetchLike; resolver?: Resolver };
type URLCheck = { ok: true; url: URL } | { ok: false; reason: string };

const doiPattern = /^10\.\d{4,9}\/[^\s]+$/i;
const maxDocumentBytes = 1_000_000;
const maxRedirects = 3;

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function comparable(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function titleMatches(candidate: string, retrieved: string) {
  const left = comparable(candidate);
  const right = comparable(retrieved);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const tokens = left.split(" ").filter((token) => token.length > 2);
  const matches = tokens.filter((token) => right.includes(token)).length;
  return tokens.length > 0 && matches / tokens.length >= 0.6;
}

function extractDoi(source: SourceCandidate) {
  const raw = clean(source.doi, 300) || clean(source.url.match(/10\.\d{4,9}\/[^\s]+/i)?.[0], 300);
  return raw.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/[)>,.;]+$/, "");
}

function ipv4Parts(address: string): number[] | null {
  const value = address.trim();
  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    if (Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= 0xffffffff) {
      return [(numeric >>> 24) & 255, (numeric >>> 16) & 255, (numeric >>> 8) & 255, numeric & 255];
    }
  }
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
    ? parts.map(Number)
    : null;
}

function ipv4Blocked(address: string) {
  const parts = ipv4Parts(address);
  if (!parts) return false;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) || (a === 192 && b === 88 && c === 99) ||
    (a === 198 && b >= 18 && b <= 19) || (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) || a >= 224;
}

function ipv6Blocked(address: string) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::" || value === "::1" || value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    return value === "::" || value === "::1" || ipv4Blocked(mapped);
  }
  const first = Number.parseInt(value.split(":").find(Boolean) || "0", 16);
  return !Number.isFinite(first) || first === 0 || (first >= 0xfc00 && first <= 0xfdff) ||
    (first >= 0xfe80 && first <= 0xfebf) || (first >= 0xff00 && first <= 0xffff) ||
    value.startsWith("2001:db8:");
}

export function isBlockedIp(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "");
  const family = isIP(normalized);
  return family === 4 ? ipv4Blocked(normalized) : family === 6 ? ipv6Blocked(normalized) : ipv4Blocked(normalized);
}

function blockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const dottedNumericPrefix = host.match(/^((?:\d{1,3}\.){3}\d{1,3})(?:\.|$)/)?.[1];
  const decimalNumericPrefix = host.match(/^(\d{7,10})(?:\.|$)/)?.[1];
  return host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
    host.endsWith(".zeabur.internal") || host.startsWith("service-") ||
    (dottedNumericPrefix ? ipv4Blocked(dottedNumericPrefix) : false) ||
    (decimalNumericPrefix ? ipv4Blocked(decimalNumericPrefix) : false);
}

async function resolveAndValidateHost(hostname: string, resolver: Resolver): Promise<URLCheck> {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  if (blockedHostname(normalized)) return { ok: false, reason: "blocked_hostname" };
  if (isIP(normalized)) return isBlockedIp(normalized) ? { ok: false, reason: "blocked_ip" } : { ok: true, url: new URL(`https://${hostname}`) };
  try {
    const addresses = await resolver(normalized);
    if (!addresses.length || addresses.some((item) => isBlockedIp(item.address))) return { ok: false, reason: "blocked_dns_result" };
    return { ok: true, url: new URL(`https://${hostname}`) };
  } catch {
    return { ok: false, reason: "dns_resolution_failed" };
  }
}

export async function validateOutboundUrl(input: string, resolver: Resolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true })) : Promise<URLCheck> {
  let url: URL;
  try { url = new URL(input); } catch { return { ok: false, reason: "invalid_url" }; }
  if (url.protocol !== "https:") return { ok: false, reason: "https_required" };
  if (url.username || url.password) return { ok: false, reason: "credentials_forbidden" };
  if (url.port && url.port !== "443") return { ok: false, reason: "port_forbidden" };
  return resolveAndValidateHost(url.hostname, resolver).then((result) => result.ok ? { ok: true, url } : result);
}

function isTrustedCrossrefUrl(url: URL) {
  const entry = TRUSTED_RESEARCH_API_ALLOWLIST[0];
  return url.origin === entry.origin && url.hostname === entry.host && (!url.port || url.port === String(entry.port)) && url.pathname.startsWith(entry.pathPrefix) && !url.search && !url.hash;
}

function crossrefUrlForDoi(doi: string) {
  return new URL(`${TRUSTED_RESEARCH_API_ALLOWLIST[0].origin}/works/${encodeURIComponent(doi)}`);
}

function baseResult(source: SourceCandidate, sourceIdentityStatus: SourceIdentityStatus, claimSupportStatus: ClaimSupportStatus, retrievedAt: string, resolvedUrl: string, method: SourceRef["verificationMethod"], extra: Partial<SourceRef> = {}): SourceRef {
  return {
    title: source.title,
    url: source.url,
    sourceType: source.sourceType,
    status: sourceIdentityStatus === "BLOCKED" ? "BLOCKED" : sourceIdentityStatus === "CONTRADICTED" ? "CONTRADICTED" : "UNVERIFIED",
    sourceIdentityStatus,
    claimSupportStatus,
    resolvedUrl,
    retrievedAt,
    verificationMethod: method,
    verificationOutcome: sourceIdentityStatus,
    doi: extractDoi(source) || undefined,
    ...extra,
  };
}

async function readLimited(response: Response) {
  try {
    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > maxDocumentBytes) return "";
    return (await response.text()).slice(0, maxDocumentBytes);
  } catch { return ""; }
}

async function fetchTrustedApi(initial: URL, fetchImpl: FetchLike, resolver: Resolver): Promise<{ response?: Response; finalUrl?: URL; blocked?: string }> {
  let current = initial;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    if (!isTrustedCrossrefUrl(current)) return { blocked: "trusted_api_allowlist" };
    const checked = await validateOutboundUrl(current.toString(), resolver);
    if (!checked.ok) return { blocked: checked.reason };
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        redirect: "manual",
        cache: "no-store",
        headers: { accept: "application/json", "user-agent": "Old-Mike-Research-Portal-source-verifier/1.3.2" },
        signal: AbortSignal.timeout(8000),
      });
    } catch { return { blocked: "trusted_api_request_failed" }; }
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: current };
    const location = response.headers.get("location");
    if (!location || redirects === maxRedirects) return { blocked: "redirect_limit" };
    let next: URL;
    try { next = new URL(location, current); } catch { return { blocked: "invalid_redirect" }; }
    if (!isTrustedCrossrefUrl(next)) return { blocked: "redirect_outside_allowlist" };
    current = next;
  }
  return { blocked: "redirect_limit" };
}

function crossrefMetadata(data: any) {
  const item = data?.message;
  const title = Array.isArray(item?.title) ? clean(item.title[0], 500) : "";
  const publisher = clean(item?.publisher, 300);
  const parts = item?.published?.["date-parts"]?.[0];
  const publishedAt = Array.isArray(parts) && parts.length >= 3 ? `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}` : "";
  const metadataDoi = clean(item?.DOI, 300).toLowerCase();
  return { title, publisher, publishedAt, metadataDoi };
}

export function externalSearchConnected(env: NodeJS.ProcessEnv = process.env) {
  return env.OPENCLAW_EXTERNAL_SEARCH === "true";
}

export async function verifySourceCandidate(source: SourceCandidate, options: VerificationOptions = {}): Promise<SourceRef> {
  const retrievedAt = new Date().toISOString();
  const fetchImpl = options.fetchImpl || fetch;
  const resolver = options.resolver || ((hostname: string) => dnsLookup(hostname, { all: true, verbatim: true }));
  let displayUrl: URL;
  try { displayUrl = new URL(source.url); } catch { return baseResult(source, "BLOCKED", "BLOCKED", retrievedAt, source.url, "blocked"); }
  if (displayUrl.username || displayUrl.password || (displayUrl.port && displayUrl.port !== "443") || blockedHostname(displayUrl.hostname) || isBlockedIp(displayUrl.hostname) || ipv4Blocked(displayUrl.hostname)) {
    return baseResult(source, "BLOCKED", "BLOCKED", retrievedAt, source.url, "blocked");
  }
  // Normal publisher/journal URLs are never fetched in v1.3.2. They remain unverified.
  if (!source.doi && !extractDoi(source)) return baseResult(source, "UNVERIFIED", "CLAIM_UNVERIFIED", retrievedAt, source.url, "not_connected");
  const doi = extractDoi(source);
  if (!doiPattern.test(doi)) return baseResult(source, "UNVERIFIED", "CLAIM_UNVERIFIED", retrievedAt, source.url, "not_connected");
  const crossrefUrl = crossrefUrlForDoi(doi);
  const result = await fetchTrustedApi(crossrefUrl, fetchImpl, resolver);
  if (result.blocked || !result.response || !result.finalUrl) return baseResult(source, "BLOCKED", "BLOCKED", retrievedAt, crossrefUrl.toString(), "blocked", { doi });
  if (!result.response.ok) return baseResult(source, "UNVERIFIED", "CLAIM_UNVERIFIED", retrievedAt, result.finalUrl.toString(), "trusted_api_crossref", { doi });
  let data: any;
  try { data = JSON.parse(await readLimited(result.response)); } catch { return baseResult(source, "UNVERIFIED", "CLAIM_UNVERIFIED", retrievedAt, result.finalUrl.toString(), "trusted_api_crossref", { doi }); }
  const metadata = crossrefMetadata(data);
  const doiMatches = !metadata.metadataDoi || metadata.metadataDoi === doi.toLowerCase();
  const matches = Boolean(metadata.title && doiMatches && titleMatches(source.title, metadata.title) && (!source.publisher || !metadata.publisher || comparable(source.publisher) === comparable(metadata.publisher)) && (!source.publishedAt || !metadata.publishedAt || metadata.publishedAt.slice(0, 10) === source.publishedAt.slice(0, 10)));
  return baseResult(source, matches ? "SOURCE_METADATA_VERIFIED" : "CONTRADICTED", "CLAIM_UNVERIFIED", retrievedAt, result.finalUrl.toString(), "trusted_api_crossref", { publisher: metadata.publisher || source.publisher, publishedAt: metadata.publishedAt || source.publishedAt, doi });
}

export async function verifySourceCandidates(sources: SourceCandidate[], fetchImpl: FetchLike = fetch) {
  if (!externalSearchConnected()) return { status: "blocked" as const, sources: [] as SourceRef[], message: SOURCE_SEARCH_NOT_CONNECTED_EXACT };
  const verified = await Promise.all(sources.map((source) => verifySourceCandidate(source, { fetchImpl })));
  return { status: "success" as const, sources: verified, message: undefined };
}
