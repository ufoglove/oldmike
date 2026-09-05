/**
 * Stage Operation Layer Contracts (V3-U02-R1)
 *
 * Implements core operational interfaces specified in section 16 of the V3.1 spec:
 * - StageDefinition & RequirementDefinition
 * - FieldDefinition & FieldPolicy (Action allowlists, data classifications)
 * - StageReadinessSnapshot & RequirementIssue (IssueNavigator deep links)
 * - FieldLock & AssistPatch (backend write protection & optimistic concurrency)
 * - TopicSelectionSnapshot & StageCompletionSnapshot (cross-stage handoffs)
 */

export type StageId =
  | "radar"
  | "one-click"
  | "topic-lab"
  | "navigator"
  | "blueprint"
  | "ethics"
  | "execution"
  | "analysis"
  | "manuscript"
  | "submission-gate"
  | string;

export type DataNature =
  | "USER_INPUT"
  | "AI_DERIVED"
  | "SOURCE_VERIFIED"
  | "METRIC_COMPUTED"
  | "SYSTEM_AUDIT"
  | "HUMAN_ATTESTATION";

export type AssistActionType =
  | "EXPLAIN"
  | "DRAFT_FROM_CONTEXT"
  | "POLISH"
  | "VERIFY_SOURCE"
  | "BATCH_FILL"
  | "FIND_GAP"
  | "CRITIQUE";

export type FieldPolicyRule = {
  fieldRef: string;
  stageId: StageId;
  label: string;
  dataNature: DataNature;
  aiWritable: boolean;
  requiresUserFact: boolean;
  requiresEvidence: boolean;
  allowedAssistActions: AssistActionType[];
  lockable: boolean;
};

export type IssueStatus = "MISSING" | "STALE" | "INVALID" | "CONFLICT" | "SATISFIED";

export type RequirementIssueDestination = {
  routeId: string;
  tabId?: string;
  anchor?: string;
  fieldRef?: string;
  entityId?: string;
};

export interface RequirementIssue {
  issueId: string;
  projectId: string;
  stageId: StageId;
  requirementId: string;
  entityId: string;
  fieldRef: string;
  status: IssueStatus;
  blocksTransition: boolean;
  message: string;
  expectedRevision?: string;
  destination: RequirementIssueDestination;
  assistActions: AssistActionType[];
  requiresUserFact: boolean;
  returnContextId?: string;
  evaluatedAt: string;
}

export interface StageReadinessSnapshot {
  stageId: StageId;
  projectId: string;
  isReady: boolean;
  canProceed: boolean;
  totalRequirements: number;
  satisfiedRequirements: number;
  blockingIssues: RequirementIssue[];
  nonBlockingIssues: RequirementIssue[];
  nextStageId?: string;
  nextStageLabel?: string;
  evaluatedAt: string;
}

export type LockPolicy = "MANUAL" | "AUTOMATION_POLICY" | "SYSTEM_ENFORCED";

export interface FieldLockRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  stageId: StageId;
  entityId: string;
  fieldRef: string;
  lockedValue: any;
  lockVersion: number;
  lockedByUserId?: string | null;
  lockReason?: string | null;
  lockPolicy: LockPolicy;
  sourceVersionId?: string | null;
  isStale: boolean;
  staleReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopicSelectionSnapshot {
  projectId: string;
  topicId: string;
  topicTitle: string;
  topicTitleEn?: string;
  conceptAbstract?: string;
  researchQuestion: string;
  gapStatement: string;
  methodologyOverview: string;
  targetPopulation?: string;
  expectedContribution: string;
  minimumViableStudy?: string;
  resourceRequirements?: string;
  knownLimitations: string[];
  assumptions: string[];
  risks: string[];
  literatureIds: string[];
  citationSourceIds: string[];
  sourceSnapshotIds: string[];
  selectedBy: string;
  selectionMethod: "MANUAL_ADOPTION" | "AUTO_SELECTED_DRAFT";
  selectedAt: string;
  handoffLimitations: string[];
  downstreamOpenRequirements: string[];
  lockManifest: { fieldRef: string; lockVersion: number }[];
}

export interface StageCompletionSnapshot {
  id: string;
  workspaceId: string;
  projectId: string;
  stageId: StageId;
  status: "COMPLETED" | "HANDOFF_READY" | "SUPERSEDED";
  snapshotData: Record<string, any>;
  topicSnapshot?: TopicSelectionSnapshot | null;
  lockManifest: any[];
  handoffLimitations: string[];
  downstreamOpenRequirements: string[];
  nextStageId?: string | null;
  createdByUserId?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface AssistPatchProposal {
  fieldRef: string;
  entityId?: string;
  baseRevision?: number;
  expectedLockRevision?: number;
  proposedValue: any;
  sourceRefs?: string[];
  assumptions?: string[];
  changeReason?: string;
}

export interface AssistApplyResult {
  fieldRef: string;
  status: "APPLIED" | "CONFLICT_LOCKED" | "CONFLICT_STALE" | "POLICY_DENIED" | "FAILED";
  message: string;
  appliedValue?: any;
  newVersion?: number;
}
