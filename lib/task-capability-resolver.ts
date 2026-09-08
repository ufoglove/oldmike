/**
 * Task Capability Resolver & Skill Adapter Contract (v4.0 Spec §2, §3, §8)
 *
 * 定位：將第三方審查後的 Skills（如 academic-research-skills 引用校核、claude-scholar 筆記格式）
 * 轉化為受控的 TaskCapability，納入現有 ProjectWorkOrder / AgentJob 體系。
 *
 * 嚴格原則：
 * 1. 唯一狀態機：不為第三方 Skill 另建專案流程或進度狀態，一律掛入現有 Stage / Task。
 * 2. 授權與邊界：非 MIT/Apache-2.0 或具 NC 限制者（如 CC BY-NC 4.0）標記為 NON_COMMERCIAL_RESEARCH_ONLY。
 * 3. 永遠不全域覆寫：禁止覆蓋 AGENTS.md, SOUL.md, MEMORY.md 或全域 prompt。
 * 4. 誠實狀態：無真實金鑰/環境回傳 UNSUPPORTED / NOT_RUN，禁止偽造合格。
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type ProjectWorkOrder, type WorkerState } from "./project-orchestrator-contract.ts";

export const TASK_CAPABILITY_RESOLVER_CONTRACT = "task-capability-resolver/1.0.0" as const;

export type SkillLicenseClassification =
  | "PERMISSIVE_MIT_OR_APACHE"
  | "NON_COMMERCIAL_RESEARCH_ONLY" // e.g. CC BY-NC 4.0 (academic-research-skills)
  | "PROPRIETARY_OR_RESTRICTED"
  | "UNREVIEWED_SOURCE_ONLY";

export type CapabilityExecutionMode =
  | "INTERNAL_DETERMINISTIC"
  | "SANDBOX_ISOLATED"
  | "EXTERNAL_API_BOUND"
  | "HUMAN_ASSIST_PROMPT_ONLY";

export type TaskCapability = {
  capabilityId: string;
  sourcePackageId: string;
  upstreamRepo: string;
  pinnedRevision?: string;
  licenseCategory: SkillLicenseClassification;
  executionMode: CapabilityExecutionMode;
  supportedGoals: PrimaryGoalId[];
  applicableStages: string[];
  requiredInputs: string[];
  outputArtifactType: string;
  writeScopePolicy: "READ_ONLY" | "APPEND_CANDIDATE_DRAFT" | "MUTATE_LOCKABLE_FIELD";
};

export type TaskCapabilityInvocation = {
  invocationId: string;
  capabilityId: string;
  workOrderId: string;
  projectId: string;
  workspaceId: string;
  stageId: string;
  inputPayload: Record<string, unknown>;
  dryRun?: boolean;
};

export type TaskCapabilityResult = {
  ok: boolean;
  invocationId: string;
  capabilityId: string;
  status: WorkerState;
  outputArtifact?: {
    format: "JSON" | "MARKDOWN";
    content: string;
    summary: string;
    hash: string;
  };
  unresolvedIssues?: string[];
  errorMessage?: string;
};

/**
 * 核心註冊表：已審查並允許受控適配的 Skill 清單
 */
export const ADAPTED_CAPABILITIES: ReadonlyArray<TaskCapability> = [
  {
    capabilityId: "ars-citation-verification",
    sourcePackageId: "academic-research-skills",
    upstreamRepo: "https://github.com/Imbad0202/academic-research-skills",
    pinnedRevision: "v2.9-curated",
    licenseCategory: "NON_COMMERCIAL_RESEARCH_ONLY", // CC BY-NC 4.0
    executionMode: "INTERNAL_DETERMINISTIC",
    supportedGoals: ["JOURNAL_SCI_SSCI", "NSTC_GENERAL", "MOE_TPR"],
    applicableStages: ["literature-review", "gap-novelty", "manuscript-writing"],
    requiredInputs: ["citationList", "claimText"],
    outputArtifactType: "CITATION_VERIFICATION_REPORT",
    writeScopePolicy: "APPEND_CANDIDATE_DRAFT",
  },
  {
    capabilityId: "cs-obsidian-project-vault",
    sourcePackageId: "claude-scholar",
    upstreamRepo: "https://github.com/kepano/obsidian-skills",
    pinnedRevision: "bb9ec95e1b59c3471bd6fd77a78a4042430bfac3",
    licenseCategory: "PERMISSIVE_MIT_OR_APACHE", // MIT
    executionMode: "INTERNAL_DETERMINISTIC",
    supportedGoals: ["JOURNAL_SCI_SSCI", "NSTC_GENERAL", "MOE_TPR"],
    applicableStages: ["project-init", "topic-lab", "literature-review"],
    requiredInputs: ["topicTitle", "notesList"],
    outputArtifactType: "STRUCTURED_RESEARCH_NOTE",
    writeScopePolicy: "APPEND_CANDIDATE_DRAFT",
  },
];

/**
 * 依工作單目標與階段，解析出目前可用之 Capability 清單
 */
export function resolveApplicableCapabilities(params: {
  workOrder: Pick<ProjectWorkOrder, "primaryGoal">;
  stageId: string;
  isCommercialTenant?: boolean;
}): TaskCapability[] {
  return ADAPTED_CAPABILITIES.filter((cap) => {
    if (!cap.supportedGoals.includes(params.workOrder.primaryGoal)) return false;
    if (!cap.applicableStages.includes(params.stageId)) return false;
    // 商業租戶嚴格阻擋非商業授權（CC BY-NC 等）
    if (params.isCommercialTenant && cap.licenseCategory === "NON_COMMERCIAL_RESEARCH_ONLY") {
      return false;
    }
    return true;
  });
}
