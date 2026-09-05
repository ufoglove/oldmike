// Research Opportunity Radar（老麥・前沿雷達）— Signal Discovery Engine.
// Evidence First: every opportunity is derived from real scholarly observations
// collected by the portal's source adapters. No fabricated trends, percentages,
// citations or novelty. All model judgements are AI self-assessments labelled
// UNVERIFIED until independent verification.

export const RADAR_CONTRACT = "research-opportunity-radar/1.0.0" as const;
export const OPPORTUNITY_MAX = 12 as const;
export const SCAN_DOMAINS = [
  "AI與數位科技跨領域應用", "AI教育應用", "AR/VR/XR教育應用", "AR/VR/XR職業安全應用",
  "AI與職業安全", "AI與環境工程", "AIoT與智慧監測", "新興數位科技", "Human-AI Collaboration",
  "智慧製造與先進製程", "Digital Twin", "Multimodal AI", "Agentic AI", "Generative AI", "Wearable AI",
] as const;

// Opportunity score weights (100 total) — the radar score, distinct from the
// research-topic score used later in the Topic Lab.
export const OPPORTUNITY_SCORE_WEIGHTS = Object.freeze({
  trendGrowth: 20,
  researchGap: 20,
  researcherFit: 20,
  noveltyPotential: 15,
  crossDomainPotential: 10,
  feasibility: 10,
  futureExtension: 5,
});

export type RadarScoreBreakdown = { trendGrowth: number; researchGap: number; researcherFit: number; noveltyPotential: number; crossDomainPotential: number; feasibility: number; futureExtension: number };

export type OpportunitySignal = "HOT_TREND" | "RISING_TREND" | "WEAK_SIGNAL" | "EMERGING_TECHNOLOGY" | "CONVERGENCE" | "GAP_SIGNAL" | "SATURATION_WARNING" | "OPPORTUNITY";

export type RadarOpportunity = {
  opportunityId: string;
  title: string;              // e.g. "Multimodal AI × XR × Occupational Safety"
  trend: "↑↑↑" | "↑↑" | "↑" | "→" | "↓";
  maturity: "EMERGING" | "GROWING" | "MATURE" | "SATURATED";
  researchHeat: number;       // 0-100
  growthSpeed: number;        // 0-100
  researcherFit: number;      // 0-100
  researchGapLevel: "HIGH" | "MEDIUM" | "LOW";
  saturationLevel: "LOW" | "LOW_MEDIUM" | "MEDIUM" | "HIGH";
  opportunityScore: number;   // 0-100 (weighted)
  scoreBreakdown: RadarScoreBreakdown;
  grade: "PRIORITY" | "STRONG" | "WATCH" | "LOW";
  summary: string;            // 老麥一句話
  signals: OpportunitySignal[];
  relatedTechnologies: string[];
  relatedDomains: string[];
  gapSignals: string[];       // evidence-derived gap phrases
  evidence: { sourceId: string; provider: string; year: string | null; title: string; doi: string | null }[];
  evidenceStatus: "UNVERIFIED" | "NEEDS_VERIFICATION";
};

export type RadarScanResult = {
  contractVersion: typeof RADAR_CONTRACT;
  scanId: string;
  generatedAt: string;
  focus: string;
  capability: string;
  providerStates: Record<string, string>;
  globalOpportunities: RadarOpportunity[];
  myOpportunities: RadarOpportunity[];
  evidenceNote: string;
};

export class RadarContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "RadarContractError";
    this.code = code;
    this.status = status;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function modelText(value: unknown, maximum = 1_000): string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum ? value.trim() : "";
}
function modelTextArray(value: unknown, maximumItems = 10, itemMaximum = 300): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumItems) return null;
  const output = value.map((item) => modelText(item, itemMaximum));
  return output.every(Boolean) ? output : null;
}
function score(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}
function rank(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
}

export function parseRadarScanRequest(value: unknown): { focus: string; idempotencyKey: string } {
  if (!record(value) || value.operation !== "SCAN_OPPORTUNITIES") throw new RadarContractError("unsupported_operation", 422);
  const idempotencyKey = modelText(value.idempotencyKey, 160);
  if (!idempotencyKey) throw new RadarContractError("idempotency_key_required");
  const focus = modelText(value.focus, 300) || "";
  return { focus, idempotencyKey };
}

export function parseRadarEnvelope(content: string): { ok: true; value: { opportunities: RadarOpportunity[]; evidenceNote: string } } | { ok: false; code: string; stage: string; recoverableFields: string[] } {
  let value: unknown;
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "").trim();
    value = JSON.parse(cleaned);
  } catch {
    return { ok: false, code: "radar_json_invalid", stage: "JSON_PARSE", recoverableFields: ["opportunities"] };
  }
  if (!record(value) || !Array.isArray(value.opportunities) || value.opportunities.length < 1 || value.opportunities.length > OPPORTUNITY_MAX) {
    return { ok: false, code: "radar_shape_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: ["opportunities"] };
  }
  const evidenceNote = modelText(value.evidenceNote, 500) || "";
  const opportunities: RadarOpportunity[] = [];
  for (let index = 0; index < value.opportunities.length; index += 1) {
    const item = value.opportunities[index];
    if (!record(item)) return { ok: false, code: "radar_opportunity_invalid", stage: "FIELD_VALUE", recoverableFields: [`opportunities.${index}`] };
    const title = modelText(item.title, 300);
    const summary = modelText(item.summary, 800);
    const trend = ["↑↑↑", "↑↑", "↑", "→", "↓"].includes(item.trend as string) ? (item.trend as RadarOpportunity["trend"]) : "→";
    const maturity = ["EMERGING", "GROWING", "MATURE", "SATURATED"].includes(item.maturity as string) ? item.maturity as RadarOpportunity["maturity"] : "EMERGING";
    const researchHeat = score(item.researchHeat);
    const growthSpeed = score(item.growthSpeed);
    const researcherFit = score(item.researcherFit);
    const gapLevel = ["HIGH", "MEDIUM", "LOW"].includes(item.researchGapLevel as string) ? item.researchGapLevel as RadarOpportunity["researchGapLevel"] : "MEDIUM";
    const saturation = ["LOW", "LOW_MEDIUM", "MEDIUM", "HIGH"].includes(item.saturationLevel as string) ? item.saturationLevel as RadarOpportunity["saturationLevel"] : "MEDIUM";
    const breakdown = record(item.scoreBreakdown) ? item.scoreBreakdown : {};
    const sb: RadarScoreBreakdown = {
      trendGrowth: rank(breakdown.trendGrowth) ?? 0,
      researchGap: rank(breakdown.researchGap) ?? 0,
      researcherFit: rank(breakdown.researcherFit) ?? 0,
      noveltyPotential: rank(breakdown.noveltyPotential) ?? 0,
      crossDomainPotential: rank(breakdown.crossDomainPotential) ?? 0,
      feasibility: rank(breakdown.feasibility) ?? 0,
      futureExtension: rank(breakdown.futureExtension) ?? 0,
    };
    const opportunityScore = Math.round(
      sb.trendGrowth * 0.2 + sb.researchGap * 0.2 + sb.researcherFit * 0.2 + sb.noveltyPotential * 0.15 + sb.crossDomainPotential * 0.1 + sb.feasibility * 0.1 + sb.futureExtension * 0.05,
    );
    const grade: RadarOpportunity["grade"] = opportunityScore >= 90 ? "PRIORITY" : opportunityScore >= 80 ? "STRONG" : opportunityScore >= 70 ? "WATCH" : "LOW";
    const signals = Array.isArray(item.signals) ? (item.signals as unknown[]).filter((s): s is OpportunitySignal => typeof s === "string" && ["HOT_TREND", "RISING_TREND", "WEAK_SIGNAL", "EMERGING_TECHNOLOGY", "CONVERGENCE", "GAP_SIGNAL", "SATURATION_WARNING", "OPPORTUNITY"].includes(s)).slice(0, 8) : [];
    const relatedTechnologies = modelTextArray(item.relatedTechnologies, 8, 120) || [];
    const relatedDomains = modelTextArray(item.relatedDomains, 8, 120) || [];
    const gapSignals = modelTextArray(item.gapSignals, 8, 200) || [];
    const evidence = Array.isArray(item.evidence)
      ? (item.evidence as unknown[]).slice(0, 12).map((e) => record(e) ? ({ sourceId: modelText(e.sourceId, 120) || "", provider: modelText(e.provider, 60) || "", year: e.year === null ? null : modelText(e.year, 20), title: modelText(e.title, 300) || "", doi: e.doi === null ? null : modelText(e.doi, 300) }) : null).filter((e): e is NonNullable<typeof e> => Boolean(e && (e.title || e.sourceId)))
      : [];
    if (!title || !summary || researchHeat === null || growthSpeed === null || researcherFit === null) {
      return { ok: false, code: "radar_opportunity_value_invalid", stage: "FIELD_VALUE", recoverableFields: [`opportunities.${index}`] };
    }
    opportunities.push({
      opportunityId: `R-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(index + 1).padStart(2, "0")}`,
      title, trend, maturity, researchHeat, growthSpeed, researcherFit, researchGapLevel: gapLevel, saturationLevel: saturation,
      opportunityScore, scoreBreakdown: sb, grade, summary, signals, relatedTechnologies, relatedDomains, gapSignals, evidence,
      evidenceStatus: "UNVERIFIED",
    });
  }
  return { ok: true, value: { opportunities, evidenceNote } };
}
