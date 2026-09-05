/**
 * Daily Digest Scheduler Policy & Quota Contract (Spec v3.2.0 / V3-U03-R1 — A12)
 *
 * Enforces:
 * - Schedule policy: timezone Asia/Taipei; disabled by default unless explicitly authorized.
 * - Idempotency: key includes (workspace, scope/project, schedule_id, scheduled_local_date, task_kind).
 * - Rate limiting, circuit breakers, 429 Retry-After respect.
 * - Recovery from checkpoint without duplicate billing.
 * - Rotating sources or query versions creates NEW snapshot; never rewrites previous day's results.
 * - Digest items: topic, 3 categories, why notable, relation to profile, new/updated literature,
 *   evidence window, potential gap, required data, risks, confidence & sources.
 */
import { type OpportunityCategory } from "./opportunity-category-contract.ts";

export const DAILY_DIGEST_CONTRACT = "daily-digest/1.0.0" as const;

export type DailyDigestSchedulePolicy = {
  scheduleId: string;
  workspaceId: string;
  projectId?: string;               // project-scoped or entire profile
  enabled: boolean;                 // default false per spec
  frequency: "DAILY" | "WEEKDAYS";
  localTime: string;                // e.g. "08:00"
  timeZone: "Asia/Taipei";          // fixed per spec
  dailyBudgetUnits?: number;
  sources: Array<"CONSENSUS" | "OPENALEX" | "CROSSREF" | "SEMANTIC_SCHOLAR">;
  topicsFilter?: string[];
  lastRunLocalDate?: string;        // YYYY-MM-DD
};

export type DailyDigestItem = {
  itemId: string;
  title: string;
  primaryCategory: OpportunityCategory;
  categories: OpportunityCategory[];
  whyNotable: string;
  relationToProfile: string;
  newOrUpdatedLiteratureCount: number;
  evidenceWindow: { from: string; to: string };
  potentialGap: string;
  requiredDataOrResources: string[];
  risks: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  sources: Array<{ provider: string; title: string; doi?: string | null }>;
  actionTaken?: "EXPLORED" | "SENT_TO_INSPIRATION" | "FAVORITED" | "DISMISSED";
};

export type DailyDigestSnapshot = {
  digestId: string;
  scheduleId: string;
  workspaceId: string;
  localDate: string;                // YYYY-MM-DD in Asia/Taipei
  contractVersion: typeof DAILY_DIGEST_CONTRACT;
  generatedAt: string;
  items: DailyDigestItem[];
  queryVersion: string;
  totalEstimatedUnits: number;
  isIdempotentReplay: boolean;
};

export function makeDailyDigestIdempotencyKey(
  workspaceId: string,
  scheduleId: string,
  localDate: string,
  taskKind = "DAILY_DIGEST",
  projectId?: string,
): string {
  return `digest:${workspaceId}:${projectId ?? "profile"}:${scheduleId}:${localDate}:${taskKind}`;
}

export function buildDefaultSchedulePolicy(workspaceId: string, scheduleId = "default"): DailyDigestSchedulePolicy {
  return {
    scheduleId,
    workspaceId,
    enabled: false,                 // explicitly disabled by default per spec A12
    frequency: "DAILY",
    localTime: "08:00",
    timeZone: "Asia/Taipei",
    sources: ["CONSENSUS", "OPENALEX", "CROSSREF", "SEMANTIC_SCHOLAR"],
  };
}

/** Check if a run is permitted under the policy (honors budget + enabled state). */
export function canExecuteDailyDigest(
  policy: DailyDigestSchedulePolicy,
  currentLocalDate: string,
  todayEstimatedUnits = 1,
): { permitted: boolean; reason?: string } {
  if (!policy.enabled) return { permitted: false, reason: "SCHEDULE_DISABLED" };
  if (policy.lastRunLocalDate === currentLocalDate) return { permitted: false, reason: "ALREADY_RAN_TODAY" };
  if (policy.dailyBudgetUnits !== undefined && todayEstimatedUnits > policy.dailyBudgetUnits) {
    return { permitted: false, reason: "BUDGET_EXCEEDED" };
  }
  return { permitted: true };
}
