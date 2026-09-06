/**
 * Route Studios Contract (V3-U08-FULL)
 * Spec: docs/stage08/spec-v3-4.0.md §1, §3, §4, §5, §7, §8, §9, §10, §12, §13, §14, §15, §16, §26
 *
 * Implements:
 * 1. Intake of Stage 7 DesignAnalysisPlanningSnapshot (zero re-entry)
 * 2. Tri-goal specific Route Studios:
 *    - JOURNAL_RESEARCH_PLANNING (JournalResearchPlan & ManuscriptBlueprint)
 *    - NSTC_GENERAL_PROPOSAL (NSTCProposalDraft & WorkPackageMatrix)
 *    - MOE_TPR_PROPOSAL (TeachingPracticeProposalDraft & CourseTeachingAssessmentMatrix)
 * 3. Structured Section AST & Protected Fact Bindings
 * 4. Deterministic Budget Planning Engine Contract
 * 5. RouteWorkspaceSnapshot immutable handoff contract for Stage 9 (ethics-review)
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type DesignAnalysisPlanningSnapshot } from "./study-design-planning-contract.ts";
import { type DownstreamRequirementItem } from "./blueprint-planning-contract.ts";

export const ROUTE_STUDIO_CONTRACT_VERSION = "route-studio/1.0.0" as const;

// -------------------------------------------------------------
// §5 Studio Kinds & Roles
// -------------------------------------------------------------
export const STUDIO_KINDS = [
  "JOURNAL_RESEARCH_PLANNING",
  "NSTC_GENERAL_PROPOSAL",
  "MOE_TPR_PROPOSAL",
] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];

export const STUDIO_PARTICIPATION_ROLES = [
  "PRIMARY",
  "SECONDARY",
  "FUTURE",
  "NOT_SELECTED",
] as const;
export type StudioParticipationRole = (typeof STUDIO_PARTICIPATION_ROLES)[number];

// -------------------------------------------------------------
// §9 Protected Facts & Structured AST Nodes
// -------------------------------------------------------------
export type FactNodeType =
  | "PLANNING_CALC_REF"
  | "COURSE_FACT_REF"
  | "CITATION_SOURCE_REF"
  | "RESULT_FACT_REF"
  | "WORK_PACKAGE_REF"
  | "BUDGET_ITEM_REF";

export type ProtectedFactBinding = {
  factId: string;
  factType: FactNodeType;
  targetRefId: string; // e.g. calculationId, courseId, citationId
  displayText: string;
  isImmutable: boolean;
  provenance: string;
};

export type SectionParagraphNode = {
  paragraphId: string;
  order: number;
  content: string;
  contentOrigin: "SOURCE_REPORTED" | "PROJECT_PROPOSAL" | "ASSUMPTION" | "INTERPRETATION";
  factBindings: ProtectedFactBinding[];
  citationSourceRefs: string[];
  isLocked: boolean;
};

export type SectionDraft = {
  sectionId: string;
  semanticSectionId: string;
  officialTemplateItemRef?: string;
  titleZh: string;
  titleEn: string;
  purposeSummary: string;
  wordBudget?: number;
  paragraphs: SectionParagraphNode[];
  requiredEvidenceIds: string[];
  status: "EMPTY" | "DRAFT_WITH_GAPS" | "CONTENT_DRAFT_COMPLETE" | "APPROVED";
  isLocked: boolean;
};

// -------------------------------------------------------------
// §10 Journal Research Plan & Manuscript Blueprint (SCI/SSCI)
// -------------------------------------------------------------
export type JournalPositioning = {
  targetJournalCategory: string; // e.g. "Safety Science / Education & Tech Q1"
  internationalGapSummary: string;
  coreContributionStatement: string;
  methodologicalRigorNotes: string;
  unresolvedLimitations: string[];
};

export type ManuscriptBlueprint = {
  workingTitle: string;
  keywords: string[];
  abstractStructure: {
    background: string;
    objective: string;
    plannedMethods: string;
    expectedContribution: string; // NOT fake results!
  };
  introductionOutline: string[];
  theoreticalFrameworkOutline: string[];
  plannedMethodsOutline: string[];
  resultsSlots: Array<{
    slotId: string;
    targetRqRef: string;
    expectedOutcomeMetric: string;
    status: "NOT_YET_AVAILABLE";
  }>;
  discussionQuestions: string[];
  plannedTablesAndFigures: string[];
};

export type JournalResearchPlan = {
  positioning: JournalPositioning;
  manuscriptScope: string;
  blueprint: ManuscriptBlueprint;
  sections: SectionDraft[];
};

// -------------------------------------------------------------
// §12 & §13 NSTC General Proposal & Work Packages
// -------------------------------------------------------------
export type WorkPackageItem = {
  workPackageId: string; // e.g. "WP-01"
  title: string;
  targetRqRefs: string[];
  studyComponentRef: string;
  methodDescription: string;
  dataRequirements: string;
  dependencies: string[];
  startMonth: number;
  endMonth: number;
  milestones: string[];
  deliverables: string[];
  acceptanceCriteria: string;
  resourceRolesNeeded: string[];
  budgetRefs: string[];
  riskAndAlternativePlan: string;
};

export type NSTCProposalDraft = {
  programDiscipline: string;
  targetYear: string;
  durationYears: number;
  isMultiYear: boolean;
  piExperienceSummary: string;
  preliminaryResultsSummary?: string;
  workPackages: WorkPackageItem[];
  sections: SectionDraft[];
};

// -------------------------------------------------------------
// §14 & §15 MOE Teaching Practice Proposal & Assessment Matrix
// -------------------------------------------------------------
export type CourseAssessmentMatrixRow = {
  rowId: string;
  courseObjective: string;
  teachingProblem: string;
  localEvidenceRef?: string; // e.g. classroom log, previous feedback
  proposedIntervention: string;
  mechanismRef: string;
  learningOutcome: string;
  assessmentRequirement: string; // e.g. "客觀操作日誌 + 技能評量規準 (Rubrics)"
  timePointLabel: string;
  targetRqRef: string;
  analysisPlanRef: string;
  courseWeekTimeline: string;
  responsibleStaffRole: string;
  status: "COMPLETE" | "PROVISIONAL" | "MISSING_LOCAL_EVIDENCE";
};

export type TeachingPracticeProposalDraft = {
  courseName: string;
  semesterRef: string;
  classSize: number;
  pedagogicalProblemStatement: string;
  localEvidenceStatus: "VERIFIED_AVAILABLE" | "PENDING_LOCAL_EVIDENCE" | "UNKNOWN";
  courseAssessmentMatrix: CourseAssessmentMatrixRow[];
  sections: SectionDraft[];
};

// -------------------------------------------------------------
// §16 Budget Planning Contract (Deterministic Engine)
// -------------------------------------------------------------
export const BUDGET_EXPENSE_CATEGORIES = [
  "PERSONNEL_ASSISTANT",    // 兼任助理 / 研究津貼
  "EQUIPMENT_LEASE_PURCHASE",// 儀器設備 / 租借 / 耗材
  "OPERATING_CONSUMABLE",   // 業務費 / 測驗受試費 / 訪談茶點
  "TRAVEL_DOMESTIC",        // 國內差旅 / 場域收案
  "OVERHEAD_INDIRECT",      // 專案管理費 (機構代管)
] as const;
export type BudgetExpenseCategory = (typeof BUDGET_EXPENSE_CATEGORIES)[number];

export type BudgetItem = {
  budgetItemId: string;
  studioKind: StudioKind;
  fiscalYear: number;
  category: BudgetExpenseCategory;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number; // Decimal in integer cents or integer TWD
  periods: number; // e.g. 12 months, 4 units
  currency: "TWD" | "USD";
  priceSource: "OFFICIAL_STANDARD" | "VENDOR_QUOTE" | "ESTIMATED_ASSUMPTION";
  workPackageRef?: string;
  necessityRationale: string;
  requestedAmount: number; // calculated: quantity * unitCost * periods
};

export type BudgetPlan = {
  currency: "TWD";
  items: BudgetItem[];
  totalPersonnelCost: number;
  totalOperatingCost: number;
  totalEquipmentCost: number;
  totalDirectCost: number;
  totalIndirectCost: number;
  grandTotal: number;
  unknownItemsCount: number;
  calculationStatus: "COMPUTED" | "PARTIAL_UNKNOWN_EXCLUDED" | "CALCULATION_FAILED";
  lastCalculationTimestamp: string;
};

// -------------------------------------------------------------
// §6 & §27 Complete Route Workspace
// -------------------------------------------------------------
export type RouteWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceDesignSnapshotId: string;
  sourceTheorySnapshotId: string;
  sourceBlueprintSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  activeStudio: StudioKind;
  studioParticipations: Record<StudioKind, StudioParticipationRole>;

  // Route specific plans & drafts
  journalPlan?: JournalResearchPlan;
  nstcProposal?: NSTCProposalDraft;
  moeTprProposal?: TeachingPracticeProposalDraft;

  // Shared Budget Plan
  budgetPlan: BudgetPlan;

  // Downstream Requirements carried forward
  downstreamRequirements: DownstreamRequirementItem[];

  decision: "ADOPT_PLAN_OR_DRAFT" | "ADOPT_WITH_DECLARED_GAPS" | "RETURN_FOR_DESIGN_OR_SCOPE_REVISION" | "NEEDS_CORE_WRITING_INPUT";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §26 RouteWorkspaceSnapshot (Immutable handoff to Stage 9)
// -------------------------------------------------------------
export type RouteWorkspaceSnapshot = {
  snapshotId: string; // e.g. "rws_<uuid>"
  schemaVersion: "route-studio/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "route-studio";
  nextStageId: "ethics-review"; // Stage 9: 路線審查、合規準備與研究倫理
  sourceDesignSnapshotId: string;
  sourceTheorySnapshotId: string;
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  studioRevision: number;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    activeStudio: StudioKind;
  };

  // References & Identifiers
  rqRefs: string[];
  sectionRefs: string[];
  workPackageRefs: string[];
  budgetItemRefs: string[];
  citationSourceRefs: string[];

  // Budget Summary
  grandTotalBudget: number;
  budgetCalculationStatus: string;

  // Downstream Requirements
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // Next Actions for Stage 9 Routing
  nextActions: {
    isJournalPreCheckNeeded: boolean;
    isNstcReviewNeeded: boolean;
    isMoeTprReviewNeeded: boolean;
    isEthicsFilingRequired: boolean;
  };

  limitations: string[];
  checksum: string;
  createdAt: string;
};
