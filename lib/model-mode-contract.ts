export const MODEL_MODE_CONTRACT_VERSION = "old-mike-model-routing/1.0.0" as const;

export const modelModeProfiles = ["AUTO", "FAST", "ACADEMIC", "DEEP_REVIEW", "CODE_DATA"] as const;
export const modelRoutingOperations = ["PROJECT_CHAT", "ACADEMIC_LANGUAGE", "REVIEW_STUDIO", "JOURNAL_SUBMISSION", "PROPOSAL_GUIDANCE", "CODE_DATA_ASSIST", "SUBMISSION_NAVIGATOR", "ONE_CLICK_INSPIRATION", "ASSIST_LITERATURE_REVIEW", "ASSIST_GAP_ANALYSIS", "ASSIST_THEORY_ANALYSIS", "ASSIST_DESIGN_ANALYSIS", "ASSIST_ETHICS_DRAFT", "ASSIST_ROUTE_SECTION", "ASSIST_REVIEWER_SIMULATION"] as const;

export type ModelModeProfile = (typeof modelModeProfiles)[number];
export type ModelRoutingOperation = (typeof modelRoutingOperations)[number];

export const modelModeLabels: Readonly<Record<ModelModeProfile, string>> = Object.freeze({
  AUTO: "老麥預設",
  FAST: "快速整理",
  ACADEMIC: "學術模式",
  DEEP_REVIEW: "深度審閱",
  CODE_DATA: "程式與資料",
});

const enabledModes: Readonly<Record<ModelRoutingOperation, readonly ModelModeProfile[]>> = Object.freeze({
  PROJECT_CHAT: ["AUTO"],
  ACADEMIC_LANGUAGE: ["AUTO"],
  REVIEW_STUDIO: ["AUTO"],
  JOURNAL_SUBMISSION: ["AUTO"],
  PROPOSAL_GUIDANCE: ["AUTO"],
  CODE_DATA_ASSIST: [],
  SUBMISSION_NAVIGATOR: ["AUTO"],
  ONE_CLICK_INSPIRATION: ["AUTO"],
  ASSIST_LITERATURE_REVIEW: ["AUTO"],
  ASSIST_GAP_ANALYSIS: ["AUTO"],
  ASSIST_THEORY_ANALYSIS: ["AUTO"],
  ASSIST_DESIGN_ANALYSIS: ["AUTO"],
  ASSIST_ETHICS_DRAFT: ["AUTO"],
  ASSIST_ROUTE_SECTION: ["AUTO"],
  ASSIST_REVIEWER_SIMULATION: ["AUTO"],
});

export class ModelModeContractError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.name = "ModelModeContractError";
    this.code = code;
    this.status = status;
  }
}

export function parseModelModeProfile(value: unknown): ModelModeProfile {
  if (typeof value !== "string" || !modelModeProfiles.includes(value as ModelModeProfile)) throw new ModelModeContractError("invalid_model_mode_profile");
  return value as ModelModeProfile;
}

export function enabledModelModesForOperation(operation: ModelRoutingOperation): readonly ModelModeProfile[] {
  return enabledModes[operation];
}
