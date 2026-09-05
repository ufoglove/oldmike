// Research Topic Validation（老麥・選題實驗室深度驗證）— Research Decision Engine.
// Evidence First: decomposition, gap matrix, novelty and score are derived from
// real scholarly observations; every claim is traceable; nothing is fabricated.

export const TOPIC_VALIDATION_CONTRACT = "research-topic-validation/1.0.0" as const;

export const VALIDATION_GAPS = [
  "TECHNOLOGY_GAP", "POPULATION_GAP", "CONTEXT_GAP", "THEORY_GAP", "METHOD_GAP",
  "TEMPORAL_GAP", "DATA_GAP", "HUMAN_AI_GAP", "IMPLEMENTATION_GAP", "CROSS_DOMAIN_GAP",
] as const;
export type ValidationGapId = (typeof VALIDATION_GAPS)[number];
export const GAP_LABELS: Readonly<Record<ValidationGapId, string>> = Object.freeze({
  TECHNOLOGY_GAP: "Technology Gap", POPULATION_GAP: "Population Gap", CONTEXT_GAP: "Context Gap",
  THEORY_GAP: "Theory Gap", METHOD_GAP: "Method Gap", TEMPORAL_GAP: "Temporal Gap",
  DATA_GAP: "Data Gap", HUMAN_AI_GAP: "Human-AI Gap", IMPLEMENTATION_GAP: "Implementation Gap", CROSS_DOMAIN_GAP: "Cross-domain Gap",
});
export type GapStatus = "CONFIRMED" | "LIKELY" | "WEAK" | "NOT_SUPPORTED" | "UNVERIFIED";

export const VALIDATION_SCORE_WEIGHTS = Object.freeze({
  novelty: 20, researchGap: 20, academicContribution: 15, theoreticalContribution: 10,
  methodologicalStrength: 10, feasibility: 10, dataAccessibility: 5, journalFundingFit: 5, futureExtension: 5,
});

export type ValidationParameterInnovation = "CONSERVATIVE" | "BALANCED" | "FRONTIER";
export type ValidationParameterDifficulty = "LOW" | "MEDIUM" | "HIGH";
export type ValidationParameterDuration = "3M" | "6M" | "1Y" | "3Y";
export type ValidationParameterOutput = "JOURNAL" | "SSCI" | "SCI" | "Q1Q2" | "NSTC" | "THREE_YEAR";
export type ValidationParameterDesign = "SURVEY" | "EXPERIMENT" | "RCT" | "QUASI" | "LONGITUDINAL" | "MIXED" | "SEM" | "MULTIMODAL" | "AI_DEV" | "FIELD";

export type ValidationParameters = {
  innovation: ValidationParameterInnovation;
  difficulty: ValidationParameterDifficulty;
  duration: ValidationParameterDuration;
  output: ValidationParameterOutput;
  design: ValidationParameterDesign;
};

export type TopicValidationRequest = {
  operation: "VALIDATE_TOPIC";
  idempotencyKey: string;
  topicTitle: string;
  researchQuestion?: string;
  parameters: ValidationParameters;
  provenance?: { radarOpportunityId?: string; inspirationRunId?: string; ideaId?: string };
};

export type DecompositionItem = { label: string; value: string; status: "PROVIDED" | "INFERRED" | "SUGGESTED" | "MISSING" };
export type EvidenceLedgerEntry = { claim: string; sourceTitle: string; provider: string; year: string | null; doi: string | null; relationship: "SUPPORTS" | "CONTRADICTS" | "UNKNOWN"; verificationStatus: "UNVERIFIED" };
export type GapRow = { gap: ValidationGapId; status: GapStatus; note: string };
export type NoveltyResult = { level: "HIGH" | "MODERATE" | "LOW" | "POTENTIAL_DUPLICATE" | "INSUFFICIENT_EVIDENCE"; closestStudies: { title: string; year: string | null; doi: string | null }[]; contributionDelta: string[]; answer: string };
export type Reviewer2Item = { question: string; answer: string; severity: "LOW" | "MEDIUM" | "HIGH" };
export type ValidationScore = { total: number; breakdown: Record<keyof typeof VALIDATION_SCORE_WEIGHTS, number>; grade: "STRONG_RECOMMEND" | "RECOMMEND" | "CONDITIONAL" | "WEAK" };

export type TopicValidationResult = {
  contractVersion: typeof TOPIC_VALIDATION_CONTRACT;
  validationId: string;
  version: number;
  parameters: ValidationParameters;
  decomposition: DecompositionItem[];
  evidence: { ledger: EvidenceLedgerEntry[]; note: string };
  gapMatrix: GapRow[];
  novelty: NoveltyResult;
  score: ValidationScore;
  reviewer2: Reviewer2Item[];
  recommendedNextStep: string;
  evidenceStatus: "UNVERIFIED" | "NEEDS_VERIFICATION";
};

export class TopicValidationContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = "TopicValidationContractError"; this.code = code; this.status = status; }
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function modelText(value: unknown, maximum = 1_000): string { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum ? value.trim() : ""; }
function modelTextArray(value: unknown, maximumItems = 10, itemMaximum = 400): string[] | null { if (!Array.isArray(value) || value.length < 1 || value.length > maximumItems) return null; const out = value.map((item) => modelText(item, itemMaximum)); return out.every(Boolean) ? out : null; }
function score(value: unknown): number | null { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null; }
function oneOf<T extends string>(value: unknown, options: readonly T[]): T | null { return typeof value === "string" && options.includes(value as T) ? value as T : null; }

export function parseTopicValidationRequest(value: unknown): TopicValidationRequest {
  if (!record(value) || value.operation !== "VALIDATE_TOPIC") throw new TopicValidationContractError("unsupported_operation", 422);
  const idempotencyKey = modelText(value.idempotencyKey, 160);
  const topicTitle = modelText(value.topicTitle, 500);
  if (!idempotencyKey || !topicTitle) throw new TopicValidationContractError("topic_title_required");
  const researchQuestion = value.researchQuestion === undefined || value.researchQuestion === null ? undefined : modelText(value.researchQuestion, 800);
  const parameters = record(value.parameters) ? value.parameters : {};
  const innovation = oneOf(parameters.innovation, ["CONSERVATIVE", "BALANCED", "FRONTIER"] as const);
  const difficulty = oneOf(parameters.difficulty, ["LOW", "MEDIUM", "HIGH"] as const);
  const duration = oneOf(parameters.duration, ["3M", "6M", "1Y", "3Y"] as const);
  const output = oneOf(parameters.output, ["JOURNAL", "SSCI", "SCI", "Q1Q2", "NSTC", "THREE_YEAR"] as const);
  const design = oneOf(parameters.design, ["SURVEY", "EXPERIMENT", "RCT", "QUASI", "LONGITUDINAL", "MIXED", "SEM", "MULTIMODAL", "AI_DEV", "FIELD"] as const);
  if (!innovation || !difficulty || !duration || !output || !design) throw new TopicValidationContractError("invalid_parameters");
  let provenance: TopicValidationRequest["provenance"];
  if (record(value.provenance)) {
    provenance = {
      radarOpportunityId: modelText(value.provenance.radarOpportunityId, 120) || undefined,
      inspirationRunId: modelText(value.provenance.inspirationRunId, 120) || undefined,
      ideaId: modelText(value.provenance.ideaId, 120) || undefined,
    };
  }
  return { operation: "VALIDATE_TOPIC", idempotencyKey, topicTitle, researchQuestion, parameters: { innovation, difficulty, duration, output, design }, provenance };
}

export function parseTopicValidationEnvelope(content: string): { ok: true; value: { decomposition: DecompositionItem[]; evidence: { ledger: EvidenceLedgerEntry[]; note: string }; gapMatrix: GapRow[]; novelty: NoveltyResult; score: ValidationScore; reviewer2: Reviewer2Item[]; recommendedNextStep: string } } | { ok: false; code: string; stage: string; recoverableFields: string[] } {
  let value: unknown;
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "").trim();
    value = JSON.parse(cleaned);
  } catch { return { ok: false, code: "topic_validation_json_invalid", stage: "JSON_PARSE", recoverableFields: ["decomposition"] }; }
  if (!record(value)) return { ok: false, code: "topic_validation_shape_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: [] };
  // decomposition (12 items; missing allowed but status must be set)
  if (!Array.isArray(value.decomposition) || value.decomposition.length < 6) return { ok: false, code: "topic_validation_decomposition_invalid", stage: "FIELD_VALUE", recoverableFields: ["decomposition"] };
  const decomposition: DecompositionItem[] = value.decomposition.slice(0, 20).map((item) => {
    const r = record(item) ? item : {};
    const label = modelText(r.label, 200) || "項目";
    const val = modelText(r.value, 800) || "";
    const status = oneOf(r.status, ["PROVIDED", "INFERRED", "SUGGESTED", "MISSING"] as const) || "MISSING";
    return { label, value: val, status };
  });
  // evidence ledger
  const evidence = record(value.evidence) ? value.evidence : {};
  const ledger: EvidenceLedgerEntry[] = Array.isArray(evidence.ledger) ? (evidence.ledger as unknown[]).slice(0, 16).map((item) => {
    const r = record(item) ? item : {};
    return {
      claim: modelText(r.claim, 500) || "",
      sourceTitle: modelText(r.sourceTitle, 300) || "",
      provider: modelText(r.provider, 60) || "UNKNOWN",
      year: r.year === null ? null : modelText(r.year, 20),
      doi: r.doi === null ? null : modelText(r.doi, 300),
      relationship: oneOf(r.relationship, ["SUPPORTS", "CONTRADICTS", "UNKNOWN"] as const) || "UNKNOWN",
      verificationStatus: "UNVERIFIED",
    } as unknown as EvidenceLedgerEntry;
  }).filter((e) => e.claim && e.sourceTitle) : [];
  const evidenceNote = modelText(evidence.note, 500) || "";
  // gap matrix (all 10 required)
  if (!Array.isArray(value.gapMatrix) || value.gapMatrix.length !== VALIDATION_GAPS.length) return { ok: false, code: "topic_validation_gapmatrix_invalid", stage: "FIELD_VALUE", recoverableFields: ["gapMatrix"] };
  const gapMatrix: GapRow[] = value.gapMatrix.map((item, index) => {
    const r = record(item) ? item : {};
    const gap = oneOf(r.gap, VALIDATION_GAPS) || VALIDATION_GAPS[index];
    const status = oneOf(r.status, ["CONFIRMED", "LIKELY", "WEAK", "NOT_SUPPORTED", "UNVERIFIED"] as const) || "UNVERIFIED";
    return { gap, status, note: modelText(r.note, 500) || "" };
  });
  // novelty
  const novelty = record(value.novelty) ? value.novelty : {};
  const level = oneOf(novelty.level, ["HIGH", "MODERATE", "LOW", "POTENTIAL_DUPLICATE", "INSUFFICIENT_EVIDENCE"] as const);
  const closestStudies = Array.isArray(novelty.closestStudies) ? novelty.closestStudies.slice(0, 5).map((item) => { const r = record(item) ? item : {}; return { title: modelText(r.title, 300) || "", year: r.year === null ? null : modelText(r.year, 20), doi: r.doi === null ? null : modelText(r.doi, 300) }; }).filter((s) => s.title) : [];
  const contributionDelta = modelTextArray(novelty.contributionDelta, 8, 400) || [];
  const answer = modelText(novelty.answer, 800) || "";
  if (!level || !answer || contributionDelta.length === 0) return { ok: false, code: "topic_validation_novelty_invalid", stage: "FIELD_VALUE", recoverableFields: ["novelty"] };
  // score
  const scoreValue = record(value.score) ? value.score : {};
  const breakdown = record(scoreValue.breakdown) ? scoreValue.breakdown : {};
  const b: ValidationScore["breakdown"] = {
    novelty: score(breakdown.novelty) ?? 0, researchGap: score(breakdown.researchGap) ?? 0, academicContribution: score(breakdown.academicContribution) ?? 0,
    theoreticalContribution: score(breakdown.theoreticalContribution) ?? 0, methodologicalStrength: score(breakdown.methodologicalStrength) ?? 0,
    feasibility: score(breakdown.feasibility) ?? 0, dataAccessibility: score(breakdown.dataAccessibility) ?? 0,
    journalFundingFit: score(breakdown.journalFundingFit) ?? 0, futureExtension: score(breakdown.futureExtension) ?? 0,
  };
  const total = Math.round(b.novelty * 0.2 + b.researchGap * 0.2 + b.academicContribution * 0.15 + b.theoreticalContribution * 0.1 + b.methodologicalStrength * 0.1 + b.feasibility * 0.1 + b.dataAccessibility * 0.05 + b.journalFundingFit * 0.05 + b.futureExtension * 0.05);
  const grade: ValidationScore["grade"] = total >= 85 ? "STRONG_RECOMMEND" : total >= 70 ? "RECOMMEND" : total >= 55 ? "CONDITIONAL" : "WEAK";
  // reviewer2 (all 10 required)
  if (!Array.isArray(value.reviewer2) || value.reviewer2.length !== 10) return { ok: false, code: "topic_validation_reviewer2_invalid", stage: "FIELD_VALUE", recoverableFields: ["reviewer2"] };
  const reviewer2: Reviewer2Item[] = value.reviewer2.map((item) => {
    const r = record(item) ? item : {};
    return { question: modelText(r.question, 300) || "問題", answer: modelText(r.answer, 600) || "", severity: oneOf(r.severity, ["LOW", "MEDIUM", "HIGH"] as const) || "MEDIUM" };
  }).filter((r) => r.answer);
  if (reviewer2.length < 10) return { ok: false, code: "topic_validation_reviewer2_invalid", stage: "FIELD_VALUE", recoverableFields: ["reviewer2"] };
  const recommendedNextStep = modelText(value.recommendedNextStep, 600) || "";
  return { ok: true, value: { decomposition, evidence: { ledger, note: evidenceNote }, gapMatrix, novelty: { level, closestStudies, contributionDelta, answer }, score: { total, breakdown: b, grade }, reviewer2, recommendedNextStep } };
}
