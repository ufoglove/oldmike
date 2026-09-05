import { beta1CanonicalJson, beta1Hash, isBeta1Hash } from "./canonical-hash.ts";
import { classifyV2Beta1ClauseResultState, tokenizeV2Beta1ResultPropositions } from "./evidence-anchors.ts";
import { parseV2Beta1ProjectId } from "./shared-authority.ts";

export const V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION = "old-mike-v2-beta1/typed-observation-renderer/2" as const;
export const V2_BETA1_OBSERVATION_CONFIRMATION_SCHEMA = "old-mike-v2-beta1/observation-confirmation/2" as const;
export const V2_BETA1_EXPLICIT_ATTESTATION = "I explicitly confirm that each included typed observation matches the displayed source excerpt and should be used only as an association-level research claim." as const;

type Material = { materialId: string; kind: string; title: string; content: string; contentHash?: string };
type Direction = "NEGATIVE" | "ZERO" | "POSITIVE";
type Comparator = "<" | "<=" | "=" | ">=" | ">";
type DecisionKind = "CONFIRMED" | "CORRECTED" | "EXCLUDED";

export type V2Beta1ObservationCitation =
  | { kind: "OWN_DATA"; materialId: string; startByte: number; endByte: number; spanHash: string }
  | { kind: "LITERATURE"; identityKind: "DOI" | "ARXIV" | "AUTHOR_YEAR_TITLE"; identity: string; materialId: string; materialContentHash: string; startByte: number; endByte: number; spanHash: string };

export type V2Beta1TypedObservationRecord = {
  recordId: string;
  materialId: string;
  materialContentHash: string;
  startByte: number;
  endByte: number;
  spanHash: string;
  metricId: string;
  cohortId: string;
  timepoint: string;
  analysisId: string;
  effectId: string;
  estimate: string;
  unit: string;
  direction: Direction;
  sampleSize: number;
  pComparator: Comparator;
  pValue: string;
  ci95Lower: string;
  ci95Upper: string;
  citation: V2Beta1ObservationCitation;
  resultState: "OBSERVED";
  assertion: "AFFIRMED";
  inference: "ASSOCIATION_ONLY";
  rendererVersion: typeof V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION;
  recordHash: string;
};

export type V2Beta1ObservationCandidate = {
  candidateId: string;
  status: "UNCONFIRMED_ADVISORY";
  rawExcerpt: string;
  materialId: string;
  materialContentHash: string;
  startByte: number;
  endByte: number;
  spanHash: string;
  suggestedRecord: Omit<V2Beta1TypedObservationRecord, "recordId" | "recordHash"> | null;
  candidateHash: string;
};

export type V2Beta1ObservationDecision = { candidateId: string; decision: DecisionKind; recordHash: string | null };

export type V2Beta1ObservationConfirmationAuthority = {
  schemaId: typeof V2_BETA1_OBSERVATION_CONFIRMATION_SCHEMA;
  projectId: string;
  baseRevision: number;
  baseContentHash: string;
  sourceBundleHash: string;
  outputTarget: "SCI" | "SSCI" | "NSTC" | "MOE";
  researchDirectionHash: string;
  researchDomainHash: string;
  rendererVersion: typeof V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION;
  decisions: V2Beta1ObservationDecision[];
  records: V2Beta1TypedObservationRecord[];
  recordSetHash: string;
  attestationStatement: typeof V2_BETA1_EXPLICIT_ATTESTATION;
  confirmedRecordIds: string[];
  confirmationSelectionHash: string;
  trustLabel: "EXPLICIT_USER_ASSERTION";
  scopeClass: "SESSION_OR_LOCAL_SCOPE_BOUND";
  scopeAuthorityHash: string;
  confirmationHash: string;
  authorityHash: string;
};

export type V2Beta1ObservationAuthorityContext = {
  projectId: string;
  baseRevision: number;
  baseContentHash: string;
  outputTarget: "SCI" | "SSCI" | "NSTC" | "MOE";
  researchDirection: string;
  researchDomainHash: string;
  trustedScope: string;
  materials: readonly Material[];
};

export type V2Beta1RenderedObservationClaim = {
  recordHash: string;
  claimId: string;
  renderedClaimText: string;
  renderedClaimHash: string;
};

const RECORD_KEYS = ["recordId", "materialId", "materialContentHash", "startByte", "endByte", "spanHash", "metricId", "cohortId", "timepoint", "analysisId", "effectId", "estimate", "unit", "direction", "sampleSize", "pComparator", "pValue", "ci95Lower", "ci95Upper", "citation", "resultState", "assertion", "inference", "rendererVersion", "recordHash"] as const;
const CITATION_OWN_KEYS = ["kind", "materialId", "startByte", "endByte", "spanHash"] as const;
const CITATION_LITERATURE_KEYS = ["kind", "identityKind", "identity", "materialId", "materialContentHash", "startByte", "endByte", "spanHash"] as const;
const DECISION_KEYS = ["candidateId", "decision", "recordHash"] as const;
const AUTHORITY_KEYS = ["schemaId", "projectId", "baseRevision", "baseContentHash", "sourceBundleHash", "outputTarget", "researchDirectionHash", "researchDomainHash", "rendererVersion", "decisions", "records", "recordSetHash", "attestationStatement", "confirmedRecordIds", "confirmationSelectionHash", "trustLabel", "scopeClass", "scopeAuthorityHash", "confirmationHash", "authorityHash"] as const;
const RESULT_KINDS = new Set(["RESULTS", "STATISTICS", "TABLE", "FIGURE"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export const V2_BETA1_OBSERVATION_UNITS = Object.freeze(["%", "point", "points", "second", "seconds", "minute", "minutes", "hour", "hours", "day", "days"] as const);
const UNIT_SET = new Set<string>(V2_BETA1_OBSERVATION_UNITS);

function row(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string) {
  const actual = Object.keys(value).sort(); const authority = [...expected].sort();
  if (actual.length !== authority.length || actual.some((key, index) => key !== authority[index])) throw new Error(code);
}
function exactText(value: unknown, minimum: number, maximum: number, code: string) {
  if (typeof value !== "string" || value !== value.trim() || value.length < minimum || value.length > maximum) throw new Error(code);
  return value;
}
function identifier(value: unknown, code: string) {
  const parsed = exactText(value, 1, 160, code);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(parsed)) throw new Error(code);
  return parsed;
}
function canonicalDecimal(value: unknown, code: string) {
  const parsed = exactText(value, 1, 40, code);
  const canonical = canonicalCandidateDecimal(parsed);
  if (canonical === null) throw new Error(code);
  const numeric = Number(canonical);
  if (!Number.isFinite(numeric)) throw new Error(code);
  return { text: canonical, numeric };
}
function contentHash(material: Material) {
  const hash = beta1Hash(material.content);
  if (material.contentHash !== undefined && material.contentHash !== hash) throw new Error("beta1_observation_material_hash_invalid");
  return hash;
}
function sourceBundleHash(materials: readonly Material[]) {
  return beta1Hash(materials.map((material) => ({ materialId: material.materialId, kind: material.kind, title: material.title, contentHash: contentHash(material) })));
}
function byteIndex(value: string, codeUnitIndex: number) { return encoder.encode(value.slice(0, codeUnitIndex)).byteLength; }
function rawSpan(material: Material, startByte: number, endByte: number) {
  const bytes = encoder.encode(material.content);
  if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte) || startByte < 0 || endByte <= startByte || endByte > bytes.byteLength) throw new Error("beta1_observation_span_invalid");
  return decoder.decode(bytes.slice(startByte, endByte));
}
function normalizeNumericToken(value: string) {
  return value.normalize("NFKC").replace(/[−–—]/gu, "-").replace(/^\+/, "");
}
function canonicalCandidateDecimal(value: string | undefined) {
  if (!value) return null;
  const normalized = normalizeNumericToken(value).replace(/^(-?)\./u, "$10.");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  let text = normalized;
  if (text.includes(".")) text = text.replace(/0+$/u, "").replace(/\.$/u, "");
  return text === "-0" ? "0" : text;
}
function exactUnit(value: unknown, code: string) {
  const unit = exactText(value, 1, 32, code).normalize("NFKC");
  if (!UNIT_SET.has(unit)) throw new Error(code);
  return unit;
}
function canonicalCitationIdentity(kind: unknown, value: unknown) {
  const identity = exactText(value, 3, 500, "beta1_observation_citation_invalid").normalize("NFKC");
  if (kind === "DOI") {
    const canonical = identity.replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "").replace(/^doi:\s*/iu, "").replace(/[.,;:]$/u, "").toLowerCase();
    if (!/^10\.\d{4,9}\/[\w.()/:;-]+$/u.test(canonical)) throw new Error("beta1_observation_citation_invalid");
    return { identityKind: "DOI" as const, identity: canonical };
  }
  if (kind === "ARXIV") {
    const suffix = identity.replace(/^arxiv:\s*/iu, "");
    if (!/^\d{4}\.\d{4,5}(?:v\d+)?$/u.test(suffix)) throw new Error("beta1_observation_citation_invalid");
    return { identityKind: "ARXIV" as const, identity: `arXiv:${suffix}` };
  }
  if (kind === "AUTHOR_YEAR_TITLE") {
    if (!/^[^|]{2,120}\|(?:19|20)\d{2}\|[^|]{4,300}$/u.test(identity)) throw new Error("beta1_observation_citation_invalid");
    return { identityKind: "AUTHOR_YEAR_TITLE" as const, identity };
  }
  throw new Error("beta1_observation_citation_invalid");
}
function citationLocator(materials: readonly Material[], identityKind: "DOI" | "ARXIV" | "AUTHOR_YEAR_TITLE", identity: string) {
  const matches: Array<{ material: Material; startByte: number; endByte: number; spanHash: string }> = [];
  for (const material of materials) {
    if (material.kind !== "CITATION") continue;
    for (const proposition of tokenizeV2Beta1ResultPropositions(material.content)) {
      const normalized = proposition.raw.normalize("NFKC");
      let supported = false;
      try {
        if (identityKind === "DOI") {
          for (const raw of normalized.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/[\w.()/:;-]+/giu) ?? []) if (canonicalCitationIdentity("DOI", raw).identity === identity) supported = true;
        } else if (identityKind === "ARXIV") {
          for (const raw of normalized.match(/(?:arxiv:\s*)?\d{4}\.\d{4,5}(?:v\d+)?/giu) ?? []) if (canonicalCitationIdentity("ARXIV", raw).identity === identity) supported = true;
        } else supported = normalized.includes(identity);
      } catch { supported = false; }
      if (supported) matches.push({ material, startByte: proposition.startByte, endByte: proposition.endByte, spanHash: beta1Hash(proposition.raw) });
    }
  }
  return matches.length === 1 ? matches[0] : null;
}
function candidateField(raw: string, names: readonly string[]) {
  const authority = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
  return raw.match(new RegExp(`(?:${authority})\\s*[:=：＝]\\s*([A-Za-z0-9._:-]+)`, "iu"))?.[1] ?? null;
}
function candidateRecord(materials: readonly Material[], material: Material, raw: string, startByte: number, endByte: number, spanHash: string): Omit<V2Beta1TypedObservationRecord, "recordId" | "recordHash"> | null {
  if (classifyV2Beta1ClauseResultState(raw) !== "OBSERVED") return null;
  const normalized = raw.normalize("NFKC");
  const observed = /(?:實際(?:觀察|測得)|observed|measured)\s*(?:at|as|為|到)?\s*([+\-−–—]?(?:\d+(?:\.\d+)?|\.\d+))\s*([%％]|[A-Za-z][A-Za-z0-9/_-]*)?/iu.exec(normalized)
    ?? /([+\-−–—]?(?:\d+(?:\.\d+)?|\.\d+))\s*([%％])\s*(?:was\s+)?observed/iu.exec(normalized);
  const estimate = canonicalCandidateDecimal(observed?.[1]);
  const sample = normalized.match(/(?:N|樣本(?:數)?)\s*[:=：＝]?\s*(\d+)/iu)?.[1];
  const p = normalized.match(/p\s*(<=|>=|<|>|=|≤|≥)\s*(\d+(?:\.\d+)?|\.\d+)/iu);
  const ci = normalized.match(/(?:95%?\s*CI|CI95|95％\s*CI|95%?\s*信賴區間)\s*[:=：＝]?\s*[\[(（]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,，]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[\])）]/iu);
  const metricId = candidateField(normalized, ["metricId", "指標ID"]);
  const cohortId = candidateField(normalized, ["cohortId", "群組ID"]);
  const timepoint = candidateField(normalized, ["timepoint", "時間點"]);
  const analysisId = candidateField(normalized, ["analysisId", "分析ID"]);
  const effectId = candidateField(normalized, ["effectId", "效果ID"]);
  const literature = normalized.match(/(?:citation|引用)\s*[:=：＝]\s*(DOI|ARXIV|AUTHOR_YEAR_TITLE)\s*[:：]\s*([^;；。\n]+)/iu);
  const literatureIdentity = literature ? canonicalCitationIdentity(literature[1].toUpperCase(), literature[2].trim()) : null;
  const locator = literatureIdentity ? citationLocator(materials, literatureIdentity.identityKind, literatureIdentity.identity) : null;
  const citation = /(?:citation|引用)\s*[:=：＝]\s*OWN_DATA/iu.test(normalized)
    ? { kind: "OWN_DATA" as const, materialId: material.materialId, startByte, endByte, spanHash }
    : literatureIdentity && locator ? { kind: "LITERATURE" as const, ...literatureIdentity, materialId: locator.material.materialId, materialContentHash: contentHash(locator.material), startByte: locator.startByte, endByte: locator.endByte, spanHash: locator.spanHash } : null;
  if (!estimate || !sample || !p || !ci || !metricId || !cohortId || !timepoint || !analysisId || !effectId || !citation) return null;
  const pValue = canonicalCandidateDecimal(p[2]); const lower = canonicalCandidateDecimal(ci[1]); const upper = canonicalCandidateDecimal(ci[2]);
  if (!pValue || !lower || !upper) return null;
  const numeric = Number(estimate);
  return {
    materialId: material.materialId, materialContentHash: contentHash(material), startByte, endByte, spanHash,
    metricId, cohortId, timepoint, analysisId, effectId, estimate, unit: exactUnit(observed?.[2]?.normalize("NFKC") === "%" ? "%" : observed?.[2] ?? "%", "beta1_observation_unit_invalid"),
    direction: numeric < 0 ? "NEGATIVE" : numeric > 0 ? "POSITIVE" : "ZERO", sampleSize: Number(sample),
    pComparator: p[1].replace("≤", "<=").replace("≥", ">=") as Comparator, pValue, ci95Lower: lower, ci95Upper: upper, citation,
    resultState: "OBSERVED", assertion: "AFFIRMED", inference: "ASSOCIATION_ONLY", rendererVersion: V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION,
  };
}

export function deriveV2Beta1ObservationCandidates(materials: readonly Material[]): V2Beta1ObservationCandidate[] {
  const candidates: V2Beta1ObservationCandidate[] = [];
  for (const material of materials) {
    if (!RESULT_KINDS.has(material.kind) || contentHash(material) !== beta1Hash(material.content)) continue;
    for (const proposition of tokenizeV2Beta1ResultPropositions(material.content)) {
      const raw = proposition.raw;
      if (!/(?:實際(?:觀察|測得)|\bobserved\b|\bmeasured\b)/iu.test(raw) || !/[0-9０-９]/u.test(raw)) continue;
      const startByte = proposition.startByte; const endByte = proposition.endByte; const spanHash = beta1Hash(raw);
      const candidateCore = { status: "UNCONFIRMED_ADVISORY" as const, rawExcerpt: raw, materialId: material.materialId, materialContentHash: contentHash(material), startByte, endByte, spanHash, suggestedRecord: candidateRecord(materials, material, raw, startByte, endByte, spanHash) };
      const candidateId = `candidate:${beta1Hash(candidateCore).slice(0, 40)}`;
      candidates.push({ candidateId, ...candidateCore, candidateHash: beta1Hash({ candidateId, ...candidateCore }) });
    }
  }
  return candidates;
}

function parseCitation(value: unknown, materials: readonly Material[], recordMaterial: Material, recordStart: number, recordEnd: number): V2Beta1ObservationCitation {
  const input = row(value, "beta1_observation_citation_invalid");
  if (input.kind === "OWN_DATA") exactKeys(input, CITATION_OWN_KEYS, "beta1_observation_citation_invalid");
  else if (input.kind === "LITERATURE") exactKeys(input, CITATION_LITERATURE_KEYS, "beta1_observation_citation_invalid");
  else throw new Error("beta1_observation_citation_invalid");
  if (input.kind === "OWN_DATA") {
    if (input.materialId !== recordMaterial.materialId || input.startByte !== recordStart || input.endByte !== recordEnd || !isBeta1Hash(input.spanHash) || beta1Hash(rawSpan(recordMaterial, Number(input.startByte), Number(input.endByte))) !== input.spanHash) throw new Error("beta1_observation_citation_invalid");
    return { kind: "OWN_DATA", materialId: input.materialId, startByte: Number(input.startByte), endByte: Number(input.endByte), spanHash: input.spanHash as string };
  }
  const canonical = canonicalCitationIdentity(input.identityKind, input.identity);
  if (input.identity !== canonical.identity) throw new Error("beta1_observation_citation_invalid");
  const citationMaterial = materials.find((item) => item.materialId === input.materialId);
  if (!citationMaterial || citationMaterial.kind !== "CITATION" || citationMaterial.materialId === recordMaterial.materialId || input.materialContentHash !== contentHash(citationMaterial) || !isBeta1Hash(input.spanHash)) throw new Error("beta1_observation_citation_invalid");
  const locatorText = rawSpan(citationMaterial, Number(input.startByte), Number(input.endByte));
  if (beta1Hash(locatorText) !== input.spanHash) throw new Error("beta1_observation_citation_invalid");
  const located = citationLocator(materials, canonical.identityKind, canonical.identity);
  if (!located || located.material.materialId !== citationMaterial.materialId || located.startByte !== input.startByte || located.endByte !== input.endByte || located.spanHash !== input.spanHash) throw new Error("beta1_observation_citation_invalid");
  return { kind: "LITERATURE", ...canonical, materialId: citationMaterial.materialId, materialContentHash: input.materialContentHash as string, startByte: Number(input.startByte), endByte: Number(input.endByte), spanHash: input.spanHash as string };
}

export function parseV2Beta1TypedObservationRecord(value: unknown, materials: readonly Material[]): V2Beta1TypedObservationRecord {
  const input = row(value, "beta1_observation_record_invalid"); exactKeys(input, RECORD_KEYS, "beta1_observation_record_invalid");
  const materialId = identifier(input.materialId, "beta1_observation_material_invalid"); const material = materials.find((item) => item.materialId === materialId);
  if (!material || input.materialContentHash !== contentHash(material)) throw new Error("beta1_observation_material_invalid");
  const startByte = Number(input.startByte); const endByte = Number(input.endByte); const excerpt = rawSpan(material, startByte, endByte);
  if (!isBeta1Hash(input.spanHash) || beta1Hash(excerpt) !== input.spanHash) throw new Error("beta1_observation_span_invalid");
  if (classifyV2Beta1ClauseResultState(excerpt) !== "OBSERVED") throw new Error("beta1_observation_source_state_invalid");
  const estimate = canonicalDecimal(input.estimate, "beta1_observation_estimate_invalid"); const pValue = canonicalDecimal(input.pValue, "beta1_observation_p_invalid"); const lower = canonicalDecimal(input.ci95Lower, "beta1_observation_ci_invalid"); const upper = canonicalDecimal(input.ci95Upper, "beta1_observation_ci_invalid");
  if (input.estimate !== estimate.text || input.pValue !== pValue.text || input.ci95Lower !== lower.text || input.ci95Upper !== upper.text) throw new Error("beta1_observation_decimal_identity_invalid");
  if (pValue.numeric < 0 || pValue.numeric > 1 || lower.numeric > upper.numeric || estimate.numeric < lower.numeric || estimate.numeric > upper.numeric || !["<", "<=", "=", ">=", ">"].includes(String(input.pComparator))) throw new Error("beta1_observation_numeric_invalid");
  const direction: Direction = estimate.numeric < 0 ? "NEGATIVE" : estimate.numeric > 0 ? "POSITIVE" : "ZERO";
  if (input.direction !== direction || !Number.isSafeInteger(input.sampleSize) || Number(input.sampleSize) < 1) throw new Error("beta1_observation_direction_or_sample_invalid");
  if (input.resultState !== "OBSERVED" || input.assertion !== "AFFIRMED" || input.inference !== "ASSOCIATION_ONLY" || input.rendererVersion !== V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION) throw new Error("beta1_observation_semantics_invalid");
  const normalizedExcerpt = excerpt.normalize("NFKC");
  const exactPair = (label: string, value: string) => new RegExp(`(?:^|[;；,，\\s])(?:${label})\\s*[:=]\\s*${value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?=$|[;；,，\\s])`, "iu").test(normalizedExcerpt);
  if (!exactPair("metricId|指標ID", String(input.metricId)) || !exactPair("cohortId|群組ID", String(input.cohortId)) || !exactPair("timepoint|時間點", String(input.timepoint)) || !exactPair("analysisId|分析ID", String(input.analysisId)) || !exactPair("effectId|效果ID", String(input.effectId))) throw new Error("beta1_observation_raw_key_support_invalid");
  const unit = exactUnit(input.unit, "beta1_observation_unit_invalid");
  const observedMatch = /(?:observed|measured|實際(?:觀察|測得))\s*(?:at|as|為|到)?\s*([+\-−–—]?(?:\d+(?:\.\d+)?|\.\d+))\s*([%％]|[A-Za-z][A-Za-z0-9/_-]*)/iu.exec(normalizedExcerpt);
  const estimateSupported = canonicalCandidateDecimal(observedMatch?.[1]) === estimate.text && (() => { try { return exactUnit(observedMatch?.[2]?.normalize("NFKC"), "beta1_observation_unit_invalid") === unit; } catch { return false; } })();
  const sampleSupported = new RegExp(`(?:N|樣本(?:數)?)\\s*[:=]?\\s*${String(input.sampleSize)}(?=$|[^0-9])`, "iu").test(normalizedExcerpt);
  const comparatorPattern = String(input.pComparator).replace("<=", "(?:<=|≤)").replace(">=", "(?:>=|≥)");
  const pRaw = new RegExp(`p\\s*${comparatorPattern}\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)(?=$|[^0-9])`, "iu").exec(normalizedExcerpt)?.[1];
  const pSupported = canonicalCandidateDecimal(pRaw) === pValue.text;
  const ciRaw = /(?:95%?\s*CI|CI95|95%?\s*信賴區間)\s*[:=]?\s*[\[(（]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[,，]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*[\])）]/iu.exec(normalizedExcerpt);
  const ciSupported = canonicalCandidateDecimal(ciRaw?.[1]) === lower.text && canonicalCandidateDecimal(ciRaw?.[2]) === upper.text;
  if (!estimateSupported || !sampleSupported || !pSupported || !ciSupported) throw new Error("beta1_observation_raw_numeric_support_invalid");
  const citation = parseCitation(input.citation, materials, material, startByte, endByte);
  if (citation.kind === "OWN_DATA" ? !/(?:citation|引用)\s*[:=]\s*OWN_DATA/iu.test(normalizedExcerpt) : !/(?:citation|引用)\s*[:=]/iu.test(normalizedExcerpt) || !normalizedExcerpt.toLocaleLowerCase("en-US").includes(citation.identity.toLocaleLowerCase("en-US"))) throw new Error("beta1_observation_raw_citation_support_invalid");
  const core = {
    recordId: identifier(input.recordId, "beta1_observation_record_id_invalid"), materialId, materialContentHash: input.materialContentHash as string, startByte, endByte, spanHash: input.spanHash as string,
    metricId: identifier(input.metricId, "beta1_observation_key_invalid"), cohortId: identifier(input.cohortId, "beta1_observation_key_invalid"), timepoint: identifier(input.timepoint, "beta1_observation_key_invalid"), analysisId: identifier(input.analysisId, "beta1_observation_key_invalid"), effectId: identifier(input.effectId, "beta1_observation_effect_invalid"),
    estimate: estimate.text, unit, direction, sampleSize: Number(input.sampleSize), pComparator: input.pComparator as Comparator, pValue: pValue.text, ci95Lower: lower.text, ci95Upper: upper.text,
    citation, resultState: "OBSERVED" as const, assertion: "AFFIRMED" as const, inference: "ASSOCIATION_ONLY" as const, rendererVersion: V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION,
  };
  if (!isBeta1Hash(input.recordHash) || beta1Hash(core) !== input.recordHash) throw new Error("beta1_observation_record_hash_invalid");
  return { ...core, recordHash: input.recordHash as string };
}

function validateRecordSet(records: readonly V2Beta1TypedObservationRecord[], materials: readonly Material[]) {
  const materialOrder = new Map(materials.map((item, index) => [item.materialId, index]));
  const sorted = [...records].sort((a, b) => (materialOrder.get(a.materialId)! - materialOrder.get(b.materialId)!) || a.startByte - b.startByte || (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0));
  if (beta1CanonicalJson(sorted) !== beta1CanonicalJson(records) || new Set(records.map((item) => item.recordId)).size !== records.length || new Set(records.map((item) => item.recordHash)).size !== records.length) throw new Error("beta1_observation_record_set_invalid");
  for (let index = 1; index < records.length; index += 1) if (records[index - 1].materialId === records[index].materialId && records[index - 1].endByte > records[index].startByte) throw new Error("beta1_observation_span_overlap");
  const groups = new Map<string, V2Beta1TypedObservationRecord[]>();
  for (const record of records) {
    const key = [record.metricId, record.cohortId, record.timepoint, record.analysisId, record.effectId, record.unit].join("|"); const group = groups.get(key) ?? []; group.push(record); groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (new Set(group.map((item) => item.direction)).size > 1 || Math.max(...group.map((item) => Number(item.ci95Lower))) > Math.min(...group.map((item) => Number(item.ci95Upper)))) throw new Error("beta1_observation_conflict");
  }
}

function authorityCore(context: V2Beta1ObservationAuthorityContext, decisions: V2Beta1ObservationDecision[], records: V2Beta1TypedObservationRecord[]) {
  const projectId = parseV2Beta1ProjectId(context.projectId);
  if (!Number.isSafeInteger(context.baseRevision) || context.baseRevision < 1 || !isBeta1Hash(context.baseContentHash) || !isBeta1Hash(context.researchDomainHash) || !context.researchDirection.trim() || !context.trustedScope.trim()) throw new Error("beta1_observation_context_invalid");
  const candidates = deriveV2Beta1ObservationCandidates(context.materials); const candidateMap = new Map(candidates.map((item) => [item.candidateId, item]));
  if (decisions.length !== candidates.length || new Set(decisions.map((item) => item.candidateId)).size !== decisions.length || decisions.some((item, index) => item.candidateId !== candidates[index]?.candidateId)) throw new Error("beta1_observation_decision_set_invalid");
  const recordMap = new Map(records.map((item) => [item.recordHash, item]));
  for (const decision of decisions) {
    const candidate = candidateMap.get(decision.candidateId); if (!candidate) throw new Error("beta1_observation_decision_invalid");
    if (decision.decision === "EXCLUDED") { if (decision.recordHash !== null) throw new Error("beta1_observation_decision_invalid"); continue; }
    if ((decision.decision !== "CONFIRMED" && decision.decision !== "CORRECTED") || !isBeta1Hash(decision.recordHash)) throw new Error("beta1_observation_decision_invalid");
    const record = recordMap.get(decision.recordHash); if (!record || record.materialId !== candidate.materialId || record.materialContentHash !== candidate.materialContentHash || record.startByte !== candidate.startByte || record.endByte !== candidate.endByte || record.spanHash !== candidate.spanHash) throw new Error("beta1_observation_decision_binding_invalid");
    if (decision.decision === "CONFIRMED" && (!candidate.suggestedRecord || beta1CanonicalJson({ ...candidate.suggestedRecord, recordId: record.recordId, recordHash: record.recordHash }) !== beta1CanonicalJson(record))) throw new Error("beta1_observation_confirmation_invalid");
  }
  const usedHashes = decisions.filter((item) => item.decision !== "EXCLUDED").map((item) => item.recordHash);
  if (usedHashes.length !== records.length || new Set(usedHashes).size !== records.length || usedHashes.some((hash) => !recordMap.has(hash!))) throw new Error("beta1_observation_orphan_record");
  validateRecordSet(records, context.materials);
  const recordSetHash = beta1Hash(records.map((record) => record.recordHash)); const confirmedRecordIds = records.map((record) => record.recordId); const confirmationSelectionHash = beta1Hash(decisions); const scopeAuthorityHash = beta1Hash({ authority: "EXPLICIT_USER_ASSERTION_SCOPE", scope: context.trustedScope, projectId });
  const confirmationCore = { projectId, baseRevision: context.baseRevision, baseContentHash: context.baseContentHash, sourceBundleHash: sourceBundleHash(context.materials), outputTarget: context.outputTarget, researchDirectionHash: beta1Hash(context.researchDirection), researchDomainHash: context.researchDomainHash, rendererVersion: V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION, decisions, recordSetHash, attestationStatement: V2_BETA1_EXPLICIT_ATTESTATION, confirmedRecordIds, confirmationSelectionHash, trustLabel: "EXPLICIT_USER_ASSERTION" as const, scopeClass: "SESSION_OR_LOCAL_SCOPE_BOUND" as const, scopeAuthorityHash };
  const confirmationHash = beta1Hash(confirmationCore);
  return { schemaId: V2_BETA1_OBSERVATION_CONFIRMATION_SCHEMA, ...confirmationCore, records, confirmationHash };
}

export function createV2Beta1ObservationConfirmationAuthority(context: V2Beta1ObservationAuthorityContext, decisions: V2Beta1ObservationDecision[], rawRecords: readonly unknown[]): V2Beta1ObservationConfirmationAuthority {
  const records = rawRecords.map((record) => parseV2Beta1TypedObservationRecord(record, context.materials));
  const core = authorityCore(context, decisions, records);
  return { ...core, authorityHash: beta1Hash(core) };
}

export function parseV2Beta1ObservationConfirmationAuthority(value: unknown, context: V2Beta1ObservationAuthorityContext): V2Beta1ObservationConfirmationAuthority {
  const input = row(value, "beta1_observation_authority_invalid"); exactKeys(input, AUTHORITY_KEYS, "beta1_observation_authority_invalid");
  if (!Array.isArray(input.decisions) || !Array.isArray(input.records) || !Array.isArray(input.confirmedRecordIds)) throw new Error("beta1_observation_authority_invalid");
  const decisions = input.decisions.map((value) => { const decision = row(value, "beta1_observation_decision_invalid"); exactKeys(decision, DECISION_KEYS, "beta1_observation_decision_invalid"); return { candidateId: identifier(decision.candidateId, "beta1_observation_decision_invalid"), decision: decision.decision as DecisionKind, recordHash: decision.recordHash === null ? null : String(decision.recordHash) }; });
  const expected = createV2Beta1ObservationConfirmationAuthority(context, decisions, input.records);
  if (beta1CanonicalJson(input) !== beta1CanonicalJson(expected)) throw new Error("beta1_observation_authority_invalid");
  return expected;
}

export function parseV2Beta1ObservationAuthorityStructural(value: unknown, materials: readonly Material[]): V2Beta1ObservationConfirmationAuthority {
  const input = row(value, "beta1_observation_authority_invalid"); exactKeys(input, AUTHORITY_KEYS, "beta1_observation_authority_invalid");
  if (!Array.isArray(input.decisions) || !Array.isArray(input.records) || !Array.isArray(input.confirmedRecordIds)) throw new Error("beta1_observation_authority_invalid");
  const projectId = parseV2Beta1ProjectId(input.projectId);
  if (input.schemaId !== V2_BETA1_OBSERVATION_CONFIRMATION_SCHEMA || !Number.isSafeInteger(input.baseRevision) || Number(input.baseRevision) < 1 || !isBeta1Hash(input.baseContentHash) || input.sourceBundleHash !== sourceBundleHash(materials) || !["SCI", "SSCI", "NSTC", "MOE"].includes(String(input.outputTarget)) || !isBeta1Hash(input.researchDirectionHash) || !isBeta1Hash(input.researchDomainHash) || input.rendererVersion !== V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION || input.attestationStatement !== V2_BETA1_EXPLICIT_ATTESTATION || input.trustLabel !== "EXPLICIT_USER_ASSERTION" || input.scopeClass !== "SESSION_OR_LOCAL_SCOPE_BOUND" || !isBeta1Hash(input.scopeAuthorityHash) || !isBeta1Hash(input.confirmationHash) || !isBeta1Hash(input.authorityHash)) throw new Error("beta1_observation_authority_invalid");
  const candidates = deriveV2Beta1ObservationCandidates(materials); const candidateMap = new Map(candidates.map((item) => [item.candidateId, item]));
  const decisions = input.decisions.map((value) => { const decision = row(value, "beta1_observation_decision_invalid"); exactKeys(decision, DECISION_KEYS, "beta1_observation_decision_invalid"); return { candidateId: identifier(decision.candidateId, "beta1_observation_decision_invalid"), decision: decision.decision as DecisionKind, recordHash: decision.recordHash === null ? null : String(decision.recordHash) }; });
  const records = input.records.map((record) => parseV2Beta1TypedObservationRecord(record, materials)); const recordMap = new Map(records.map((record) => [record.recordHash, record]));
  if (decisions.length !== candidates.length || decisions.some((decision, index) => decision.candidateId !== candidates[index]?.candidateId) || new Set(decisions.map((decision) => decision.candidateId)).size !== decisions.length) throw new Error("beta1_observation_decision_set_invalid");
  for (const decision of decisions) {
    const candidate = candidateMap.get(decision.candidateId);
    if (!candidate || !["CONFIRMED", "CORRECTED", "EXCLUDED"].includes(decision.decision) || (decision.decision === "EXCLUDED" ? decision.recordHash !== null : !isBeta1Hash(decision.recordHash))) throw new Error("beta1_observation_decision_invalid");
    if (decision.decision !== "EXCLUDED") {
      const record = recordMap.get(decision.recordHash!);
      if (!record || record.materialId !== candidate.materialId || record.materialContentHash !== candidate.materialContentHash || record.startByte !== candidate.startByte || record.endByte !== candidate.endByte || record.spanHash !== candidate.spanHash) throw new Error("beta1_observation_decision_binding_invalid");
      if (decision.decision === "CONFIRMED" && (!candidate.suggestedRecord || beta1CanonicalJson({ ...candidate.suggestedRecord, recordId: record.recordId, recordHash: record.recordHash }) !== beta1CanonicalJson(record))) throw new Error("beta1_observation_confirmation_invalid");
    }
  }
  const usedHashes = decisions.filter((item) => item.decision !== "EXCLUDED").map((item) => item.recordHash);
  if (usedHashes.length !== records.length || new Set(usedHashes).size !== records.length || usedHashes.some((hash) => !recordMap.has(hash!))) throw new Error("beta1_observation_orphan_record");
  validateRecordSet(records, materials);
  const recordSetHash = beta1Hash(records.map((record) => record.recordHash)); const confirmedRecordIds = records.map((record) => record.recordId); const confirmationSelectionHash = beta1Hash(decisions);
  const confirmationCore = { projectId, baseRevision: Number(input.baseRevision), baseContentHash: input.baseContentHash, sourceBundleHash: input.sourceBundleHash, outputTarget: input.outputTarget, researchDirectionHash: input.researchDirectionHash, researchDomainHash: input.researchDomainHash, rendererVersion: V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION, decisions, recordSetHash, attestationStatement: V2_BETA1_EXPLICIT_ATTESTATION, confirmedRecordIds, confirmationSelectionHash, trustLabel: "EXPLICIT_USER_ASSERTION" as const, scopeClass: "SESSION_OR_LOCAL_SCOPE_BOUND" as const, scopeAuthorityHash: input.scopeAuthorityHash };
  const confirmationHash = beta1Hash(confirmationCore); const core = { schemaId: V2_BETA1_OBSERVATION_CONFIRMATION_SCHEMA, ...confirmationCore, records, confirmationHash };
  const expected = { ...core, authorityHash: beta1Hash(core) };
  if (beta1CanonicalJson(input) !== beta1CanonicalJson(expected)) throw new Error("beta1_observation_authority_invalid");
  return expected as V2Beta1ObservationConfirmationAuthority;
}

export function createV2Beta1TypedObservationRecord(value: Omit<V2Beta1TypedObservationRecord, "recordId" | "recordHash"> & { recordId?: string }): V2Beta1TypedObservationRecord {
  const canonical = {
    ...value,
    estimate: canonicalDecimal(value.estimate, "beta1_observation_estimate_invalid").text,
    unit: exactUnit(value.unit, "beta1_observation_unit_invalid"),
    pValue: canonicalDecimal(value.pValue, "beta1_observation_p_invalid").text,
    ci95Lower: canonicalDecimal(value.ci95Lower, "beta1_observation_ci_invalid").text,
    ci95Upper: canonicalDecimal(value.ci95Upper, "beta1_observation_ci_invalid").text,
  };
  const recordId = value.recordId ?? `observation:${beta1Hash(canonical).slice(0, 40)}`; const core = { recordId, ...canonical };
  return { ...core, recordHash: beta1Hash(core) };
}

export function renderV2Beta1TypedObservationRecord(record: V2Beta1TypedObservationRecord): V2Beta1RenderedObservationClaim {
  const citation = record.citation.kind === "OWN_DATA" ? "OWN_DATA" : `${record.citation.identityKind}:${record.citation.identity}`;
  const claimId = `claim:${beta1Hash({ rendererVersion: V2_BETA1_TYPED_OBSERVATION_RENDERER_VERSION, recordHash: record.recordHash }).slice(0, 40)}`;
  const renderedClaimText = `${claimId}: ${record.metricId} (${record.cohortId}, ${record.timepoint}, ${record.analysisId}; ${record.effectId}) was observed at ${record.estimate} ${record.unit} (N=${record.sampleSize}; p${record.pComparator}${record.pValue}; 95% CI [${record.ci95Lower}, ${record.ci95Upper}]; ${citation}). This is an explicitly user-confirmed association-level claim.`;
  return { recordHash: record.recordHash, claimId, renderedClaimText, renderedClaimHash: beta1Hash(renderedClaimText) };
}

export function deriveV2Beta1ObservationEffectLineageHash(authority: V2Beta1ObservationConfirmationAuthority | null) {
  if (authority === null) return null;
  return beta1Hash({
    schemaId: authority.schemaId,
    projectId: authority.projectId,
    sourceBundleHash: authority.sourceBundleHash,
    outputTarget: authority.outputTarget,
    researchDirectionHash: authority.researchDirectionHash,
    researchDomainHash: authority.researchDomainHash,
    rendererVersion: authority.rendererVersion,
    decisions: authority.decisions,
    records: authority.records,
    recordSetHash: authority.recordSetHash,
    attestationStatement: authority.attestationStatement,
    confirmedRecordIds: authority.confirmedRecordIds,
    confirmationSelectionHash: authority.confirmationSelectionHash,
    trustLabel: authority.trustLabel,
    scopeClass: authority.scopeClass,
    scopeAuthorityHash: authority.scopeAuthorityHash,
  });
}

export function isV2Beta1ConfirmedObservationAuthority(value: unknown): value is V2Beta1ObservationConfirmationAuthority {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as { schemaId?: unknown }).schemaId === V2_BETA1_OBSERVATION_CONFIRMATION_SCHEMA && isBeta1Hash((value as { authorityHash?: unknown }).authorityHash));
}
