import type { ProposalDraft } from "../proposal-studio-contract.ts";
import { parseProposalDraft } from "../proposal-studio-contract.ts";
import type { V2Alpha5OfficialSourceBundle, V2Alpha5Workspace } from "../v2-alpha5/contracts.ts";
import { parseOfficialSourceBundle } from "../v2-alpha5/official-source-bundle.ts";
import { alpha9Hash } from "./contracts.ts";

export const V2_ALPHA9_REVIEW_DIMENSIONS = Object.freeze([
  "RESEARCH_QUESTION",
  "METHOD",
  "DATA",
  "ANALYSIS",
  "ETHICS",
  "TIMELINE",
  "WORK_PACKAGE",
  "BUDGET",
  "KPI",
  "ATTACHMENTS",
] as const);

export type V2Alpha9ReviewDimension = (typeof V2_ALPHA9_REVIEW_DIMENSIONS)[number];

export type V2Alpha9DimensionResult = {
  dimension: V2Alpha9ReviewDimension;
  status: "PASS" | "GAP";
  issueCodes: string[];
  dimensionHash: string;
};

export type V2Alpha9PriorityIssue = {
  issueId: string;
  dimension: V2Alpha9ReviewDimension | "OFFICIAL_SOURCE" | "LANGUAGE_QUALITY";
  severity: "MAJOR" | "MINOR";
  title: string;
  reason: string;
  recommendedRevision: string;
  alternatives: readonly [string, string, string];
  sourceHash: string;
  issueHash: string;
};

export type V2Alpha9ProposalReview = {
  schemaId: "old-mike-v2-alpha9/taiwan-proposal-review/1";
  targetId: "NSTC" | "MOE";
  directionId: string;
  proposalHash: string;
  sourceBundleHash: string;
  contentClosureStatus: "PASS" | "BLOCKED";
  officialComplianceStatus: "PASS_OFFICIAL_CURRENT" | "BLOCKED_SOURCE_AUTHORITY" | "BLOCKED_SOURCE_FRESHNESS";
  reviewStatus: "READY" | "READY_WITH_GAPS" | "NOT_READY";
  dimensions: readonly V2Alpha9DimensionResult[];
  priorityIssues: readonly V2Alpha9PriorityIssue[];
  traditionalChineseQuality: {
    status: "PASS_LOCAL_FIXTURE" | "NEEDS_REVISION" | "NOT_EVALUATED";
    issueCodes: string[];
    qualityHash: string;
  };
  providerCallCount: 0;
  databaseConnectionCount: 0;
  formalResearchWriteCount: 0;
  externalMutationCount: 0;
  reviewHash: string;
};

type IssueSeed = {
  code: string;
  dimension: V2Alpha9PriorityIssue["dimension"];
  priority: number;
  severity: V2Alpha9PriorityIssue["severity"];
};

const SOURCE_KINDS = ["ANNOUNCEMENT", "RULES", "FORMS", "ATTACHMENTS", "BUDGET", "REVIEW_CRITERIA", "TIMELINE"] as const;
const SIMPLIFIED_ONLY = /[这为与后国计学术实经发过资据审项将应务业门师课题论写]/u;

function nonEmpty(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function addDimension(results: V2Alpha9DimensionResult[], issues: IssueSeed[], dimension: V2Alpha9ReviewDimension, issueCodes: string[]) {
  const unique = [...new Set(issueCodes)].sort();
  const core = { dimension, status: unique.length === 0 ? "PASS" as const : "GAP" as const, issueCodes: unique };
  results.push({ ...core, dimensionHash: alpha9Hash(core) });
  unique.forEach((code, index) => issues.push({ code, dimension, priority: V2_ALPHA9_REVIEW_DIMENSIONS.indexOf(dimension) * 10 + index + 10, severity: "MAJOR" }));
}

function assessDimensions(proposal: ProposalDraft, workspace: V2Alpha5Workspace, directionId: string) {
  const direction = workspace.directions.find((item) => item.directionId === directionId);
  if (!direction) throw new Error("alpha9_taiwan_direction_not_found");
  const results: V2Alpha9DimensionResult[] = [];
  const issues: IssueSeed[] = [];
  const workPackageIds = new Set(proposal.workPackages.map((item) => item.workPackageId));

  const research: string[] = [];
  if (proposal.bilingual.titleZhTw !== direction.workingTitle) research.push("PROPOSAL_TITLE_DIRECTION_BINDING_MISMATCH");
  if (!proposal.narrative.researchQuestions.includes(direction.researchQuestion)) research.push("RESEARCH_QUESTION_DIRECTION_BINDING_MISMATCH");
  if (!nonEmpty(proposal.narrative.problem) || proposal.narrative.aims.length === 0 || proposal.narrative.researchQuestions.length === 0) research.push("RESEARCH_QUESTION_CLOSURE_INCOMPLETE");
  if (proposal.modeSpecific.kind === "NSTC_RESEARCH") {
    if (!nonEmpty(proposal.modeSpecific.cm03Narrative) || !nonEmpty(proposal.modeSpecific.preliminaryEvidence) || proposal.modeSpecific.expectedOutputs.length === 0) research.push("NSTC_RESEARCH_NARRATIVE_INCOMPLETE");
  } else if (!nonEmpty(proposal.modeSpecific.teachingProblem) || proposal.modeSpecific.learningOutcomes.length === 0) research.push("MOE_TEACHING_PROBLEM_OUTCOME_INCOMPLETE");
  addDimension(results, issues, "RESEARCH_QUESTION", research);

  const method: string[] = [];
  if (!nonEmpty(proposal.narrative.methods) || !nonEmpty(proposal.narrative.sample)) method.push("METHOD_DESIGN_INCOMPLETE");
  if (proposal.modeSpecific.kind === "NSTC_RESEARCH" && !nonEmpty(proposal.modeSpecific.feasibility)) method.push("NSTC_FEASIBILITY_INCOMPLETE");
  if (proposal.modeSpecific.kind === "MOE_TEACHING_PRACTICE" && (!nonEmpty(proposal.modeSpecific.intervention) || !nonEmpty(proposal.modeSpecific.evaluationDesign))) method.push("MOE_INTERVENTION_EVALUATION_INCOMPLETE");
  addDimension(results, issues, "METHOD", method);

  const data: string[] = [];
  if (!nonEmpty(proposal.narrative.data) || !nonEmpty(proposal.narrative.sample)) data.push("DATA_SOURCE_VARIABLE_PLAN_INCOMPLETE");
  if (proposal.modeSpecific.kind === "MOE_TEACHING_PRACTICE" && !nonEmpty(proposal.modeSpecific.implementationFidelity)) data.push("MOE_IMPLEMENTATION_FIDELITY_INCOMPLETE");
  addDimension(results, issues, "DATA", data);

  const analysis: string[] = [];
  if (!nonEmpty(proposal.narrative.analysis)) analysis.push("ANALYSIS_PLAN_INCOMPLETE");
  if (proposal.modeSpecific.kind === "MOE_TEACHING_PRACTICE" && !nonEmpty(proposal.modeSpecific.evaluationDesign)) analysis.push("MOE_ASSESSMENT_PLAN_INCOMPLETE");
  addDimension(results, issues, "ANALYSIS", analysis);

  const ethics: string[] = [];
  if (!nonEmpty(proposal.narrative.ethics)) ethics.push("ETHICS_PLAN_INCOMPLETE");
  if (!nonEmpty(proposal.narrative.privacy)) ethics.push("PRIVACY_PLAN_INCOMPLETE");
  addDimension(results, issues, "ETHICS", ethics);

  const timeline: string[] = [];
  if (proposal.milestones.length === 0) timeline.push("TIMELINE_MISSING");
  if (proposal.workPackages.some((workPackage) => !proposal.milestones.some((milestone) => milestone.workPackageId === workPackage.workPackageId))) timeline.push("WORK_PACKAGE_NOT_SCHEDULED");
  if (proposal.milestones.some((milestone) => {
    const workPackage = proposal.workPackages.find((item) => item.workPackageId === milestone.workPackageId);
    return !workPackage || milestone.dueMonth < workPackage.startMonth || milestone.dueMonth > workPackage.endMonth;
  })) timeline.push("MILESTONE_OUTSIDE_WORK_PACKAGE_PERIOD");
  addDimension(results, issues, "TIMELINE", timeline);

  const workPackages: string[] = [];
  if (proposal.workPackages.length === 0) workPackages.push("WORK_PACKAGE_MISSING");
  if (proposal.workPackages.some((item) => !proposal.kpis.some((kpi) => kpi.workPackageId === item.workPackageId))) workPackages.push("WORK_PACKAGE_WITHOUT_KPI");
  if (proposal.workPackages.some((item) => !proposal.milestones.some((milestone) => milestone.workPackageId === item.workPackageId))) workPackages.push("WORK_PACKAGE_WITHOUT_DELIVERABLE");
  addDimension(results, issues, "WORK_PACKAGE", workPackages);

  const budget: string[] = [];
  if (proposal.budget.items.length === 0) budget.push("BUDGET_MISSING");
  if (proposal.budget.items.some((item) => item.subtotalTwd <= 0 || !nonEmpty(item.justification))) budget.push("BUDGET_ITEM_INCOMPLETE");
  if (proposal.budget.items.some((item) => !workPackageIds.has(item.workPackageId))) budget.push("BUDGET_WORK_PACKAGE_BINDING_INVALID");
  if (proposal.budget.totalTwd !== proposal.budget.items.reduce((sum, item) => sum + item.quantity * item.unitCostTwd, 0)) budget.push("BUDGET_ARITHMETIC_MISMATCH");
  addDimension(results, issues, "BUDGET", budget);

  const kpis: string[] = [];
  if (proposal.kpis.length === 0) kpis.push("KPI_MISSING");
  if (proposal.kpis.some((item) => !workPackageIds.has(item.workPackageId) || !nonEmpty(item.measure) || !nonEmpty(item.target) || !nonEmpty(item.evidencePlan))) kpis.push("KPI_WORK_PACKAGE_OR_EVIDENCE_BINDING_INVALID");
  if (proposal.workPackages.some((item) => !proposal.kpis.some((kpi) => kpi.workPackageId === item.workPackageId))) kpis.push("WORK_PACKAGE_KPI_COVERAGE_INCOMPLETE");
  addDimension(results, issues, "KPI", kpis);

  const attachments: string[] = [];
  if (proposal.attachments.length === 0) attachments.push("ATTACHMENT_CHECKLIST_MISSING");
  if (proposal.attachments.some((item) => item.required && item.status === "FAIL")) attachments.push("REQUIRED_ATTACHMENT_FAILED");
  if (proposal.attachments.some((item) => !nonEmpty(item.label) || !nonEmpty(item.evidence))) attachments.push("ATTACHMENT_EVIDENCE_INCOMPLETE");
  addDimension(results, issues, "ATTACHMENTS", attachments);

  if (results.length !== 10 || results.some((item, index) => item.dimension !== V2_ALPHA9_REVIEW_DIMENSIONS[index])) throw new Error("alpha9_taiwan_dimension_internal_invalid");
  return { results, issues };
}

function officialCompliance(proposal: ProposalDraft, sourceBundle: V2Alpha5OfficialSourceBundle) {
  const applicationState = String((sourceBundle as unknown as Record<string, unknown>).applicationState ?? "");
  const exactKinds = sourceBundle.sources.length === SOURCE_KINDS.length
    && new Set(sourceBundle.sources.map((item) => item.kind)).size === SOURCE_KINDS.length
    && SOURCE_KINDS.every((kind) => sourceBundle.sources.some((item) => item.kind === kind));
  const currentCycle = exactKinds
    && sourceBundle.freshness === "CURRENT"
    && sourceBundle.sources.every((item) => item.freshness === "CURRENT" && item.cycleYear === sourceBundle.cycleYear);
  if (applicationState !== "SERVER_VERIFIED_OFFICIAL_CURRENT") return "BLOCKED_SOURCE_AUTHORITY" as const;
  if (!currentCycle) return "BLOCKED_SOURCE_FRESHNESS" as const;
  const requirementsReady = proposal.officialSource.humanVerified
    && proposal.requirements.every((item) => item.status === "PASS" || item.status === "NA")
    && proposal.budget.items.every((item) => item.ruleEvidenceStatus === "PASS" || item.ruleEvidenceStatus === "NA")
    && proposal.attachments.every((item) => !item.required || item.status === "PASS")
    && proposal.unresolvedIssues.length === 0;
  return requirementsReady ? "PASS_OFFICIAL_CURRENT" as const : "BLOCKED_SOURCE_AUTHORITY" as const;
}

function traditionalChineseQuality(proposal: ProposalDraft, localFixture: boolean) {
  if (!localFixture) {
    const core = { status: "NOT_EVALUATED" as const, issueCodes: [] as string[] };
    return { ...core, qualityHash: alpha9Hash(core) };
  }
  const targetText = [
    proposal.bilingual.titleZhTw,
    proposal.bilingual.abstractZhTw,
    ...proposal.bilingual.keywordsZhTw,
    proposal.narrative.problem,
    proposal.narrative.background,
    proposal.narrative.literatureGap,
    ...proposal.narrative.aims,
    ...proposal.narrative.researchQuestions,
    proposal.narrative.methods,
    proposal.narrative.analysis,
    proposal.narrative.ethics,
    proposal.narrative.privacy,
    ...proposal.workPackages.flatMap((item) => [item.title, item.objective, item.methods]),
    ...proposal.kpis.flatMap((item) => [item.measure, item.target, item.evidencePlan]),
  ].join("\n");
  const issueCodes: string[] = [];
  if (!/[\u3400-\u9fff]/u.test(targetText)) issueCodes.push("TRADITIONAL_CHINESE_CONTENT_MISSING");
  if (SIMPLIFIED_ONLY.test(targetText)) issueCodes.push("SIMPLIFIED_CHINESE_FORM_DETECTED");
  const core = { status: issueCodes.length === 0 ? "PASS_LOCAL_FIXTURE" as const : "NEEDS_REVISION" as const, issueCodes };
  return { ...core, qualityHash: alpha9Hash(core) };
}

function issueCopy(seed: IssueSeed) {
  if (seed.dimension === "OFFICIAL_SOURCE") return {
    title: "當年度官方來源尚未形成可核實權威",
    reason: "本機來源即使標示 CURRENT，仍是 LOCAL_SYNTHETIC_UNVERIFIED，不能據此宣稱符合當年度規範。",
    recommendedRevision: "由未來 server-only 官方來源提供者綁定同一年度公告、規則、表單、附件、預算、審查準則與時程後再審。",
    alternatives: ["保留目前內容並標示規範待核實。", "先完成不依賴年度規則的研究內容閉環。", "待取得同年度官方來源後一次重新總審。"] as const,
  };
  if (seed.dimension === "LANGUAGE_QUALITY") return {
    title: "繁體中文計畫語言仍需修訂",
    reason: "本機規則發現核心計畫文字缺少繁體中文內容或含明確簡體字形。",
    recommendedRevision: "統一為臺灣學術與計畫書慣用繁體中文，保留必要英文縮寫與專有名詞。",
    alternatives: ["先修正核心摘要與研究問題。", "依章節統一臺灣術語。", "整份完成後再做一次繁體中文總校閱。"] as const,
  };
  const label = seed.dimension === "RESEARCH_QUESTION" ? "研究問題與目標"
    : seed.dimension === "METHOD" ? "研究方法"
      : seed.dimension === "DATA" ? "資料與變項"
        : seed.dimension === "ANALYSIS" ? "分析計畫"
          : seed.dimension === "ETHICS" ? "倫理與隱私"
            : seed.dimension === "TIMELINE" ? "時程與里程碑"
              : seed.dimension === "WORK_PACKAGE" ? "工作包"
                : seed.dimension === "BUDGET" ? "經費編列"
                  : seed.dimension === "KPI" ? "KPI 與證據"
                    : "附件清單";
  return {
    title: `${label}閉環未完成`,
    reason: `總審實際檢出 ${seed.code}，目前不能把此維度標記為完成。`,
    recommendedRevision: `補齊${label}並重新核對與研究問題、工作包及證據的關聯。`,
    alternatives: [`優先補齊${label}的最小必要內容。`, `縮小研究範圍，使${label}可在計畫期程內完成。`, `保留缺口並明列取得資料或文件的工作包。`] as const,
  };
}

function topPriorityIssues(seeds: IssueSeed[], proposalHash: string) {
  return [...seeds]
    .sort((left, right) => left.priority - right.priority || left.code.localeCompare(right.code))
    .slice(0, 3)
    .map((seed): V2Alpha9PriorityIssue => {
      const copy = issueCopy(seed);
      const core = {
        issueId: seed.code,
        dimension: seed.dimension,
        severity: seed.severity,
        ...copy,
        sourceHash: proposalHash,
      };
      return { ...core, issueHash: alpha9Hash(core) };
    });
}

export function reviewAlpha9TaiwanProposal(workspace: V2Alpha5Workspace, directionId = workspace.selectedDirectionId): V2Alpha9ProposalReview {
  const targetId = workspace.targetSelection.targetId;
  if (targetId !== "NSTC" && targetId !== "MOE") throw new Error("alpha9_taiwan_target_invalid");
  const proposalValue = workspace.proposalsByDirection[directionId];
  if (!proposalValue) throw new Error("alpha9_taiwan_proposal_not_found");
  const proposal = parseProposalDraft(proposalValue);
  if ((targetId === "NSTC") !== (proposal.mode === "NSTC_RESEARCH") || proposal.modeSpecific.kind !== proposal.mode) throw new Error("alpha9_taiwan_target_binding_invalid");
  const sourceBundle = parseOfficialSourceBundle(workspace.sourceBundle, { targetId, domainSelectionHash: workspace.domainSelection.selectionHash });
  if (proposal.officialSource.sourceHash !== sourceBundle.bundleHash || proposal.callProgram.effectiveYear !== sourceBundle.cycleYear) throw new Error("alpha9_taiwan_source_binding_invalid");
  const proposalHash = alpha9Hash(proposal);
  const { results: dimensions, issues } = assessDimensions(proposal, workspace, directionId);
  const officialComplianceStatus = officialCompliance(proposal, sourceBundle);
  if (officialComplianceStatus !== "PASS_OFFICIAL_CURRENT") issues.push({ code: officialComplianceStatus, dimension: "OFFICIAL_SOURCE", priority: 5, severity: "MAJOR" });
  const language = traditionalChineseQuality(proposal, sourceBundle.applicationState === "LOCAL_SYNTHETIC_UNVERIFIED");
  if (language.status === "NEEDS_REVISION") issues.push({ code: language.issueCodes[0] ?? "TRADITIONAL_CHINESE_QUALITY_NEEDS_REVISION", dimension: "LANGUAGE_QUALITY", priority: 45, severity: "MAJOR" });
  const contentClosureStatus = dimensions.every((item) => item.status === "PASS") && language.status !== "NEEDS_REVISION" ? "PASS" as const : "BLOCKED" as const;
  const priorityIssues = topPriorityIssues(issues, proposalHash);
  const reviewStatus = contentClosureStatus === "BLOCKED" ? "NOT_READY" as const : officialComplianceStatus === "PASS_OFFICIAL_CURRENT" ? "READY" as const : "READY_WITH_GAPS" as const;
  const core = {
    schemaId: "old-mike-v2-alpha9/taiwan-proposal-review/1" as const,
    targetId,
    directionId,
    proposalHash,
    sourceBundleHash: sourceBundle.bundleHash,
    contentClosureStatus,
    officialComplianceStatus,
    reviewStatus,
    dimensions,
    priorityIssues,
    traditionalChineseQuality: language,
    providerCallCount: 0 as const,
    databaseConnectionCount: 0 as const,
    formalResearchWriteCount: 0 as const,
    externalMutationCount: 0 as const,
  };
  return { ...core, reviewHash: alpha9Hash(core) };
}

export const V2_ALPHA9_TAIWAN_REVIEW_BOUNDARY = Object.freeze({
  consumes: "V2Alpha5Workspace/ProposalDraft/OfficialSourceBundle",
  officialSourceFromClient: "FORBIDDEN",
  localSyntheticMayPassOfficialCompliance: false,
  providerCalls: 0,
  databaseConnections: 0,
  formalResearchWrites: 0,
  externalMutations: 0,
});
