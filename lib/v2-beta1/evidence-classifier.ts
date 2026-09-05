import type { V2Beta1SourceMaterial } from "./contracts.ts";
import { classifyV2Beta1ClauseResultState, contextualizeV2Beta1ResultProposition, extractV2Beta1CitationIdentityAuthority, extractV2Beta1ClaimAuthority, extractV2Beta1ClauseResultStates, extractV2Beta1EvidenceAnchors, extractV2Beta1ProbabilityClaims, extractV2Beta1StructuredEvidenceRecords, hasV2Beta1ClauseMissingMarker, reduceV2Beta1ResultPropositionStates, tokenizeV2Beta1ResultPropositions, type V2Beta1StructuredEvidenceRecord } from "./evidence-anchors.ts";
import { beta1Hash } from "./canonical-hash.ts";

export type V2Beta1ResultEvidenceClass = "MISSING" | "PLANNED" | "OBSERVED" | "CONFLICT";
export type V2Beta1PublicationReviewStatus = "FINAL_CONFIRMABLE" | "READY_WITH_GAPS" | "BLOCKED_EVIDENCE_OR_INTEGRITY";
export type V2Beta1ResultEvidence = { classification: V2Beta1ResultEvidenceClass; consistencyProven: boolean; traceable: boolean; sourceMaterialIds: string[] };

type SourceMaterialAuthority = Pick<V2Beta1SourceMaterial, "materialId" | "kind" | "title" | "content">;
type NumericRange = readonly [number, number];
type Probability = { comparator: "<" | "<=" | "=" | ">" | ">="; value: number; raw: string };
type ProbabilityRange = { lower: number; lowerInclusive: boolean; upper: number; upperInclusive: boolean };
type Effect = { name: string; value: number; unit: string; direction?: "UP" | "DOWN" | "NEUTRAL"; scopeSpans?: string[] };
type Observation = { key: string; identityResolved: boolean; effects: Effect[]; samples: number[]; probabilities: Probability[]; confidenceIntervals: NumericRange[]; directions: Array<"UP" | "DOWN">; hasNumericEvidence: boolean };

const RESULT_KINDS = new Set(["RESULTS", "STATISTICS", "TABLE", "FIGURE"]);
const REQUIRED_MANUSCRIPT_SECTIONS = ["ABSTRACT", "INTRODUCTION", "METHODS", "RESULTS", "DISCUSSION", "CONCLUSION"] as const;
const NUMERIC_MARKER = /(?:[+\-−–—]?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:%|％|分|點|秒|分鐘|小時|days?|hours?|points?|[A-Za-zµμ/]+)|[ＮNnｎ]\s*[=＝]\s*\d+|\bp\s*(?:<=|>=|[<>=≤≥])\s*(?:0?\.\d+|1(?:\.0+)?)|(?:95\s*(?:%|％)\s*CI|信賴區間))/iu;

function normalized(value: string) { return value.normalize("NFKC").replace(/[‐‑‒–—−]/gu, "-"); }
function normalizedLabel(value: string | undefined, fallback: string) { return (value ?? fallback).trim().toLocaleLowerCase("en-US").replace(/\s+/gu, "_"); }
function labeled(value: string, label: string) { return value.match(new RegExp(`(?:^|[;；\\s])${label}\\s*[:=]\\s*([\\p{L}\\p{N}._-]+)`, "iu"))?.[1]; }
function inferredMetric(value: string) {
  const explicit = labeled(value, "metricId") ?? value.match(/(?:^|[;；\s])指標ID\s*[:=]\s*([\p{L}\p{N}._-]+)/iu)?.[1];
  if (explicit) return normalizedLabel(explicit, "");
  const inferred = value.match(/(?:^|[。；;\n])\s*([\p{Script=Han}A-Za-z][\p{Script=Han}A-Za-z0-9 _-]{1,30}?)(?:實際(?:觀察|測得)(?:為|到)?|觀察值為|結果(?:顯示|指出)?為|為|提升|下降|增加|減少|\s*=)\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)/u)?.[1];
  return inferred ? normalizedLabel(inferred, "") : null;
}
function observationKey(value: string, fallbackMetric: string) {
  const metric = inferredMetric(value);
  return [
    metric ?? `unresolved_${normalizedLabel(fallbackMetric, "material")}`,
    normalizedLabel(labeled(value, "cohortId") ?? value.match(/(?:^|[;；\s])群組ID\s*[:=]\s*([\p{L}\p{N}._-]+)/iu)?.[1], "all"),
    normalizedLabel(labeled(value, "timepoint") ?? value.match(/(?:^|[;；\s])時間點\s*[:=]\s*([\p{L}\p{N}._-]+)/iu)?.[1], "unspecified"),
    normalizedLabel(labeled(value, "analysisId") ?? value.match(/(?:^|[;；\s])分析ID\s*[:=]\s*([\p{L}\p{N}._-]+)/iu)?.[1], "primary"),
  ].join("|");
}
function uniqueNumbers(values: readonly number[]) { return [...new Set(values.filter(Number.isFinite))]; }

function canonicalComparator(value: string): Probability["comparator"] {
  return value === "≤" ? "<=" : value === "≥" ? ">=" : value as Probability["comparator"];
}
function probabilityRange(item: Probability): ProbabilityRange | null {
  if (item.value < 0 || item.value > 1) return null;
  if (item.comparator === "=") return { lower: item.value, lowerInclusive: true, upper: item.value, upperInclusive: true };
  if (item.comparator === "<") return { lower: 0, lowerInclusive: true, upper: item.value, upperInclusive: false };
  if (item.comparator === "<=") return { lower: 0, lowerInclusive: true, upper: item.value, upperInclusive: true };
  if (item.comparator === ">") return { lower: item.value, lowerInclusive: false, upper: 1, upperInclusive: true };
  return { lower: item.value, lowerInclusive: true, upper: 1, upperInclusive: true };
}
function probabilitiesCompatible(values: readonly Probability[]) {
  if (!values.length) return true;
  const ranges = values.map(probabilityRange);
  if (ranges.some((item) => item === null)) return false;
  let lower = 0; let lowerInclusive = true; let upper = 1; let upperInclusive = true;
  for (const range of ranges as ProbabilityRange[]) {
    if (range.lower > lower) { lower = range.lower; lowerInclusive = range.lowerInclusive; } else if (range.lower === lower) lowerInclusive = lowerInclusive && range.lowerInclusive;
    if (range.upper < upper) { upper = range.upper; upperInclusive = range.upperInclusive; } else if (range.upper === upper) upperInclusive = upperInclusive && range.upperInclusive;
  }
  return lower < upper || (lower === upper && lowerInclusive && upperInclusive);
}

function extractLegacyObservation(material: SourceMaterialAuthority, rawValue: string): Observation {
  const value = normalized(rawValue);
  const confidenceIntervalSpans = [...value.matchAll(/(?:95\s*%\s*CI|信賴區間)\s*[:：]?\s*[\[(]\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)\s*%?\s*[,，]\s*[+\-]?(?:\d+(?:\.\d+)?|\.\d+)\s*%?\s*[\])]/giu)]
    .map((match) => [match.index ?? 0, (match.index ?? 0) + match[0].length] as const);
  const effects: Effect[] = [...value.matchAll(/\b(β|OR|RR|HR|Cohen(?:['’]s)?\s+d|Hedges(?:['’]s)?\s+g)\s*=\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|[A-Za-zµμ/]+)?/giu)]
    .map((match) => ({ name: match[1].toLocaleLowerCase("en-US"), value: Number(match[2]), unit: (match[3] ?? "UNITLESS").toLocaleLowerCase("en-US") }));
  for (const match of value.matchAll(/(?:為|提升|下降|增加|減少|效果(?:為)?|effect(?:\s+size)?(?:\s+of)?|(?:結果|表現|分數|負荷|指標)\s*=)\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(%|分|點|秒|分鐘|小時|days?|hours?|points?)?/giu)) effects.push({ name: "generic", value: Number(match[1]), unit: (match[2] ?? "UNITLESS").toLocaleLowerCase("en-US") });
  for (const match of value.matchAll(/([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%/gu)) {
    const offset = match.index ?? 0;
    if (confidenceIntervalSpans.some(([start, end]) => offset >= start && offset < end)) continue;
    effects.push({ name: "generic", value: Number(match[1]), unit: "%" });
  }
  const samples = uniqueNumbers([...value.matchAll(/(?:^|[^\p{L}\p{N}_])([Nn])\s*=\s*(\d+)/gu)].map((match) => Number(match[2])));
  const probabilities = extractV2Beta1ProbabilityClaims(rawValue).map((item) => ({ comparator: canonicalComparator(item.comparator), value: item.value, raw: item.raw }));
  const confidenceIntervals = [...value.matchAll(/(?:95\s*%\s*CI|信賴區間)\s*[:：]?\s*[\[(]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%?\s*[,，]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%?\s*[\])]/giu)].map((match) => [Number(match[1]), Number(match[2])] as const);
  const directions: Observation["directions"] = [];
  if (/(?:方向為)?(?:增加|提升|上升|正向|高於|improv|increase|positive|higher)/iu.test(value)) directions.push("UP");
  if (/(?:方向為)?(?:下降|降低|減少|負向|低於|decreas|negative|lower)/iu.test(value) || effects.some((item) => item.value < 0)) directions.push("DOWN");
  return { key: observationKey(value, material.materialId), identityResolved: inferredMetric(value) !== null, effects: effects.filter((item) => Number.isFinite(item.value)), samples, probabilities, confidenceIntervals, directions, hasNumericEvidence: NUMERIC_MARKER.test(value) };
}

function structuredObservation(record: V2Beta1StructuredEvidenceRecord): Observation {
  if (!record.observationKey) throw new Error("beta1_evidence_observation_key_invalid");
  const normalizedRaw = normalized(record.raw);
  const samples = uniqueNumbers(record.sampleSizeSpans.flatMap((span) => {
    const parsed = normalized(span).match(/[Nn]\s*=\s*(\d+)/u);
    return parsed ? [Number(parsed[1])] : [];
  }));
  const probabilities = extractV2Beta1ProbabilityClaims(record.raw).map((item) => ({ comparator: canonicalComparator(item.comparator), value: item.value, raw: item.raw }));
  const confidenceIntervals = record.confidenceIntervalSpans.flatMap((span) => {
    const parsed = normalized(span).match(/(?:95\s*%\s*CI|信賴區間)\s*[:：]?\s*[\[(]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%?\s*[,，]\s*([+\-]?(?:\d+(?:\.\d+)?|\.\d+))\s*%?\s*[\])]/iu);
    return parsed ? [[Number(parsed[1]), Number(parsed[2])] as const] : [];
  });
  const directions = [...new Set(record.effects.map((effect) => effect.direction).filter((value): value is "UP" | "DOWN" => value !== "NEUTRAL"))];
  return {
    key: [record.observationKey.metricId, record.observationKey.cohortId, record.observationKey.timepoint, record.observationKey.analysisId].join("|"),
    identityResolved: true,
    effects: record.effects.map((effect) => ({ name: effect.name, value: effect.value, unit: effect.unit, direction: effect.direction, scopeSpans: effect.scopeSpans })),
    samples,
    probabilities,
    confidenceIntervals,
    directions,
    hasNumericEvidence: NUMERIC_MARKER.test(normalizedRaw),
  };
}

function extractObservations(material: SourceMaterialAuthority): Observation[] {
  const source = material.content;
  const observed = tokenizeV2Beta1ResultPropositions(source).filter((proposition) => proposition.resultState === "OBSERVED");
  return observed.flatMap((proposition) => {
    const recordSource = contextualizeV2Beta1ResultProposition(proposition);
    const records = extractV2Beta1StructuredEvidenceRecords(recordSource).records.filter((record) => record.structured && classifyV2Beta1ClauseResultState(proposition.raw) === "OBSERVED");
    return records.length ? records.map(structuredObservation) : [extractLegacyObservation(material, recordSource)];
  });
}

function incompatibleCanonical(values: readonly unknown[]) { return new Set(values.map((value) => JSON.stringify(value))).size > 1; }
function groupConflict(group: readonly Observation[]) {
  const effects = group.flatMap((item) => item.effects); const samples = group.flatMap((item) => item.samples); const probabilities = group.flatMap((item) => item.probabilities); const intervals = group.flatMap((item) => item.confidenceIntervals); const directions = new Set(group.flatMap((item) => item.directions));
  const effectsByIdentity = new Map<string, Effect[]>();
  for (const effect of effects) { const key = `${effect.name.toLocaleLowerCase("en-US")}|${effect.unit.toLocaleLowerCase("en-US")}`; effectsByIdentity.set(key, [...(effectsByIdentity.get(key) ?? []), effect]); }
  return [...effectsByIdentity.values()].some((items) => incompatibleCanonical(items.map(({ name: _name, unit: _unit, ...rest }) => rest))) || incompatibleCanonical(samples) || !probabilitiesCompatible(probabilities) || incompatibleCanonical(intervals) || directions.size > 1;
}
function groupReconciled(group: readonly Observation[]) {
  if (group.length < 2 || group.some((item) => !item.hasNumericEvidence) || groupConflict(group)) return false;
  return [group.filter((item) => item.effects.length > 0).length, group.filter((item) => item.samples.length > 0).length, group.filter((item) => item.probabilities.length > 0).length, group.filter((item) => item.confidenceIntervals.length > 0).length, group.filter((item) => item.directions.length > 0).length].some((count) => count >= 2);
}

export function hasV2Beta1MissingResultMarker(value: string) {
  return hasV2Beta1ClauseMissingMarker(value);
}
export function hasV2Beta1PlannedResultMarker(value: string) {
  return extractV2Beta1ClauseResultStates(value).some((clause) => clause.resultState === "PLANNED");
}
export function extractV2Beta1ProtectedEvidenceTokens(value: string) { return extractV2Beta1EvidenceAnchors(value); }

export type V2Beta1CitationIndex = { directIdentities: string[]; numericMarkers: string[]; indexHash: string };
function canonicalCitationIdentity(value: string) { return normalized(value).replace(/^doi\s*:\s*/iu, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//iu, "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US"); }
export function buildV2Beta1CitationIndex(materials: readonly SourceMaterialAuthority[]): V2Beta1CitationIndex {
  const direct = new Set<string>();
  const numeric = new Set<string>();
  for (const material of materials.filter((item) => item.kind === "CITATION")) {
    const authority = extractV2Beta1CitationIdentityAuthority(material.content);
    const identities = authority.directIdentities.map(canonicalCitationIdentity);
    for (const identity of identities) direct.add(identity);
    if (identities.length > 0) for (const marker of authority.numericMarkers) numeric.add(normalized(marker));
  }
  const core = { directIdentities: [...direct].sort(), numericMarkers: [...numeric].sort() };
  return { ...core, indexHash: beta1Hash(core) };
}

export function hasV2Beta1TraceableCitationIdentity(materials: readonly SourceMaterialAuthority[]) {
  const citationIndex = buildV2Beta1CitationIndex(materials);
  const directIdentities = new Set(citationIndex.directIdentities);
  const boundNumericMarkers = new Set(citationIndex.numericMarkers);
  return materials.filter((item) => RESULT_KINDS.has(item.kind)).some((material) => {
    const authority = extractV2Beta1CitationIdentityAuthority(material.content);
    return authority.directIdentities.some((identity) => directIdentities.has(canonicalCitationIdentity(identity))) || authority.numericMarkers.some((marker) => boundNumericMarkers.has(normalized(marker)));
  });
}

export function classifyV2Beta1ResultEvidence(materials: readonly SourceMaterialAuthority[]): V2Beta1ResultEvidence {
  const resultMaterials = materials.filter((item) => RESULT_KINDS.has(item.kind)); const sourceMaterialIds = resultMaterials.map((item) => item.materialId);
  if (!resultMaterials.length) return { classification: "MISSING", consistencyProven: false, traceable: false, sourceMaterialIds };
  const rows = resultMaterials.map((item) => item.content); const traceable = hasV2Beta1TraceableCitationIdentity(materials);
  const claims = rows.flatMap((row) => extractV2Beta1ClaimAuthority(row).clauses);
  const hasMissing = rows.some(hasV2Beta1MissingResultMarker);
  const hasPlanned = rows.some(hasV2Beta1PlannedResultMarker);
  const hasUnresolved = claims.some((clause) => clause.resultState === "UNRESOLVED" || clause.unresolved);
  const reduction = reduceV2Beta1ResultPropositionStates(claims.map((clause) => clause.resultState));
  const structuredEvidenceProven = resultMaterials.every((item) => {
    const records = extractV2Beta1StructuredEvidenceRecords(item.content).records;
    const claims = extractV2Beta1ClaimAuthority(item.content).clauses;
    return records.length > 0 && records.every((record) => record.structured) && claims.every((clause) => !clause.unresolved);
  });
  const observations = resultMaterials.flatMap(extractObservations); const groups = new Map<string, Observation[]>();
  for (const observation of observations.filter((item) => item.identityResolved)) groups.set(observation.key, [...(groups.get(observation.key) ?? []), observation]);
  if ([...groups.values()].some(groupConflict)) return { classification: "CONFLICT", consistencyProven: false, traceable, sourceMaterialIds };
  const observed = reduction.hasObserved && observations.some((item) => item.hasNumericEvidence);
  if (observed) return { classification: "OBSERVED", consistencyProven: !hasMissing && !hasPlanned && !hasUnresolved && structuredEvidenceProven && groups.size > 0 && [...groups.values()].every(groupReconciled), traceable, sourceMaterialIds };
  if (hasPlanned) return { classification: "PLANNED", consistencyProven: false, traceable, sourceMaterialIds };
  return { classification: "MISSING", consistencyProven: false, traceable: false, sourceMaterialIds };
}

function hasLogicalSection(materials: readonly SourceMaterialAuthority[], section: typeof REQUIRED_MANUSCRIPT_SECTIONS[number]) {
  if (section === "DISCUSSION") return materials.some((item) => item.kind === "NOTE" && /discussion|討論/iu.test(`${item.materialId} ${item.title} ${item.content.slice(0, 48)}`));
  if (section === "CONCLUSION") return materials.some((item) => item.kind === "NOTE" && /conclusion|結論/iu.test(`${item.materialId} ${item.title} ${item.content.slice(0, 48)}`));
  return materials.some((item) => item.kind === section);
}
export function assessV2Beta1PublicationReadiness(materials: readonly SourceMaterialAuthority[]) {
  const resultEvidence = classifyV2Beta1ResultEvidence(materials); const requiredSectionsComplete = REQUIRED_MANUSCRIPT_SECTIONS.every((section) => hasLogicalSection(materials, section));
  const hasBlockingMarker = materials.some((item) => hasV2Beta1MissingResultMarker(item.content)) || materials.some((item) => RESULT_KINDS.has(item.kind) && hasV2Beta1PlannedResultMarker(item.content));
  const citationPresent = hasV2Beta1TraceableCitationIdentity(materials);
  const publicationUsable = requiredSectionsComplete && citationPresent && resultEvidence.classification === "OBSERVED" && resultEvidence.consistencyProven && resultEvidence.traceable && !hasBlockingMarker;
  const reviewStatus: V2Beta1PublicationReviewStatus = publicationUsable ? "FINAL_CONFIRMABLE" : resultEvidence.classification === "CONFLICT" ? "BLOCKED_EVIDENCE_OR_INTEGRITY" : "READY_WITH_GAPS";
  return { resultEvidence, requiredSectionsComplete, hasBlockingMarker, publicationUsable, reviewStatus };
}
