/**
 * Research Workflow Registry & Node State Contract
 * Spec: v3.3.0 (V3-U03-R2) Section 5, 6, 7
 *
 * Defines:
 * 1. Three-route workflow templates (JOURNAL_SCI_SSCI / NSTC_GENERAL / MOE_TPR) with
 *    stable stage_id, prerequisites, output type, route applicability, gates.
 * 2. Eight node states: NOT_STARTED | IN_PROGRESS | AWAITING_INPUT | AWAITING_APPROVAL |
 *    BLOCKED | FAILED | COMPLETED_VALID | STALE | NOT_APPLICABLE | MODULE_UNAVAILABLE.
 * 3. Progress口径: per selected work order endpoint and workflow version, applicable nodes only;
 *    optional doesn't block; N/A with reason; shared nodes counted once.
 * 4. Green light ONLY derived from backend valid completion snapshot.
 */
import { type PrimaryGoalId } from "./research-goal-registry.ts";

export const RESEARCH_WORKFLOW_REGISTRY_CONTRACT = "research-workflow-registry/1.0.0" as const;

export const NODE_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AWAITING_INPUT",
  "AWAITING_APPROVAL",
  "BLOCKED",
  "FAILED",
  "COMPLETED_VALID",
  "STALE",
  "NOT_APPLICABLE",
  "MODULE_UNAVAILABLE",
] as const;
export type WorkflowNodeState = (typeof NODE_STATES)[number];

export type WorkflowNode = {
  nodeId: string;
  titleZh: string;
  route: PrimaryGoalId | "COMMON";
  prerequisites: string[];
  outputType: string;
  required: boolean;
  gate: string;
};

export type WorkflowRouteTemplate = {
  route: PrimaryGoalId;
  labelZh: string;
  nodes: WorkflowNode[];
};

export const COMMON_BACKBONE: WorkflowNode[] = [
  { nodeId: "research-goal-background", titleZh: "研究目標與背景", route: "COMMON", prerequisites: [], outputType: "GOAL_CONTEXT", required: true, gate: "goal selected" },
  { nodeId: "frontier-radar", titleZh: "前沿雷達（可選）", route: "COMMON", prerequisites: [], outputType: "OPPORTUNITY_SET", required: false, gate: "optional entry" },
  { nodeId: "one-click-inspiration", titleZh: "一鍵靈感（可選）", route: "COMMON", prerequisites: [], outputType: "IDEA_SET", required: false, gate: "optional entry" },
  { nodeId: "topic-lab", titleZh: "選題實驗室", route: "COMMON", prerequisites: ["research-goal-background"], outputType: "TOPIC_SELECTION_SNAPSHOT", required: true, gate: "confirmed topic + sources" },
  { nodeId: "submission-navigation", titleZh: "投稿與計畫導航", route: "COMMON", prerequisites: ["topic-lab"], outputType: "SUBMISSION_NAVIGATION_SNAPSHOT", required: true, gate: "route candidates + readiness" },
  { nodeId: "research-blueprint", titleZh: "研究藍圖", route: "COMMON", prerequisites: ["submission-navigation"], outputType: "RESEARCH_BLUEPRINT", required: true, gate: "handoff snapshot" },
  { nodeId: "literature-deep-dive", titleZh: "文獻深化／Gap", route: "COMMON", prerequisites: ["topic-lab"], outputType: "GAP_EVIDENCE", required: false, gate: "dependent" },
  { nodeId: "theory-mechanism", titleZh: "理論與機制（適用時）", route: "COMMON", prerequisites: ["topic-lab"], outputType: "THEORY_MECHANISM", required: false, gate: "applicable only" },
  { nodeId: "research-design", titleZh: "研究設計與分析規劃", route: "COMMON", prerequisites: ["research-blueprint"], outputType: "RESEARCH_DESIGN", required: true, gate: "design gate" },
];

export const JOURNAL_ROUTE_NODES: WorkflowNode[] = [
  { nodeId: "journal-positioning", titleZh: "期刊定位與文章類型", route: "JOURNAL_SCI_SSCI", prerequisites: ["submission-navigation"], outputType: "POSITIONING_VARIANT", required: true, gate: "scope + article type" },
  { nodeId: "planning-ethics-protocol", titleZh: "研究規劃／倫理工具 Protocol", route: "JOURNAL_SCI_SSCI", prerequisites: ["research-design"], outputType: "ETHICS_PROTOCOL_PLAN", required: true, gate: "as applicable" },
  { nodeId: "pilot-or-formal", titleZh: "預試與正式研究／既有資料接入", route: "JOURNAL_SCI_SSCI", prerequisites: ["planning-ethics-protocol"], outputType: "STUDY_EXECUTION", required: true, gate: "data/ethics" },
  { nodeId: "data-governance", titleZh: "資料治理", route: "JOURNAL_SCI_SSCI", prerequisites: ["pilot-or-formal"], outputType: "DATA_GOVERNANCE", required: true, gate: "dict + raw preserved" },
  { nodeId: "analysis-results-lock", titleZh: "分析實驗室與結果鎖定", route: "JOURNAL_SCI_SSCI", prerequisites: ["data-governance"], outputType: "RESULT_FACT", required: true, gate: "analysis + result lock" },
  { nodeId: "manuscript-draft", titleZh: "全文協作", route: "JOURNAL_SCI_SSCI", prerequisites: ["analysis-results-lock"], outputType: "MANUSCRIPT_SCIENTIFIC_DRAFT", required: true, gate: "sources" },
  { nodeId: "scientific-review-revision", titleZh: "科學審查與修訂", route: "JOURNAL_SCI_SSCI", prerequisites: ["manuscript-draft"], outputType: "REVIEW_REVISION", required: true, gate: "review" },
  { nodeId: "translation-polish", titleZh: "翻譯與學術潤稿", route: "JOURNAL_SCI_SSCI", prerequisites: ["scientific-review-revision"], outputType: "LANGUAGE_REVIEWED", required: true, gate: "meaning lock" },
  { nodeId: "journal-compliance", titleZh: "目標期刊合規與作者核准", route: "JOURNAL_SCI_SSCI", prerequisites: ["translation-polish"], outputType: "COMPLIANCE_CHECKED", required: true, gate: "author approval" },
  { nodeId: "submission-package", titleZh: "投稿包就緒", route: "JOURNAL_SCI_SSCI", prerequisites: ["journal-compliance"], outputType: "JOURNAL_SUBMISSION_PACKAGE", required: true, gate: "package" },
  { nodeId: "journal-submission-event", titleZh: "真實送件／審查／修訂紀錄（外部事件）", route: "JOURNAL_SCI_SSCI", prerequisites: ["submission-package"], outputType: "EXTERNAL_EVENT_LOG", required: false, gate: "external" },
];

export const NSTC_ROUTE_NODES: WorkflowNode[] = [
  { nodeId: "nstc-science-position", titleZh: "科學問題與學門定位", route: "NSTC_GENERAL", prerequisites: ["submission-navigation"], outputType: "NSTC_ROUTE_CANDIDATE", required: true, gate: "discipline" },
  { nodeId: "nstc-gap-innovation", titleZh: "研究現況／Gap／創新", route: "NSTC_GENERAL", prerequisites: ["nstc-science-position"], outputType: "GAP_INNOVATION", required: true, gate: "evidence" },
  { nodeId: "nstc-objectives-methods", titleZh: "目標、方法、工作包及倫理規劃", route: "NSTC_GENERAL", prerequisites: ["nstc-gap-innovation"], outputType: "METHODS_WORKPACKAGES", required: true, gate: "methods" },
  { nodeId: "nstc-schedule-budget", titleZh: "時程、人力、設備及預算規劃", route: "NSTC_GENERAL", prerequisites: ["nstc-objectives-methods"], outputType: "BUDGET_PLAN", required: true, gate: "costs met" },
  { nodeId: "nstc-proposal", titleZh: "國科會計畫書", route: "NSTC_GENERAL", prerequisites: ["nstc-schedule-budget"], outputType: "PROPOSAL_DRAFT", required: true, gate: "proposal" },
  { nodeId: "nstc-simulated-review", titleZh: "科學與學門模擬審查", route: "NSTC_GENERAL", prerequisites: ["nstc-proposal"], outputType: "SIMULATED_REVIEW", required: true, gate: "review" },
  { nodeId: "nstc-language-format", titleZh: "語言與格式檢查", route: "NSTC_GENERAL", prerequisites: ["nstc-simulated-review"], outputType: "LANGUAGE_REVIEWED", required: true, gate: "format" },
  { nodeId: "nstc-cycle-compliance", titleZh: "當年度／校內規範附件與申請人確認", route: "NSTC_GENERAL", prerequisites: ["nstc-language-format"], outputType: "COMPLIANCE_CHECKED", required: true, gate: "cycle verified" },
  { nodeId: "nstc-application-package", titleZh: "申請包就緒", route: "NSTC_GENERAL", prerequisites: ["nstc-cycle-compliance"], outputType: "PROPOSAL_APPLICATION_PACKAGE", required: true, gate: "package" },
  { nodeId: "nstc-external-events", titleZh: "真實申請／核定／執行與結案紀錄", route: "NSTC_GENERAL", prerequisites: ["nstc-application-package"], outputType: "EXTERNAL_EVENT_LOG", required: false, gate: "external" },
];

export const MOE_TPR_ROUTE_NODES: WorkflowNode[] = [
  { nodeId: "moe-course-instructor", titleZh: "正式課程與主持人資訊", route: "MOE_TPR", prerequisites: ["submission-navigation"], outputType: "COURSE_PROFILE", required: true, gate: "instructor of record" },
  { nodeId: "moe-teaching-problem", titleZh: "教學問題與可取得的現場證據", route: "MOE_TPR", prerequisites: ["moe-course-instructor"], outputType: "TEACHING_PROBLEM", required: true, gate: "classroom evidence" },
  { nodeId: "moe-literature-mechanism", titleZh: "教學文獻、原因假說與學習機制", route: "MOE_TPR", prerequisites: ["moe-teaching-problem"], outputType: "LEARNING_MECHANISM", required: true, gate: "mechanism" },
  { nodeId: "moe-design-intervention", titleZh: "課程設計／教學介入／成果評量", route: "MOE_TPR", prerequisites: ["moe-literature-mechanism"], outputType: "INTERVENTION_ASSESSMENT", required: true, gate: "design" },
  { nodeId: "moe-research-ethics", titleZh: "研究設計／倫理與學生權益規劃", route: "MOE_TPR", prerequisites: ["moe-design-intervention"], outputType: "ETHICS_STUDENT_RIGHTS", required: true, gate: "ethics" },
  { nodeId: "moe-schedule-budget", titleZh: "課程週次、資源及預算", route: "MOE_TPR", prerequisites: ["moe-research-ethics"], outputType: "BUDGET_PLAN", required: true, gate: "costs" },
  { nodeId: "moe-proposal", titleZh: "教學實踐計畫書與授課資料", route: "MOE_TPR", prerequisites: ["moe-schedule-budget"], outputType: "PROPOSAL_DRAFT", required: true, gate: "proposal" },
  { nodeId: "moe-review-consistency", titleZh: "課程研究一致性／模擬審查", route: "MOE_TPR", prerequisites: ["moe-proposal"], outputType: "SIMULATED_REVIEW", required: true, gate: "review" },
  { nodeId: "moe-cycle-compliance", titleZh: "當年度／校內規範附件與申請人確認", route: "MOE_TPR", prerequisites: ["moe-review-consistency"], outputType: "COMPLIANCE_CHECKED", required: true, gate: "cycle verified" },
  { nodeId: "moe-application-package", titleZh: "申請包就緒", route: "MOE_TPR", prerequisites: ["moe-cycle-compliance"], outputType: "PROPOSAL_APPLICATION_PACKAGE", required: true, gate: "package" },
  { nodeId: "moe-external-events", titleZh: "真實申請／核定／課程研究／成果紀錄", route: "MOE_TPR", prerequisites: ["moe-application-package"], outputType: "EXTERNAL_EVENT_LOG", required: false, gate: "external" },
];

export const WORKFLOW_ROUTE_TEMPLATES: Readonly<Record<PrimaryGoalId, WorkflowRouteTemplate>> = Object.freeze({
  JOURNAL_SCI_SSCI: {
    route: "JOURNAL_SCI_SSCI",
    labelZh: "SCI／SSCI 國際期刊論文",
    nodes: [...COMMON_BACKBONE, ...JOURNAL_ROUTE_NODES],
  },
  NSTC_GENERAL: {
    route: "NSTC_GENERAL",
    labelZh: "國科會一般研究計畫",
    nodes: [...COMMON_BACKBONE, ...NSTC_ROUTE_NODES],
  },
  MOE_TPR: {
    route: "MOE_TPR",
    labelZh: "教育部教學實踐研究計畫",
    nodes: [...COMMON_BACKBONE, ...MOE_TPR_ROUTE_NODES],
  },
});

export function getWorkflowTemplate(route: PrimaryGoalId): WorkflowRouteTemplate {
  return WORKFLOW_ROUTE_TEMPLATES[route];
}

export type WorkflowNodeProgress = {
  node: WorkflowNode;
  state: WorkflowNodeState;
  // completion snapshot evidence (green light source of truth)
  completionSnapshotId?: string;
  completedAt?: string;
  issueCount: number;
  note?: string;
};

/**
 * Compute route progress per spec §6: applicable required nodes only; optional nodes
 * don't block; shared nodes counted once; unbuilt-but-required modules remain in the
 * denominator (not removed to beautify progress).
 */
export function computeWorkflowProgress(nodes: WorkflowNode[], progress: WorkflowNodeProgress[]): {
  requiredComplete: number;
  requiredTotal: number;
  optionalComplete: number;
  optionalTotal: number;
  completionRate: number;          // 0..1 for required nodes
  awaitingInputCount: number;
  blockedCount: number;
  unbuiltCount: number;
  sharedCompleteCount: number;
} {
  const byId = new Map(progress.map((p) => [p.node.nodeId, p]));
  const required = nodes.filter((n) => n.required);
  const optional = nodes.filter((n) => !n.required);

  const isComplete = (n: WorkflowNode) => {
    const p = byId.get(n.nodeId);
    return p?.state === "COMPLETED_VALID";
  };

  const requiredComplete = required.filter(isComplete).length;
  const requiredTotal = required.length;
  const optionalComplete = optional.filter(isComplete).length;
  const optionalTotal = optional.length;
  const completionRate = requiredTotal > 0 ? requiredComplete / requiredTotal : 0;
  const awaitingInputCount = [...byId.values()].filter((p) => p.state === "AWAITING_INPUT" || p.state === "AWAITING_APPROVAL").length;
  const blockedCount = [...byId.values()].filter((p) => p.state === "BLOCKED" || p.state === "FAILED").length;
  const unbuiltCount = [...byId.values()].filter((p) => p.state === "MODULE_UNAVAILABLE").length;
  const sharedCompleteCount = byId.get("submission-navigation")?.state === "COMPLETED_VALID" ? 1 : 0;

  return { requiredComplete, requiredTotal, optionalComplete, optionalTotal, completionRate, awaitingInputCount, blockedCount, unbuiltCount, sharedCompleteCount };
}