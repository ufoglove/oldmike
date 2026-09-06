/**
 * Research Blueprint Planning Contract (V3-U04-FULL)
 * Spec: v3.4.0 (docs/stage04/spec-v3-4.0.md) §3, §4, §5, §6, §7, §8, §9, §10, §11, §12, §20, §21
 *
 * Implements:
 * 1. Intake of Stage 3 SubmissionNavigationSnapshot
 * 2. Tri-goal research blueprint definitions (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. Objective - RQ - Evidence planning matrix
 * 4. Work packages, DAG dependencies, relative timelines & resource assumptions
 * 5. EvidenceNeed directed task contracts (connecting to existing literature center)
 * 6. Official rule snapshots & late-stage downstream requirements (due_phase & blocks_actions)
 * 7. FieldEnvelope with provenance, temporal_status & locks
 * 8. BlueprintPlanningSnapshot immutable handoff contract for Stage 5
 */

import { type PrimaryGoalId, type GoalContext, RESEARCH_GOAL_DEFINITIONS } from "./research-goal-registry.ts";
import {
  type SubmissionNavigationSnapshot,
  type JournalCandidate,
  type NstcRouteCandidate,
  type MoeTprRouteCandidate,
  type OfficialRuleSnapshot,
} from "./submission-navigation-engines-contract.ts";

export const BLUEPRINT_PLANNING_CONTRACT_VERSION = "blueprint-planning/1.0.0" as const;

// -------------------------------------------------------------
// §5 Temporal Status (Preserve input_state & temporal truth)
// -------------------------------------------------------------
export const TEMPORAL_STATUSES = [
  "PROPOSED_BEFORE_STUDY",        // 研究執行前建議
  "DOCUMENTED_PRIOR_PLAN",        // 有時間戳支持的既有事前規劃
  "AS_CONDUCTED_RECORD",          // 已有實際研究紀錄（唯讀引用）
  "RETROSPECTIVE_PLANNING_NOTE",  // 研究完成後整理（不冒充事前假設或預註冊）
] as const;
export type TemporalStatus = (typeof TEMPORAL_STATUSES)[number];

// -------------------------------------------------------------
// §10 Evidence Statement Classification
// -------------------------------------------------------------
export const STATEMENT_EVIDENCE_TYPES = [
  "SOURCE_BACKED_STATEMENT",        // 有來源與精確定位，可核對支持程度
  "USER_REPORTED_CONTEXT",          // 使用者提供事實，未必獨立驗證
  "PROPOSED_DESIGN_CHOICE",         // 本研究建議做法，不冒充文獻共識
  "HYPOTHESIS_TO_TEST",             // 待檢驗關係
  "ASSUMPTION_PENDING_VALIDATION",   // 假設或未知
  "DOCUMENTED_RESULT_REFERENCE",    // 既有真實結果的唯讀引用（不可反寫為事前規劃）
] as const;
export type StatementEvidenceType = (typeof STATEMENT_EVIDENCE_TYPES)[number];

export const EVIDENCE_SUPPORT_RELATIONS = [
  "SUPPORTS",
  "CONTRADICTS",
  "CONTEXT",
  "INSUFFICIENT",
] as const;
export type EvidenceSupportRelation = (typeof EVIDENCE_SUPPORT_RELATIONS)[number];

// -------------------------------------------------------------
// §12 Late-Stage Requirements & Due Phases
// -------------------------------------------------------------
export const DUE_PHASES = [
  "CURRENT_BLUEPRINT",
  "GAP_VALIDATION",
  "THEORY_MODEL",
  "RESEARCH_DESIGN",
  "APPLICATION",
  "BEFORE_STUDY_START",
  "MANUSCRIPT",
  "FINAL_SUBMISSION",
] as const;
export type DuePhase = (typeof DUE_PHASES)[number];

export const BLOCKS_ACTIONS = [
  "EDIT_DRAFT",
  "COMPLETE_BLUEPRINT",
  "HANDOFF_TO_EVIDENCE_VALIDATION",
  "CONFIRM_ELIGIBILITY",
  "EXECUTE_STUDY",
  "SUBMIT_EXTERNALLY",
] as const;
export type BlocksAction = (typeof BLOCKS_ACTIONS)[number];

export type DownstreamRequirementItem = {
  requirementId: string;
  title: string;
  duePhase: DuePhase;
  blocksActions: BlocksAction[];
  status: "PENDING" | "SATISFIED" | "WAIVED" | "DEFERRED";
  allowedDeferralReason?: string;
  fieldRef?: string;
  sourceRef?: string;
  ownerRef?: string;
};

// -------------------------------------------------------------
// §14 FieldEnvelope (Uniform representation with provenance & locks)
// -------------------------------------------------------------
export type FieldEnvelope<T = unknown> = {
  fieldRef: string;
  value: T;
  valueType: "string" | "number" | "boolean" | "array" | "object";
  origin: "SOURCE_SNAPSHOT" | "GENERATED_DRAFT" | "USER_FACT" | "COMPUTED_FACT" | "EXTERNAL_FACT" | "PROTECTED_RESULT";
  sourceRefs: string[];
  temporalStatus: TemporalStatus;
  statementEvidenceType?: StatementEvidenceType;
  assumptions: string[];
  uncertainty?: string | null;
  fieldRevision: number;
  isLocked: boolean;
  lockPolicy?: "MANUAL" | "AUTOMATION_POLICY" | "SECTION_LOCK";
  lockVersion?: number;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED" | "REVISION_REQUIRED";
  lastModifiedAt: string;
};

// -------------------------------------------------------------
// §8 Objective - RQ - Evidence Planning Matrix
// -------------------------------------------------------------
export const RQ_TYPES = [
  "DESCRIPTIVE",
  "RELATIONAL",
  "CAUSAL",
  "EXPLORATORY",
  "DESIGN_EVALUATION",
  "SYNTHESIS",
] as const;
export type RqType = (typeof RQ_TYPES)[number];

export type RqPlanningRow = {
  rqId: string; // e.g. RQ-01
  objectiveId: string; // references parent Objective ID
  questionText: string;
  rqType: RqType;
  unitOfAnalysis: string; // e.g. "學生個別學習成效" / "製造業作業人員" / "模型推論延遲"
  targetSubjectOrConstruct: string; // 對象或構念
  requiredEvidenceDirection: string; // 需要何種證據回答
  preliminaryMethodDirection: string; // 初步方法方向
  associatedWorkPackageIds: string[];
  expectedContributionDirection: string;
  temporalStatus: TemporalStatus;
  status: "DRAFT" | "REVIEWED" | "LOCKED";
  isLocked: boolean;
  assumptions: string[];
  pendingItems: string[];
};

export type ResearchObjectiveItem = {
  objectiveId: string; // e.g. OBJ-01
  statement: string; // 具體可執行目標
  correspondsToGap: string; // 對應之 Gap 線索
  expectedDeliverables: string[];
  associatedRqIds: string[];
  isLocked: boolean;
};

// -------------------------------------------------------------
// §9 Work Packages, Milestones, Resources & DAG
// -------------------------------------------------------------
export type WorkPackagePlan = {
  packageId: string; // e.g. WP-01
  title: string;
  objectiveRefs: string[];
  rqRefs: string[];
  tasks: string[];
  deliverables: string[];
  acceptanceCriteria: string;
  dependencies: string[]; // references packageId in DAG
  responsibleRole: string;
  ownerRef?: string | null;
  requiredResources: string[];
  estimatedRelativeDuration: string; // e.g. "M1-M3" / "Week 1-4"
  risks: string[];
  routeScope: "SHARED_CORE" | "JOURNAL_SPECIFIC" | "NSTC_SPECIFIC" | "MOE_SPECIFIC";
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
};

export type MilestonePlan = {
  milestoneId: string; // e.g. MS-01
  title: string;
  relativePeriod: string; // e.g. "M3" / "Week 6"
  associatedWorkPackageIds: string[];
  verificationEvidence: string;
};

export type ResourceAssumption = {
  resourceId: string;
  name: string;
  category: "PERSONNEL" | "FIELD_SITE" | "TOOL_EQUIPMENT" | "DATA_ACCESS" | "COST";
  status: "OWNED" | "REQUESTED" | "PROPOSED" | "UNKNOWN";
  costEstimate?: {
    amount: number | null; // null if unknown, NEVER 0 for unknown
    currency: "TWD" | "USD" | "EUR" | null;
    isEstimate: boolean;
    basisOrSource?: string;
  };
  availabilityTimeline: string; // e.g. "研究開始前需取得場域同意函"
  contingencyPlan?: string;
};

// -------------------------------------------------------------
// §11 EvidenceNeed (Directed retrieval task to existing center)
// -------------------------------------------------------------
export const EVIDENCE_NEED_ROLES = [
  "CORE",
  "GAP",
  "THEORY",
  "METHOD",
  "MEASUREMENT",
  "SIMILAR_STUDY",
  "DISCUSSION",
] as const;
export type EvidenceNeedRole = (typeof EVIDENCE_NEED_ROLES)[number];

export type EvidenceNeed = {
  needId: string; // e.g. EN-01
  projectId: string;
  blueprintRevision: number;
  sectionId: string;
  claimId?: string;
  rqId?: string;
  purpose: string;
  role: EvidenceNeedRole;
  whatMustBeVerified: string;
  supportOrCounterevidence: "SUPPORT_ONLY" | "BOTH_SUPPORT_AND_COUNTER" | "EXPLORATORY";
  keywordGroups: string[][];
  suggestedQuery: string;
  populationContext?: string;
  sourcePreferences: ("CONSENSUS" | "SEMANTIC_SCHOLAR" | "OPEN_ALEX" | "CROSSREF")[];
  freshnessRationale?: string;
  retrievalBudgetCap: number; // e.g. max 10 papers
  existingEvidenceRefs: string[];
  acceptanceCriteria: string;
  status: "PENDING" | "RETRIEVED" | "INSUFFICIENT" | "FAILED";
  returnContextId: string;
  createdIso: string;
};

// -------------------------------------------------------------
// §10 EvidenceLink in Blueprint
// -------------------------------------------------------------
export type BlueprintEvidenceLink = {
  linkId: string;
  projectId: string;
  sectionId: string;
  claimId: string;
  rqId?: string;
  literatureId: string;
  citationSourceId?: string;
  sourceRevision: number;
  locationInText?: string;
  retrievalScope: "ABSTRACT" | "FULL_TEXT" | "SNIPPET";
  processedCoverage: "HUMAN_READ" | "MACHINE_PROCESSED_PARTIAL" | "METADATA_ONLY";
  supportRelation: EvidenceSupportRelation;
  studyFamilyId?: string; // canonical study family to prevent duplicate counting
  providerRecordProvenance: {
    provider: string;
    retrievedAt: string;
    rights: string;
  };
};

// -------------------------------------------------------------
// §7 Three-Goal Specific Blueprint Models
// -------------------------------------------------------------

// A. SCI/SSCI International Journal
export type JournalSpecificBlueprint = {
  targetJournalName: string;
  targetPublisher?: string | null;
  targetIndexingVerified: string[]; // e.g. ["SCIE", "SSCI", "SCOPUS"]
  targetArticleType: "ORIGINAL_RESEARCH" | "REVIEW" | "SHORT_COMMUNICATION" | "METHODOLOGY" | "PERSPECTIVE";
  journalAudienceContext: string;
  internationalGapStatement: string;
  primaryTheoreticalContribution: string;
  methodologyOverview: string;
  dataAndResultsRequirements: {
    requiredVariablesOrMetrics: string[];
    analysisPlanDirection: string;
    evidenceNeededPerSection: Record<string, string>; // e.g. Introduction: "...", Discussion: "..."
    temporalStatus: "PROPOSED_BEFORE_STUDY"; // No fake results!
  };
  sampleArticleSuggestions: {
    suggestionText: string;
    isOfficialJournalRule: boolean; // false = quality recommendation, not journal hard rule!
  }[];
  apcFundingPlan?: {
    currency?: string;
    amount?: number | null;
    isWaiverAvailable?: boolean;
    budgetSourceDirection?: string;
  };
};

// B. NSTC General Research Project
export type NstcSpecificBlueprint = {
  disciplineCode: string;
  disciplineName: string;
  divisionName: string;
  scientificQuestionImportance: string;
  noveltyAndInnovation: string;
  principalInvestigatorCapabilityEvidence: {
    source: "AUTHORIZED_PROFILE" | "UNKNOWN";
    qualificationStatement: string;
  };
  projectDuration: {
    durationOption: "ONE_YEAR" | "TWO_YEAR" | "THREE_YEAR" | "UNDECIDED_COMPARE";
    multiYearContinuationRationale?: string; // If multi-year, why continuing RQ
    isFixedThreeYearAssumption: false; // Must NEVER force 3 years!
  };
  workPackagesAndMilestones: WorkPackagePlan[];
  resourceAndBudgetDirection: {
    personnelDirection: string[];
    equipmentDirection: string[];
    travelOrFieldDirection: string[];
    unknownItems: string[];
  };
  officialRuleSnapshotRef?: string;
};

// C. MOE Teaching Practice Research (TPR)
export type MoeTprSpecificBlueprint = {
  courseIdentity: {
    courseName: string;
    courseSemesterOrYear: string;
    targetStudents: string;
    creditsAndType: string;
    courseInfoStatus: "USER_PROVIDED" | "UNKNOWN"; // UNKNOWN when no authorized CourseProfile data, NEVER invent
    instructorEligibilityStatus: "PASS" | "FAIL" | "UNKNOWN"; // UNKNOWN if unverified, NEVER assume
  };
  pedagogicalProblemAndContext: {
    observedLearningDifficulties: string;
    baselineEvidenceSource: "ACTUAL_COURSEWORK" | "OBSERVATION" | "GRADES_SUMMARY" | "PENDING_BASELINE_TASK";
    probableRootCauseHypothesis: string; // clearly marked as hypothesis
  };
  instructionalIntervention: {
    interventionDescription: string;
    theoreticalMechanism: string; // why it might work
    implementationTimeline: string; // e.g. Week 4-10
  };
  learningOutcomesAndAssessment: {
    alignedLearningOutcomes: string[];
    assessmentMethods: string[]; // e.g. rubrics, performance tasks, pre-post
    isSatisfactionOnlySurvey: false; // Cannot use TAM / satisfaction to claim skill mastery!
    evaluationDataNeeds: string[];
  };
  ethicsAndConsentDirection: {
    studentConsentPlan: string;
    institutionalReviewDirection: string;
    duePhase: DuePhase;
  };
  officialRuleSnapshotRef?: string;
};

// -------------------------------------------------------------
// §6 & §21 Complete Blueprint Workspace & Version State
// -------------------------------------------------------------
export type BlueprintPlanningStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "WAITING_INPUT"
  | "WAITING_EVIDENCE"
  | "IN_REVIEW"
  | "REVISION_REQUIRED"
  | "BASELINED"
  | "BASELINED_PROVISIONAL"
  | "STALE_SOURCE"
  | "ARCHIVED";

export type BlueprintWorkspace = {
  blueprintId: string;
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceNavigationSnapshotId: string;
  sourceTopicSelectionSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: "NONE" | "UNDECIDED" | "NSTC_GENERAL" | "MOE_TPR";
  publicationIntent: "JOURNAL" | "DEFERRED" | "NONE";
  planningStatus: BlueprintPlanningStatus;
  temporalStatus: TemporalStatus;

  // Shared Core Blueprint Sections
  researchIdentity: {
    workingTitleZh: FieldEnvelope<string>;
    workingTitleEn: FieldEnvelope<string>;
    sourceTopicTitle: string; // read-only baseline
    targetAudienceOrDiscipline: FieldEnvelope<string>;
    currentResearchStage: string;
  };

  coreProblemAndScope: {
    problemStatement: FieldEnvelope<string>;
    targetSystemOrPopulation: FieldEnvelope<string>;
    contextAndImportance: FieldEnvelope<string>;
    inScopeAndOutScope: FieldEnvelope<string>;
  };

  gapAndNoveltyClues: {
    preliminaryGapStatement: FieldEnvelope<string>;
    similarStudiesContrast: FieldEnvelope<string>;
    hypothesizedValueAdd: FieldEnvelope<string>;
    evidenceStatus: "UNVERIFIED" | "PARTIALLY_SUPPORTED" | "SUPPORTED";
  };

  purposeAndObjectives: {
    overallPurpose: FieldEnvelope<string>;
    objectives: ResearchObjectiveItem[];
  };

  researchQuestionsMatrix: RqPlanningRow[];

  preliminaryTheoryAndLogic: {
    candidateTheories: FieldEnvelope<string[]>;
    whyItMightWork: FieldEnvelope<string>;
    coreConstructs: FieldEnvelope<string[]>;
    alternativeExplanations: FieldEnvelope<string[]>;
    theoreticalBoundaryConditions: FieldEnvelope<string>;
  };

  methodAndDataDirection: {
    preliminaryMethodology: FieldEnvelope<string>;
    observationOrComparisonUnit: FieldEnvelope<string>;
    dataSourceTypes: FieldEnvelope<string[]>;
    requiredEvidenceTypes: FieldEnvelope<string[]>;
    feasibilityNotes: FieldEnvelope<string>;
  };

  workPackages: WorkPackagePlan[];
  milestones: MilestonePlan[];
  resourceAssumptions: ResourceAssumption[];
  evidenceNeeds: EvidenceNeed[];
  evidenceLinks: BlueprintEvidenceLink[];

  // Route-Specific Blueprints (co-exist, do not overwrite each other!)
  journalBlueprint?: JournalSpecificBlueprint;
  nstcBlueprint?: NstcSpecificBlueprint;
  moeTprBlueprint?: MoeTprSpecificBlueprint;

  // Risks & Downstream Requirements
  risksAndAssumptions: {
    riskId: string;
    statement: string;
    isAssumption: boolean;
    impactsRqOrWp: string[];
    likelihood: "LOW" | "MEDIUM" | "HIGH";
    severity: "LOW" | "MEDIUM" | "HIGH";
    mitigationStrategy: string;
    ownerRef?: string;
  }[];

  // Upstream handoff limitations preserved verbatim from Stage 3 (spec §3)
  handoffLimitations: string[];

  // Literature center pass-through refs (spec §10: 藍圖只連結既有中心，不複製文獻庫)
  literatureIds: string[];
  citationSourceIds: string[];
  ruleSnapshotRefs: string[];

  downstreamRequirements: DownstreamRequirementItem[];

  // Handoff & Versioning Metadata
  planningBaselineRef?: string;
  provisionalNotes?: string[];
  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §20 BlueprintPlanningSnapshot (Immutable handoff to Stage 5)
// -------------------------------------------------------------
export type BlueprintPlanningSnapshot = {
  snapshotId: string; // e.g. bps_<uuid>
  schemaVersion: "blueprint-planning/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "blueprint";
  nextStageId: "gap-novelty"; // Stage 5: 文獻深化與Gap／新穎性驗證
  sourceNavigationSnapshotId: string;
  sourceTopicSelectionSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: "NONE" | "UNDECIDED" | "NSTC_GENERAL" | "MOE_TPR";
  publicationIntent: "JOURNAL" | "DEFERRED" | "NONE";

  blueprintId: string;
  blueprintRevision: number;
  planningBaselineRef: string;
  planningStatus: BlueprintPlanningStatus;
  researchStage: string;
  temporalStatus: TemporalStatus;

  // Snapshot content references & core summaries
  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    problemSummary: string;
    overallPurpose: string;
  };
  objectiveRefs: string[];
  rqRefs: string[];
  methodAndDataPlanRefs: string[];
  workPackageRefs: string[];
  milestoneRefs: string[];
  resourceAssumptionsCount: number;

  // Evidence & Literature Center Connection
  literatureIds: string[];
  evidenceIds: string[];
  citationSourceIds: string[];
  zoteroBindings: { libraryType: string; libraryId: string; collectionKey?: string }[];
  evidenceNeedRefs: string[]; // Handed off directly to Stage 5!
  searchTaskRefs: string[];

  // Upstream handoff preservation (spec §3: 上游 UNKNOWN/待查狀態原樣保留)
  handoffLimitations: string[];

  // Downstream Requirements & Rules
  ruleSnapshotRefs: string[];
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: DuePhase[];

  // Locks & Provenance
  lockManifest: { fieldRef: string; lockVersion: number; lockPolicy: string }[];
  sourceManifest: { sourceId: string; sourceVersion: number }[];
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  decisionOrigin: "USER_MANUAL_ADOPTION" | "AUTO_PLANNING_BASELINE";
  readinessSnapshotRef: string;
  completionBasis: "PLANNING_BASELINE_COMMITTED" | "PROVISIONAL_PLANNING_BASELINE";
  limitations: string[];

  createdAt: string;
  checksum: string;
};

// -------------------------------------------------------------
// §18 Logic Checker Finding & Readiness
// -------------------------------------------------------------
export type BlueprintLogicFinding = {
  checkId: string;
  ruleCode: string;
  severity: "FATAL" | "MAJOR_WARNING" | "SUGGESTION";
  targetSection: string;
  targetFieldRef?: string;
  findingDescription: string;
  rationale: string;
  suggestedAction: string;
  autoFixAvailable: boolean;
};
