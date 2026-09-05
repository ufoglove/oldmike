import "server-only";

import { createHash } from "node:crypto";
import { oldMikeAssistMessages } from "./assist-prompts.ts";
import { ASSIST_REGISTRY, canonicalAssistSource, parseOldMikeAssistResponse, type OldMikeAssistRequest, type OldMikeAssistResponse } from "./old-mike-assist-contract.ts";
import { callOpenClaw, type OpenClawCallResult } from "./openclaw.ts";
import { sha256CanonicalPortable } from "./canonical-sha256.ts";

export type OldMikeAssistServerResult =
  | { kind: "success"; value: OldMikeAssistResponse }
  | { kind: "parse-failed"; code: string }
  | { kind: "gateway-failed"; failure: Exclude<OpenClawCallResult, { kind: "success" }> };

type OldMikeAssistExecutionInput = {
  request: OldMikeAssistRequest;
  context: unknown;
  contextHash: string;
  sessionKey: string;
  signal?: AbortSignal;
  provider?: { submit(input: { messages: ReturnType<typeof oldMikeAssistMessages>; sessionKey: string; signal?: AbortSignal }): Promise<OpenClawCallResult> };
};

type AssistLedgerEntry = { requestHash: string; promise?: Promise<OldMikeAssistServerResult>; result?: OldMikeAssistServerResult };
const assistLedger = new Map<string, AssistLedgerEntry>();
const MAX_ASSIST_LEDGER = 128;

function retainAssistResult(key: string, requestHash: string, result: OldMikeAssistServerResult) {
  assistLedger.set(key, { requestHash, result });
  while (assistLedger.size > MAX_ASSIST_LEDGER) assistLedger.delete(assistLedger.keys().next().value as string);
}

async function executeAssistOnce(input: OldMikeAssistExecutionInput): Promise<OldMikeAssistServerResult> {
  const messages = oldMikeAssistMessages(input.request, input.context);
  const result = input.provider
    ? await input.provider.submit({ messages, sessionKey: input.sessionKey, signal: input.signal })
    : await callOpenClaw(messages, input.sessionKey, ASSIST_REGISTRY[input.request.surface].operation, undefined, input.signal);
  if (result.kind !== "success") return { kind: "gateway-failed", failure: result };
  const parsed = parseOldMikeAssistResponse(result.content, input.request, { contextHash: input.contextHash });
  if (!parsed.ok) return { kind: "parse-failed", code: parsed.code };
  return { kind: "success", value: parsed.value };
}

export async function executeOldMikeAssist(input: OldMikeAssistExecutionInput): Promise<OldMikeAssistServerResult> {
  if (input.signal?.aborted) return { kind: "gateway-failed", failure: { kind: "upstream-error" } };
  if (input.request.modeProfile !== "AUTO") return { kind: "parse-failed", code: "assist_mode_not_enabled" };
  if (createHash("sha256").update(canonicalAssistSource(input.request.contextSnapshot), "utf8").digest("hex") !== input.request.sourceHash) return { kind: "parse-failed", code: "assist_source_hash_mismatch" };
  const ledgerKey = sha256CanonicalPortable({ scope: input.sessionKey, idempotencyKey: input.request.idempotencyKey });
  const requestHash = sha256CanonicalPortable({ request: input.request, contextHash: input.contextHash });
  const prior = assistLedger.get(ledgerKey);
  if (prior) {
    if (prior.requestHash !== requestHash) return { kind: "parse-failed", code: "assist_idempotency_conflict" };
    if (prior.result) return prior.result;
    if (prior.promise) return prior.promise;
  }
  const promise = executeAssistOnce(input);
  assistLedger.set(ledgerKey, { requestHash, promise });
  const result = await promise.catch(() => ({ kind: "gateway-failed", failure: { kind: "upstream-error" } } as OldMikeAssistServerResult));
  retainAssistResult(ledgerKey, requestHash, result);
  return result;
}
