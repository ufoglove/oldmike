import "server-only";

import { parseV2Beta2Source, type V2Beta2Source } from "./contracts.ts";

export const V2_BETA2_PROVIDER_PORT_VERSION = "old-mike-v2-beta2/provider-port/1" as const;

export type V2Beta2ProviderSubmission = {
  jobId: string;
  stageInstanceHash: string;
  requestHash: string;
  receiptCommitment: string;
  source: V2Beta2Source;
};

export type V2Beta2ProviderCapability = Readonly<{
  portVersion: typeof V2_BETA2_PROVIDER_PORT_VERSION;
  providerClass: "LOCAL_DETERMINISTIC_FIXTURE" | "BOUNDED_SERVER_ADAPTER";
  submission: "AVAILABLE" | "PROVEN_NOT_SUBMITTED";
  lookup: "AVAILABLE" | "UNAVAILABLE";
  reasonCode: null | "LOCAL_FIXTURE_DISABLED" | "LIVE_RUNTIME_NOT_AUTHORIZED" | "LOOKUP_AUTHORITY_MISSING";
}>;

export type V2Beta2ProviderLookupRequest = Readonly<{
  receiptCommitment: string;
  requestHash: string;
}>;

export interface V2Beta2ProviderPort {
  capability(): V2Beta2ProviderCapability;
  submit(input: V2Beta2ProviderSubmission): Promise<unknown>;
  lookup(input: V2Beta2ProviderLookupRequest): Promise<unknown>;
}

export class V2Beta2ProviderCapabilityError extends Error {
  readonly code = "beta2_provider_capability_unavailable";
  readonly provenNotSubmitted = true;
  readonly reasonCode: Exclude<V2Beta2ProviderCapability["reasonCode"], null>;

  constructor(reasonCode: Exclude<V2Beta2ProviderCapability["reasonCode"], null>) {
    super("beta2_provider_capability_unavailable");
    this.reasonCode = reasonCode;
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("beta2_provider_submission_invalid");
}

function exactHash(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error("beta2_provider_submission_invalid");
  return value;
}

function exactIdentifier(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || value.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/u.test(value)) throw new Error("beta2_provider_submission_invalid");
  return value;
}

export function parseV2Beta2ProviderSubmission(value: unknown): V2Beta2ProviderSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("beta2_provider_submission_invalid");
  const input = value as Record<string, unknown>;
  exactKeys(input, ["jobId", "stageInstanceHash", "requestHash", "receiptCommitment", "source"]);
  return {
    jobId: exactIdentifier(input.jobId),
    stageInstanceHash: exactHash(input.stageInstanceHash),
    requestHash: exactHash(input.requestHash),
    receiptCommitment: exactHash(input.receiptCommitment),
    source: parseV2Beta2Source(input.source),
  };
}

export function parseV2Beta2ProviderLookupRequest(value: unknown): V2Beta2ProviderLookupRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("beta2_provider_lookup_request_invalid");
  const input = value as Record<string, unknown>;
  const actual = Object.keys(input).sort();
  const expected = ["receiptCommitment", "requestHash"];
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("beta2_provider_lookup_request_invalid");
  try {
    return { receiptCommitment: exactHash(input.receiptCommitment), requestHash: exactHash(input.requestHash) };
  } catch {
    throw new Error("beta2_provider_lookup_request_invalid");
  }
}

export function assertV2Beta2SubmissionCapability(provider: V2Beta2ProviderPort) {
  const capability = provider.capability();
  if (capability.portVersion !== V2_BETA2_PROVIDER_PORT_VERSION || capability.submission !== "AVAILABLE" || capability.reasonCode !== null) {
    throw new V2Beta2ProviderCapabilityError(capability.reasonCode ?? "LIVE_RUNTIME_NOT_AUTHORIZED");
  }
  return capability;
}

export function assertV2Beta2LookupCapability(provider: V2Beta2ProviderPort) {
  const capability = provider.capability();
  if (capability.portVersion !== V2_BETA2_PROVIDER_PORT_VERSION || capability.lookup !== "AVAILABLE" || capability.reasonCode !== null) {
    throw new V2Beta2ProviderCapabilityError(capability.reasonCode ?? "LOOKUP_AUTHORITY_MISSING");
  }
  return capability;
}
