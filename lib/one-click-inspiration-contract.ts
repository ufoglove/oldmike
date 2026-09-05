// One-click inspiration (一鍵靈感泉源) — fixed input/output contracts.
// Integrity rules mirror the rest of the portal: no fabricated citations, no
// claims of novelty without verification, every candidate scored 0-100 by the
// model itself and labelled as AI self-assessment, evidence always UNVERIFIED
// until fresh verification.

export const ONE_CLICK_INSPIRATION_CONTRACT = "one-click-inspiration/1.0.0" as const;
export const RESEARCH_FOCUS_MAX_LENGTH = 200 as const;
export const CANDIDATE_COUNT = 10 as const;
export const TOP3_COUNT = 3 as const;
export const CANDIDATE_OUTPUT_LIMIT_BYTES = 192_000 as const;

export const RESEARCH_GOALS = ["AUTO", "JOURNAL", "SSCI", "NSTC", "THREE_YEAR"] as const;
export type ResearchGoalId = (typeof RESEARCH_GOALS)[number];

export const RESEARCH_GOAL_LABELS: Readonly<Record<ResearchGoalId, string>> = Object.freeze({
  AUTO: "自動判斷",
  JOURNAL: "快速期刊",
  SSCI: "SSCI／SCI論文",
  NSTC: "科技部計畫",
  THREE_YEAR: "三年研究主軸",
});

export type OneClickInspirationRequest = {
  radarContext?: unknown;
  operation: "GENERATE_INSPIRATIONS";
  idempotencyKey: string;
  researchFocus: string;
  researchGoal: ResearchGoalId;
  researchDomains: string[];
};

export type InspirationCandidate = {
  ideaType?: string;
  evidenceStatus?: string;
  candidateId: string;
  titleZh: string;
  titleEn: string;
  researchQuestion: string;
  literatureGap: string;
  innovation: string;
  theory: string;
  method: string;
  feasibility: string;
  venue: string;
  score: number; // model self-assessment, 0-100 integer
};

export type InspirationTop3Entry = {
  candidateId: string;
  role: "PRIORITY" | "FASTEST" | "PROJECT_SCALE";
  reason: string;
  pros: string[];
  risks: string[];
};

export type OneClickInspirationResult = {
  contractVersion: typeof ONE_CLICK_INSPIRATION_CONTRACT;
  judgment: string;
  evidenceStatus: "UNVERIFIED" | "NEEDS_VERIFICATION";
  evidenceNote: string;
  candidates: InspirationCandidate[];
  top3: InspirationTop3Entry[];
  inputHash: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function modelText(value: unknown, maximum = 1_000): string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum ? value.trim() : "";
}

function modelTextArray(value: unknown, maximumItems = 6, itemMaximum = 300): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximumItems) return null;
  const output = value.map((item) => modelText(item, itemMaximum));
  return output.every(Boolean) ? output : null;
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

export class OneClickInspirationContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "OneClickInspirationContractError";
    this.code = code;
    this.status = status;
  }
}

export function parseOneClickInspirationRequest(value: unknown): OneClickInspirationRequest {
  if (!record(value) || value.operation !== "GENERATE_INSPIRATIONS") throw new OneClickInspirationContractError("unsupported_operation", 422);
  const idempotencyKey = modelText(value.idempotencyKey, 160);
  if (!idempotencyKey) throw new OneClickInspirationContractError("idempotency_key_required");
  const researchFocus = modelText(value.researchFocus, RESEARCH_FOCUS_MAX_LENGTH) || "";
  const researchGoal = value.researchGoal;
  if (!RESEARCH_GOALS.includes(researchGoal as ResearchGoalId)) throw new OneClickInspirationContractError("invalid_research_goal");
  const researchDomains = Array.isArray(value.researchDomains) && value.researchDomains.length > 0
    ? (value.researchDomains as unknown[]).filter((item): item is string => typeof item === "string" && item.length > 0 && item.length <= 200).slice(0, 12)
    : [];
  if (researchDomains.length === 0) throw new OneClickInspirationContractError("research_domains_required");
  return { operation: "GENERATE_INSPIRATIONS", idempotencyKey, researchFocus, researchGoal: researchGoal as ResearchGoalId, researchDomains };
}

export function parseInspirationEnvelope(content: string): { ok: true; value: { judgment: string; evidenceStatus: "UNVERIFIED" | "NEEDS_VERIFICATION"; evidenceNote: string; candidates: InspirationCandidate[]; top3: InspirationTop3Entry[] } } | { ok: false; code: string; stage: string; recoverableFields: string[] } {
  let value: unknown;
  try {
    const cleaned = content.replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "").trim();
    value = JSON.parse(cleaned);
  } catch {
    return { ok: false, code: "one_click_inspiration_json_invalid", stage: "JSON_PARSE", recoverableFields: ["candidates"] };
  }
  if (!record(value) || !Array.isArray(value.candidates) || value.candidates.length !== CANDIDATE_COUNT) {
    return { ok: false, code: "one_click_inspiration_shape_invalid", stage: "TOP_LEVEL_SHAPE", recoverableFields: ["candidates"] };
  }
  const judgment = modelText(value.judgment, 2_000);
  if (!judgment) return { ok: false, code: "one_click_inspiration_judgment_invalid", stage: "FIELD_VALUE", recoverableFields: ["judgment"] };
  const evidenceStatus = value.evidenceStatus === "UNVERIFIED" || value.evidenceStatus === "NEEDS_VERIFICATION" ? value.evidenceStatus : "UNVERIFIED";
  const evidenceNote = modelText(value.evidenceNote, 300) || "";
  const candidates: InspirationCandidate[] = [];
  for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
    const item = value.candidates[index];
    if (!record(item)) return { ok: false, code: "one_click_inspiration_candidate_invalid", stage: "FIELD_VALUE", recoverableFields: [`candidates.${index}`] };
    const titleZh = modelText(item.titleZh, 300);
    const titleEn = modelText(item.titleEn, 400);
    const researchQuestion = modelText(item.researchQuestion, 800);
    const literatureGap = modelText(item.literatureGap, 800);
    const innovation = modelText(item.innovation, 800);
    const theory = modelText(item.theory, 400);
    const method = modelText(item.method, 800);
    const feasibility = modelText(item.feasibility, 500);
    const venue = modelText(item.venue, 300);
    const score = isScore(item.score) ? item.score : null;
    if (!titleZh || !titleEn || !researchQuestion || !literatureGap || !innovation || !method || score === null) {
      return { ok: false, code: "one_click_inspiration_candidate_value_invalid", stage: "FIELD_VALUE", recoverableFields: [`candidates.${index}`] };
    }
    candidates.push({ candidateId: `inspiration_${index + 1}`, titleZh, titleEn, researchQuestion, literatureGap, innovation, theory: theory || "待確認", method, feasibility: feasibility || "待確認", venue: venue || "待確認", score });
  }
  if (!Array.isArray(value.top3) || value.top3.length !== TOP3_COUNT) {
    return { ok: false, code: "one_click_inspiration_top3_invalid", stage: "FIELD_VALUE", recoverableFields: ["top3"] };
  }
  const roles: InspirationTop3Entry["role"][] = ["PRIORITY", "FASTEST", "PROJECT_SCALE"];
  const top3: InspirationTop3Entry[] = [];
  for (let index = 0; index < TOP3_COUNT; index += 1) {
    const item = value.top3[index];
    if (!record(item)) return { ok: false, code: "one_click_inspiration_top3_invalid", stage: "FIELD_VALUE", recoverableFields: [`top3.${index}`] };
    const candidateId = modelText(item.candidateId, 80) || `inspiration_${index + 1}`;
    const reason = modelText(item.reason, 800);
    const pros = modelTextArray(item.pros);
    const risks = modelTextArray(item.risks);
    if (!reason || !pros || !risks) return { ok: false, code: "one_click_inspiration_top3_invalid", stage: "FIELD_VALUE", recoverableFields: [`top3.${index}`] };
    top3.push({ candidateId, role: roles[index], reason, pros, risks });
  }
  const knownIds = new Set(candidates.map((c) => c.candidateId));
  for (const entry of top3) {
    if (!knownIds.has(entry.candidateId)) {
      return { ok: false, code: "one_click_inspiration_top3_reference_invalid", stage: "FIELD_VALUE", recoverableFields: ["top3"] };
    }
  }
  return { ok: true, value: { judgment, evidenceStatus, evidenceNote, candidates, top3 } };
}
