import { beta1CanonicalJson, beta1Hash } from "./canonical-hash.ts";

export type V2Beta1ProbabilityClaim = { comparator: "<" | "<=" | "=" | ">" | ">="; value: number; raw: string };
export type V2Beta1ObservationKey = { metricId: string; cohortId: string; timepoint: string; analysisId: string };
export type V2Beta1StructuredEffect = { name: string; direction: "UP" | "DOWN" | "NEUTRAL"; value: number; unit: string; raw: string; scopeSpans: string[] };
export type V2Beta1StructuredEvidenceRecord = {
  raw: string;
  structured: boolean;
  observationKey: V2Beta1ObservationKey | null;
  observationKeySpans: string[];
  effects: V2Beta1StructuredEffect[];
  effectSpans: string[];
  scopeSpans: string[];
  sampleSizeSpans: string[];
  probabilitySpans: string[];
  confidenceIntervalSpans: string[];
  citationSpans: string[];
  rawAnchors: string[];
  recordHash: string;
};
export type V2Beta1StructuredEvidenceAuthority = { records: V2Beta1StructuredEvidenceRecord[]; rawAnchors: string[]; probabilityClaims: V2Beta1ProbabilityClaim[] };
export type V2Beta1EvidenceClause = { raw: string; observationKeySpans: string[]; effectSpans: string[]; scopeSpans: string[]; rawAnchors: string[] };
export type V2Beta1EvidenceClauseAuthority = { clauses: V2Beta1EvidenceClause[]; rawAnchors: string[]; probabilityClaims: V2Beta1ProbabilityClaim[] };
export type V2Beta1CitationIdentityAuthority = { directIdentities: string[]; numericMarkers: string[]; allSpans: string[] };
export type V2Beta1ClauseClass = "RESULT_STATE" | "EVIDENCE_CLAIM" | "CONTEXT" | "NONCLAIM";
export type V2Beta1ClauseResultState = "PLANNED" | "OBSERVED" | "MISSING" | "UNRESOLVED" | null;
export type V2Beta1ResultProposition = { raw: string; startByte: number; endByte: number; structuredContextRaw: string | null; resultState: V2Beta1ClauseResultState };
export type V2Beta1ResultStateReduction = {
  resultState: "CONFLICT" | "OBSERVED" | "PLANNED" | "MISSING";
  hasObserved: boolean;
  hasPlanned: boolean;
  hasMissing: boolean;
  hasUnresolved: boolean;
};
export type V2Beta1EvidenceClaimIR = {
  observationKey: V2Beta1ObservationKey | null;
  effects: V2Beta1StructuredEffect[];
  polarity: "NEGATED" | "AFFIRMED" | "QUALIFIED";
  qualifierSpans: string[];
  citationIdentities: string[];
  rawSpanCommitment: string;
  claimIdentity: string;
};
export type V2Beta1ClauseIR = {
  raw: string;
  classification: V2Beta1ClauseClass;
  resultState: V2Beta1ClauseResultState;
  unresolved: boolean;
  claim: V2Beta1EvidenceClaimIR | null;
  clauseHash: string;
};
export type V2Beta1ClaimAuthority = { clauses: V2Beta1ClauseIR[]; authorityHash: string };
export const V2_BETA1_REVISION_EXACT_KEYS = ["revisionId", "strategy", "text", "rationale", "risk", "recommended", "researchIntegrity", "revisionHash"] as const;

export function hasV2Beta1ExactRevisionKeys(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return beta1CanonicalJson(keys) === beta1CanonicalJson([...V2_BETA1_REVISION_EXACT_KEYS].sort());
}

const OBSERVATION_KEY = /(?:metricId|cohortId|timepoint|analysisId|指標ID|群組ID|時間點|分析ID)\s*[:=]\s*[\p{L}\p{N}._-]+/giu;
const EFFECT_UNIT = String.raw`(?:%|％|ms|s|sec(?:onds?)?|kg|g|mg|[µμ]g|m|cm|mm|km|kWh|W|MW|分|點|秒|分鐘|小時|days?|hours?|minutes?|points?)`;
const NAMED_EFFECT = new RegExp(String.raw`(?:β|\b(?:OR|RR|HR)|\bCohen(?:['’]s)?\s+d|\bHedges(?:['’]s)?\s+g)\s*=\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*${EFFECT_UNIT})?`, "giu");
const NARRATIVE_EFFECT = new RegExp(String.raw`[\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9 _-]{1,40}?(?:增加|提升|上升|下降|降低|減少|高於|低於|increase(?:d)?|improve(?:d)?|decrease(?:d)?|higher|lower|為|was|were)\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)\s*${EFFECT_UNIT}?`, "giu");
const OBSERVED_AT_EFFECT = new RegExp(String.raw`[\p{L}][\p{L}\p{N} _-]{1,40}?\s+(?:was|were)\s+observed\s+at\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:${EFFECT_UNIT})`, "giu");
const SAMPLE_SIZE = /(?:^|(?<=[^\p{L}\p{N}_]))[Nn]\s*=\s*\d+/giu;
const P_VALUE = /p\s*(?:<=|>=|[<>=≤≥])\s*(?:0?\.\d+|1(?:\.0+)?)/giu;
const CONFIDENCE_INTERVAL = /(?:(?:\d{1,3}(?:\.\d+)?\s*%\s*)?(?:CI|confidence\s+interval|信賴區間|置信區間)|區間)\s*[:：]?\s*[\[(]\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)\s*[,，]\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)\s*[\])]/giu;
const DOI = /(?:https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/[-._;()/:A-Z0-9]+/giu;
const ARXIV = /(?:arXiv\s*:\s*)\d{4}\.\d{4,5}(?:v\d+)?/giu;
const BRACKET_CITATION = /\[[0-9]+(?:\s*[-,]\s*[0-9]+)*\]/gu;
const WESTERN_AUTHOR_YEAR = /\b[A-Z][A-Za-z'’.-]+(?:\s+(?:et\s+al\.|and\s+[A-Z][A-Za-z'’.-]+))?\s*\((?:19|20)\d{2}\)/gu;
const CJK_AUTHOR_YEAR = /[\p{Script=Han}]{1,18}(?:等)?\s*\((?:19|20)\d{2}\)/gu;
const PARENTHETICAL_CITATION = /\((?:[A-Z][A-Za-z'’.-]+|[\p{Script=Han}]{1,18})(?:[^()\r\n]{0,72}?)(?:19|20)\d{2}\)/gu;
const NEGATION_SCOPE = /(?:結果|觀察|effect|association)?(?:並?不支持|未支持|不顯著|未顯著|沒有|無法|不能|並?未|尚未|缺乏證據|not\s+support(?:ed)?|did\s+not|was\s+not|were\s+not|lacks?\s+(?:evidence|support)|does\s+not\s+support)[^，,；;。.!！？]{0,48}/giu;
const UNCERTAINTY_SCOPE = /(?:結果|觀察|effect|association)?(?:可能|或許|推測|謹慎|仍須|似乎|顯示可能|may|might|could|possibly|unlikely|appears?(?:\s+to\s+be)?|suggests?)[^，,；;。.!！？]{0,40}/giu;
const CLAIM_SIGNAL = /(?:因果|導致|造成|證明|支持|不支持|顯示|指出|表明|推論|所有族群|普遍|確定|無疑|caus(?:e|al)|prove(?:s|d)?|support(?:s|ed)?|show(?:s|ed)?|indicat(?:e|es|ed)|suggest(?:s|ed)?|all\s+populations?|univers(?:al|ally)|certain(?:ly)?|generaliz(?:e|es|ed))/iu;
const CONTEXT_SIGNAL = /(?:研究背景|情境|場域|研究範圍|background|context|setting|scope)/iu;
const RESULT_SUBJECT = /(?:研究結果|結果|主要指標|指標|樣本|信賴區間|置信區間|\bCI\b|統計分析|資料分析|數據分析|分析結果|分析|資料蒐集|數據蒐集|資料|數據|statistical\s+analysis|confidence\s+interval|sample|preliminary\s+(?:analysis|results?)|analysis|results?|findings?|data\s+(?:analysis|collection))/iu;
const OBSERVED_PREDICATE = /(?:實際(?:觀察|測得)|目前(?:觀察|測得)|已觀察|觀察到|觀察值|結果顯示|結果指出|分析完成|\b(?:observed|measured|found|showed|completed)\b)/iu;
const ENGLISH_PROCESS_PENDING = /(?:will\s+(?:test|analy[sz]e|collect|examine|evaluate)|pending\s+(?:analysis|results?|completion)|not\s+yet\s+(?:observed|analy[sz]ed|completed)|results?\s+remain(?:s)?\s+pending|analysis\s+remain(?:s)?\s+pending|in\s+progress|incomplete|ongoing|awaiting(?:\s+completion)?|to\s+be\s+(?:analy[sz]ed|completed)|has\s+yet\s+to\s+be\s+completed|will\s+be\s+analy[sz]ed|scheduled\s+(?:for|to)[^.?!]{0,32}(?:analysis|completion)|preliminary[^.?!]{0,24}pending)/iu;
const ENGLISH_RESIDUAL_PLANNING = /(?:expected\s+(?:improvement|results?|effects?|increase|decrease|change)|planned\s+results?|future\s+stud(?:y|ies))/iu;
const CHINESE_PENDING = /(?:預期(?:提升|改善|增加|下降|結果\s*(?:顯示|指出|為|達))|預計\s*(?:[Nn]\s*=|\d|樣本|結果|指標|完成|蒐集|分析|達)|將\s*(?:檢驗|分析|蒐集|收集|測試|評估)|擬\s*(?:檢驗|分析|蒐集|收集|測試|評估)|尚待(?:分析|完成|蒐集|收集)|尚未完成|仍待(?:正式)?分析|仍待完成|仍未完成|未完成|待蒐集|待收集|待分析|待完成|尚在進行|仍在進行|正在進行|蒐集中|正在蒐集|尚在蒐集|九月[^。！？]{0,20}完成[^。！？]{0,12}分析|完成[^。！？]{0,12}分析[^。！？]{0,12}(?:尚待|預計)|初步結果[^。！？]{0,20}(?:仍待|待完成|待分析))/iu;
const EXPECTED_RESULT_PENDING = /(?:預期結果\s*(?:顯示|指出|為|達)|(?:本研究)?目標(?:值)?\s*(?:為|達)|主要指標\s*預計(?:為|達)?)/iu;
const LEGITIMATE_OBSERVED_CONTROL = /(?:預期結果與實際觀察一致|未完成作業組|預期焦慮量表)/u;
const STRUCTURED_OBSERVATION_FIELD = /(?:metricId|cohortId|timepoint|analysisId|指標ID|群組ID|時間點|分析ID)\s*[:=：]\s*[\p{L}\p{N}._-]+/iu;
const STRUCTURED_METADATA_SEGMENT = /^(?:metricId|cohortId|timepoint|analysisId|指標ID|群組ID|時間點|分析ID)\s*[:=]\s*[\p{L}\p{N}._-]+$/iu;
const ENGLISH_OBSERVATION_SUBJECT = /\b(?:(no)\s+)?(?:the\s+)?(?:statistical\s+analysis|data\s+analysis|results?|findings?|analysis|analyses)\b/iu;
const ENGLISH_NEGATIVE_MODIFIERS = new Set(["independently", "directly", "empirically", "formally", "reliably", "statistically", "robustly", "externally", "conclusively"]);
const FIXED_MISSING_MARKER = /(?:待整理|待填|尚未提供|稍後補|\bmissing\b|\bTBD\b|\bXXX\b|[<〈][^>〉]+[>〉])/iu;
const ISOLATED_UNKNOWN = /(?:^|[\s:：=])(?:\?|？)(?=$|[\s；;，,.。])/u;
const UNKNOWN_SAMPLE = /(?:^|[^\p{L}\p{N}_])[Nn]\s*=\s*(?:(?:\?|待填|TBD|XXX)(?=$|[\s；;，,.。])|(?=$|[；;，,.。]))/iu;

type MappedText = { normalized: string; starts: number[]; ends: number[] };
type MappedMatch = { raw: string; normalized: string; index: number; end: number };

function normalizeMapped(value: string): MappedText {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const raw = String.fromCodePoint(codePoint);
    const mapped = raw.normalize("NFKC").replace(/[‐‑‒–—−]/gu, "-");
    normalized += mapped;
    for (let offset = 0; offset < mapped.length; offset += 1) {
      starts.push(index);
      ends.push(index + raw.length);
    }
    index += raw.length;
  }
  return { normalized, starts, ends };
}

function collectMapped(value: string, pattern: RegExp): MappedMatch[] {
  const mapped = normalizeMapped(value);
  return [...mapped.normalized.matchAll(pattern)].map((match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const rawStart = mapped.starts[start] ?? 0;
    const rawEnd = mapped.ends[Math.max(start, end - 1)] ?? rawStart;
    return { raw: value.slice(rawStart, rawEnd).trim(), normalized: match[0].trim(), index: rawStart, end: rawEnd };
  }).filter((item) => item.raw.length > 0);
}

function uniqueLongest(values: readonly string[]) {
  const sorted = [...new Set(values)].sort((a, b) => b.length - a.length);
  return sorted.filter((value, index) => !sorted.slice(0, index).some((other) => other.includes(value)));
}

function utf8Bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function splitContrastRanges(value: string, start: number, end: number) {
  const ranges: Array<{ start: number; end: number }> = [];
  const source = value.slice(start, end);
  const matches = [...source.matchAll(/然而|但|\bhowever\b|\bbut\b/giu)];
  let rangeStart = start;
  for (const match of matches) {
    const relative = match.index ?? 0;
    const absolute = start + relative;
    if (absolute <= rangeStart) continue;
    if (match[0] === "但" && value[absolute - 1] === "不") continue;
    if (match[0].toLocaleLowerCase("en-US") === "but" && /\bnot\s+only\b[^.?!；;]{0,64}$/iu.test(value.slice(rangeStart, absolute))) continue;
    const before = value.slice(rangeStart, absolute).trim();
    const after = value.slice(absolute, end).trim();
    if (!before || !after) continue;
    ranges.push({ start: rangeStart, end: absolute });
    rangeStart = absolute;
  }
  ranges.push({ start: rangeStart, end });
  return ranges;
}

function splitIndependentEnglishCoordinateRanges(value: string, start: number, end: number) {
  const ranges: Array<{ start: number; end: number }> = [];
  const source = value.slice(start, end);
  const matches = [...source.matchAll(/\band\b/giu)];
  const hasObservation = (text: string) => /\b(?:observed|unobserved)\b/iu.test(text);
  const hasFinitePredicate = (text: string) => /\b(?:is|are|was|were|has|have|had|can|cannot|could|may|might|will|would|should|remain|remains|remained|emerge|emerges|emerged|show|shows|showed|indicate|indicates|indicated|establish|establishes|established|confirm|confirms|confirmed)\b/iu.test(text);
  let rangeStart = start;
  for (const match of matches) {
    const conjunctionStart = start + (match.index ?? 0);
    const conjunctionEnd = conjunctionStart + match[0].length;
    const before = value.slice(rangeStart, conjunctionStart).trim();
    const after = value.slice(conjunctionEnd, end).trim();
    if (!before || !after || !hasObservation(before) || !hasObservation(after) || !hasFinitePredicate(before) || !hasFinitePredicate(after)) continue;
    ranges.push({ start: rangeStart, end: conjunctionStart });
    rangeStart = conjunctionEnd;
  }
  ranges.push({ start: rangeStart, end });
  return ranges;
}

function normalizeEnglishPredicate(value: string) {
  return value.normalize("NFKC").replace(/[‐‑‒–—−]/gu, "-").replace(/’/gu, "'").toLocaleLowerCase("en-US")
    .replace(/\bhas(?:n't|nt)\b/gu, "has not")
    .replace(/\bhave(?:n't|nt)\b/gu, "have not")
    .replace(/\bhad(?:n't|nt)\b/gu, "had not")
    .replace(/\bis(?:n't|nt)\b/gu, "is not")
    .replace(/\bare(?:n't|nt)\b/gu, "are not")
    .replace(/\bwas(?:n't|nt)\b/gu, "was not")
    .replace(/\bwere(?:n't|nt)\b/gu, "were not")
    .replace(/\bdo(?:n't|nt)\b/gu, "do not")
    .replace(/\bdoes(?:n't|nt)\b/gu, "does not")
    .replace(/\bdid(?:n't|nt)\b/gu, "did not")
    .replace(/\bcould(?:n't|nt)\b/gu, "could not")
    .replace(/\bshould(?:n't|nt)\b/gu, "should not")
    .replace(/\bwould(?:n't|nt)\b/gu, "would not")
    .replace(/\bwo(?:n't|nt)\b/gu, "will not")
    .replace(/\bca(?:n't|nt)\b/gu, "cannot");
}

function boundedObservedEnd(words: readonly string[], start: number) {
  if (words[start] === "observed") return start + 1;
  if (!ENGLISH_NEGATIVE_MODIFIERS.has(words[start] ?? "")) return null;
  if (words[start + 1] === "observed") return start + 2;
  if (words[start + 1] === "and" && ENGLISH_NEGATIVE_MODIFIERS.has(words[start + 2] ?? "") && words[start + 3] === "observed") return start + 4;
  return null;
}

type EnglishEvidenceToken = { word: string; start: number; end: number };
type EnglishEvidenceRelationState = "ABSENT" | "AMBIGUOUS_NEGATION" | "PRESENT";
type V2Beta1EvidenceRelationSpan = { start: number; end: number };
type EnglishEvidenceRelation = {
  targetId: string;
  state: EnglishEvidenceRelationState;
  polarity: "NEGATIVE" | "AMBIGUOUS" | "POSITIVE";
  modality: "ASSERTED" | "MODAL" | "CONDITIONAL" | "HYPOTHETICAL";
  embedding: "MAIN" | "ASSERTIVE_REPORT" | "NEGATED_REPORT" | "RELATIVE" | "NOMINAL";
  subjectSpan: V2Beta1EvidenceRelationSpan | null;
  modifierSpan: V2Beta1EvidenceRelationSpan | null;
  auxiliaryChain: string[];
  reportingPredicate: string | null;
  complementSpan: V2Beta1EvidenceRelationSpan | null;
  targetObservation: { start: number; end: number; polarity: "NEGATED" | "PRESENT" | "AMBIGUOUS" } | null;
  scope: V2Beta1EvidenceRelationSpan;
  start: number;
  end: number;
};

export type V2Beta1EvidenceTargetRelation = {
  targetId: string;
  kind: "BOUND" | "INCOMPLETE";
  operatorKind: "ABSENCE" | "PRESENCE" | "AMBIGUOUS";
  scope: V2Beta1EvidenceRelationSpan;
  observationTarget: EnglishEvidenceRelation["targetObservation"];
  composedPolarity: "ABSENT" | "PRESENT" | null;
};

type EnglishEvidenceRelationAuthority = Partial<Pick<EnglishEvidenceRelation,
  "modality" | "embedding" | "subjectSpan" | "modifierSpan" | "auxiliaryChain" | "reportingPredicate" | "complementSpan" | "targetObservation" | "scope"
>>;

export type V2Beta1EvidenceRelationIR =
  | { kind: "NO_RELATION"; targets: V2Beta1EvidenceTargetRelation[] }
  | {
    kind: "BOUND";
    targetId: string;
    targets: V2Beta1EvidenceTargetRelation[];
    subjectSpan: V2Beta1EvidenceRelationSpan | null;
    modifierSpan: V2Beta1EvidenceRelationSpan | null;
    auxiliaryOperatorChain: string[];
    reportingOrContradictionPredicate: { value: string; span: V2Beta1EvidenceRelationSpan } | null;
    complementSpan: V2Beta1EvidenceRelationSpan | null;
    observationTarget: EnglishEvidenceRelation["targetObservation"];
    scope: V2Beta1EvidenceRelationSpan;
    composedPolarity: "ABSENT" | "PRESENT";
  }
  | {
    kind: "INCOMPLETE";
    targetId: string;
    targets: V2Beta1EvidenceTargetRelation[];
    subjectSpan: V2Beta1EvidenceRelationSpan | null;
    modifierSpan: V2Beta1EvidenceRelationSpan | null;
    auxiliaryOperatorChain: string[];
    reportingOrContradictionPredicate: { value: string; span: V2Beta1EvidenceRelationSpan } | null;
    complementSpan: V2Beta1EvidenceRelationSpan | null;
    observationTarget: EnglishEvidenceRelation["targetObservation"];
    scope: V2Beta1EvidenceRelationSpan;
    reason: "NEGATIVE_GOVERNOR_TARGET_INCOMPLETE";
  };

function tokenizeEnglishEvidenceRelations(value: string): EnglishEvidenceToken[] {
  const normalized = normalizeEnglishPredicate(value);
  return [...normalized.matchAll(/\b[a-z]+\b/gu)].map((match) => ({ word: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }));
}

export function deriveV2Beta1EvidenceRelationIR(value: string): V2Beta1EvidenceRelationIR {
  const normalizedValue = normalizeEnglishPredicate(value);
  const tokens = tokenizeEnglishEvidenceRelations(value);
  const word = (index: number) => tokens[index]?.word ?? "";
  const evidenceHeads = new Set(["evidence", "support", "finding", "findings", "result", "results"]);
  const existentialAuxiliaries = new Set(["is", "are", "was", "were"]);
  const observationAuxiliaries = new Set(["is", "are", "was", "were", "has", "have", "had"]);
  const lackPredicates = new Set(["lack", "lacks", "lacked", "lacking"]);
  const relationCopulas = new Set(["is", "are", "was", "were", "remain", "remains", "remained"]);
  const absentComplements = new Set(["absent", "unavailable", "missing", "lacking", "unobserved"]);
  const presentComplements = new Set(["available", "present"]);
  const availabilityModifiers = new Set([...ENGLISH_NEGATIVE_MODIFIERS, "currently"]);
  const nominalAbsenceHeads = new Set(["absence", "lack"]);
  const nominalAffirmedPredicates = new Set(["remain", "remains", "remained", "persist", "persists", "persisted"]);
  const nominalDocumentPredicates = new Set(["documented", "reported", "noted"]);
  const reportingPredicates = new Set(["show", "shows", "showed", "shown", "demonstrate", "demonstrates", "demonstrated", "indicate", "indicates", "indicated", "report", "reports", "reported", "note", "notes", "noted", "document", "documents", "documented", "confirm", "confirms", "confirmed", "establish", "establishes", "established"]);
  const evidenceRelationModifiers = new Set([...ENGLISH_NEGATIVE_MODIFIERS, "direct", "sufficient", "empirical"]);
  const activeNegativeAuxiliaries = new Set(["do", "does", "did", "can", "could", "will", "would", "should", "may", "might"]);
  const passiveReportingPredicates = new Set(["demonstrated", "shown", "indicated", "reported", "confirmed", "established", "documented", "noted"]);
  const insufficientConclusions = new Set(["conclude", "concludes", "concluded", "infer", "infers", "inferred", "demonstrate", "demonstrates", "demonstrated", "establish", "establishes", "established"]);
  const hypothesisPredicates = new Set(["hypothesize", "hypothesizes", "hypothesized", "hypothesise", "hypothesises", "hypothesised"]);
  const openNegativeQuantifiers = new Set(["little", "scant", "hardly", "scarcely"]);
  const emergencePredicates = new Set(["emerge", "emerges", "emerged", "appear", "appears", "appeared"]);
  const contrastBoundaries = new Set(["but", "however", "although", "though", "whereas", "while"]);
  const modalGovernors = new Set(["may", "might", "could", "should", "would"]);
  const relations: EnglishEvidenceRelation[] = [];
  const ambiguousScopes: Array<{ start: number; end: number; modality: EnglishEvidenceRelation["modality"]; embedding: EnglishEvidenceRelation["embedding"] }> = [];

  const recordRelation = (
    state: EnglishEvidenceRelationState,
    startIndex: number,
    endIndex: number,
    authority: EnglishEvidenceRelationAuthority = {},
  ) => {
    const containing = ambiguousScopes.find((scope) => startIndex >= scope.start && endIndex <= scope.end);
    const effectiveState = containing && state !== "AMBIGUOUS_NEGATION" ? "AMBIGUOUS_NEGATION" : state;
    const start = tokens[Math.max(0, startIndex)]?.start ?? 0;
    const end = tokens[Math.max(startIndex, endIndex - 1)]?.end ?? start;
    const observedToken = tokens.find((token) => token.word === "observed" && token.start >= start && token.end <= end);
    const declaredTargetIsObserved = authority.targetObservation
      ? normalizedValue.slice(authority.targetObservation.start, authority.targetObservation.end) === "observed"
      : false;
    const targetSpan = declaredTargetIsObserved ? authority.targetObservation! : (observedToken
      ? { start: observedToken.start, end: observedToken.end, polarity: effectiveState === "ABSENT" ? "NEGATED" as const : effectiveState === "PRESENT" ? "PRESENT" as const : "AMBIGUOUS" as const }
      : { start, end, polarity: effectiveState === "ABSENT" ? "NEGATED" as const : effectiveState === "PRESENT" ? "PRESENT" as const : "AMBIGUOUS" as const });
    relations.push({
      targetId: `observation:${targetSpan.start}:${targetSpan.end}`,
      state: effectiveState,
      polarity: effectiveState === "ABSENT" ? "NEGATIVE" : effectiveState === "PRESENT" ? "POSITIVE" : "AMBIGUOUS",
      modality: containing?.modality ?? authority.modality ?? "ASSERTED",
      embedding: containing?.embedding ?? authority.embedding ?? "MAIN",
      subjectSpan: authority.subjectSpan ?? null,
      modifierSpan: authority.modifierSpan ?? null,
      auxiliaryChain: authority.auxiliaryChain ?? [],
      reportingPredicate: authority.reportingPredicate ?? null,
      complementSpan: authority.complementSpan ?? null,
      targetObservation: authority.targetObservation ?? null,
      scope: authority.scope ?? { start, end },
      start,
      end,
    });
  };

  const recordAmbiguousScope = (start: number, end: number, modality: EnglishEvidenceRelation["modality"], embedding: EnglishEvidenceRelation["embedding"]) => {
    ambiguousScopes.push({ start, end, modality, embedding });
    recordRelation("AMBIGUOUS_NEGATION", start, end, { modality, embedding });
  };

  const observedWithModifiers = (start: number, allowUnjoinedSecond = true) => {
    let cursor = start;
    let modifierCount = 0;
    let nextModifierJoined = true;
    let hasUnjoinedModifier = false;
    while (ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor))) {
      if (modifierCount > 0 && !nextModifierJoined) hasUnjoinedModifier = true;
      cursor += 1;
      modifierCount += 1;
      if (word(cursor) === "and" && ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor + 1))) {
        cursor += 1;
        nextModifierJoined = true;
      } else {
        nextModifierJoined = false;
      }
    }
    if (word(cursor) === "observed") return { relation: modifierCount <= 2 && (allowUnjoinedSecond || !hasUnjoinedModifier) ? "MATCH" as const : "AMBIGUOUS" as const, observedIndex: cursor, nextIndex: cursor + 1 };
    const boundedObservedIndex = [0, 1, 2, 3, 4].map((offset) => cursor + offset).find((index) => word(index) === "observed");
    return boundedObservedIndex === undefined ? null : { relation: "AMBIGUOUS" as const, observedIndex: boundedObservedIndex, nextIndex: boundedObservedIndex + 1 };
  };

  const recordObservedHead = (parsed: ReturnType<typeof observedWithModifiers>, authority: EnglishEvidenceRelationAuthority = {}) => {
    if (!parsed || !evidenceHeads.has(word(parsed.nextIndex))) return false;
    recordRelation(parsed.relation === "MATCH" ? "ABSENT" : "AMBIGUOUS_NEGATION", parsed.observedIndex, parsed.nextIndex + 1, authority);
    return true;
  };

  const localRelationEnd = (start: number) => {
    for (let cursor = start; cursor < tokens.length; cursor += 1) if (contrastBoundaries.has(word(cursor))) return cursor;
    return tokens.length;
  };

  const tokenSpan = (startIndex: number, endIndex: number) => ({
    start: tokens[Math.max(0, startIndex)]?.start ?? 0,
    end: tokens[Math.max(startIndex, endIndex - 1)]?.end ?? tokens[Math.max(0, startIndex)]?.start ?? 0,
  });

  const relationBoundaryWords = new Set([...contrastBoundaries, "and", "or", "if", "whether", "that", "which"]);
  const boundedSubjectBefore = (predicateIndex: number) => {
    if (predicateIndex < 1) return null;
    let start = Math.max(0, predicateIndex - 8);
    for (let cursor = predicateIndex - 1; cursor >= start; cursor -= 1) {
      const punctuation = normalizedValue.slice(tokens[cursor]?.end ?? 0, tokens[cursor + 1]?.start ?? 0);
      if (/[.;!?]/u.test(punctuation) || relationBoundaryWords.has(word(cursor))) {
        start = cursor + 1;
        break;
      }
    }
    while (["a", "an", "the"].includes(word(start)) && start + 1 < predicateIndex) start += 1;
    if (start >= predicateIndex) return null;
    const terminal = word(predicateIndex - 1);
    if (!terminal || relationBoundaryWords.has(terminal) || activeNegativeAuxiliaries.has(terminal) || observationAuxiliaries.has(terminal)) return null;
    return { start, end: predicateIndex, span: tokenSpan(start, predicateIndex) };
  };

  const observedEvidenceHead = (start: number) => {
    let cursor = start;
    let modifierCount = 0;
    while (ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor))) {
      modifierCount += 1;
      cursor += 1;
      if (word(cursor) === "and" && ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor + 1))) cursor += 1;
    }
    if (word(cursor) === "observed" && evidenceHeads.has(word(cursor + 1))) {
      return { relation: modifierCount <= 2 ? "MATCH" as const : "AMBIGUOUS" as const, headIndex: cursor + 1, nextIndex: cursor + 2 };
    }
    if (modifierCount === 0) {
      for (let offset = 1; offset <= 2; offset += 1) {
        const observedIndex = start + offset;
        if (word(observedIndex) === "observed" && evidenceHeads.has(word(observedIndex + 1))) return { relation: "AMBIGUOUS" as const, headIndex: observedIndex + 1, nextIndex: observedIndex + 2 };
      }
    }
    return null;
  };

  const observedComplement = (start: number) => {
    const end = Math.min(localRelationEnd(start), start + 24);
    let complement = -1;
    for (let cursor = start; cursor < Math.min(end, start + 6); cursor += 1) {
      if (["that", "which"].includes(word(cursor))) { complement = cursor; break; }
    }
    if (complement < 0) return null;
    const finitePredicates = new Set(["is", "are", "was", "were", "has", "have", "had", "exists", "existed", "shows", "showed", "indicates", "indicated"]);
    let leftHasFinitePredicate = false;
    for (let cursor = complement + 1; cursor < end; cursor += 1) {
      if (contrastBoundaries.has(word(cursor))) return null;
      if (word(cursor) === "and" && leftHasFinitePredicate) return null;
      if (finitePredicates.has(word(cursor))) leftHasFinitePredicate = true;
      if (word(cursor) !== "observed") continue;
      const preceding = [word(cursor - 1), word(cursor - 2), word(cursor - 3), word(cursor - 4)];
      const negated = preceding.some((item, offset) => ["not", "never", "no"].includes(item) && !(item === "not" && preceding[offset - 1] === "only"));
      return { polarity: negated ? "NEGATED" as const : "PRESENT" as const, start: complement, end: cursor + 1 };
    }
    return null;
  };

  const recordNegativeGovernor = (start: number, complement: ReturnType<typeof observedComplement>, authority: EnglishEvidenceRelationAuthority = {}) => {
    if (!complement) return false;
    recordRelation(complement.polarity === "NEGATED" ? "AMBIGUOUS_NEGATION" : "ABSENT", start, complement.end, authority);
    return true;
  };

  const consumeBoundedModifierRun = (start: number, allowed: ReadonlySet<string>) => {
    let cursor = start;
    let count = 0;
    while (allowed.has(word(cursor))) {
      count += 1;
      cursor += 1;
      if (word(cursor) === "and" && allowed.has(word(cursor + 1))) cursor += 1;
    }
    return { cursor, count, valid: count <= 2 };
  };

  const directObservedEvidenceComplement = (start: number) => {
    const parsed = observedEvidenceHead(start);
    if (!parsed) return null;
    return {
      polarity: parsed.relation === "MATCH" ? "PRESENT" as const : "AMBIGUOUS" as const,
      start,
      end: parsed.nextIndex,
    };
  };

  const infinitiveOrGerundObservedTarget = (start: number) => {
    const end = Math.min(localRelationEnd(start), start + 18);
    let cursor = start;
    let complementStart = start;
    if (word(cursor) === "to") {
      cursor += 1;
      if (word(cursor) === "have") cursor += 1;
      if (word(cursor) === "be" || word(cursor) === "been") cursor += 1;
    } else if (word(cursor) === "of") {
      complementStart = cursor;
      cursor += 1;
      while (cursor < end && !["having", "being"].includes(word(cursor))) {
        if (relationBoundaryWords.has(word(cursor))) return null;
        cursor += 1;
      }
      if (word(cursor) === "having") {
        cursor += 1;
        if (word(cursor) === "been") cursor += 1;
      } else if (word(cursor) === "being") cursor += 1;
      else return null;
    } else return null;
    const parsed = observedWithModifiers(cursor);
    if (!parsed || parsed.observedIndex >= end) return null;
    return {
      polarity: parsed.relation === "MATCH" ? "PRESENT" as const : "AMBIGUOUS" as const,
      start: complementStart,
      end: parsed.nextIndex,
    };
  };

  const bareFiniteObservedTarget = (start: number) => {
    const end = Math.min(localRelationEnd(start), start + 14);
    let finiteSeen = false;
    for (let cursor = start; cursor < end; cursor += 1) {
      if (relationBoundaryWords.has(word(cursor))) return null;
      if (observationAuxiliaries.has(word(cursor))) finiteSeen = true;
      if (word(cursor) !== "observed" || !finiteSeen) continue;
      const previous = [word(cursor - 1), word(cursor - 2), word(cursor - 3)];
      return {
        polarity: previous.includes("not") || previous.includes("never") ? "NEGATED" as const : "PRESENT" as const,
        start,
        end: cursor + 1,
      };
    }
    return null;
  };

  const governedObservationTarget = (start: number) => observedComplement(start)
    ?? directObservedEvidenceComplement(start)
    ?? infinitiveOrGerundObservedTarget(start)
    ?? bareFiniteObservedTarget(start);

  const negativeAuxiliary = (start: number) => {
    if (word(start) === "cannot") return { auxiliary: "can", next: start + 1, modality: "ASSERTED" as const };
    if (![...activeNegativeAuxiliaries, ...observationAuxiliaries].includes(word(start)) || !["not", "never"].includes(word(start + 1))) return null;
    const auxiliary = word(start);
    let next = start + 2;
    const chain = [word(start), word(start + 1)];
    if (["has", "have", "had"].includes(word(next))) { chain.push(word(next)); next += 1; }
    if (["be", "been"].includes(word(next))) { chain.push(word(next)); next += 1; }
    return {
      auxiliary,
      chain,
      next,
      modality: ["could", "would", "should", "may", "might"].includes(auxiliary) ? "MODAL" as const : "ASSERTED" as const,
    };
  };

  const recordTypedNegativeReportingRelation = (subject: NonNullable<ReturnType<typeof boundedSubjectBefore>>, auxiliaryIndex: number) => {
    const negative = negativeAuxiliary(auxiliaryIndex);
    if (!negative) return false;
    if (word(negative.next) === "the" && word(negative.next + 1) === "case" && word(negative.next + 2) === "that") {
      const target = observedComplement(negative.next + 1);
      if (!target) return false;
      recordRelation(target.polarity === "NEGATED" ? "PRESENT" : "AMBIGUOUS_NEGATION", subject.start, target.end, {
        embedding: "ASSERTIVE_REPORT",
        subjectSpan: subject.span,
        auxiliaryChain: negative.chain ?? [negative.auxiliary, "not"],
        reportingPredicate: "case",
        complementSpan: tokenSpan(target.start, target.end),
        targetObservation: { ...tokenSpan(Math.max(target.start, target.end - 1), target.end), polarity: target.polarity },
        scope: tokenSpan(subject.start, target.end),
      });
      return true;
    }
    const modifiers = consumeBoundedModifierRun(negative.next, evidenceRelationModifiers);
    const predicateIndex = modifiers.cursor;
    const predicate = word(predicateIndex);
    const target = governedObservationTarget(predicateIndex + 1);
    const trailingBoundary = normalizedValue.slice(tokens[predicateIndex]?.end ?? 0, tokens[predicateIndex + 1]?.start ?? normalizedValue.length);
    const passiveWithoutExplicitTarget = passiveReportingPredicates.has(predicate)
      && (predicateIndex + 1 >= localRelationEnd(predicateIndex) || /[.;!?]/u.test(trailingBoundary));
    if (!target && !passiveWithoutExplicitTarget) return false;
    const chainedReportingPredicate = predicate === "provided" && word(predicateIndex + 1) === "to" && reportingPredicates.has(word(predicateIndex + 2))
      ? word(predicateIndex + 2)
      : null;
    const negatedFailurePredicate = ["fail", "fails", "failed"].includes(predicate) && word(predicateIndex + 1) === "to" && reportingPredicates.has(word(predicateIndex + 2))
      ? word(predicateIndex + 2)
      : null;
    const knownPredicate = reportingPredicates.has(predicate) || chainedReportingPredicate !== null || negatedFailurePredicate !== null;
    const nonEstablishingReport = ["report", "reports", "reported", "note", "notes", "noted", "document", "documents", "documented"].includes(predicate);
    const state = negatedFailurePredicate && modifiers.valid && target?.polarity === "PRESENT"
      ? "PRESENT"
      : !modifiers.valid || !target || target.polarity !== "PRESENT" || !knownPredicate || negative.modality === "MODAL" || nonEstablishingReport
      ? "AMBIGUOUS_NEGATION"
      : "ABSENT";
    const relationEnd = target?.end ?? predicateIndex + 1;
    recordRelation(state, subject.start, relationEnd, {
      modality: negative.modality,
      embedding: "NEGATED_REPORT",
      subjectSpan: subject.span,
      auxiliaryChain: negative.chain ?? [negative.auxiliary, "not"],
      reportingPredicate: negatedFailurePredicate ?? chainedReportingPredicate ?? predicate,
      complementSpan: target ? tokenSpan(target.start, target.end) : null,
      targetObservation: target ? { ...tokenSpan(Math.max(target.start, target.end - 1), target.end), polarity: target.polarity } : null,
      scope: tokenSpan(subject.start, relationEnd),
    });
    return true;
  };

  const recordTypedFailedReportingRelation = (subject: NonNullable<ReturnType<typeof boundedSubjectBefore>>, predicateStart: number) => {
    if (!["fail", "fails", "failed"].includes(word(predicateStart)) || word(predicateStart + 1) !== "to") return false;
    const modifiers = consumeBoundedModifierRun(predicateStart + 2, evidenceRelationModifiers);
    const predicateIndex = modifiers.cursor;
    const target = governedObservationTarget(predicateIndex + 1);
    if (!target) return false;
    const negatedFailure = (word(predicateStart - 1) === "not" && [...activeNegativeAuxiliaries, ...observationAuxiliaries].includes(word(predicateStart - 2)))
      || word(predicateStart - 1) === "never"
      || word(subject.start) === "no";
    const state = negatedFailure && modifiers.valid && reportingPredicates.has(word(predicateIndex)) && target.polarity === "PRESENT"
      ? "PRESENT"
      : modifiers.valid && reportingPredicates.has(word(predicateIndex)) && target.polarity === "PRESENT" ? "ABSENT" : "AMBIGUOUS_NEGATION";
    recordRelation(state, subject.start, target.end, {
      embedding: "NEGATED_REPORT",
      subjectSpan: subject.span,
      reportingPredicate: word(predicateIndex),
      complementSpan: tokenSpan(target.start, target.end),
      targetObservation: { ...tokenSpan(Math.max(target.start, target.end - 1), target.end), polarity: target.polarity },
      scope: tokenSpan(subject.start, target.end),
    });
    return true;
  };

  const prefixMakesNominalAmbiguous = (nominalIndex: number) => {
    const start = Math.max(0, nominalIndex - 8);
    const prefix = Array.from({ length: nominalIndex - start }, (_, offset) => word(start + offset));
    return prefix.some((item) => ["if", "whether", "hypothetically"].includes(item) || modalGovernors.has(item))
      || prefix.some((item, offset) => item === "not" && item !== prefix[offset + 1]);
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const subjectForAuxiliary = boundedSubjectBefore(index);
    if (subjectForAuxiliary && negativeAuxiliary(index)) recordTypedNegativeReportingRelation(subjectForAuxiliary, index);

    if (subjectForAuxiliary && observationAuxiliaries.has(word(index)) && word(index + 1) === "yet" && word(index + 2) === "to" && word(index + 3) === "be" && word(index + 4) === "observed") {
      recordRelation("ABSENT", subjectForAuxiliary.start, index + 5, {
        subjectSpan: subjectForAuxiliary.span,
        auxiliaryChain: [word(index), "yet", "to", "be"],
        targetObservation: { ...tokenSpan(index + 4, index + 5), polarity: "NEGATED" },
        scope: tokenSpan(subjectForAuxiliary.start, index + 5),
      });
    }

    const subjectForPredicate = boundedSubjectBefore(index);
    if (subjectForPredicate && ["fail", "fails", "failed"].includes(word(index))) recordTypedFailedReportingRelation(subjectForPredicate, index);

    if (word(index) === "insufficient") {
      const copulaIndex = index - 1;
      const subject = observationAuxiliaries.has(word(copulaIndex)) ? boundedSubjectBefore(copulaIndex) : null;
      if (subject) {
        const linker = word(index + 1);
        const conclusionPredicate = word(index + 2);
        const exactConclusion = linker === "for"
          ? ["concluding", "inferring", "demonstrating", "establishing"].includes(conclusionPredicate)
          : linker === "to" && insufficientConclusions.has(conclusionPredicate);
        if (["for", "to"].includes(linker) && conclusionPredicate) {
          const target = governedObservationTarget(index + 3);
          if (target) recordRelation(exactConclusion && target.polarity === "PRESENT" ? "ABSENT" : "AMBIGUOUS_NEGATION", subject.start, target.end, {
            embedding: "NEGATED_REPORT",
            subjectSpan: subject.span,
            auxiliaryChain: [word(copulaIndex)],
            reportingPredicate: conclusionPredicate,
            complementSpan: tokenSpan(target.start, target.end),
            targetObservation: { ...tokenSpan(Math.max(target.start, target.end - 1), target.end), polarity: target.polarity },
            scope: tokenSpan(subject.start, target.end),
          });
        }
      }
    }

    if (openNegativeQuantifiers.has(word(index))) {
      let cursor = index + 1;
      if (word(cursor) === "any") cursor += 1;
      const modifiers = consumeBoundedModifierRun(cursor, evidenceRelationModifiers);
      cursor = modifiers.cursor;
      if (evidenceHeads.has(word(cursor))) {
        const target = governedObservationTarget(cursor + 1);
        if (target) recordRelation(modifiers.valid && target.polarity === "PRESENT" ? "ABSENT" : "AMBIGUOUS_NEGATION", index, target.end, {
          auxiliaryChain: [word(index)],
          complementSpan: tokenSpan(target.start, target.end),
          targetObservation: { ...tokenSpan(Math.max(target.start, target.end - 1), target.end), polarity: target.polarity },
          scope: tokenSpan(index, target.end),
        });
      }
    }

    if (word(index) === "no") {
      const modifiers = consumeBoundedModifierRun(index + 1, evidenceRelationModifiers);
      if (word(modifiers.cursor) === "observed" && emergencePredicates.has(word(modifiers.cursor + 2))) {
        recordRelation(modifiers.valid ? "ABSENT" : "AMBIGUOUS_NEGATION", index, modifiers.cursor + 3, {
          auxiliaryChain: ["no"],
          modifierSpan: modifiers.cursor > index + 1 ? tokenSpan(index + 1, modifiers.cursor) : null,
          targetObservation: { ...tokenSpan(modifiers.cursor, modifiers.cursor + 1), polarity: "NEGATED" },
          scope: tokenSpan(index, modifiers.cursor + 3),
        });
      }
    }

    if (word(index) === "neither") {
      const end = Math.min(localRelationEnd(index), index + 18);
      const norIndex = Array.from({ length: Math.max(0, end - index - 1) }, (_, offset) => index + offset + 1).find((cursor) => word(cursor) === "nor");
      const observedIndex = norIndex === undefined ? undefined : Array.from({ length: Math.max(0, end - norIndex - 1) }, (_, offset) => norIndex + offset + 1).find((cursor) => word(cursor) === "observed");
      if (observedIndex !== undefined) recordRelation("ABSENT", index, observedIndex + 1, {
        auxiliaryChain: ["neither", "nor"],
        targetObservation: { ...tokenSpan(observedIndex, observedIndex + 1), polarity: "NEGATED" },
        scope: tokenSpan(index, observedIndex + 1),
      });
    }

    if (evidenceHeads.has(word(index)) && word(index + 1) === "for") {
      const end = Math.min(localRelationEnd(index), index + 14);
      const copula = Array.from({ length: Math.max(0, end - index - 2) }, (_, offset) => index + offset + 2).find((cursor) => relationCopulas.has(word(cursor)));
      if (copula !== undefined && absentComplements.has(word(copula + 1))) recordRelation("ABSENT", index, copula + 2, {
        subjectSpan: tokenSpan(index, copula),
        auxiliaryChain: [word(copula)],
        scope: tokenSpan(index, copula + 2),
      });
    }

    if (word(index) === "without" && evidenceHeads.has(word(index + 1))) {
      const subject = boundedSubjectBefore(index);
      if (subject) recordRelation("ABSENT", subject.start, index + 2, {
        subjectSpan: subject.span,
        auxiliaryChain: ["without"],
        scope: tokenSpan(subject.start, index + 2),
      });
    }

    if (word(index) === "impossible" && word(index + 1) === "to" && reportingPredicates.has(word(index + 2))) {
      const target = governedObservationTarget(index + 3);
      if (target) recordRelation(target.polarity === "PRESENT" ? "ABSENT" : "AMBIGUOUS_NEGATION", index, target.end, {
        auxiliaryChain: ["impossible"],
        reportingPredicate: word(index + 2),
        complementSpan: tokenSpan(target.start, target.end),
        targetObservation: { ...tokenSpan(Math.max(target.start, target.end - 1), target.end), polarity: target.polarity },
        scope: tokenSpan(index, target.end),
      });
    }

    if (observationAuxiliaries.has(word(index)) && word(index + 1) === "yet" && word(index + 2) === "to" && word(index + 3) === "be" && passiveReportingPredicates.has(word(index + 4))) {
      const subject = boundedSubjectBefore(index);
      if (subject) recordRelation("ABSENT", subject.start, index + 5, {
        subjectSpan: subject.span,
        auxiliaryChain: [word(index), "yet", "to", "be"],
        reportingPredicate: word(index + 4),
        targetObservation: { ...tokenSpan(index + 4, index + 5), polarity: "NEGATED" },
        scope: tokenSpan(subject.start, index + 5),
      });
    }

    if (word(index) === "if") {
      const end = Math.min(localRelationEnd(index), index + 24);
      const observedIndex = Array.from({ length: Math.max(0, end - index - 1) }, (_, offset) => index + offset + 1).find((cursor) => word(cursor) === "observed");
      if (observedIndex !== undefined) recordAmbiguousScope(index, end, "CONDITIONAL", "MAIN");
    }

    if (word(index) === "not" && word(index + 1) === "the" && word(index + 2) === "case" && word(index + 3) === "that") {
      const complement = observedComplement(index + 2);
      if (complement) recordRelation(complement.polarity === "NEGATED" ? "PRESENT" : "AMBIGUOUS_NEGATION", index, complement.end, {
        embedding: "ASSERTIVE_REPORT",
        auxiliaryChain: ["not"],
        complementSpan: tokenSpan(complement.start, complement.end),
        targetObservation: { ...tokenSpan(Math.max(complement.start, complement.end - 1), complement.end), polarity: complement.polarity },
      });
    }

    if (hypothesisPredicates.has(word(index))) {
      const subject = boundedSubjectBefore(index);
      const complement = observedComplement(index + 1);
      if (subject && complement) recordAmbiguousScope(subject.start, complement.end, "HYPOTHETICAL", "ASSERTIVE_REPORT");
    }
    if (reportingPredicates.has(word(index))) {
      const subject = boundedSubjectBefore(index);
      const complement = observedComplement(index + 1);
      if (subject && complement?.polarity === "NEGATED") recordRelation("ABSENT", subject.start, complement.end, { embedding: "ASSERTIVE_REPORT", subjectSpan: subject.span, reportingPredicate: word(index) });
    }
    if (["do", "does", "did"].includes(word(index)) && word(index + 1) === "not" && word(index + 2) === "have" && evidenceHeads.has(word(index + 3))) {
      const subject = boundedSubjectBefore(index);
      if (subject) recordNegativeGovernor(subject.start, observedComplement(index + 4), { embedding: "MAIN", subjectSpan: subject.span, auxiliaryChain: [word(index), "not", "have"] });
    }
    if (["has", "have", "had"].includes(word(index)) && word(index + 1) === "no" && evidenceHeads.has(word(index + 2))) {
      const subject = boundedSubjectBefore(index);
      if (subject) recordNegativeGovernor(subject.start, observedComplement(index + 3), { embedding: "MAIN", subjectSpan: subject.span, auxiliaryChain: [word(index)] });
    }
    if (modalGovernors.has(word(index)) && lackPredicates.has(word(index + 1))) {
      const subject = boundedSubjectBefore(index);
      if (subject) {
        const parsed = observedWithModifiers(index + 2);
        if (parsed && evidenceHeads.has(word(parsed.nextIndex))) recordRelation("AMBIGUOUS_NEGATION", subject.start, parsed.nextIndex + 1, { modality: "MODAL", embedding: "MAIN", subjectSpan: subject.span, auxiliaryChain: [word(index)], reportingPredicate: word(index + 1) });
        if (evidenceHeads.has(word(index + 2))) {
          const complement = observedComplement(index + 3);
          if (complement) recordRelation("AMBIGUOUS_NEGATION", subject.start, complement.end, { modality: "MODAL", embedding: "MAIN", subjectSpan: subject.span, auxiliaryChain: [word(index)], reportingPredicate: word(index + 1) });
        }
      }
    }

    if (word(index) === "there" && existentialAuxiliaries.has(word(index + 1)) && word(index + 2) === "no") {
      recordObservedHead(observedWithModifiers(index + 3));
    }
    if (word(index) === "there" && existentialAuxiliaries.has(word(index + 1)) && word(index + 2) === "not" && word(index + 3) === "any") {
      recordObservedHead(observedWithModifiers(index + 4));
    }

    if (word(index) === "there" && existentialAuxiliaries.has(word(index + 1))) {
      let cursor = index + 2;
      if (["a", "an", "the"].includes(word(cursor))) cursor += 1;
      if (["absence", "lack"].includes(word(cursor)) && word(cursor + 1) === "of") recordObservedHead(observedWithModifiers(cursor + 2));
      if (word(cursor) === "no" && evidenceHeads.has(word(cursor + 1))) recordNegativeGovernor(index, observedComplement(cursor + 2));
      if (word(cursor) === "not" && word(cursor + 1) === "any" && evidenceHeads.has(word(cursor + 2))) recordNegativeGovernor(index, observedComplement(cursor + 3));
      if (nominalAbsenceHeads.has(word(cursor)) && word(cursor + 1) === "of" && evidenceHeads.has(word(cursor + 2))) recordNegativeGovernor(index, observedComplement(cursor + 3), { embedding: "NOMINAL" });
    }

    if (word(index) === "there" && modalGovernors.has(word(index + 1)) && word(index + 2) === "be") {
      let cursor = index + 3;
      const complement = word(cursor) === "no" && evidenceHeads.has(word(cursor + 1)) ? observedComplement(cursor + 2)
        : word(cursor) === "not" && word(cursor + 1) === "any" && evidenceHeads.has(word(cursor + 2)) ? observedComplement(cursor + 3) : null;
      if (complement) recordAmbiguousScope(index, complement.end, "MODAL", "MAIN");
    }

    if (word(index) === "no") {
      const modifiers = consumeBoundedModifierRun(index + 1, evidenceRelationModifiers);
      if (evidenceHeads.has(word(modifiers.cursor))) {
        const target = governedObservationTarget(modifiers.cursor + 1);
        if (target) recordRelation(modifiers.valid && target.polarity === "PRESENT" ? "ABSENT" : "AMBIGUOUS_NEGATION", index, target.end);
      } else if (word(modifiers.cursor) === "observed" && evidenceHeads.has(word(modifiers.cursor + 1))) {
        recordRelation(modifiers.valid ? "ABSENT" : "AMBIGUOUS_NEGATION", index, modifiers.cursor + 2);
      }
      recordObservedHead(observedWithModifiers(index + 1));
      if (evidenceHeads.has(word(index + 1)) && observationAuxiliaries.has(word(index + 2))) {
        let cursor = index + 3;
        if (word(cursor) === "been") cursor += 1;
        const parsed = observedWithModifiers(cursor);
        if (parsed) recordRelation(parsed.relation === "MATCH" ? "ABSENT" : "AMBIGUOUS_NEGATION", index, parsed.nextIndex);
      }
    }

    if (lackPredicates.has(word(index))) {
      const copulaIndex = observationAuxiliaries.has(word(index - 1)) ? index - 1 : index;
      const subject = boundedSubjectBefore(copulaIndex);
      if (subject) {
        recordObservedHead(observedWithModifiers(index + 1), { subjectSpan: subject.span, reportingPredicate: word(index) });
        if (evidenceHeads.has(word(index + 1))) recordNegativeGovernor(subject.start, observedComplement(index + 2), { subjectSpan: subject.span, reportingPredicate: word(index) });
        const modifiers = consumeBoundedModifierRun(index + 1, evidenceRelationModifiers);
        if (evidenceHeads.has(word(modifiers.cursor))) {
          const target = governedObservationTarget(modifiers.cursor + 1);
          if (target) recordRelation(modifiers.valid && target.polarity === "PRESENT" ? "ABSENT" : "AMBIGUOUS_NEGATION", subject.start, target.end, { subjectSpan: subject.span, reportingPredicate: word(index) });
        }
      }
    }

    if (nominalAbsenceHeads.has(word(index)) && word(index + 1) === "of") {
      const parsed = observedEvidenceHead(index + 2);
      if (parsed) {
        const tail = parsed.nextIndex;
        const prefixAmbiguous = prefixMakesNominalAmbiguous(index) || value.includes("?");
        const negatedTail = observationAuxiliaries.has(word(tail)) && word(tail + 1) === "not" && word(tail + 2) !== "only";
        const affirmedTail = nominalAffirmedPredicates.has(word(tail)) || (observationAuxiliaries.has(word(tail)) && nominalDocumentPredicates.has(word(tail + 1)));
        const notOnlyDocumented = observationAuxiliaries.has(word(tail)) && word(tail + 1) === "not" && word(tail + 2) === "only" && nominalDocumentPredicates.has(word(tail + 3));
        if (word(index - 1) === "no" && parsed.relation === "MATCH") recordRelation("PRESENT", index - 1, Math.max(tail + 2, parsed.nextIndex), { embedding: "NOMINAL", auxiliaryChain: ["no"] });
        else if (parsed.relation === "AMBIGUOUS" || prefixAmbiguous || negatedTail) recordRelation("AMBIGUOUS_NEGATION", index, Math.max(tail + 2, parsed.nextIndex), { embedding: "NOMINAL" });
        else if (affirmedTail || notOnlyDocumented) recordRelation("ABSENT", index, notOnlyDocumented ? tail + 4 : tail + 2, { embedding: "NOMINAL" });
        else recordRelation("AMBIGUOUS_NEGATION", index, Math.min(tokens.length, tail + 3), { embedding: "NOMINAL" });
      }
      if (evidenceHeads.has(word(index + 2))) {
        const complement = observedComplement(index + 3);
        if (complement) recordRelation(word(index - 1) === "no" && complement.polarity === "PRESENT" ? "PRESENT" : prefixMakesNominalAmbiguous(index) || complement.polarity === "NEGATED" ? "AMBIGUOUS_NEGATION" : "ABSENT", word(index - 1) === "no" ? index - 1 : index, complement.end, { embedding: "NOMINAL", auxiliaryChain: word(index - 1) === "no" ? ["no"] : [] });
      }
    }

    if (word(index) === "no" && evidenceHeads.has(word(index + 1))) {
      const afterHead = index + 2;
      const modalScope = word(index - 3) === "there" && modalGovernors.has(word(index - 2)) && word(index - 1) === "be";
      const complement = observedComplement(afterHead) ?? (reportingPredicates.has(word(afterHead)) ? observedComplement(afterHead + 1) : null);
      if (complement) recordRelation(modalScope || complement.polarity === "NEGATED" ? "AMBIGUOUS_NEGATION" : "ABSENT", index, complement.end, { modality: modalScope ? "MODAL" : "ASSERTED" });
    }

    if (evidenceHeads.has(word(index)) && ["do", "does", "did"].includes(word(index + 1)) && word(index + 2) === "not") {
      const complement = observedComplement(index + 4);
      if (complement) {
        if (reportingPredicates.has(word(index + 3))) recordNegativeGovernor(index, complement, { embedding: "NEGATED_REPORT" });
        else recordRelation("AMBIGUOUS_NEGATION", index, complement.end, { embedding: "NEGATED_REPORT" });
      }
    }
    if (evidenceHeads.has(word(index)) && ["fail", "fails", "failed"].includes(word(index + 1)) && word(index + 2) === "to") {
      const complement = observedComplement(index + 4);
      if (complement) recordRelation(reportingPredicates.has(word(index + 3)) ? "ABSENT" : "AMBIGUOUS_NEGATION", index, complement.end, { embedding: "NEGATED_REPORT" });
    }
    if (evidenceHeads.has(word(index)) && modalGovernors.has(word(index + 1)) && word(index + 2) === "not" && reportingPredicates.has(word(index + 3))) {
      const complement = observedComplement(index + 4);
      if (complement) recordAmbiguousScope(index, complement.end, "MODAL", "NEGATED_REPORT");
    }

    if (evidenceHeads.has(word(index)) && observationAuxiliaries.has(word(index + 1)) && ["not", "never"].includes(word(index + 2)) && word(index + 3) !== "only") {
      let cursor = index + 3;
      if (word(cursor) === "yet") cursor += 1;
      if (word(cursor) === "been") cursor += 1;
      const parsed = observedWithModifiers(cursor, false);
      if (parsed) recordRelation(parsed.relation === "MATCH" ? "ABSENT" : "AMBIGUOUS_NEGATION", index, parsed.nextIndex);
    }

    if (word(index) === "observed" && evidenceHeads.has(word(index + 1)) && relationCopulas.has(word(index + 2))) {
      const complement = index + 3;
      if (absentComplements.has(word(complement))) recordRelation("ABSENT", index, complement + 1);
      else if (word(complement) === "not" && word(complement + 1) !== "only") {
        const availabilityIndex = availabilityModifiers.has(word(complement + 1)) ? complement + 2 : complement + 1;
        if (presentComplements.has(word(availabilityIndex))) recordRelation("ABSENT", index, availabilityIndex + 1);
      }
      else if (presentComplements.has(word(complement))) recordRelation("PRESENT", index, complement + 1);
    }

    if (evidenceHeads.has(word(index)) && relationCopulas.has(word(index + 1)) && word(index + 2) === "unobserved") recordRelation("ABSENT", index, index + 3);

    if (evidenceHeads.has(word(index)) && word(index + 1) === "can" && word(index + 2) === "be" && word(index + 3) === "observed") recordRelation("PRESENT", index, index + 4);
    if (evidenceHeads.has(word(index)) && word(index + 1) === "cannot" && word(index + 2) === "be" && word(index + 3) === "observed") recordRelation("ABSENT", index, index + 4);
    if (evidenceHeads.has(word(index)) && ["can", "could"].includes(word(index + 1)) && word(index + 2) === "not" && word(index + 3) === "be" && word(index + 4) === "observed") recordRelation("ABSENT", index, index + 5);
    if (evidenceHeads.has(word(index)) && word(index + 1) === "will" && word(index + 2) === "be" && word(index + 3) === "observed") recordRelation("ABSENT", index, index + 4, { modality: "MODAL" });
    if (evidenceHeads.has(word(index)) && word(index + 1) === "would" && word(index + 2) === "be" && word(index + 3) === "observed") recordRelation("AMBIGUOUS_NEGATION", index, index + 4, { modality: "CONDITIONAL" });
    if (evidenceHeads.has(word(index)) && ["may", "might", "could", "should"].includes(word(index + 1)) && word(index + 2) === "be" && word(index + 3) === "observed") recordRelation("AMBIGUOUS_NEGATION", index, index + 4, { modality: "MODAL" });
    if (evidenceHeads.has(word(index)) && ["may", "might", "should"].includes(word(index + 1)) && word(index + 2) === "not") {
      let cursor = index + 3;
      if (["has", "have", "had"].includes(word(cursor))) cursor += 1;
      if (word(cursor) === "been") cursor += 1;
      const parsed = observedWithModifiers(cursor);
      if (parsed) recordRelation("AMBIGUOUS_NEGATION", index, parsed.nextIndex, { modality: "MODAL" });
    }
    if (evidenceHeads.has(word(index)) && observationAuxiliaries.has(word(index + 1)) && word(index + 2) === "yet" && word(index + 3) === "to" && word(index + 4) === "be" && word(index + 5) === "observed") recordRelation("ABSENT", index, index + 6);

    if (evidenceHeads.has(word(index)) && observationAuxiliaries.has(word(index + 1)) && word(index + 2) === "not" && word(index + 3) === "only") {
      let cursor = index + 4;
      if (word(cursor) === "been") cursor += 1;
      if (word(cursor) !== "observed") continue;
      cursor += 1;
      if (word(cursor) === "but") cursor += 1;
      let modifierCount = 0;
      if (ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor))) {
        cursor += 1;
        modifierCount += 1;
        if (word(cursor) === "and" && ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor + 1))) {
          cursor += 2;
          modifierCount += 1;
        } else if (ENGLISH_NEGATIVE_MODIFIERS.has(word(cursor))) {
          cursor += 1;
          modifierCount += 1;
        }
      }
      if (modifierCount <= 2 && word(cursor) === "replicated") recordRelation("PRESENT", index, cursor + 1);
    }
  }

  const punctuationBetween = (left: number, right: number) => /[.;!?]/u.test(normalizedValue.slice(tokens[left]?.end ?? 0, tokens[right]?.start ?? normalizedValue.length));
  const structuralBoundary = (index: number, direction: -1 | 1) => {
    let cursor = index;
    while (cursor >= 0 && cursor < tokens.length) {
      const next = cursor + direction;
      if (next < 0 || next >= tokens.length || punctuationBetween(Math.min(cursor, next), Math.max(cursor, next))) break;
      if (contrastBoundaries.has(word(next))) break;
      cursor = next;
    }
    return cursor;
  };
  const positiveContradictionPredicates = new Set(["contradict", "contradicts", "contradicted", "refute", "refutes", "refuted", "disprove", "disproves", "disproved"]);
  const finiteObservationAuxiliaries = new Set(["is", "are", "was", "were", "has", "have", "had", "exists", "existed", "shows", "showed", "indicates", "indicated"]);

  for (let observedIndex = 0; observedIndex < tokens.length; observedIndex += 1) {
    if (word(observedIndex) !== "observed") continue;
    if (relations.some((relation) => relation.start <= tokens[observedIndex].start && relation.end >= tokens[observedIndex].end)) continue;
    const start = structuralBoundary(observedIndex, -1);
    const end = structuralBoundary(observedIndex, 1) + 1;
    const words = Array.from({ length: end - start }, (_, offset) => word(start + offset));
    const localObserved = observedIndex - start;
    const preceding = words.slice(0, localObserved);
    const evidenceIndex = preceding.findLastIndex((item) => evidenceHeads.has(item));
    const noIndex = preceding.findLastIndex((item) => item === "no");
    const insufficientIndex = preceding.findLastIndex((item) => ["insufficient", "inadequate", "limited"].includes(item));
    const negativeIndex = preceding.findLastIndex((item) => item === "not" || item === "never" || item === "cannot");
    const linkerIndex = preceding.findLastIndex((item) => ["that", "which", "to", "of", "for", "as", "by", "through"].includes(item));
    const contradictionIndex = preceding.findLastIndex((item) => positiveContradictionPredicates.has(item));
    const relativeIndex = preceding.findLastIndex((item) => ["that", "which"].includes(item));
    const independentCoordinate = preceding.some((item, offset) => item === "and"
      && preceding.slice(relativeIndex >= 0 ? relativeIndex + 1 : 0, offset).some((candidate) => finiteObservationAuxiliaries.has(candidate))
      && preceding.slice(offset + 1).some((candidate) => finiteObservationAuxiliaries.has(candidate)));
    const relativeMainObservation = relativeIndex >= 0
      && negativeIndex > relativeIndex
      && preceding.slice(negativeIndex + 1).some((item) => finiteObservationAuxiliaries.has(item));
    const noLackPositive = noIndex >= 0 && ["lack", "absence"].includes(preceding[noIndex + 1] ?? "") && preceding[noIndex + 2] === "of";
    const negatedFailurePositive = negativeIndex >= 0 && ["fail", "fails", "failed"].includes(preceding[negativeIndex + 1] ?? "") && preceding.slice(negativeIndex + 2).includes("to");
    const noFailurePositive = noIndex >= 0 && preceding.slice(noIndex + 1).some((item, offset, tail) => ["fail", "fails", "failed"].includes(item) && tail[offset + 1] === "to" && reportingPredicates.has(tail[offset + 2] ?? ""));
    const neverFailurePositive = preceding.some((item, offset) => item === "never" && ["fail", "fails", "failed"].includes(preceding[offset + 1] ?? "") && preceding[offset + 2] === "to" && reportingPredicates.has(preceding[offset + 3] ?? ""));
    const noShortagePositive = noIndex >= 0 && preceding[noIndex + 1] === "shortage" && preceding[noIndex + 2] === "of" && evidenceHeads.has(preceding[noIndex + 3] ?? "");
    const outerInnerPositive = preceding.includes("case") && preceding.includes("not")
      && [word(observedIndex - 1), word(observedIndex - 2), word(observedIndex - 3)].includes("not");
    if ((noIndex >= 0 && evidenceIndex > noIndex && contradictionIndex > evidenceIndex) || noLackPositive || negatedFailurePositive || noFailurePositive || neverFailurePositive || noShortagePositive || outerInnerPositive) {
      recordRelation("PRESENT", start, end, {
        auxiliaryChain: preceding.filter((item) => ["no", "not", "never", "cannot", "fail", "fails", "failed"].includes(item)),
        reportingPredicate: contradictionIndex >= 0 ? preceding[contradictionIndex] : negatedFailurePositive ? preceding[negativeIndex + 1] : null,
        complementSpan: tokenSpan(Math.max(start, linkerIndex >= 0 ? start + linkerIndex : observedIndex), observedIndex + 1),
        targetObservation: { ...tokenSpan(observedIndex, observedIndex + 1), polarity: outerInnerPositive ? "NEGATED" : "PRESENT" },
        scope: tokenSpan(start, end),
      });
      continue;
    }
    const leadingSubject = ["a", "an", "the"].includes(words[0] ?? "") ? words[1] : words[0];
    if (["result", "results", "finding", "findings"].includes(leadingSubject ?? "") && (linkerIndex < 0 || preceding[linkerIndex] === "as")) continue;
    if (independentCoordinate || relativeMainObservation) continue;
    const negativeAuxiliaryIndex = preceding.findLastIndex((item, offset) => item === "cannot" || ((item === "not" || item === "never") && offset > 0 && [...activeNegativeAuxiliaries, ...observationAuxiliaries].includes(preceding[offset - 1])));
    const localNegationIndex = preceding.findLastIndex((item, offset) => ["not", "never"].includes(item) && preceding[offset + 1] !== "only");
    const localAuxiliaryIndex = localNegationIndex >= 0
      ? Array.from({ length: Math.min(6, localNegationIndex) }, (_, offset) => localNegationIndex - offset - 1).find((offset) => [...activeNegativeAuxiliaries, ...observationAuxiliaries].includes(preceding[offset] ?? ""))
      : undefined;
    if (localNegationIndex >= 0 && localAuxiliaryIndex !== undefined) {
      const auxiliary = preceding[localAuxiliaryIndex];
      const modal = ["may", "might", "could", "should", "would"].includes(auxiliary);
      recordRelation(modal ? "AMBIGUOUS_NEGATION" : "ABSENT", start, observedIndex + 1, {
        modality: modal ? "MODAL" : "ASSERTED",
        subjectSpan: tokenSpan(start, start + localAuxiliaryIndex),
        auxiliaryChain: preceding.slice(localAuxiliaryIndex, localNegationIndex + 1),
        targetObservation: { ...tokenSpan(observedIndex, observedIndex + 1), polarity: "NEGATED" },
        scope: tokenSpan(start, end),
      });
      continue;
    }
    const absenceGovernor = (noIndex >= 0 && evidenceIndex > noIndex)
      || (insufficientIndex >= 0 && (evidenceIndex < 0 || Math.abs(evidenceIndex - insufficientIndex) <= 3))
      || (negativeAuxiliaryIndex >= 0 && (evidenceIndex >= 0 || linkerIndex >= 0))
      || preceding.some((item, offset) => lackPredicates.has(item) && preceding.slice(offset + 1).some((candidate) => evidenceHeads.has(candidate)));
    if (!absenceGovernor) {
      const explicitBarePending = preceding.at(-2) === "not" && preceding.at(-1) === "yet";
      const unresolvedOperator = preceding.some((item) => ["no", "not", "never", "yet", "without", "neither", "nor", "little", "scant", "hardly", "scarcely", "impossible", "insufficient"].includes(item));
      recordRelation(explicitBarePending ? "ABSENT" : unresolvedOperator ? "AMBIGUOUS_NEGATION" : "PRESENT", observedIndex, observedIndex + 1, {
        targetObservation: { ...tokenSpan(observedIndex, observedIndex + 1), polarity: "PRESENT" },
        scope: tokenSpan(start, end),
      });
      continue;
    }
    const predicateIndex = linkerIndex > 0 ? linkerIndex - 1 : negativeAuxiliaryIndex >= 0 ? negativeAuxiliaryIndex + 1 : evidenceIndex;
    const predicate = preceding[predicateIndex] ?? null;
    const knownBound = noIndex >= 0 || insufficientIndex >= 0 || (predicate !== null && (reportingPredicates.has(predicate) || ["provided", "exists", "exist", "established", "confirmed"].includes(predicate)));
    recordRelation(knownBound ? "ABSENT" : "AMBIGUOUS_NEGATION", start, end, {
      subjectSpan: boundedSubjectBefore(start + Math.max(0, negativeAuxiliaryIndex))?.span ?? null,
      auxiliaryChain: preceding.filter((item) => ["no", "not", "never", "cannot", "insufficient"].includes(item)),
      reportingPredicate: predicate,
      complementSpan: tokenSpan(Math.max(start, linkerIndex >= 0 ? start + linkerIndex : observedIndex), observedIndex + 1),
      targetObservation: { ...tokenSpan(observedIndex, observedIndex + 1), polarity: "PRESENT" },
      scope: tokenSpan(start, end),
    });
  }

  const toPredicateAuthority = (relation: EnglishEvidenceRelation) => {
    if (!relation.reportingPredicate) return null;
    const token = tokens.find((item) => item.word === relation.reportingPredicate && item.start >= relation.scope.start && item.end <= relation.scope.end);
    return token ? { value: token.word, span: { start: token.start, end: token.end } } : null;
  };
  const relationRichness = (relation: EnglishEvidenceRelation) => Number(Boolean(relation.targetObservation)) * 8
    + Number(Boolean(relation.complementSpan)) * 4
    + Number(Boolean(relation.subjectSpan)) * 2
    + Math.min(1, relation.scope.end - relation.scope.start);
  const targetGroups = new Map<string, EnglishEvidenceRelation[]>();
  for (const relation of relations) targetGroups.set(relation.targetId, [...(targetGroups.get(relation.targetId) ?? []), relation]);
  const targetRelations = [...targetGroups.entries()].map(([targetId, candidates]) => {
    const ordered = [...candidates].sort((left, right) => relationRichness(right) - relationRichness(left));
    const incomplete = ordered.find((relation) => relation.state === "AMBIGUOUS_NEGATION");
    const absent = ordered.find((relation) => relation.state === "ABSENT");
    const present = ordered.find((relation) => relation.state === "PRESENT");
    const selected = absent ?? incomplete ?? present!;
    const kind = absent || present && !incomplete ? "BOUND" as const : "INCOMPLETE" as const;
    return {
      selected,
      authority: {
        targetId,
        kind,
        operatorKind: absent ? "ABSENCE" as const : incomplete ? "AMBIGUOUS" as const : "PRESENCE" as const,
        scope: selected.scope,
        observationTarget: selected.targetObservation,
        composedPolarity: absent ? "ABSENT" as const : incomplete ? null : "PRESENT" as const,
      },
    };
  }).sort((left, right) => left.selected.start - right.selected.start || left.selected.end - right.selected.end);
  const targets = targetRelations.map((item) => item.authority);
  const selectResolved = (kind: V2Beta1EvidenceTargetRelation["kind"], polarity?: V2Beta1EvidenceTargetRelation["composedPolarity"]) => targetRelations
    .filter((item) => item.authority.kind === kind && (polarity === undefined || item.authority.composedPolarity === polarity))
    .sort((left, right) => relationRichness(right.selected) - relationRichness(left.selected))[0]?.selected;
  const incomplete = selectResolved("INCOMPLETE");
  if (incomplete) return {
    kind: "INCOMPLETE",
    targetId: incomplete.targetId,
    targets,
    subjectSpan: incomplete.subjectSpan,
    modifierSpan: incomplete.modifierSpan,
    auxiliaryOperatorChain: incomplete.auxiliaryChain,
    reportingOrContradictionPredicate: toPredicateAuthority(incomplete),
    complementSpan: incomplete.complementSpan,
    observationTarget: incomplete.targetObservation,
    scope: incomplete.scope,
    reason: "NEGATIVE_GOVERNOR_TARGET_INCOMPLETE",
  };
  const absent = selectResolved("BOUND", "ABSENT");
  if (absent) return {
    kind: "BOUND",
    targetId: absent.targetId,
    targets,
    subjectSpan: absent.subjectSpan,
    modifierSpan: absent.modifierSpan,
    auxiliaryOperatorChain: absent.auxiliaryChain,
    reportingOrContradictionPredicate: toPredicateAuthority(absent),
    complementSpan: absent.complementSpan,
    observationTarget: absent.targetObservation,
    scope: absent.scope,
    composedPolarity: "ABSENT",
  };
  const present = selectResolved("BOUND", "PRESENT");
  if (present) return {
    kind: "BOUND",
    targetId: present.targetId,
    targets,
    subjectSpan: present.subjectSpan,
    modifierSpan: present.modifierSpan,
    auxiliaryOperatorChain: present.auxiliaryChain,
    reportingOrContradictionPredicate: toPredicateAuthority(present),
    complementSpan: present.complementSpan,
    observationTarget: present.targetObservation,
    scope: present.scope,
    composedPolarity: "PRESENT",
  };
  return { kind: "NO_RELATION", targets: [] };
}

function parseBoundedEnglishObservationState(value: string): V2Beta1ClauseResultState {
  const authority = normalizeEnglishPredicate(value);
  const subject = ENGLISH_OBSERVATION_SUBJECT.exec(authority);
  ENGLISH_OBSERVATION_SUBJECT.lastIndex = 0;
  if (!subject) return null;
  const leadingNo = subject[1] === "no";
  const matchedWords = authority.slice((subject.index ?? 0) + subject[0].length).match(/[a-z]+/gu);
  const words: string[] = matchedWords ? [...matchedWords].slice(0, 16) : [];
  const starts = (...expected: string[]) => expected.every((word, index) => words[index] === word);
  if ((starts("have", "not", "only", "been", "observed") || starts("has", "not", "only", "been", "observed") || starts("had", "not", "only", "been", "observed")) && words.includes("replicated")) return "OBSERVED";
  if (leadingNo && words.includes("observed")) return "PLANNED";
  if ((starts("remain", "unobserved") || starts("remains", "unobserved") || starts("remained", "unobserved"))) return "PLANNED";
  const auxiliary = words[0];
  if (["has", "have", "had"].includes(auxiliary)) {
    if (words[1] === "never" && words[2] === "been" && words[3] === "observed") return "PLANNED";
    if (words[1] === "yet" && words[2] === "to" && words[3] === "be" && words[4] === "observed") return "PLANNED";
    if (words[1] === "not" && words[2] === "been" && words[3] === "observed" && words[4] === "yet") return "PLANNED";
    if (words[1] === "not" && words[2] === "yet" && words[3] === "been") {
      if (boundedObservedEnd(words, 4) !== null) return "PLANNED";
    }
  }
  if (["is", "are", "was", "were"].includes(auxiliary)) {
    if (words[1] === "yet" && words[2] === "to" && words[3] === "be" && words[4] === "observed") return "PLANNED";
    if (words[1] === "not" && words[2] === "yet" && words[3] === "observed") return "PLANNED";
    if (words[1] === "not" && words[2] === "observed" && words[3] === "yet") return "PLANNED";
    if (words[1] === "not" && boundedObservedEnd(words, 2) !== null) return "PLANNED";
  }
  const cannotStart = words[0] === "cannot" ? 1 : words[0] === "can" && words[1] === "not" ? 2 : null;
  if (cannotStart !== null) {
    if (words[cannotStart] === "be" && words[cannotStart + 1] === "observed") return "PLANNED";
    if (words[cannotStart] === "be" && ["considered", "regarded"].includes(words[cannotStart + 1] ?? "") && (words[cannotStart + 1] !== "regarded" || words[cannotStart + 2] === "as") && words[cannotStart + (words[cannotStart + 1] === "regarded" ? 3 : 2)] === "observed") return "PLANNED";
  }
  if (starts("can", "be", "observed")) return "OBSERVED";
  if (["lack", "lacks"].includes(words[0] ?? "")) {
    const observedEnd = boundedObservedEnd(words, 1);
    if (observedEnd !== null && ["evidence", "support"].includes(words[observedEnd] ?? "")) return "PLANNED";
  }
  if (starts("without", "being", "observed")) return "PLANNED";
  const bounded = words.slice(0, 16);
  const negativeSignal = leadingNo || bounded.some((word) => ["no", "not", "never", "unobserved", "yet", "cannot", "lack", "lacks", "without"].includes(word)) || (words[0] === "can" && words[1] === "not");
  const observationSignal = bounded.some((word) => word === "observed" || word === "unobserved");
  return negativeSignal && observationSignal ? "UNRESOLVED" : null;
}

type ClauseRange = { start: number; end: number; structuredContextRaw: string | null };

function structuredPredicateRanges(value: string, start: number, end: number): ClauseRange[] {
  const segments: Array<{ start: number; end: number; bodyStart: number; bodyEnd: number; normalized: string }> = [];
  let segmentStart = start;
  let squareDepth = 0;
  let roundDepth = 0;
  for (let index = start; index < end; index += 1) {
    const char = value[index];
    if (char === "[" || char === "［") squareDepth += 1;
    if (char === "]" || char === "］") squareDepth = Math.max(0, squareDepth - 1);
    if (char === "(" || char === "（") roundDepth += 1;
    if (char === ")" || char === "）") roundDepth = Math.max(0, roundDepth - 1);
    if (squareDepth !== 0 || roundDepth !== 0 || !/[；;]/u.test(char)) continue;
    const source = value.slice(segmentStart, index);
    const leading = source.match(/^\s*/u)?.[0].length ?? 0;
    const trailing = source.match(/\s*$/u)?.[0].length ?? 0;
    const bodyStart = segmentStart + leading;
    const bodyEnd = index - trailing;
    if (bodyEnd > bodyStart) segments.push({ start: segmentStart, end: index + 1, bodyStart, bodyEnd, normalized: value.slice(bodyStart, bodyEnd).normalize("NFKC") });
    segmentStart = index + 1;
  }
  const tail = value.slice(segmentStart, end);
  const tailLeading = tail.match(/^\s*/u)?.[0].length ?? 0;
  const tailTrailing = tail.match(/\s*$/u)?.[0].length ?? 0;
  if (end - tailTrailing > segmentStart + tailLeading) segments.push({ start: segmentStart, end, bodyStart: segmentStart + tailLeading, bodyEnd: end - tailTrailing, normalized: value.slice(segmentStart + tailLeading, end - tailTrailing).normalize("NFKC").replace(/[。．｡！？.!?]+$/gu, "").trim() });
  let metadataCount = 0;
  const metadataFields = new Set<string>();
  while (metadataCount < segments.length && STRUCTURED_METADATA_SEGMENT.test(segments[metadataCount].normalized)) {
    const field = segments[metadataCount].normalized.match(/^([\p{L}]+)\s*[:=]/u)?.[1].toLocaleLowerCase("en-US");
    if (field) metadataFields.add(({ 指標id: "metricid", 群組id: "cohortid", 時間點: "timepoint", 分析id: "analysisid" } as Record<string, string>)[field] ?? field);
    metadataCount += 1;
  }
  if (metadataCount !== 4 || metadataFields.size !== 4 || !["metricid", "cohortid", "timepoint", "analysisid"].every((field) => metadataFields.has(field))) return [{ start, end, structuredContextRaw: null }];
  const contextEnd = segments[metadataCount - 1].end;
  const structuredContextRaw = value.slice(start, contextEnd).trim().replace(/[；;]\s*$/u, "");
  const claims: ClauseRange[] = [];
  let current: ClauseRange | null = null;
  for (let index = metadataCount; index < segments.length; index += 1) {
    const segment = segments[index];
    const state = classifyV2Beta1ClauseResultState(value.slice(segment.bodyStart, segment.bodyEnd));
    if (state !== null) {
      if (current) claims.push(current);
      current = { start: claims.length === 0 ? start : segment.bodyStart, end: segment.end, structuredContextRaw };
    } else if (current) {
      current.end = segment.end;
    }
  }
  if (current) claims.push(current);
  return claims.length > 0 ? claims : [{ start, end, structuredContextRaw }];
}

function safeOuterClauses(value: string) {
  const outer: Array<{ start: number; end: number }> = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "[" || char === "［") squareDepth += 1;
    if (char === "]" || char === "］") squareDepth = Math.max(0, squareDepth - 1);
    if (char === "(" || char === "（") roundDepth += 1;
    if (char === ")" || char === "）") roundDepth = Math.max(0, roundDepth - 1);
    const previous = value[index - 1] ?? "";
    const next = value[index + 1] ?? "";
    const before = value.slice(Math.max(start, index - 8), index).toLowerCase();
    const safeAsciiPeriod = char === "."
      && !(/[0-9]/u.test(previous) && /[0-9]/u.test(next))
      && next !== "/"
      && !/[a-z0-9]/iu.test(next)
      && !/(?:\bet\s+al|\bdoi|\bvs)$/iu.test(before);
    const fullwidthLeadingDecimal = /[．｡]/u.test(char) && /[0-9０-９]/u.test(next) && /[<>=≤≥＜＞＝+\-−]/u.test(previous);
    const safeFullwidthPeriod = /[．｡]/u.test(char) && !(/[0-9０-９]/u.test(previous) && /[0-9０-９]/u.test(next)) && !fullwidthLeadingDecimal;
    const hardBoundary = /[。！？\n!?]/u.test(char) || safeAsciiPeriod || safeFullwidthPeriod;
    const nextHardOffset = value.slice(index + 1).search(/[。．｡！？\n!?]/u);
    const currentHardEnd = nextHardOffset < 0 ? value.length : index + 1 + nextHardOffset + 1;
    const structuredRegion = STRUCTURED_OBSERVATION_FIELD.test(value.slice(start, currentHardEnd).normalize("NFKC"));
    const semicolonBoundary = /[；;]/u.test(char) && !structuredRegion;
    if (squareDepth === 0 && roundDepth === 0 && (hardBoundary || semicolonBoundary)) {
      outer.push({ start, end: index + 1 });
      start = index + 1;
    }
  }
  if (value.slice(start).trim()) outer.push({ start, end: value.length });
  return outer.flatMap((range) => structuredPredicateRanges(value, range.start, range.end))
    .flatMap((range) => splitContrastRanges(value, range.start, range.end).map((item) => ({ ...item, structuredContextRaw: range.structuredContextRaw })))
    .flatMap((range) => splitIndependentEnglishCoordinateRanges(value, range.start, range.end).map((item) => ({ ...item, structuredContextRaw: range.structuredContextRaw })))
    .flatMap((range) => {
    const source = value.slice(range.start, range.end);
    const leading = source.match(/^\s*/u)?.[0].length ?? 0;
    const trailing = source.match(/\s*$/u)?.[0].length ?? 0;
    const rawStart = range.start + leading;
    const rawEnd = range.end - trailing;
    if (rawEnd <= rawStart) return [];
    return [{ raw: value.slice(rawStart, rawEnd), start: rawStart, end: rawEnd, structuredContextRaw: range.structuredContextRaw }];
    });
}

function observationKeyAuthority(clause: string) {
  const matches = collectMapped(clause, OBSERVATION_KEY);
  const spans = matches.map((item) => item.raw);
  const fields = new Map<string, string[]>();
  for (const match of matches) {
    const parsed = match.normalized.match(/^(metricId|cohortId|timepoint|analysisId|指標ID|群組ID|時間點|分析ID)\s*[:=]\s*([\p{L}\p{N}._-]+)$/iu);
    if (!parsed) continue;
    const field = ({ 指標ID: "metricId", 群組ID: "cohortId", 時間點: "timepoint", 分析ID: "analysisId" } as Record<string, string>)[parsed[1]] ?? parsed[1];
    fields.set(field.toLowerCase(), [...(fields.get(field.toLowerCase()) ?? []), parsed[2].toLocaleLowerCase("en-US")]);
  }
  const values = ["metricid", "cohortid", "timepoint", "analysisid"].map((field) => fields.get(field));
  if (values.some((items) => !items || items.length !== 1)) return { observationKey: null, spans };
  return { observationKey: { metricId: values[0]![0], cohortId: values[1]![0], timepoint: values[2]![0], analysisId: values[3]![0] }, spans };
}

function directionFor(raw: string, value: number): V2Beta1StructuredEffect["direction"] {
  const normalized = raw.normalize("NFKC").replace(/[‐‑‒–—−]/gu, "-");
  if (/(?:下降|降低|減少|低於|decreas|lower|negative)/iu.test(normalized) || value < 0) return "DOWN";
  if (/(?:增加|提升|上升|高於|increas|improv|higher|positive)/iu.test(normalized) || value > 0) return "UP";
  return "NEUTRAL";
}

type LocatedEffect = { effect: Omit<V2Beta1StructuredEffect, "scopeSpans">; index: number; end: number };

function effectAuthority(clause: string): LocatedEffect[] {
  const named = collectMapped(clause, NAMED_EFFECT).map((match) => {
    const parsed = match.normalized.match(/^(β|OR|RR|HR|Cohen(?:['’]s)?\s+d|Hedges(?:['’]s)?\s+g)\s*=\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|[A-Za-zµμ/]+)?$/iu);
    if (!parsed) return null;
    const value = Number(parsed[2]);
    return { effect: { name: parsed[1].toLocaleLowerCase("en-US"), direction: directionFor(match.normalized, value), value, unit: (parsed[3] ?? "UNITLESS").toLocaleLowerCase("en-US"), raw: match.raw }, index: match.index, end: match.end };
  }).filter((item): item is LocatedEffect => item !== null && Number.isFinite(item.effect.value));
  const narrative = collectMapped(clause, NARRATIVE_EFFECT).map((match) => {
    const parsed = match.normalized.match(/^(.*?)([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|分|點|秒|分鐘|小時|days?|hours?|points?|[A-Za-zµμ/]+)?$/iu);
    if (!parsed) return null;
    const value = Number(parsed[2]);
    return { effect: { name: parsed[1].trim().toLocaleLowerCase("en-US"), direction: directionFor(match.normalized, value), value, unit: (parsed[3] ?? "UNITLESS").toLocaleLowerCase("en-US"), raw: match.raw }, index: match.index, end: match.end };
  }).filter((item): item is LocatedEffect => item !== null && Number.isFinite(item.effect.value));
  const observedAt = collectMapped(clause, OBSERVED_AT_EFFECT).map((match) => {
    const parsed = match.normalized.match(/^(.*?)\s+(?:was|were)\s+observed\s+at\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|分|點|秒|分鐘|小時|days?|hours?|points?|[A-Za-zµμ/]+)$/iu);
    if (!parsed) return null;
    const value = Number(parsed[2]);
    return { effect: { name: parsed[1].trim().toLocaleLowerCase("en-US"), direction: directionFor(match.normalized, value), value, unit: parsed[3].toLocaleLowerCase("en-US"), raw: match.raw }, index: match.index, end: match.end };
  }).filter((item): item is LocatedEffect => item !== null && Number.isFinite(item.effect.value));
  const unique = new Map<string, LocatedEffect>();
  for (const effect of [...named, ...narrative, ...observedAt]) unique.set(`${effect.index}:${effect.effect.raw}`, effect);
  return [...unique.values()];
}

function citationIdentityAuthority(value: string, confidenceMatches = collectMapped(value, CONFIDENCE_INTERVAL)): V2Beta1CitationIdentityAuthority {
  const overlapsConfidenceInterval = (match: MappedMatch) => confidenceMatches.some((interval) => match.index < interval.end && match.end > interval.index);
  const genericAuthorLabel = (match: MappedMatch) => {
    const label = match.normalized.replace(/[()（）,，.;；:\d]/gu, " ").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
    return /^(?:data|dataset|model|table|figure|wave|study|phase|cohort|trial|period|research|year|資料|資料集|數據|數據集|模型|表|圖|波次|研究|研究期別|期別|年度)(?:\s|$)/iu.test(label);
  };
  const direct = [DOI, ARXIV, WESTERN_AUTHOR_YEAR, CJK_AUTHOR_YEAR, PARENTHETICAL_CITATION]
    .flatMap((pattern) => collectMapped(value, pattern))
    .filter((match) => !overlapsConfidenceInterval(match) && !genericAuthorLabel(match));
  const numeric = collectMapped(value, BRACKET_CITATION).filter((match) => !overlapsConfidenceInterval(match));
  const directIdentities = uniqueLongest(direct.map((item) => item.raw));
  const numericMarkers = uniqueLongest(numeric.map((item) => item.raw));
  return { directIdentities, numericMarkers, allSpans: uniqueLongest([...directIdentities, ...numericMarkers]) };
}

function recordForClause(raw: string): V2Beta1StructuredEvidenceRecord | null {
  const key = observationKeyAuthority(raw);
  const locatedEffects = effectAuthority(raw);
  const scopeMatches = [...collectMapped(raw, NEGATION_SCOPE), ...collectMapped(raw, UNCERTAINTY_SCOPE)];
  const effects = locatedEffects.map((located, locatedIndex) => {
    const assigned = scopeMatches.filter((scope) => {
      const preceding = locatedEffects.map((candidate, index) => ({ index, distance: scope.index - candidate.end })).filter((candidate) => candidate.distance >= 0).sort((a, b) => a.distance - b.distance)[0];
      if (preceding) return preceding.index === locatedIndex;
      const nearest = locatedEffects.map((candidate, index) => ({ index, distance: Math.abs(scope.index - candidate.index) })).sort((a, b) => a.distance - b.distance)[0];
      return nearest?.index === locatedIndex;
    });
    return { ...located.effect, scopeSpans: uniqueLongest(assigned.map((item) => item.raw)) };
  });
  const effectSpans = effects.map((item) => item.raw);
  const scopeSpans = uniqueLongest(scopeMatches.map((item) => item.raw));
  const sampleSizeSpans = collectMapped(raw, SAMPLE_SIZE).map((item) => item.raw);
  const probabilitySpans = collectMapped(raw, P_VALUE).map((item) => item.raw);
  const confidenceMatches = collectMapped(raw, CONFIDENCE_INTERVAL);
  const confidenceIntervalSpans = confidenceMatches.map((item) => item.raw);
  const citationSpans = citationIdentityAuthority(raw, confidenceMatches).allSpans;
  const rawAnchors = uniqueLongest([...key.spans, ...effectSpans, ...scopeSpans, ...sampleSizeSpans, ...probabilitySpans, ...confidenceIntervalSpans, ...citationSpans]);
  if (!rawAnchors.length) return null;
  const core = {
    raw,
    structured: key.observationKey !== null && effects.length > 0,
    observationKey: key.observationKey,
    observationKeySpans: key.spans,
    effects,
    effectSpans,
    scopeSpans,
    sampleSizeSpans,
    probabilitySpans,
    confidenceIntervalSpans,
    citationSpans,
    rawAnchors,
  };
  return { ...core, recordHash: beta1Hash(core) };
}

function canonicalComparator(value: string): V2Beta1ProbabilityClaim["comparator"] {
  const normalized = value.normalize("NFKC");
  if (normalized === "≤") return "<=";
  if (normalized === "≥") return ">=";
  return normalized as V2Beta1ProbabilityClaim["comparator"];
}

export function extractV2Beta1ProbabilityClaims(value: string): V2Beta1ProbabilityClaim[] {
  return collectMapped(value, P_VALUE).map((match) => {
    const parsed = match.normalized.match(/p\s*(<=|>=|[<>=≤≥])\s*(0?\.\d+|1(?:\.0+)?)/iu);
    return parsed ? { comparator: canonicalComparator(parsed[1]), value: Number(parsed[2]), raw: match.raw } : null;
  }).filter((item): item is V2Beta1ProbabilityClaim => item !== null);
}

export function extractV2Beta1CitationIdentityAuthority(value: string): V2Beta1CitationIdentityAuthority {
  return citationIdentityAuthority(value);
}

export function hasV2Beta1ClauseMissingMarker(value: string) {
  const authority = value.normalize("NFKC").replace(/[‐‑‒–—−]/gu, "-");
  return FIXED_MISSING_MARKER.test(authority) || UNKNOWN_SAMPLE.test(authority) || ISOLATED_UNKNOWN.test(authority);
}

export function classifyV2Beta1ClauseResultState(value: string): V2Beta1ClauseResultState {
  const authority = value.normalize("NFKC").replace(/[‐‑‒–—−]/gu, "-").trim();
  if (!authority) return null;
  const withoutObservedControlLabels = authority
    .replace(/預期結果與實際觀察一致/gu, "實際觀察一致")
    .replace(/未完成作業組/gu, "作業組")
    .replace(/預期焦慮量表/gu, "焦慮量表");
  const englishEvidenceRelation = deriveV2Beta1EvidenceRelationIR(withoutObservedControlLabels);
  if (englishEvidenceRelation.kind === "INCOMPLETE") return "UNRESOLVED";
  if (englishEvidenceRelation.kind === "BOUND") return englishEvidenceRelation.composedPolarity === "ABSENT" ? "PLANNED" : "OBSERVED";
  const englishObservationState = parseBoundedEnglishObservationState(withoutObservedControlLabels);
  if (englishObservationState !== null) return englishObservationState;
  if (EXPECTED_RESULT_PENDING.test(withoutObservedControlLabels) || ENGLISH_PROCESS_PENDING.test(withoutObservedControlLabels) || CHINESE_PENDING.test(withoutObservedControlLabels)) return "PLANNED";
  if (LEGITIMATE_OBSERVED_CONTROL.test(authority) && OBSERVED_PREDICATE.test(authority)) return "OBSERVED";
  const resultSubject = RESULT_SUBJECT.test(authority);
  if (OBSERVED_PREDICATE.test(authority)) return "OBSERVED";
  if (ENGLISH_RESIDUAL_PLANNING.test(withoutObservedControlLabels)) return "PLANNED";
  if (hasV2Beta1ClauseMissingMarker(authority)) return "MISSING";
  if (!resultSubject) return null;
  return CLAIM_SIGNAL.test(authority) || /(?:preliminary|初步|await|pending|完成|分析)/iu.test(authority) ? "UNRESOLVED" : null;
}

export function tokenizeV2Beta1ResultPropositions(value: string): V2Beta1ResultProposition[] {
  return safeOuterClauses(value).map(({ raw, start, end, structuredContextRaw }) => ({ raw, startByte: utf8Bytes(value.slice(0, start)), endByte: utf8Bytes(value.slice(0, end)), structuredContextRaw, resultState: classifyV2Beta1ClauseResultState(raw) }));
}

export function contextualizeV2Beta1ResultProposition(proposition: Pick<V2Beta1ResultProposition, "raw" | "structuredContextRaw">) {
  return proposition.structuredContextRaw && observationKeyAuthority(proposition.raw).observationKey === null ? `${proposition.structuredContextRaw}; ${proposition.raw}` : proposition.raw;
}

export function extractV2Beta1ClauseResultStates(value: string) {
  return tokenizeV2Beta1ResultPropositions(value).map(({ raw, resultState }) => ({ raw, resultState }));
}

export function reduceV2Beta1ResultPropositionStates(states: readonly V2Beta1ClauseResultState[], conflict = false): V2Beta1ResultStateReduction {
  const hasObserved = states.includes("OBSERVED");
  const hasPlanned = states.includes("PLANNED");
  const hasMissing = states.includes("MISSING");
  const hasUnresolved = states.includes("UNRESOLVED");
  return {
    resultState: conflict ? "CONFLICT" : hasObserved ? "OBSERVED" : hasPlanned ? "PLANNED" : "MISSING",
    hasObserved,
    hasPlanned,
    hasMissing,
    hasUnresolved,
  };
}

function evidenceClaimForRecord(record: V2Beta1StructuredEvidenceRecord): V2Beta1EvidenceClaimIR {
  const qualifiers = uniqueLongest(record.effects.flatMap((effect) => effect.scopeSpans));
  const negated = qualifiers.some((span) => NEGATION_SCOPE.test(span));
  NEGATION_SCOPE.lastIndex = 0;
  const qualified = qualifiers.length > 0;
  const core = {
    observationKey: record.observationKey,
    effects: record.effects,
    polarity: negated ? "NEGATED" as const : qualified ? "QUALIFIED" as const : "AFFIRMED" as const,
    qualifierSpans: qualifiers,
    citationIdentities: record.citationSpans,
    rawSpanCommitment: beta1Hash(record.raw),
  };
  return { ...core, claimIdentity: beta1Hash(core) };
}

export function extractV2Beta1ClaimAuthority(value: string): V2Beta1ClaimAuthority {
  const clauses = tokenizeV2Beta1ResultPropositions(value).map(({ raw, structuredContextRaw, resultState: classifiedState }) => {
    const recordSource = contextualizeV2Beta1ResultProposition({ raw, structuredContextRaw });
    const record = recordForClause(recordSource);
    const resultState = classifiedState;
    const claimLike = CLAIM_SIGNAL.test(raw);
    const classification: V2Beta1ClauseClass = resultState === "PLANNED" || resultState === "MISSING" || resultState === "UNRESOLVED"
      ? "RESULT_STATE"
      : record && isV2Beta1EvidenceBearingRecord(record)
        ? "EVIDENCE_CLAIM"
        : claimLike
          ? "EVIDENCE_CLAIM"
          : CONTEXT_SIGNAL.test(raw)
            ? "CONTEXT"
            : "NONCLAIM";
    const unresolved = (classification === "RESULT_STATE" && resultState === "UNRESOLVED") || (classification === "EVIDENCE_CLAIM" && (!record || !record.structured));
    const claim = record && isV2Beta1EvidenceBearingRecord(record) ? evidenceClaimForRecord(record) : null;
    const core = { raw, classification, resultState, unresolved, claim };
    return { ...core, clauseHash: beta1Hash(core) };
  });
  return { clauses, authorityHash: beta1Hash(clauses) };
}

export function extractV2Beta1StructuredEvidenceRecords(value: string): V2Beta1StructuredEvidenceAuthority {
  const records = tokenizeV2Beta1ResultPropositions(value).map((proposition) => recordForClause(contextualizeV2Beta1ResultProposition(proposition))).filter((item): item is V2Beta1StructuredEvidenceRecord => item !== null);
  return { records, rawAnchors: uniqueLongest(records.flatMap((item) => item.rawAnchors)), probabilityClaims: extractV2Beta1ProbabilityClaims(value) };
}

export function extractV2Beta1EvidenceClauses(value: string): V2Beta1EvidenceClauseAuthority {
  const authority = extractV2Beta1StructuredEvidenceRecords(value);
  return {
    clauses: authority.records.map(({ raw, observationKeySpans, effectSpans, scopeSpans, rawAnchors }) => ({ raw, observationKeySpans, effectSpans, scopeSpans, rawAnchors })),
    rawAnchors: authority.rawAnchors,
    probabilityClaims: authority.probabilityClaims,
  };
}

export function extractV2Beta1EvidenceAnchors(value: string) {
  return extractV2Beta1StructuredEvidenceRecords(value).rawAnchors;
}

function recordBindingMatches(source: V2Beta1StructuredEvidenceRecord, candidate: V2Beta1StructuredEvidenceRecord) {
  return beta1CanonicalJson(source.observationKey) === beta1CanonicalJson(candidate.observationKey)
    && beta1CanonicalJson(source.observationKeySpans) === beta1CanonicalJson(candidate.observationKeySpans)
    && beta1CanonicalJson(source.effects) === beta1CanonicalJson(candidate.effects)
    && beta1CanonicalJson(source.scopeSpans) === beta1CanonicalJson(candidate.scopeSpans)
    && beta1CanonicalJson(source.sampleSizeSpans) === beta1CanonicalJson(candidate.sampleSizeSpans)
    && beta1CanonicalJson(source.probabilitySpans) === beta1CanonicalJson(candidate.probabilitySpans)
    && beta1CanonicalJson(source.confidenceIntervalSpans) === beta1CanonicalJson(candidate.confidenceIntervalSpans)
    && beta1CanonicalJson(source.citationSpans) === beta1CanonicalJson(candidate.citationSpans);
}

export function isV2Beta1EvidenceBearingRecord(record: V2Beta1StructuredEvidenceRecord) {
  return record.observationKeySpans.length > 0 || record.effects.length > 0 || record.sampleSizeSpans.length > 0 || record.probabilitySpans.length > 0 || record.confidenceIntervalSpans.length > 0 || record.citationSpans.length > 0;
}

export function requiresV2Beta1CompleteEvidenceClausePreservation(value: string) {
  return extractV2Beta1StructuredEvidenceRecords(value).records.some((record) => isV2Beta1EvidenceBearingRecord(record) && !record.structured);
}

export function validateV2Beta1AcademicProposition(value: string) {
  if (typeof value !== "string" || value.trim().length < 24 || /來源核對錨點/iu.test(value)) return false;
  const authority = extractV2Beta1StructuredEvidenceRecords(value);
  const evidenceRecords = authority.records.filter(isV2Beta1EvidenceBearingRecord);
  if (!evidenceRecords.length) {
    const lexical = value.replace(/[\d\p{P}\p{S}_]+/gu, " ");
    const hanCount = (lexical.match(/[\p{Script=Han}]/gu) ?? []).length;
    const latinWords = lexical.match(/\b[A-Za-z]{3,}\b/gu) ?? [];
    const hasPredicate = /(?:顯示|指出|支持|呈現|說明|表明|關聯|影響|限制|推論|觀察|維持|不能|不可|仍須|界定|約束|was|were|show(?:ed|s)?|indicat(?:e|ed|es)|support(?:ed|s)?|suggest(?:ed|s)?|remain(?:ed|s)?|cannot|may|might|bound(?:ed|s)?|limit(?:ed|s)?)/iu.test(value);
    return hasPredicate && (hanCount >= 14 || latinWords.length >= 7);
  }
  return evidenceRecords.every((record) => {
    let residue = record.raw;
    for (const anchor of [...record.rawAnchors].sort((a, b) => b.length - a.length)) residue = residue.split(anchor).join(" ");
    const lexical = residue.replace(/(?:metricId|cohortId|timepoint|analysisId|指標ID|群組ID|時間點|分析ID)\s*[:=]\s*[\p{L}\p{N}._-]+/giu, " ").replace(/[\d\p{P}\p{S}_]+/gu, " ");
    const hanCount = (lexical.match(/[\p{Script=Han}]/gu) ?? []).length;
    const latinWords = lexical.match(/\b[A-Za-z]{3,}\b/gu) ?? [];
    const compactRaw = record.raw.replace(/[\s\p{P}\p{S}]/gu, "");
    const compactResidue = residue.replace(/[\s\p{P}\p{S}]/gu, "");
    const anchorDominance = compactRaw.length ? 1 - compactResidue.length / compactRaw.length : 1;
    const hasPredicate = /(?:顯示|指出|支持|不支持|呈現|說明|表明|關聯|影響|限制|推論|觀察|維持|不能|不可|仍須|界定|約束|缺乏證據|was|were|show(?:ed|s)?|indicat(?:e|ed|es)|support(?:ed|s)?|suggest(?:ed|s)?|remain(?:ed|s)?|cannot|may|might|bound(?:ed|s)?|limit(?:ed|s)?|lacks?\s+(?:evidence|support)|appears?|uncertain)/iu.test(record.raw);
    const genericPadding = /(?:上述資訊|這些資訊|these\s+(?:details|items|tokens)|僅供參考|維持學術判斷)/iu.test(residue);
    return hasPredicate && !genericPadding && anchorDominance <= 0.90 && (hanCount >= 10 || latinWords.length >= 4);
  });
}

export function validateV2Beta1RevisionEvidenceClauses(source: string, revision: string) {
  if (/(?:^|[\s，,；;：:])(?:unsupported|none)(?=$|[\s，,。；;])/iu.test(revision) || !validateV2Beta1AcademicProposition(revision)) return false;
  const sourceAuthority = extractV2Beta1StructuredEvidenceRecords(source);
  const revisionAuthority = extractV2Beta1StructuredEvidenceRecords(revision);
  const sourceRecords = sourceAuthority.records.filter(isV2Beta1EvidenceBearingRecord);
  const sourceClaims = extractV2Beta1ClaimAuthority(source);
  const revisionClaims = extractV2Beta1ClaimAuthority(revision);
  if (sourceRecords.length > 0 && revisionClaims.clauses.some((clause) => clause.unresolved || (clause.classification === "RESULT_STATE" && clause.resultState !== "OBSERVED"))) return false;
  if (sourceRecords.length > 0 && revisionClaims.clauses.some((clause) => (clause.classification === "EVIDENCE_CLAIM" || clause.classification === "RESULT_STATE") && clause.claim === null)) return false;
  const sourceClaimCount = sourceClaims.clauses.filter((clause) => clause.claim !== null).length;
  const revisionClaimCount = revisionClaims.clauses.filter((clause) => clause.claim !== null).length;
  if (sourceRecords.length > 0 && sourceClaimCount !== revisionClaimCount) return false;
  const sourceVerbatim = source.trim().replace(/[。.!！？]+$/u, "").trim();
  if (sourceRecords.every((record) => record.structured) && sourceVerbatim.length >= 24 && revision.includes(sourceVerbatim)) return false;
  const sourceAnchors = uniqueLongest(sourceRecords.flatMap((record) => record.rawAnchors));
  if (!sourceAnchors.every((anchor) => revision.includes(anchor))) return false;
  const available = revisionAuthority.records.filter(isV2Beta1EvidenceBearingRecord);
  for (const sourceRecord of sourceRecords) {
    if (!sourceRecord.structured) {
      if (!revision.includes(sourceRecord.raw) || revision.trim() === sourceRecord.raw.trim()) return false;
      const index = available.findIndex((candidate) => !candidate.structured && candidate.raw === sourceRecord.raw);
      if (index < 0) return false;
      available.splice(index, 1);
      continue;
    }
    const index = available.findIndex((candidate) => candidate.structured && recordBindingMatches(sourceRecord, candidate));
    if (index < 0) return false;
    available.splice(index, 1);
  }
  return available.length === 0;
}

export const validateV2Beta1RevisionAnchors = validateV2Beta1RevisionEvidenceClauses;
