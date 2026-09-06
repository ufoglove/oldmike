/**
 * Theory and Mechanism Planning Contract (V3-U06-FULL)
 * Spec: docs/stage06/spec-v3-4.0.md §1, §3, §5, §6, §7, §8, §9, §10, §11, §12, §13, §14, §15, §16, §20, §21, §24, §25
 *
 * Implements:
 * 1. Intake of Stage 5 GapEvidenceSnapshot (zero re-entry)
 * 2. Tri-goal specific views (JOURNAL_SCI_SSCI, NSTC_GENERAL, MOE_TPR)
 * 3. 8 Modeling Approaches (THEORY_TESTING, THEORY_BUILDING, CONCEPTUAL_FRAMEWORK, TEACHING_LOGIC_MODEL, DESIGN_SCIENCE, TECHNICAL_OR_PREDICTIVE, QUALITATIVE_EXPLORATORY, MIXED_OR_MULTI_COMPONENT)
 * 4. Theory/Framework Candidate pool & SelectionDecision (rationale-based, not prestige-based)
 * 5. Construct Dictionary (canonical_name, definitions, unitOfAnalysis, scope inclusions/exclusions)
 * 6. Typed Model Relations (HYPOTHESIZED_CAUSAL, ASSOCIATION, PREDICTIVE, MEDIATION_CANDIDATE, MODERATION_CANDIDATE, PROCESS_SEQUENCE, INFORMATION_FLOW, PART_OF, FEEDBACK)
 * 7. Research Statements (HYPOTHESIS, PROPOSITION, GUIDING_QUESTION, TECHNICAL_OBJECTIVE)
 * 8. Alternative Explanations, Boundary Conditions & Assumption Register
 * 9. ModelToDesignRequirementMatrix (interface with Stage 7 research design)
 * 10. TheoryMechanismSnapshot immutable handoff contract for Stage 7
 */

import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type GapEvidenceSnapshot } from "./gap-novelty-v3-contract.ts";
import { type DownstreamRequirementItem, type TemporalStatus } from "./blueprint-planning-contract.ts";

export const THEORY_MECHANISM_CONTRACT_VERSION = "theory-mechanism/1.0.0" as const;

// -------------------------------------------------------------
// §5 Modeling Approaches (Independent from Primary Goal)
// -------------------------------------------------------------
export const MODELING_APPROACHES = [
  "THEORY_TESTING",             // 檢驗／延伸既有理論
  "THEORY_BUILDING",            // 探索或建構新解釋，清楚標示新提出部分
  "CONCEPTUAL_FRAMEWORK",       // 使用明確概念框架，不一定依附單一具名理論
  "TEACHING_LOGIC_MODEL",       // 教學活動、機制、近期與遠期成果邏輯鏈
  "DESIGN_SCIENCE",             // 問題、設計原則、系統功能與評估命題
  "TECHNICAL_OR_PREDICTIVE",    // 機理假設、系統關係、預測或性能問題
  "QUALITATIVE_EXPLORATORY",    // 敏感化概念、引導問題，不預填正式主題
  "MIXED_OR_MULTI_COMPONENT",   // 多子研究或多種建模層
] as const;
export type ModelingApproach = (typeof MODELING_APPROACHES)[number];

// -------------------------------------------------------------
// §7 Candidate Theory Kinds & Selection Roles
// -------------------------------------------------------------
export const THEORY_CANDIDATE_KINDS = [
  "EXISTING_THEORY",
  "EXISTING_FRAMEWORK",
  "PROJECT_PROPOSED_FRAMEWORK",
  "DESIGN_RATIONALE",
] as const;
export type TheoryCandidateKind = (typeof THEORY_CANDIDATE_KINDS)[number];

export const THEORY_SELECTION_ROLES = [
  "PRIMARY_LENS",
  "SUPPORTING_LENS",
  "RIVAL_EXPLANATION",
  "NOT_SELECTED",
  "PROVISIONAL",
] as const;
export type TheorySelectionRole = (typeof THEORY_SELECTION_ROLES)[number];

export type TheoryCandidate = {
  candidateId: string;
  name: string;
  aliases: string[];
  candidateKind: TheoryCandidateKind;
  originSourceRefs: string[]; // literatureIds
  definitionLocations: string[];
  originalDomain: string;
  corePropositions: string[];
  constructs: string[];
  explanatoryScope: string;
  linkedGapRefs: string[];
  linkedRqRefs: string[];
  applicabilityNotes: string;
  limitations: string[];
  selectionRole: TheorySelectionRole;
  selectionRationale?: string;
  actualReadingScope: "ABSTRACT_REVIEWED" | "FULLTEXT_REVIEWED" | "INDIRECT_CITATION";
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
};

// -------------------------------------------------------------
// §9 Construct Dictionary & Definitions
// -------------------------------------------------------------
export const CONSTRUCT_MODEL_ROLES = [
  "INTERVENTION_OR_EXPOSURE",
  "OUTCOME",
  "PROCESS",
  "PROPOSED_MEDIATOR",
  "PROPOSED_MODERATOR",
  "CONTEXT",
  "TECHNICAL_COMPONENT",
  "POTENTIAL_COMMON_CAUSE",
  "SENSITIZING_CONCEPT",
] as const;
export type ConstructModelRole = (typeof CONSTRUCT_MODEL_ROLES)[number];

export type ConstructDefinition = {
  constructId: string;
  revision: number;
  canonicalNameZh: string;
  canonicalNameEn: string;
  aliases: string[];
  conceptualDefinition: string;
  definitionBasis: "SOURCE_REPORTED" | "PROJECT_PROPOSED_NEW" | "ADAPTED_FROM_SOURCE";
  sourceRefs: string[]; // literatureIds
  sourceLocations: string[];
  scopeInclusions: string[];
  scopeExclusions: string[];
  neighboringConstructDifferences: string;
  unitOfAnalysis: string;
  level: "INDIVIDUAL" | "GROUP" | "ORGANIZATION" | "SYSTEM";
  roleInCurrentModel: ConstructModelRole;
  linkedRqRefs: string[];
  provisionalObservationDirection: string; // Direction for measurement without faking full scales
  isLocked: boolean;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
};

// -------------------------------------------------------------
// §10 Typed Model Relations & Mechanisms
// -------------------------------------------------------------
export const MODEL_RELATION_TYPES = [
  "HYPOTHESIZED_CAUSAL",        // 尚待設計與資料檢驗的因果關係
  "ASSOCIATION",                // 相關關聯，不冒充因果
  "PREDICTIVE",                 // 預測用途，不冒充機制解釋
  "MEDIATION_CANDIDATE",        // 中介機制候選
  "MODERATION_CANDIDATE",       // 邊界或效果差異候選
  "PROCESS_SEQUENCE",           // 步驟或時間順序
  "INFORMATION_FLOW",           // 技術/系統資料流
  "PART_OF_OR_COMPOSITION",     // 構念或功能組成
  "FEEDBACK_OR_DYNAMIC",        // 具有時間或系統動態意義的回饋
] as const;
export type ModelRelationType = (typeof MODEL_RELATION_TYPES)[number];

export const RELATION_BASIS_TYPES = [
  "EXISTING_THEORY_DERIVATION",
  "EMPIRICAL_PATTERN",
  "CROSS_DOMAIN_ANALOGY",
  "NEW_PROPOSED_LINK",
  "TECHNICAL_DESIGN_RATIONALE",
] as const;
export type RelationBasisType = (typeof RELATION_BASIS_TYPES)[number];

export type ModelRelation = {
  relationId: string; // e.g. "REL-01"
  modelId: string;
  modelRevision: number;
  sourceConstructRef: string;
  targetConstructRef: string;
  relationType: ModelRelationType;
  direction: "FORWARD" | "BIDIRECTIONAL" | "UNDIRECTED";
  expectedSign: "POSITIVE" | "NEGATIVE" | "NON_LINEAR" | "EXPLORATORY";
  timeOrderNotes: string;
  mechanismRationale: string; // Detailed reason why it might work
  alternativeExplanations: string[];
  basisType: RelationBasisType;
  literatureSupportRefs: string[];
  counterevidenceRefs: string[];
  linkedRqRefs: string[];
  linkedStatementRefs: string[]; // Refers to H1, P1, etc.
  moderatesRelationRef?: string; // If relationType === "MODERATION_CANDIDATE"
  isExplanatoryOnlyNotDirectlyTested: boolean;
  isLocked: boolean;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
};

// -------------------------------------------------------------
// §11 Research Statements (Hypotheses, Propositions, Questions)
// -------------------------------------------------------------
export const STATEMENT_TYPES = [
  "HYPOTHESIS",                 // 具方向或檢定性假設 (H1, H2)
  "PROPOSITION",                // 理論或設計命題 (P1, P2)
  "GUIDING_QUESTION",           // 探索或質性引導問題 (GQ1, GQ2)
  "TECHNICAL_OBJECTIVE",        // 系統/架構評估目標 (TO1, TO2)
] as const;
export type StatementType = (typeof STATEMENT_TYPES)[number];

export const DATA_EXPOSURE_STATUSES = [
  "PRE_DATA_PLANNED",
  "EXISTING_DATA_UNANALYZED",
  "POST_DATA_EXPLORATORY",
  "RESULTS_AWARE",
  "UNKNOWN",
] as const;
export type DataExposureStatus = (typeof DATA_EXPOSURE_STATUSES)[number];

export type ResearchStatement = {
  statementId: string; // e.g. "ST-01"
  stableLabel: string; // e.g. "H1" / "P1" / "GQ1"
  statementType: StatementType;
  statementText: string;
  linkedRqRef: string;
  constructRefs: string[];
  relationRefs: string[];
  rationaleSummary: string;
  expectedObservation: string;
  disconfirmationDirection: string; // What observation would refute this?
  temporalStatus: TemporalStatus;
  dataExposureStatus: DataExposureStatus;
  isLocked: boolean;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
};

// -------------------------------------------------------------
// §12 Alternative Explanations & Boundary Conditions
// -------------------------------------------------------------
export type AlternativeExplanation = {
  explanationId: string;
  impactsRelationRefs: string[];
  impactsStatementRefs: string[];
  rivalExplanationText: string;
  rivalMechanism: string;
  discriminatingObservation: string; // How study design can distinguish between main & rival explanation
  suggestedDesignRemedy: string;
};

export type BoundaryCondition = {
  boundaryId: string;
  targetStatementOrRelationRef: string;
  boundaryDimension: "POPULATION" | "TASK_DIFFICULTY" | "TIME_WINDOW" | "ENVIRONMENT" | "TECHNOLOGY_COMPATIBILITY";
  boundaryDescription: string;
  isPlannedForEmpiricalTesting: boolean;
};

// -------------------------------------------------------------
// §13 RQ - Model - Study Design Requirement Matrix
// -------------------------------------------------------------
export type ModelToDesignRequirement = {
  requirementId: string; // e.g. "DES-REQ-01"
  rqRef: string;
  statementRef: string;
  constructRefs: string[];
  relationRefs: string[];
  observationalRequirement: string;
  comparisonNeed: string; // e.g. "需要無自適應提示之對照組"
  temporalNeed: string; // e.g. "需要即時日誌與延宕測量時點"
  unitAndLevel: string;
  designUncertainty: string;
  duePhase: "RESEARCH_DESIGN" | "BEFORE_STUDY_START";
};

// -------------------------------------------------------------
// §5 & §16 Tri-Goal Specific Rationale Notes
// -------------------------------------------------------------
export type JournalModelRationale = {
  theoreticalPositioningAndGapResponse: string;
  differentiationFromClosestStudies: string;
  hypothesizedMechanismDefense: string;
  untestedBoundariesAndLimitations: string;
};

export type NstcModelRationale = {
  scientificProblemImportance: string;
  logicalDerivationOfPropositions: string;
  interdisciplinaryValueAdd: string;
  workPackageAlignmentNotes: string;
};

export type MoeTprModelRationale = {
  classroomObservedProblem: string;
  instructionalInterventionActivity: string;
  expectedLearningMechanism: string; // Activity != Mechanism
  nearTermLearningOutcomes: string;
  farTermTransferOrRetentionOutcomes: string;
  assessmentDirectionNotes: string; // Rubrics, logs, not satisfaction alone!
};

// -------------------------------------------------------------
// §6 & §17 Complete Theory & Mechanism Workspace
// -------------------------------------------------------------
export type TheoryWorkspace = {
  workspaceId: string;
  projectId: string;
  currentRevision: number;
  sourceGapSnapshotId: string;
  sourceBlueprintSnapshotId: string;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  // Modeling Brief (§6)
  modelingBrief: {
    targetPhenomenonToExplain: string;
    targetScopeExplanation: string; // "本模型試圖解釋...，而不是..."
    unitOfAnalysis: string;
    modelingApproach: ModelingApproach;
    rationaleForApproach: string;
  };

  // Theory Candidates & Selection (§7 & §8)
  theoryCandidates: TheoryCandidate[];
  selectedPrimaryLensId?: string;
  selectionDecisionRationale: string;

  // Construct Dictionary (§9)
  constructs: ConstructDefinition[];

  // Typed Model Relations (§10)
  relations: ModelRelation[];

  // Research Statements (§11)
  statements: ResearchStatement[];

  // Rival Explanations & Boundaries (§12)
  alternativeExplanations: AlternativeExplanation[];
  boundaryConditions: BoundaryCondition[];

  // Interface to Stage 7 Design (§13)
  designRequirements: ModelToDesignRequirement[];

  // Tri-Goal Rationales (§16)
  journalRationale?: JournalModelRationale;
  nstcRationale?: NstcModelRationale;
  moeTprRationale?: MoeTprModelRationale;

  // Downstream Requirements carried forward without cyclic gate
  downstreamRequirements: DownstreamRequirementItem[];

  // Graph Layout / View Settings (§14)
  graphViewMode: "CONCEPTUAL" | "CAUSAL_DAG" | "DYNAMIC_FEEDBACK" | "TECHNICAL_FLOW";

  // Decision & State (§23)
  decision: "ADOPT_MODEL" | "ADOPT_WITH_DECLARED_ASSUMPTIONS" | "USE_EXPLORATORY_OR_DESIGN_FRAMEWORK" | "RETURN_FOR_GAP_OR_SCOPE_REVISION" | "NEEDS_CORE_DEFINITION_OR_RATIONALE";
  decisionRationale: string;
  reviewState: "DRAFT" | "HUMAN_REVIEW_PENDING" | "APPROVED";
  isLocked: boolean;

  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------
// §24 TheoryMechanismSnapshot (Immutable handoff to Stage 7)
// -------------------------------------------------------------
export type TheoryMechanismSnapshot = {
  snapshotId: string; // e.g. "tms_<uuid>"
  schemaVersion: "theory-mechanism/1.0.0";
  workspaceId: string;
  projectId: string;
  workOrderId: string;
  stageId: "theory-mechanism";
  nextStageId: "study-design"; // Stage 7: 研究設計與分析計畫
  sourceGapSnapshotId: string;
  sourceBlueprintSnapshotId: string;
  goalContextRevision: number;
  primaryGoal: PrimaryGoalId;
  fundingIntent: string;
  publicationIntent: string;

  modelRevision: number;
  modelingApproach: ModelingApproach;
  decision: string;
  decisionRationale: string;

  scope: {
    workingTitleZh: string;
    workingTitleEn: string;
    overallPurpose: string;
    targetPhenomenon: string;
  };

  // References & Identifiers
  rqRefs: string[];
  theoryCandidateRefs: string[];
  constructRefs: string[];
  relationRefs: string[];
  statementRefs: string[];
  alternativeExplanationRefs: string[];
  boundaryConditionRefs: string[];
  designRequirementRefs: string[];

  // Downstream Requirements (carried forward)
  downstreamRequirements: DownstreamRequirementItem[];
  duePhases: string[];

  // Design hints handed off to Stage 7
  measurementDirections: Array<{ constructId: string; observationDirection: string }>;
  comparisonNeeds: string[];
  temporalNeeds: string[];

  literatureIds?: string[];
  evidenceIds?: string[];
  citationSourceIds?: string[];

  limitations: string[];
  checksum: string;
  createdAt: string;
};

// -------------------------------------------------------------
// §21 Alignment Findings
// -------------------------------------------------------------
export type TheoryLogicFinding = {
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
