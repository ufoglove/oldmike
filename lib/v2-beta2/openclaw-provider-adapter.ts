import "server-only";

import type { OpenClawChatCompletionProtocolResult, OpenClawMessage } from "../openclaw.ts";
import {
  beta2CanonicalJson,
  parseV2Beta2ProviderLookupOutcome,
  parseV2Beta2ProviderResult,
  type V2Beta2ProviderLookupOutcome,
  type V2Beta2ProviderSubmitOutcome,
} from "./contracts.ts";
import {
  V2_BETA2_PROVIDER_PORT_VERSION,
  V2Beta2ProviderCapabilityError,
  parseV2Beta2ProviderLookupRequest,
  parseV2Beta2ProviderSubmission,
  type V2Beta2ProviderCapability,
  type V2Beta2ProviderPort,
  type V2Beta2ProviderSubmission,
} from "./provider-port.ts";

export const V2_BETA2_OPENCLAW_ADAPTER_VERSION = "old-mike-v2-beta2/openclaw-provider-adapter/1" as const;

export type V2Beta2OpenClawProtocolExecutor = (input: Readonly<{
  adapterVersion: typeof V2_BETA2_OPENCLAW_ADAPTER_VERSION;
  messages: readonly OpenClawMessage[];
  sessionKey: string;
  operation: "M01_RESEARCH_DIRECTIONS";
}>) => Promise<OpenClawChatCompletionProtocolResult>;

type LookupExecutor = (input: Readonly<{ receiptCommitment: string; requestHash: string }>) => Promise<unknown>;

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[], code: string) {
  const input = record(value, code);
  const actual = Object.keys(input).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error(code);
  return input;
}

function parseSuccessContent(raw: string, submission: V2Beta2ProviderSubmission): V2Beta2ProviderSubmitOutcome {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { throw new Error("beta2_provider_adapter_response_invalid"); }
  const input = exact(parsed, ["schemaId", "receiptCommitment", "requestHash", "result"], "beta2_provider_adapter_response_invalid");
  if (input.schemaId !== "old-mike-v2-beta2/provider-adapter-response/1"
    || input.receiptCommitment !== submission.receiptCommitment
    || input.requestHash !== submission.requestHash) throw new Error("beta2_provider_adapter_response_invalid");
  let result;
  try { result = parseV2Beta2ProviderResult(input.result); } catch { throw new Error("beta2_provider_adapter_response_invalid"); }
  if (result.providerClass !== "BOUNDED_SERVER_ADAPTER"
    || result.stageInstanceHash !== submission.stageInstanceHash
    || result.sourceHash !== submission.source.sourceHash) throw new Error("beta2_provider_adapter_response_invalid");
  return { completionClass: "COMPLETE", receiptCommitment: submission.receiptCommitment, requestHash: submission.requestHash, result };
}

export function createV2Beta2OpenClawProviderMessages(input: V2Beta2ProviderSubmission): readonly OpenClawMessage[] {
  const submission = parseV2Beta2ProviderSubmission(input);
  const contract = "Return exactly one JSON object using old-mike-v2-beta2/provider-adapter-response/1. Preserve stageInstanceHash, sourceHash, all source material UTF-8 content/order/hashes, exactly three lanes in canonical order, exactly one BALANCED_RECOMMENDED lane, and complete 13-field S0. Do not include provider, model, endpoint, credential, tool, or diagnostic identity.";
  return Object.freeze([
    Object.freeze({ role: "system" as const, content: contract }),
    Object.freeze({ role: "user" as const, content: beta2CanonicalJson({ adapterVersion: V2_BETA2_OPENCLAW_ADAPTER_VERSION, submission }) }),
  ]);
}

export function createBoundedV2Beta2OpenClawProviderAdapter(input: Readonly<{
  enabledForInjectedLocalContractTest: boolean;
  executeProtocol: V2Beta2OpenClawProtocolExecutor;
  lookupReceipt?: LookupExecutor;
}>): V2Beta2ProviderPort {
  const capability = (): V2Beta2ProviderCapability => input.enabledForInjectedLocalContractTest
    ? {
        portVersion: V2_BETA2_PROVIDER_PORT_VERSION,
        providerClass: "BOUNDED_SERVER_ADAPTER",
        submission: "AVAILABLE",
        lookup: input.lookupReceipt ? "AVAILABLE" : "UNAVAILABLE",
        reasonCode: input.lookupReceipt ? null : "LOOKUP_AUTHORITY_MISSING",
      }
    : {
        portVersion: V2_BETA2_PROVIDER_PORT_VERSION,
        providerClass: "BOUNDED_SERVER_ADAPTER",
        submission: "PROVEN_NOT_SUBMITTED",
        lookup: "UNAVAILABLE",
        reasonCode: "LIVE_RUNTIME_NOT_AUTHORIZED",
      };

  return {
    capability,
    async submit(rawSubmission) {
      const current = capability();
      if (current.submission !== "AVAILABLE" || current.reasonCode !== null) throw new V2Beta2ProviderCapabilityError("LIVE_RUNTIME_NOT_AUTHORIZED");
      const submission = parseV2Beta2ProviderSubmission(rawSubmission);
      const protocol = await input.executeProtocol({
        adapterVersion: V2_BETA2_OPENCLAW_ADAPTER_VERSION,
        messages: createV2Beta2OpenClawProviderMessages(submission),
        sessionKey: `beta2:${submission.jobId}`,
        operation: "M01_RESEARCH_DIRECTIONS",
      });
      if (protocol.kind === "success") return parseSuccessContent(protocol.content, submission);
      if (protocol.kind === "completion-unknown") return { completionClass: "COMPLETION_UNKNOWN", receiptCommitment: submission.receiptCommitment, requestHash: submission.requestHash } satisfies V2Beta2ProviderSubmitOutcome;
      if (protocol.kind === "terminal-rejected") return { completionClass: "TERMINAL_REJECTED", receiptCommitment: submission.receiptCommitment, requestHash: submission.requestHash, reasonCode: "PROVIDER_TERMINAL_REJECTED" } satisfies V2Beta2ProviderSubmitOutcome;
      throw new V2Beta2ProviderCapabilityError("LIVE_RUNTIME_NOT_AUTHORIZED");
    },
    async lookup(rawLookup) {
      const current = capability();
      if (current.lookup !== "AVAILABLE" || current.reasonCode !== null || !input.lookupReceipt) throw new V2Beta2ProviderCapabilityError(current.reasonCode ?? "LOOKUP_AUTHORITY_MISSING");
      const lookup = parseV2Beta2ProviderLookupRequest(rawLookup);
      const parsed = parseV2Beta2ProviderLookupOutcome(await input.lookupReceipt(lookup));
      if (parsed.receiptCommitment !== lookup.receiptCommitment || parsed.requestHash !== lookup.requestHash) throw new Error("beta2_provider_adapter_lookup_invalid");
      return parsed satisfies V2Beta2ProviderLookupOutcome;
    },
  };
}
