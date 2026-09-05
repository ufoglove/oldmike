import { beta1CanonicalJson, beta1Hash } from "./canonical-hash.ts";
import {
  extractV2Beta1CitationIdentityAuthority,
  extractV2Beta1ClaimAuthority,
  extractV2Beta1StructuredEvidenceRecords,
  isV2Beta1EvidenceBearingRecord,
  validateV2Beta1AcademicProposition,
  validateV2Beta1RevisionEvidenceClauses,
  type V2Beta1StructuredEvidenceRecord,
} from "./evidence-anchors.ts";

export const V2_BETA1_RESEARCH_INTEGRITY_SCHEMA = "old-mike-v2-beta1/research-integrity/1" as const;

export type V2Beta1IntegrityMaterial = { kind: string; title: string; content: string };
export type V2Beta1CitationCatalog = {
  schemaId: "old-mike-v2-beta1/citation-catalog/1";
  directIdentities: string[];
  numericMarkers: string[];
  catalogHash: string;
};
export type V2Beta1IntegrityRawSpan = {
  role: "CLAUSE" | "OBSERVATION_KEY" | "EFFECT" | "QUALIFIER" | "N" | "P" | "CI" | "CITATION";
  startByte: number;
  endByte: number;
  rawHash: string;
};
export type V2Beta1IntegrityEffect = {
  name: string;
  direction: "UP" | "DOWN" | "NEUTRAL";
  value: number;
  unit: string;
  polarity: "AFFIRMED" | "NEGATED" | "QUALIFIED";
  certainty: "CERTAIN" | "QUALIFIED" | "UNKNOWN";
  qualifierSpans: string[];
};
export type V2Beta1ClaimNode = {
  claimId: string;
  segmentId: string;
  kind: "RESULT_STATE" | "EVIDENCE_CLAIM" | "CONTEXT" | "NONCLAIM" | "UNRESOLVED";
  subject: string | null;
  predicate: string | null;
  object: string | null;
  epistemicState: "OBSERVED" | "PLANNED" | "MISSING" | "CONFLICT" | "UNRESOLVED" | "CONTEXT" | "NONCLAIM";
  polarity: "AFFIRMED" | "NEGATED" | "QUALIFIED" | "NEUTRAL";
  certainty: "CERTAIN" | "QUALIFIED" | "UNKNOWN" | "NOT_APPLICABLE";
  scope: string[];
  cohort: string | null;
  timepoint: string | null;
  analysis: string | null;
  setting: string | null;
  measurement: string | null;
  effects: V2Beta1IntegrityEffect[];
  sampleSize: string[];
  probability: string[];
  confidenceInterval: string[];
  citationIdentities: string[];
  rawSpans: V2Beta1IntegrityRawSpan[];
  claimHash: string;
};
export type V2Beta1IntegritySegment = {
  segmentId: string;
  kind: "CLAIM" | "FORMAT";
  startByte: number;
  endByte: number;
  rawHash: string;
  claimId: string | null;
};
export type V2Beta1IntegrityDocument = {
  textHash: string;
  byteLength: number;
  segments: V2Beta1IntegritySegment[];
  claims: V2Beta1ClaimNode[];
  documentHash: string;
};
export type V2Beta1ResearchIntegrityGraph = {
  schemaId: typeof V2_BETA1_RESEARCH_INTEGRITY_SCHEMA;
  findingId: string;
  source: V2Beta1IntegrityDocument;
  revision: V2Beta1IntegrityDocument;
  citationCatalog: V2Beta1CitationCatalog;
  ownDataBinding: boolean;
  mappings: Array<{ sourceClaimId: string; revisionClaimId: string; semanticKey: string; mappingHash: string }>;
  resultState: "CONFLICT" | "UNRESOLVED" | "PLANNED" | "MISSING" | "OBSERVED";
  completeCoverage: boolean;
  semanticEquivalent: boolean;
  citationValid: boolean;
  proseValid: boolean;
  publicationUsable: boolean;
  graphHash: string;
};

type DocumentRole = "source" | "revision";
type GraphInput = {
  findingId: string;
  sourceText: string;
  revisionText: string;
  citationCatalog: V2Beta1CitationCatalog;
  ownDataBinding: boolean;
};

const FORMAT_ONLY = /^[\s\p{P}\p{S}]*$/u;
const CLAIM_SIGNAL = /(?:因果|導致|造成|證明|支持|不支持|顯示|指出|表明|推論|所有|普遍|確定|無疑|關聯|影響|caus(?:e|al)|prove(?:s|d)?|support(?:s|ed)?|show(?:s|ed)?|indicat(?:e|es|ed)|suggest(?:s|ed)?|all\s+populations?|univers(?:al|ally)|certain(?:ly)?|generaliz(?:e|es|ed)|association|effect)/iu;
const RESULT_SIGNAL = /(?:結果|分析|資料|數據|觀察|發現|results?|analysis|data|findings?|observed)/iu;
const MISSING_SIGNAL = /(?:待填|TBD|XXX|n\s*=\s*\?|尚未提供|missing)/iu;
const GENERALIZATION_SIGNAL = /(?:既有研究|文獻|所有|普遍|跨場域|研究顯示|literature|prior\s+stud(?:y|ies)|all\s+populations?|univers(?:al|ally)|generaliz)/iu;
const PREDICATE_SIGNAL = /(?:並?不支持|支持|顯示|指出|表明|導致|造成|證明|關聯|影響|限制|觀察|發現|可能|似乎|仍待|尚未|未完成|was|were|show(?:s|ed)?|indicat(?:e|es|ed)|support(?:s|ed)?|cause(?:s|d)?|affect(?:s|ed)?|remain(?:s|ed)?|may|might|appears?|suggests?)/iu;
const encoder = new TextEncoder();

function utf8Length(value: string) { return encoder.encode(value).length; }
function canonicalIdentity(value: string) { return value.normalize("NFKC").replace(/^doi\s*:\s*/iu, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US"); }
function unique(values: readonly string[]) { return [...new Set(values)]; }

function splitComplete(value: string) {
  const spans: Array<{ start: number; end: number; raw: string }> = [];
  let start = 0; let square = 0; let round = 0;
  for (let cursor = 0; cursor < value.length;) {
    const codePoint = value.codePointAt(cursor); if (codePoint === undefined) break;
    const char = String.fromCodePoint(codePoint); const width = char.length;
    if (char === "[" || char === "［") square += 1;
    if (char === "]" || char === "］") square = Math.max(0, square - 1);
    if (char === "(" || char === "（") round += 1;
    if (char === ")" || char === "）") round = Math.max(0, round - 1);
    const next = value[cursor + width] ?? ""; const previous = value[cursor - 1] ?? "";
    const decimal = char === "." && /\d/u.test(previous) && /\d/u.test(next);
    const boundary = square === 0 && round === 0 && !decimal && (/[。！？!?\n]/u.test(char) || (char === "." && !/[A-Za-z0-9/]/u.test(next)));
    cursor += width;
    if (boundary) { spans.push({ start, end: cursor, raw: value.slice(start, cursor) }); start = cursor; }
  }
  if (start < value.length) spans.push({ start, end: value.length, raw: value.slice(start) });
  if (!spans.length) spans.push({ start: 0, end: value.length, raw: value });
  return spans;
}

function locateRawSpans(fullText: string, segment: { start: number; raw: string }, role: V2Beta1IntegrityRawSpan["role"], values: readonly string[]) {
  const spans: V2Beta1IntegrityRawSpan[] = []; const claimed = new Set<string>();
  for (const raw of [...values].sort((a, b) => b.length - a.length)) {
    if (!raw) continue;
    let offset = segment.raw.indexOf(raw);
    while (offset >= 0 && claimed.has(`${offset}:${offset + raw.length}`)) offset = segment.raw.indexOf(raw, offset + 1);
    if (offset < 0) continue;
    claimed.add(`${offset}:${offset + raw.length}`);
    const absoluteStart = segment.start + offset; const absoluteEnd = absoluteStart + raw.length;
    spans.push({ role, startByte: utf8Length(fullText.slice(0, absoluteStart)), endByte: utf8Length(fullText.slice(0, absoluteEnd)), rawHash: beta1Hash(raw) });
  }
  return spans;
}

function semanticEffect(record: V2Beta1StructuredEvidenceRecord | null): V2Beta1IntegrityEffect[] {
  return (record?.effects ?? []).map((effect) => {
    const negated = effect.scopeSpans.some((item) => /(?:不支持|沒有|尚未|未支持|not|lacks?)/iu.test(item));
    const qualified = effect.scopeSpans.length > 0;
    return { name: effect.name, direction: effect.direction, value: effect.value, unit: effect.unit, polarity: negated ? "NEGATED" as const : qualified ? "QUALIFIED" as const : "AFFIRMED" as const, certainty: qualified ? "QUALIFIED" as const : "CERTAIN" as const, qualifierSpans: effect.scopeSpans };
  });
}

function claimNode(fullText: string, findingId: string, role: DocumentRole, segment: { start: number; end: number; raw: string }, index: number): V2Beta1ClaimNode {
  const raw = segment.raw; const trimmed = raw.trim();
  const structured = extractV2Beta1StructuredEvidenceRecords(trimmed).records.filter(isV2Beta1EvidenceBearingRecord);
  const record = structured[0] ?? null;
  const authority = extractV2Beta1ClaimAuthority(trimmed).clauses[0] ?? null;
  const unresolvedSignal = (CLAIM_SIGNAL.test(trimmed) || RESULT_SIGNAL.test(trimmed)) && (!record?.structured && authority?.resultState !== "PLANNED");
  const kind: V2Beta1ClaimNode["kind"] = unresolvedSignal || authority?.unresolved ? "UNRESOLVED" : authority?.classification ?? "NONCLAIM";
  const missing = MISSING_SIGNAL.test(trimmed);
  const epistemicState: V2Beta1ClaimNode["epistemicState"] = missing ? "MISSING" : authority?.resultState === "PLANNED" ? "PLANNED" : kind === "UNRESOLVED" ? "UNRESOLVED" : record?.structured ? "OBSERVED" : kind === "CONTEXT" ? "CONTEXT" : "NONCLAIM";
  const effects = semanticEffect(record);
  const qualifiers = unique(effects.flatMap((effect) => effect.qualifierSpans));
  const predicateMatch = trimmed.match(PREDICATE_SIGNAL); const predicate = predicateMatch?.[0] ?? (kind === "CONTEXT" ? "CONTEXT" : kind === "NONCLAIM" ? "NONCLAIM" : null);
  const predicateIndex = predicateMatch?.index ?? -1;
  const subject = record?.observationKey ? `${record.observationKey.metricId}|${record.observationKey.cohortId}|${record.observationKey.timepoint}|${record.observationKey.analysisId}` : predicateIndex > 0 ? trimmed.slice(0, predicateIndex).trim().slice(0, 240) || null : trimmed.slice(0, 240) || null;
  const object = predicateIndex >= 0 ? trimmed.slice(predicateIndex + (predicateMatch?.[0].length ?? 0)).trim().slice(0, 600) || null : null;
  const segmentId = `segment:${beta1Hash({ findingId, role, index, start: segment.start, end: segment.end, rawHash: beta1Hash(raw) }).slice(0, 40)}`;
  const startByte = utf8Length(fullText.slice(0, segment.start)); const endByte = utf8Length(fullText.slice(0, segment.end));
  const rawSpans: V2Beta1IntegrityRawSpan[] = [
    { role: "CLAUSE", startByte, endByte, rawHash: beta1Hash(raw) },
    ...locateRawSpans(fullText, segment, "OBSERVATION_KEY", record?.observationKeySpans ?? []),
    ...locateRawSpans(fullText, segment, "EFFECT", record?.effectSpans ?? []),
    ...locateRawSpans(fullText, segment, "QUALIFIER", qualifiers),
    ...locateRawSpans(fullText, segment, "N", record?.sampleSizeSpans ?? []),
    ...locateRawSpans(fullText, segment, "P", record?.probabilitySpans ?? []),
    ...locateRawSpans(fullText, segment, "CI", record?.confidenceIntervalSpans ?? []),
    ...locateRawSpans(fullText, segment, "CITATION", record?.citationSpans ?? []),
  ];
  const core = {
    claimId: `claim:${beta1Hash({ findingId, role, segmentId, rawHash: beta1Hash(raw) }).slice(0, 40)}`,
    segmentId,
    kind,
    subject,
    predicate,
    object,
    epistemicState,
    polarity: effects.some((effect) => effect.polarity === "NEGATED") ? "NEGATED" as const : effects.some((effect) => effect.polarity === "QUALIFIED") ? "QUALIFIED" as const : effects.length ? "AFFIRMED" as const : "NEUTRAL" as const,
    certainty: effects.some((effect) => effect.certainty === "QUALIFIED") ? "QUALIFIED" as const : effects.length ? "CERTAIN" as const : kind === "UNRESOLVED" ? "UNKNOWN" as const : "NOT_APPLICABLE" as const,
    scope: qualifiers,
    cohort: record?.observationKey?.cohortId ?? null,
    timepoint: record?.observationKey?.timepoint ?? null,
    analysis: record?.observationKey?.analysisId ?? null,
    setting: null,
    measurement: record?.observationKey?.metricId ?? null,
    effects,
    sampleSize: record?.sampleSizeSpans ?? [],
    probability: record?.probabilitySpans ?? [],
    confidenceInterval: record?.confidenceIntervalSpans ?? [],
    citationIdentities: record?.citationSpans ?? [],
    rawSpans,
  };
  return { ...core, claimHash: beta1Hash(core) };
}

function documentAuthority(text: string, findingId: string, role: DocumentRole): V2Beta1IntegrityDocument {
  const spans = splitComplete(text); const claims: V2Beta1ClaimNode[] = [];
  const segments = spans.map((span, index) => {
    const format = FORMAT_ONLY.test(span.raw); const startByte = utf8Length(text.slice(0, span.start)); const endByte = utf8Length(text.slice(0, span.end));
    if (format) {
      const core = { segmentId: `segment:${beta1Hash({ findingId, role, index, startByte, endByte, rawHash: beta1Hash(span.raw) }).slice(0, 40)}`, kind: "FORMAT" as const, startByte, endByte, rawHash: beta1Hash(span.raw), claimId: null };
      return core;
    }
    const claim = claimNode(text, findingId, role, span, index); claims.push(claim);
    return { segmentId: claim.segmentId, kind: "CLAIM" as const, startByte, endByte, rawHash: beta1Hash(span.raw), claimId: claim.claimId };
  });
  const core = { textHash: beta1Hash(text), byteLength: utf8Length(text), segments, claims };
  return { ...core, documentHash: beta1Hash(core) };
}

function semanticKey(claim: V2Beta1ClaimNode) {
  return beta1Hash({ kind: claim.kind, epistemicState: claim.epistemicState, polarity: claim.polarity, certainty: claim.certainty, scope: claim.scope, cohort: claim.cohort, timepoint: claim.timepoint, analysis: claim.analysis, measurement: claim.measurement, effects: claim.effects, sampleSize: claim.sampleSize, probability: claim.probability, confidenceInterval: claim.confidenceInterval, citationIdentities: claim.citationIdentities });
}

function citationBindingValid(source: V2Beta1IntegrityDocument, catalog: V2Beta1CitationCatalog, ownDataBinding: boolean) {
  const direct = new Set(catalog.directIdentities.map(canonicalIdentity)); const numeric = new Set(catalog.numericMarkers);
  for (const claim of source.claims.filter((item) => item.kind === "EVIDENCE_CLAIM" || item.kind === "RESULT_STATE")) {
    const identities = claim.citationIdentities;
    const bound = identities.some((item) => /^\s*\[/u.test(item) ? numeric.has(item.normalize("NFKC")) : direct.has(canonicalIdentity(item)));
    const ownResult = ownDataBinding && claim.epistemicState === "OBSERVED";
    const generalization = GENERALIZATION_SIGNAL.test(`${claim.subject ?? ""} ${claim.predicate ?? ""} ${claim.object ?? ""}`);
    if ((!ownResult || generalization) && !bound) return false;
  }
  return true;
}

function conflictDetected(document: V2Beta1IntegrityDocument) {
  const groups = new Map<string, Set<string>>();
  for (const claim of document.claims.filter((item) => item.effects.length > 0 && item.measurement && item.cohort && item.timepoint && item.analysis)) {
    const key = `${claim.measurement}|${claim.cohort}|${claim.timepoint}|${claim.analysis}`;
    groups.set(key, new Set([...(groups.get(key) ?? []), beta1CanonicalJson({ effects: claim.effects, probability: claim.probability, confidenceInterval: claim.confidenceInterval })]));
  }
  return [...groups.values()].some((values) => values.size > 1);
}

function deriveResultState(source: V2Beta1IntegrityDocument): V2Beta1ResearchIntegrityGraph["resultState"] {
  if (conflictDetected(source)) return "CONFLICT";
  if (source.claims.some((claim) => claim.epistemicState === "UNRESOLVED")) return "UNRESOLVED";
  if (source.claims.some((claim) => claim.epistemicState === "PLANNED")) return "PLANNED";
  if (source.claims.some((claim) => claim.epistemicState === "MISSING") || !source.claims.some((claim) => claim.epistemicState === "OBSERVED")) return "MISSING";
  return "OBSERVED";
}

export function createV2Beta1CitationCatalog(materials: readonly V2Beta1IntegrityMaterial[]): V2Beta1CitationCatalog {
  const direct = new Set<string>(); const numeric = new Set<string>();
  for (const material of materials.filter((item) => item.kind === "CITATION")) {
    const text = `${material.title}\n${material.content}`; const authority = extractV2Beta1CitationIdentityAuthority(text);
    const durableIdentities = authority.directIdentities.filter((identity) => /(?:10\.\d{4,9}\/|arXiv\s*:)/iu.test(identity) || text.replace(identity, "").replace(/[\s\p{P}\p{S}\d]/gu, "").length >= 8);
    for (const identity of durableIdentities) direct.add(canonicalIdentity(identity));
    if (durableIdentities.length) for (const marker of authority.numericMarkers) numeric.add(marker.normalize("NFKC"));
  }
  const core = { schemaId: "old-mike-v2-beta1/citation-catalog/1" as const, directIdentities: [...direct].sort(), numericMarkers: [...numeric].sort() };
  return { ...core, catalogHash: beta1Hash(core) };
}

export function createV2Beta1ResearchIntegrityGraph(input: GraphInput): V2Beta1ResearchIntegrityGraph {
  const source = documentAuthority(input.sourceText, input.findingId, "source");
  const revision = documentAuthority(input.revisionText, input.findingId, "revision");
  const sourceClaims = source.claims.filter((claim) => claim.kind === "EVIDENCE_CLAIM" || claim.kind === "RESULT_STATE");
  const revisionClaims = revision.claims.filter((claim) => claim.kind === "EVIDENCE_CLAIM" || claim.kind === "RESULT_STATE");
  const available = [...revisionClaims]; const mappings: V2Beta1ResearchIntegrityGraph["mappings"] = [];
  for (const sourceClaim of sourceClaims) {
    const sourceKey = semanticKey(sourceClaim); const matches = available.map((claim, index) => ({ claim, index })).filter(({ claim }) => semanticKey(claim) === sourceKey);
    if (matches.length !== 1) continue;
    const [{ claim, index }] = matches; available.splice(index, 1);
    const mappingCore = { sourceClaimId: sourceClaim.claimId, revisionClaimId: claim.claimId, semanticKey: sourceKey };
    mappings.push({ ...mappingCore, mappingHash: beta1Hash(mappingCore) });
  }
  const completeCoverage = source.segments.length > 0 && revision.segments.length > 0 && source.segments.every((segment, index) => segment.startByte === (index === 0 ? 0 : source.segments[index - 1].endByte)) && revision.segments.every((segment, index) => segment.startByte === (index === 0 ? 0 : revision.segments[index - 1].endByte)) && source.segments.at(-1)?.endByte === source.byteLength && revision.segments.at(-1)?.endByte === revision.byteLength && source.segments.filter((item) => item.kind === "CLAIM").length === source.claims.length && revision.segments.filter((item) => item.kind === "CLAIM").length === revision.claims.length;
  const noOrphans = mappings.length === sourceClaims.length && mappings.length === revisionClaims.length && available.length === 0;
  const semanticEquivalent = noOrphans && validateV2Beta1RevisionEvidenceClauses(input.sourceText, input.revisionText);
  const citationValid = citationBindingValid(source, input.citationCatalog, input.ownDataBinding);
  const proseValid = validateV2Beta1AcademicProposition(input.revisionText);
  const resultState = deriveResultState(source);
  const publicationUsable = completeCoverage && semanticEquivalent && citationValid && proseValid && resultState === "OBSERVED" && !revision.claims.some((claim) => claim.kind === "UNRESOLVED");
  const core = { schemaId: V2_BETA1_RESEARCH_INTEGRITY_SCHEMA, findingId: input.findingId, source, revision, citationCatalog: input.citationCatalog, ownDataBinding: input.ownDataBinding, mappings, resultState, completeCoverage, semanticEquivalent, citationValid, proseValid, publicationUsable };
  return { ...core, graphHash: beta1Hash(core) };
}

export function validateV2Beta1ResearchIntegrityGraph(value: unknown, input: GraphInput) {
  const expected = createV2Beta1ResearchIntegrityGraph(input);
  return beta1CanonicalJson(value) === beta1CanonicalJson(expected);
}
