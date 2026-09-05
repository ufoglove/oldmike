import "server-only";

import { executeDefaultOpenClawChatCompletion, type OpenClawChatOperation, type OpenClawFailureEvidence, type OpenClawMessage } from "./openclaw.ts";

export type ResearchGenerationSubmission = { messages: OpenClawMessage[]; sessionKey: string; operation?: Extract<OpenClawChatOperation, "M01_TOPIC_LAB" | "M01_RESEARCH_DIRECTIONS" | "M01_RESEARCH_S0_EXPAND">; signal?: AbortSignal };
export type ResearchGenerationResult =
  | { kind: "success"; content: string }
  | { kind: "proven-not-submitted"; code: "provider_not_configured" | "provider_invalid" | "canceled_before_submission" }
  | { kind: "terminal-rejected"; code: "http_rejected" | "content_type_rejected" | "body_rejected" | "response_shape_invalid"; evidence: OpenClawFailureEvidence }
  | { kind: "completion-unknown"; code: "provider_deadline" | "caller_cancel" | "transport_failure_before_headers" | "transport_failure_after_headers"; evidence: OpenClawFailureEvidence };

export type ResearchGenerationProvider = {
  readonly id: "OLD_MIKE_DEFAULT" | "GPT_BYOK";
  readonly capability: "ENABLED" | "NOT_CONFIGURED";
  submit(input: ResearchGenerationSubmission): Promise<ResearchGenerationResult>;
};

export function createOpenClawResearchProvider(): ResearchGenerationProvider {
  return Object.freeze({
    id: "OLD_MIKE_DEFAULT" as const,
    capability: "ENABLED" as const,
    async submit(input: ResearchGenerationSubmission): Promise<ResearchGenerationResult> {
      if (input.signal?.aborted) return { kind: "proven-not-submitted", code: "canceled_before_submission" };
      const result = await executeDefaultOpenClawChatCompletion(input.messages, input.sessionKey, input.operation || "M01_TOPIC_LAB", input.signal);
      if (result.kind === "success") return result;
      if (result.kind === "terminal-rejected" || result.kind === "completion-unknown") return result;
      if (result.code === "configuration_missing") return { kind: "proven-not-submitted", code: "provider_not_configured" };
      if (result.code === "canceled_before_submission") return { kind: "proven-not-submitted", code: "canceled_before_submission" };
      return { kind: "proven-not-submitted", code: "provider_invalid" };
    },
  });
}

export function createDisabledGptByokResearchProvider(): ResearchGenerationProvider {
  return Object.freeze({
    id: "GPT_BYOK" as const,
    capability: "NOT_CONFIGURED" as const,
    async submit(): Promise<ResearchGenerationResult> {
      return { kind: "proven-not-submitted", code: "provider_not_configured" };
    },
  });
}
