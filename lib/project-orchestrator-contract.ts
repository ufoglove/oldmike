/**
 * Project Orchestrator & Automation Level Contract
 * Spec: v3.3.0 (V3-U03-R2) Section 8, 9
 *
 * Extends the existing AgentJob (not a second queue):
 * - Three automation levels: GUIDED | AUTO_DRAFT | AUTO_ADVANCE
 * - Work order context (goal, target output, bounded auto-adopt)
 * - Orchestrator task plan with checkpoint, budget, cancel, resume
 * - Honest stop conditions: WAITING_INPUT / WAITING_APPROVAL / WAITING_EXTERNAL
 */
import { type PrimaryGoalId } from "./research-goal-registry.ts";
import { type TargetOutput } from "./research-goal-registry.ts";

export const PROJECT_ORCHESTRATOR_CONTRACT = "project-orchestrator/1.0.0" as const;

export const AUTOMATION_LEVELS = ["GUIDED", "AUTO_DRAFT", "AUTO_ADVANCE"] as const;
export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

export const WORKER_STATES = [
  "QUEUED",
  "RUNNING",
  "PARTIAL_RESULT",
  "WAITING_INPUT",
  "WAITING_APPROVAL",
  "WAITING_EXTERNAL",
  "PAUSED",
  "FAILED_RETRYABLE",
  "FAILED_FINAL",
  "COMPLETED",
  "CANCELLED",
  "STALE_INPUT",
] as const;
export type WorkerState = (typeof WORKER_STATES)[number];

export type ProjectWorkOrder = {
  workOrderId: string;
  projectId: string;
  workspaceId: string;
  primaryGoal: PrimaryGoalId;
  goalContextRevision: number;
  targetOutput: TargetOutput;
  inputState: "IDEA_ONLY" | "PLANNED_STUDY" | "EXISTING_DATA" | "VALIDATED_RESULTS" | "EXISTING_MANUSCRIPT";
  boundedAutoAdoptTopic: boolean;
  boundedAutoAdoptRoute: boolean;
  automationLevel: AutomationLevel;
  createdAt: string;
};

export type OrchestratorTaskPlan = {
  planId: string;
  workOrderId: string;
  tasks: Array<{
    taskId: string;
    stageId: string;
    action: string;
    dependsOn: string[];
    costClass: "LOW" | "MEDIUM" | "HIGH";
    requiresApproval: boolean;
    externalWrite: boolean;
  }>;
  maxSteps: number;
  retryBudget: number;
  budgetUnits?: number;
};

export type OrchestratorRun = {
  runId: string;
  workOrderId: string;
  agentJobId: string;
  state: WorkerState;
  currentTaskId: string | null;
  checkpoint: Record<string, unknown>;
  stepCount: number;
  retryCount: number;
  usageEstimateUnits: number;
  stoppedAtReason?: string;
};

/**
 * Decide the home primary button per spec §8 based on goal + data state.
 */
export function decidePrimaryButton(input: {
  goal: PrimaryGoalId;
  hasValidatedResults: boolean;
  hasBlockingIssues: boolean;
}): string {
  if (input.hasBlockingIssues) return "老麥一鍵補足可處理項目";
  if (input.goal === "JOURNAL_SCI_SSCI") {
    return input.hasValidatedResults ? "老麥一鍵協作完成期刊稿件" : "老麥一鍵完成期刊研究規劃";
  }
  if (input.goal === "NSTC_GENERAL") return "老麥一鍵協作完成國科會計畫書";
  if (input.goal === "MOE_TPR") return "老麥一鍵協作完成教學實踐計畫書";
  return "老麥一鍵協作";
}

/**
 * Validate a mutating action at worker/submit time (spec §9: never skip checks on AUTO_ADVANCE).
 */
export function validateActionGate(input: {
  expectedRevision: number;
  currentRevision: number;
  fieldLocked: boolean;
  authorizedRange: boolean;
  withinBudget: boolean;
}): { permitted: boolean; reason?: "REVISION_MISMATCH" | "FIELD_LOCKED" | "OUT_OF_AUTHORIZED_RANGE" | "OVER_BUDGET" } {
  if (input.currentRevision !== input.expectedRevision) return { permitted: false, reason: "REVISION_MISMATCH" };
  if (input.fieldLocked) return { permitted: false, reason: "FIELD_LOCKED" };
  if (!input.authorizedRange) return { permitted: false, reason: "OUT_OF_AUTHORIZED_RANGE" };
  if (!input.withinBudget) return { permitted: false, reason: "OVER_BUDGET" };
  return { permitted: true };
}
