import "server-only";

import { createHash } from "node:crypto";
import { sha256Canonical } from "./research-contract.ts";
import { webResearchEnabled } from "./outbound-research-policy.ts";
import { readPublicWebContent, WebContentReaderError } from "./web-content-reader.ts";
import { parseTopicLabObservationProviderResult, type TopicLabAnalyzeRequest, type TopicLabSourceObservation } from "./topic-lab-contract.ts";

export type TopicLabSourceCapability = "NOT_REQUESTED" | "SCHOLARLY_DISABLED" | "SCHOLARLY_READY" | "SCHOLARLY_PARTIAL" | "SCHOLARLY_UNAVAILABLE" | "MANUAL_PUBLIC_HTTPS" | "MANUAL_DISABLED";
export type TopicLabProviderState = "READY" | "EMPTY" | "DISABLED" | "TIMED_OUT" | "CANCELLED" | "RATE_LIMITED" | "UPSTREAM_ERROR" | "INVALID_RESPONSE";
export type TopicLabScholarlyAdapter = {
  readonly provider: "OPENALEX" | "CROSSREF" | "SEMANTIC_SCHOLAR" | "CONSENSUS";
  search(input: TopicLabAnalyzeRequest, observedAt: Date, signal?: AbortSignal): Promise<TopicLabSourceObservation[]>;
};

export class TopicLabSourceProviderError extends Error {
  readonly code: string;
  readonly status: number;
  readonly providerState: TopicLabProviderState;
  constructor(code: string, status: number, providerState: TopicLabProviderState = "UPSTREAM_ERROR") {
    super(code);
    this.name = "TopicLabSourceProviderError";
    this.code = code;
    this.status = status;
    this.providerState = providerState;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\r\n?/gu, "\n").replace(/[\u0000-\u001f\u007f]/gu, " ").trim();
  return cleaned && cleaned.length <= maximum ? cleaned : "";
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeDoi(value: unknown) {
  const cleaned = boundedText(value, 300).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//u, "");
  return /^10\.\d{4,9}\/.+/u.test(cleaned) ? cleaned : null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

function dateFromParts(value: unknown) {
  if (!record(value) || !Array.isArray(value["date-parts"]) || !Array.isArray(value["date-parts"][0])) return null;
  const [year, month = 1, day = 1] = value["date-parts"][0].map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const output = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return normalizeDate(output);
}

function citationCount(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

async function readJson(response: Response, provider: string) {
  if (response.status === 429) { await response.body?.cancel().catch(() => undefined); throw new TopicLabSourceProviderError(`${provider.toLowerCase()}_rate_limited`, 503, "RATE_LIMITED"); }
  if (response.status !== 200) { await response.body?.cancel().catch(() => undefined); throw new TopicLabSourceProviderError(`${provider.toLowerCase()}_upstream_error`, 502, "UPSTREAM_ERROR"); }
  if (!(response.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) { await response.body?.cancel().catch(() => undefined); throw new TopicLabSourceProviderError(`${provider.toLowerCase()}_response_invalid`, 502, "INVALID_RESPONSE"); }
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > 512_000) { await response.body?.cancel().catch(() => undefined); throw new TopicLabSourceProviderError(`${provider.toLowerCase()}_response_too_large`, 502, "INVALID_RESPONSE"); }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > 512_000) throw new TopicLabSourceProviderError(`${provider.toLowerCase()}_response_too_large`, 502, "INVALID_RESPONSE");
  try { return JSON.parse(text) as unknown; }
  catch { throw new TopicLabSourceProviderError(`${provider.toLowerCase()}_response_invalid`, 502, "INVALID_RESPONSE"); }
}

function queryHash(input: TopicLabAnalyzeRequest, provider: string) {
  return sha256Canonical({ provider, direction: input.researchDirection, window: input.evidenceWindow });
}

function safeLocationHash(value: unknown, fallback: string) {
  const location = boundedText(value, 2_048);
  return digest(location || fallback);
}

function requestSignal(parent?: AbortSignal) {
  const timeout = AbortSignal.timeout(10_000);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

function abortedState(parent?: AbortSignal): TopicLabProviderState {
  return parent?.aborted ? "CANCELLED" : "TIMED_OUT";
}

export function createOpenAlexAdapter(fetcher: typeof fetch = fetch): TopicLabScholarlyAdapter {
  return Object.freeze({
    provider: "OPENALEX" as const,
    async search(input: TopicLabAnalyzeRequest, observedAt: Date, signal?: AbortSignal) {
      const endpoint = new URL("https://api.openalex.org/works");
      endpoint.searchParams.set("search", input.researchDirection);
      endpoint.searchParams.set("filter", `from_publication_date:${input.evidenceWindow.from},to_publication_date:${input.evidenceWindow.to}`);
      endpoint.searchParams.set("per-page", "12");
      let response: Response;
      try { response = await fetcher(endpoint, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: requestSignal(signal) }); }
      catch { throw new TopicLabSourceProviderError("openalex_timeout_or_transport", 503, abortedState(signal)); }
      const value = await readJson(response, "OPENALEX");
      if (!record(value) || !Array.isArray(value.results) || value.results.length > 12) throw new TopicLabSourceProviderError("openalex_response_invalid", 502, "INVALID_RESPONSE");
      const qHash = queryHash(input, "OPENALEX");
      return value.results.map((item, index) => {
        if (!record(item)) throw new TopicLabSourceProviderError("openalex_item_invalid", 502, "INVALID_RESPONSE");
        const rawProviderKey = boundedText(item.id, 300);
        const providerKey = rawProviderKey ? digest(`OPENALEX\0${rawProviderKey}`) : "";
        const title = boundedText(item.title, 300);
        const publishedAt = item.publication_date === null ? null : normalizeDate(item.publication_date);
        const doi = normalizeDoi(item.doi);
        const location = record(item.primary_location) ? item.primary_location.landing_page_url : null;
        if (!providerKey || !title || (item.publication_date !== null && !publishedAt)) throw new TopicLabSourceProviderError("openalex_item_invalid", 502, "INVALID_RESPONSE");
        return { observationId: `obs_openalex_${providerKey.slice(0, 20)}`, provider: "OPENALEX" as const, providerKey, queryHash: qHash, window: input.evidenceWindow, title, publishedAt, retrievedAt: observedAt.toISOString(), doi, citationCount: citationCount(item.cited_by_count), urlHash: safeLocationHash(location, doi ? `doi:${doi}` : `openalex:${providerKey}:${index}`), status: "UNVERIFIED" as const };
      });
    },
  });
}

export function createCrossrefAdapter(fetcher: typeof fetch = fetch): TopicLabScholarlyAdapter {
  return Object.freeze({
    provider: "CROSSREF" as const,
    async search(input: TopicLabAnalyzeRequest, observedAt: Date, signal?: AbortSignal) {
      const endpoint = new URL("https://api.crossref.org/works");
      endpoint.searchParams.set("query.bibliographic", input.researchDirection);
      endpoint.searchParams.set("filter", `from-pub-date:${input.evidenceWindow.from},until-pub-date:${input.evidenceWindow.to}`);
      endpoint.searchParams.set("rows", "12");
      let response: Response;
      try { response = await fetcher(endpoint, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: requestSignal(signal) }); }
      catch { throw new TopicLabSourceProviderError("crossref_timeout_or_transport", 503, abortedState(signal)); }
      const value = await readJson(response, "CROSSREF");
      if (!record(value) || value.status !== "ok" || value["message-type"] !== "work-list" || !record(value.message) || !Array.isArray(value.message.items) || value.message.items.length > 12) throw new TopicLabSourceProviderError("crossref_response_invalid", 502, "INVALID_RESPONSE");
      const qHash = queryHash(input, "CROSSREF");
      return value.message.items.map((item, index) => {
        if (!record(item)) throw new TopicLabSourceProviderError("crossref_item_invalid", 502, "INVALID_RESPONSE");
        const doi = normalizeDoi(item.DOI);
        const rawProviderKey = doi || boundedText(item.URL, 300) || `${Array.isArray(item.title) ? boundedText(item.title[0], 300) : ""}\0${JSON.stringify(item.published || item.issued || null)}\0${index}`;
        const providerKey = rawProviderKey ? digest(`CROSSREF\0${rawProviderKey}`) : "";
        const title = Array.isArray(item.title) ? boundedText(item.title[0], 300) : "";
        const publishedAt = dateFromParts(item.published || item.issued);
        if (!providerKey || !title || !publishedAt) throw new TopicLabSourceProviderError("crossref_item_invalid", 502, "INVALID_RESPONSE");
        return { observationId: `obs_crossref_${providerKey.slice(0, 20)}`, provider: "CROSSREF" as const, providerKey, queryHash: qHash, window: input.evidenceWindow, title, publishedAt, retrievedAt: observedAt.toISOString(), doi, citationCount: citationCount(item["is-referenced-by-count"]), urlHash: safeLocationHash(item.URL, doi ? `doi:${doi}` : `crossref:${providerKey}`), status: "UNVERIFIED" as const };
      });
    },
  });
}



export function createSemanticScholarAdapter(fetcher: typeof fetch = fetch): TopicLabScholarlyAdapter {
  return Object.freeze({
    provider: "SEMANTIC_SCHOLAR" as const,
    async search(input: TopicLabAnalyzeRequest, observedAt: Date, signal?: AbortSignal) {
      const endpoint = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
      endpoint.searchParams.set("query", input.researchDirection);
      endpoint.searchParams.set("fields", "paperId,title,externalIds,publicationDate,citationCount");
      endpoint.searchParams.set("limit", "12");
      const fromYear = input.evidenceWindow.from.slice(0, 4);
      const toYear = input.evidenceWindow.to.slice(0, 4);
      if (/^\d{4}$/u.test(fromYear) && /^\d{4}$/u.test(toYear)) endpoint.searchParams.set("year", `${fromYear}-${toYear}`);
      let response: Response;
      try { response = await fetcher(endpoint, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: requestSignal(signal) }); }
      catch { throw new TopicLabSourceProviderError("semantic_scholar_timeout_or_transport", 503, abortedState(signal)); }
      const value = await readJson(response, "SEMANTIC_SCHOLAR");
      if (!record(value) || !Array.isArray(value.data) || value.data.length > 12) throw new TopicLabSourceProviderError("semantic_scholar_response_invalid", 502, "INVALID_RESPONSE");
      const qHash = queryHash(input, "SEMANTIC_SCHOLAR");
      return value.data.map((item, index) => {
        if (!record(item)) throw new TopicLabSourceProviderError("semantic_scholar_item_invalid", 502, "INVALID_RESPONSE");
        const rawProviderKey = boundedText(item.paperId, 300);
        const providerKey = rawProviderKey ? digest(`SEMANTIC_SCHOLAR\0${rawProviderKey}`) : "";
        const title = boundedText(item.title, 300);
        const publishedAt = item.publicationDate === null ? null : normalizeDate(item.publicationDate);
        const externalIds = record(item.externalIds) ? item.externalIds : null;
        const doi = normalizeDoi(externalIds ? externalIds.DOI : null);
        if (!providerKey || !title || (item.publicationDate !== null && !publishedAt)) throw new TopicLabSourceProviderError("semantic_scholar_item_invalid", 502, "INVALID_RESPONSE");
        const location = doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${rawProviderKey}`;
        return { observationId: `obs_semantic_scholar_${providerKey.slice(0, 20)}`, provider: "SEMANTIC_SCHOLAR" as const, providerKey, queryHash: qHash, window: input.evidenceWindow, title, publishedAt, retrievedAt: observedAt.toISOString(), doi, citationCount: citationCount(item.citationCount), urlHash: safeLocationHash(location, doi ? `doi:${doi}` : `semantic-scholar:${providerKey}:${index}`), status: "UNVERIFIED" as const };
      });
    },
  });
}


export function createConsensusAdapter(fetcher: typeof fetch = fetch): TopicLabScholarlyAdapter {
  return Object.freeze({
    provider: "CONSENSUS" as const,
    async search(input: TopicLabAnalyzeRequest, observedAt: Date, signal?: AbortSignal) {
      const apiKey = process.env.CONSENSUS_API_KEY;
      if (!apiKey) throw new TopicLabSourceProviderError("consensus_api_key_missing", 503, "DISABLED");
      const endpoint = new URL("https://api.consensus.app/v1/search");
      endpoint.searchParams.set("query", input.researchDirection);
      endpoint.searchParams.set("limit", "12");
      const fromYear = input.evidenceWindow.from.slice(0, 4);
      const toYear = input.evidenceWindow.to.slice(0, 4);
      if (/^\d{4}$/u.test(fromYear)) endpoint.searchParams.set("year_min", fromYear);
      if (/^\d{4}$/u.test(toYear)) endpoint.searchParams.set("year_max", toYear);
      let response: Response;
      try { response = await fetcher(endpoint, { method: "GET", headers: { Accept: "application/json", "x-api-key": apiKey }, cache: "no-store", redirect: "error", signal: requestSignal(signal) }); }
      catch { throw new TopicLabSourceProviderError("consensus_timeout_or_transport", 503, abortedState(signal)); }
      const value = await readJson(response, "CONSENSUS");
      if (!record(value) || !Array.isArray(value.results) || value.results.length > 12) throw new TopicLabSourceProviderError("consensus_response_invalid", 502, "INVALID_RESPONSE");
      const qHash = queryHash(input, "CONSENSUS");
      return value.results.map((item, index) => {
        if (!record(item)) throw new TopicLabSourceProviderError("consensus_item_invalid", 502, "INVALID_RESPONSE");
        const rawProviderKey = boundedText(item.doi, 300);
        const providerKey = rawProviderKey ? digest(`CONSENSUS\0${rawProviderKey}`) : "";
        const title = boundedText(item.title, 300);
        const rawPublishedAt = item.publish_date === null || item.publish_date === undefined ? null : item.publish_date;
        const publishedAt = rawPublishedAt === null ? null : normalizeDate(rawPublishedAt);
        const doi = normalizeDoi(item.doi);
        if (!providerKey || !title || (rawPublishedAt !== null && !publishedAt)) throw new TopicLabSourceProviderError("consensus_item_invalid", 502, "INVALID_RESPONSE");
        const location = typeof item.url === "string" && item.url ? item.url : doi ? `https://doi.org/${doi}` : "";
        return { observationId: `obs_consensus_${providerKey.slice(0, 20)}`, provider: "CONSENSUS" as const, providerKey, queryHash: qHash, window: input.evidenceWindow, title, publishedAt, retrievedAt: observedAt.toISOString(), doi, citationCount: citationCount(item.citation_count), urlHash: safeLocationHash(location, doi ? `doi:${doi}` : `consensus:${providerKey}:${index}`), status: "UNVERIFIED" as const };
      });
    },
  });
}

async function manualObservations(input: TopicLabAnalyzeRequest, now: () => Date) {
  const observations: TopicLabSourceObservation[] = [];
  for (const url of input.sourceUrls) {
    try {
      const source = await readPublicWebContent(url, { now });
      observations.push({ observationId: `obs_manual_${digest(`${source.finalUrl}:${source.contentHash}`).slice(0, 20)}`, provider: "MANUAL_PUBLIC_HTTPS", providerKey: source.contentHash, queryHash: queryHash(input, "MANUAL_PUBLIC_HTTPS"), window: input.evidenceWindow, title: source.title, publishedAt: source.publishedAt || null, retrievedAt: source.retrievedAt, doi: null, citationCount: null, urlHash: digest(source.finalUrl), status: "UNVERIFIED" });
    } catch (error) {
      if (error instanceof WebContentReaderError) throw new TopicLabSourceProviderError(error.code, error.status);
      throw new TopicLabSourceProviderError("source_collection_failed", 502);
    }
  }
  return observations;
}

export async function collectTopicLabObservations(
  input: TopicLabAnalyzeRequest,
  options: {
    now?: () => Date;
    enabled?: boolean;
    adapters?: TopicLabScholarlyAdapter[];
    semanticScholarAdapter?: TopicLabScholarlyAdapter;
    signal?: AbortSignal;
    deadlineMs?: number;
  } = {},
): Promise<{ capability: TopicLabSourceCapability; observations: TopicLabSourceObservation[]; providerStates: Record<string, TopicLabProviderState> }> {
  const now = options.now || (() => new Date());
  if (input.sourceStrategy === "NONE") return { capability: "SCHOLARLY_DISABLED", observations: [], providerStates: { OPENALEX: "DISABLED", CROSSREF: "DISABLED", SEMANTIC_SCHOLAR: "DISABLED", CONSENSUS: "DISABLED" } };
  if (input.sourceStrategy === "MANUAL_PUBLIC_HTTPS") {
    if (!webResearchEnabled()) return { capability: "MANUAL_DISABLED", observations: [], providerStates: { MANUAL_PUBLIC_HTTPS: "DISABLED" } };
    const observations = await manualObservations(input, now);
    const checked = parseTopicLabObservationProviderResult({ contractVersion: "topic-lab-observation-provider/1.0.0", observations });
    return { capability: "MANUAL_PUBLIC_HTTPS", observations: checked.observations, providerStates: { MANUAL_PUBLIC_HTTPS: observations.length ? "READY" : "EMPTY" } };
  }
  const enabled = options.enabled ?? process.env.SCHOLARLY_RETRIEVAL_ENABLED === "1";
  if (!enabled) return { capability: "SCHOLARLY_DISABLED", observations: [], providerStates: { OPENALEX: "DISABLED", CROSSREF: "DISABLED", SEMANTIC_SCHOLAR: "DISABLED", CONSENSUS: "DISABLED" } };
  if (options.semanticScholarAdapter && options.semanticScholarAdapter.provider !== "SEMANTIC_SCHOLAR") {
    throw new TopicLabSourceProviderError("semantic_scholar_capability_invalid", 500, "INVALID_RESPONSE");
  }
  const adapters = options.adapters || [
    createOpenAlexAdapter(),
    createCrossrefAdapter(),
    createSemanticScholarAdapter(),
    ...(process.env.CONSENSUS_API_KEY ? [createConsensusAdapter()] : []),
    ...(options.semanticScholarAdapter ? [options.semanticScholarAdapter] : []),
  ];
  const observations: TopicLabSourceObservation[] = [];
  const providerStates: Record<string, TopicLabProviderState> = options.adapters || options.semanticScholarAdapter
    ? {}
    : { SEMANTIC_SCHOLAR: "DISABLED" };
  const deadlineMs = options.deadlineMs ?? 10_000;
  if (!Number.isInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 10_000) throw new TopicLabSourceProviderError("scholarly_deadline_invalid", 500, "INVALID_RESPONSE");
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error("scholarly_deadline")), deadlineMs);
  const combined = options.signal ? AbortSignal.any([options.signal, deadline.signal]) : deadline.signal;
  try {
    const batches = await Promise.all(adapters.map(async (adapter) => {
      const abortPromise = new Promise<never>((_, reject) => {
        if (combined.aborted) reject(new TopicLabSourceProviderError("scholarly_collection_cancelled", 503, options.signal?.aborted ? "CANCELLED" : "TIMED_OUT"));
        else combined.addEventListener("abort", () => reject(new TopicLabSourceProviderError("scholarly_collection_cancelled", 503, options.signal?.aborted ? "CANCELLED" : "TIMED_OUT")), { once: true });
      });
      try {
        const items = await Promise.race([adapter.search(input, now(), combined), abortPromise]);
        return { provider: adapter.provider, items, state: items.length ? "READY" as const : "EMPTY" as const };
      } catch (error) {
        return { provider: adapter.provider, items: [] as TopicLabSourceObservation[], state: error instanceof TopicLabSourceProviderError ? error.providerState : "UPSTREAM_ERROR" as const };
      }
    }));
    for (const batch of batches) { observations.push(...batch.items); providerStates[batch.provider] = batch.state; }
    // The provider-result contract caps merged observations at 40. When every
    // adapter responds (4 × 12 = 48) we keep the first 40 so the result stays valid.
    if (observations.length > 40) observations.length = 40;
  } finally {
    clearTimeout(timer);
  }
  const checked = parseTopicLabObservationProviderResult({ contractVersion: "topic-lab-observation-provider/1.0.0", observations });
  const ready = Object.values(providerStates).filter((state) => state === "READY").length;
  const capability: TopicLabSourceCapability = ready === adapters.length ? "SCHOLARLY_READY" : ready > 0 ? "SCHOLARLY_PARTIAL" : "SCHOLARLY_UNAVAILABLE";
  return { capability, observations: checked.observations, providerStates };
}
