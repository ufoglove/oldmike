import { createHmac, timingSafeEqual } from "node:crypto";

export const REVIEW_AUTOMATION_CONTRACT_VERSION = "review-automation/1.0.0";
export const reviewAutomationStates = ["QUEUED", "RUNNING", "WAITING_HUMAN", "COMPLETED", "FAILED", "CANCELED"] as const;
export const reviewAutomationOperations = ["REVIEW", "RE_REVIEW", "DOCUMENT_RELEASE"] as const;
export type ReviewAutomationState = (typeof reviewAutomationStates)[number];
export type ReviewAutomationOperation = (typeof reviewAutomationOperations)[number];

export type ReviewAutomationPayload = {
  contractVersion: typeof REVIEW_AUTOMATION_CONTRACT_VERSION;
  jobId: string;
  operation: ReviewAutomationOperation;
  idempotencyKey: string;
  requestedAt: string;
  status: ReviewAutomationState;
  sourceHash: string;
  resultHash: string | null;
};

const exactPayloadKeys = ["contractVersion", "jobId", "operation", "idempotencyKey", "requestedAt", "status", "sourceHash", "resultHash"];

function record(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function exact(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).sort().join("\0") === [...keys].sort().join("\0"); }
function id(value: unknown) { return typeof value === "string" && value.length >= 8 && value.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(value); }
function digest(value: unknown) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }

export function parseReviewAutomationPayload(value: unknown): ReviewAutomationPayload {
  const row = record(value);
  if (!row || !exact(row, exactPayloadKeys) || row.contractVersion !== REVIEW_AUTOMATION_CONTRACT_VERSION || !id(row.jobId) || !id(row.idempotencyKey) || !reviewAutomationOperations.includes(row.operation as ReviewAutomationOperation) || !reviewAutomationStates.includes(row.status as ReviewAutomationState) || !digest(row.sourceHash) || !(row.resultHash === null || digest(row.resultHash))) throw new Error("invalid_review_automation_payload");
  if (typeof row.requestedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.requestedAt) || !Number.isFinite(Date.parse(row.requestedAt))) throw new Error("invalid_review_automation_timestamp");
  if ((row.status === "COMPLETED") !== (row.resultHash !== null)) throw new Error("invalid_review_automation_result_binding");
  return row as ReviewAutomationPayload;
}

export function assertReviewAutomationTransition(from: ReviewAutomationState, to: ReviewAutomationState) {
  const allowed: Record<ReviewAutomationState, ReviewAutomationState[]> = {
    QUEUED: ["RUNNING", "CANCELED", "FAILED"],
    RUNNING: ["WAITING_HUMAN", "COMPLETED", "FAILED", "CANCELED"],
    WAITING_HUMAN: [],
    COMPLETED: [], FAILED: [], CANCELED: [],
  };
  if (!allowed[from].includes(to)) throw new Error("invalid_review_automation_transition");
  return to;
}

export function reviewAutomationRetryBudget(category: "TRANSIENT_TRANSPORT" | "VALIDATION" | "POLICY" | "TENANT" | "CONTENT") {
  return category === "TRANSIENT_TRANSPORT" ? 1 : 0;
}

export function signReviewAutomationPayload(payload: ReviewAutomationPayload, timestamp: string, nonce: string, secret: string) {
  if (!/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{32}$/.test(nonce) || secret.length < 32) throw new Error("invalid_review_automation_signature_input");
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${JSON.stringify(payload)}`, "utf8").digest("hex");
}

export class ReviewNonceGuard {
  readonly #seen = new Map<string, number>();
  consume(nonce: string, timestamp: string, now = Date.now()) {
    if (!/^[a-f0-9]{32}$/.test(nonce) || !/^\d{13}$/.test(timestamp)) throw new Error("invalid_review_automation_replay_fields");
    const observed = Number(timestamp);
    if (Math.abs(now - observed) > 300_000) throw new Error("review_automation_timestamp_out_of_window");
    for (const [key, expires] of this.#seen) if (expires < now) this.#seen.delete(key);
    if (this.#seen.has(nonce)) throw new Error("review_automation_replay_rejected");
    this.#seen.set(nonce, now + 300_000);
  }
}

export function verifyReviewAutomationSignature(payload: ReviewAutomationPayload, timestamp: string, nonce: string, signature: string, secret: string, guard: ReviewNonceGuard, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(signature)) throw new Error("invalid_review_automation_signature");
  const expected = signReviewAutomationPayload(payload, timestamp, nonce, secret);
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) throw new Error("invalid_review_automation_signature");
  guard.consume(nonce, timestamp, now);
  return true;
}
