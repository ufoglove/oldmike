import "server-only";

import { randomBytes } from "node:crypto";
import {
  parseReviewAutomationPayload,
  reviewAutomationRetryBudget,
  signReviewAutomationPayload,
  type ReviewAutomationPayload,
} from "./review-automation-contract.ts";

export class ReviewAutomationAdapterError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = "ReviewAutomationAdapterError"; this.code = code; }
}

export function reviewAutomationAdapterState() {
  return process.env.OLD_MIKE_REVIEW_AUTOMATION_ADAPTER === "enabled" ? "ENABLED" as const : "DISABLED" as const;
}

export function buildReviewAutomationRequest(payloadValue: unknown, now = Date.now()) {
  if (reviewAutomationAdapterState() !== "ENABLED") throw new ReviewAutomationAdapterError("review_automation_disabled");
  const endpoint = process.env.OLD_MIKE_REVIEW_AUTOMATION_ENDPOINT;
  const secret = process.env.OLD_MIKE_REVIEW_AUTOMATION_SIGNING_SECRET;
  if (!endpoint || !secret || secret.length < 32) throw new ReviewAutomationAdapterError("review_automation_configuration_invalid");
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== "https:" || endpointUrl.username || endpointUrl.password || endpointUrl.hash) throw new ReviewAutomationAdapterError("review_automation_endpoint_policy_rejected");
  const payload = parseReviewAutomationPayload(payloadValue);
  const timestamp = String(now);
  const nonce = randomBytes(16).toString("hex");
  const signature = signReviewAutomationPayload(payload, timestamp, nonce, secret);
  return { endpoint: endpointUrl.toString(), payload, headers: { "Content-Type": "application/json", "X-Old-Mike-Timestamp": timestamp, "X-Old-Mike-Nonce": nonce, "X-Old-Mike-Signature": signature }, retryBudget: reviewAutomationRetryBudget("TRANSIENT_TRANSPORT") };
}

export async function dispatchReviewAutomation(payload: ReviewAutomationPayload) {
  const request = buildReviewAutomationRequest(payload);
  let lastError: unknown;
  for (let attempt = 0; attempt <= request.retryBudget; attempt += 1) {
    try {
      const response = await fetch(request.endpoint, { method: "POST", headers: request.headers, body: JSON.stringify(request.payload), redirect: "error", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        if (response.status >= 500 && attempt < request.retryBudget) continue;
        throw new ReviewAutomationAdapterError("review_automation_response_rejected");
      }
      return { accepted: true as const, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt >= request.retryBudget) break;
    }
  }
  throw lastError instanceof ReviewAutomationAdapterError ? lastError : new ReviewAutomationAdapterError("review_automation_transport_failed");
}
