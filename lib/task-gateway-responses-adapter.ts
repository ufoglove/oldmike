import "server-only";

import {
  TaskProviderExecutionError,
  type TaskAdapterResult,
  type TaskProviderAdapter,
} from "./task-gateway.ts";
import { taskGatewayHash, type TaskEnvelope } from "./task-gateway-contract.ts";
import { authorizedProjectContextHash, type AuthorizedProjectTaskContext } from "./task-context-contract.ts";

export { TaskProviderExecutionError } from "./task-gateway.ts";

type AdapterConfiguration = {
  endpointUrl: string;
  bearerToken: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  fixtureMode?: boolean;
  stream?: boolean;
};

type ParsedOutput = { content: string; label: "老麥"; verificationState: "UNVERIFIED" };

const PRIVATE_SERVICE_HOST = /^(?:service-[a-f0-9]{24}|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.zeabur\.internal)$/;
const PROVIDER_IDENTITY = /\b(?:openclaw|codex|chatgpt|openai|anthropic|claude|gemini|gpt-[a-z0-9.-]+)\b/i;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function loopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
}

export function isAllowedPrivateResponsesEndpoint(value: string, fixtureMode = false) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/v1/responses") return false;
    if (fixtureMode && url.protocol === "http:" && loopback(url.hostname)) return true;
    return ["http:", "https:"].includes(url.protocol) && PRIVATE_SERVICE_HOST.test(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function validateConfiguration(input: AdapterConfiguration) {
  const fixtureMode = input.fixtureMode === true;
  if (!isAllowedPrivateResponsesEndpoint(input.endpointUrl, fixtureMode)) throw new TaskProviderExecutionError("task_provider_endpoint_rejected", "PROVEN_NOT_SUBMITTED", 503);
  if (typeof input.bearerToken !== "string" || input.bearerToken.length < 16 || input.bearerToken.length > 4_096 || /[\u0000-\u001f\u007f]/.test(input.bearerToken)) {
    throw new TaskProviderExecutionError("task_provider_credential_unavailable", "PROVEN_NOT_SUBMITTED", 503);
  }
  const timeoutMs = input.timeoutMs ?? 20_000;
  const maxOutputBytes = input.maxOutputBytes ?? 65_536;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 25 || timeoutMs > 120_000) throw new TaskProviderExecutionError("task_provider_timeout_invalid", "PROVEN_NOT_SUBMITTED", 503);
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1_024 || maxOutputBytes > 262_144) throw new TaskProviderExecutionError("task_provider_output_bound_invalid", "PROVEN_NOT_SUBMITTED", 503);
  return { endpointUrl: new URL(input.endpointUrl).toString(), bearerToken: input.bearerToken, timeoutMs, maxOutputBytes, fixtureMode, stream: input.stream === true };
}

function validateContext(envelope: TaskEnvelope, context: AuthorizedProjectTaskContext | undefined) {
  if (!context || envelope.operation !== "PROJECT_CHAT" || envelope.payload.kind !== "PROJECT_CHAT_MESSAGE") throw new TaskProviderExecutionError("task_project_context_required", "PROVEN_NOT_SUBMITTED", 403);
  const { contextHash: _contextHash, ...base } = context;
  if (context.tenantId !== envelope.tenantId || context.projectId !== envelope.projectId || context.contextHash !== envelope.payload.contextHash || authorizedProjectContextHash(base) !== context.contextHash) {
    throw new TaskProviderExecutionError("task_project_context_binding_mismatch", "PROVEN_NOT_SUBMITTED", 403);
  }
  if (context.project.status !== "ACTIVE" || context.documents.length > 3 || context.workflowEvents.length > 8 || context.documents.reduce((sum, document) => sum + document.body.length, 0) > 16_000) {
    throw new TaskProviderExecutionError("task_project_context_bound_rejected", "PROVEN_NOT_SUBMITTED", 403);
  }
  return context;
}

function buildRequest(envelope: TaskEnvelope, context: AuthorizedProjectTaskContext, stream: boolean) {
  if (envelope.skillIds.some((skill) => !["scientific-writing", "scientific-critical-thinking", "citation-management"].includes(skill))) throw new TaskProviderExecutionError("task_skill_not_allowed_for_project_chat", "PROVEN_NOT_SUBMITTED", 403);
  if (envelope.toolIds.length !== 1 || envelope.toolIds[0] !== "PORTAL_FORMAL_DATA_READ") throw new TaskProviderExecutionError("task_tool_not_allowed_for_project_chat", "PROVEN_NOT_SUBMITTED", 403);
  const system = "你是老麥。只依 Portal 授權的受限專案脈絡回答；區分使用者輸入、未驗證內容與已驗證證據，不發明引用、結果或完成狀態，不提及底層供應商或模型名稱。";
  const payload = {
    operation: envelope.operation,
    projectContext: context,
    userMessage: envelope.payload.kind === "PROJECT_CHAT_MESSAGE" ? envelope.payload.message : "",
  };
  const body = {
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(payload) }] },
    ],
    stream,
  };
  const raw = JSON.stringify(body);
  if (Buffer.byteLength(raw, "utf8") > 65_536) throw new TaskProviderExecutionError("task_provider_input_too_large", "PROVEN_NOT_SUBMITTED", 413);
  return raw;
}

async function readBoundedBody(response: Response, maximumBytes: number) {
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) throw new TaskProviderExecutionError("task_provider_output_too_large", "TERMINAL_PROVIDER_REJECTED", 502);
  if (!response.body) throw new TaskProviderExecutionError("task_provider_empty_body", "TERMINAL_PROVIDER_REJECTED", 502);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new TaskProviderExecutionError("task_provider_output_too_large", "TERMINAL_PROVIDER_REJECTED", 502);
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

function sanitizeOutput(content: string, bearerToken: string): ParsedOutput {
  const normalized = content.normalize("NFKC").trim();
  if (!normalized || normalized.length > 32_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) throw new TaskProviderExecutionError("task_provider_output_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
  if (normalized.includes(bearerToken)) throw new TaskProviderExecutionError("task_provider_secret_canary_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
  if (PROVIDER_IDENTITY.test(normalized)) throw new TaskProviderExecutionError("task_provider_identity_disclosure_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
  return { content: normalized, label: "老麥", verificationState: "UNVERIFIED" };
}

function parseNonStream(raw: string, bearerToken: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new TaskProviderExecutionError("task_provider_json_invalid", "TERMINAL_PROVIDER_REJECTED", 502); }
  if (!record(parsed) || parsed.object !== "response" || parsed.status !== "completed" || !Array.isArray(parsed.output) || parsed.output.length < 1 || parsed.output.length > 8) {
    throw new TaskProviderExecutionError("task_provider_response_shape_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
  }
  const text: string[] = [];
  for (const item of parsed.output) {
    if (!record(item) || item.type !== "message" || item.role !== "assistant" || !Array.isArray(item.content) || item.content.length < 1 || item.content.length > 16) throw new TaskProviderExecutionError("task_provider_message_shape_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
    for (const content of item.content) {
      if (!record(content) || content.type !== "output_text" || typeof content.text !== "string") throw new TaskProviderExecutionError("task_provider_content_shape_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
      text.push(content.text);
    }
  }
  return sanitizeOutput(text.join(""), bearerToken);
}

function parseStream(raw: string, bearerToken: string) {
  const blocks = raw.split(/\r?\n\r?\n/).map((block) => block.trim()).filter(Boolean);
  const text: string[] = [];
  let completed = false;
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
    const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
    if (!event || !data) throw new TaskProviderExecutionError("task_provider_stream_shape_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
    let parsed: unknown;
    try { parsed = JSON.parse(data); }
    catch { throw new TaskProviderExecutionError("task_provider_stream_json_invalid", "TERMINAL_PROVIDER_REJECTED", 502); }
    if (event === "response.output_text.delta") {
      if (!record(parsed) || parsed.type !== event || typeof parsed.delta !== "string") throw new TaskProviderExecutionError("task_provider_stream_delta_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
      text.push(parsed.delta);
    } else if (event === "response.completed") {
      if (!record(parsed) || parsed.type !== event || !record(parsed.response) || parsed.response.object !== "response" || parsed.response.status !== "completed") throw new TaskProviderExecutionError("task_provider_stream_completion_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
      completed = true;
    } else {
      throw new TaskProviderExecutionError("task_provider_stream_event_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
    }
  }
  if (!completed) throw new TaskProviderExecutionError("task_provider_stream_completion_missing", "TERMINAL_PROVIDER_REJECTED", 502);
  return sanitizeOutput(text.join(""), bearerToken);
}

export class PrivateResponsesTaskProviderAdapter implements TaskProviderAdapter {
  readonly adapterKind = "PRIVATE_RESPONSES" as const;
  readonly supportedOperations = ["PROJECT_CHAT"] as const;
  readonly #configuration: ReturnType<typeof validateConfiguration>;

  constructor(input: AdapterConfiguration) { this.#configuration = validateConfiguration(input); }

  async execute(envelope: TaskEnvelope, signal: AbortSignal, executionContext?: AuthorizedProjectTaskContext): Promise<TaskAdapterResult> {
    if (signal.aborted) throw new TaskProviderExecutionError("task_canceled", "PROVEN_NOT_SUBMITTED", 409);
    const context = validateContext(envelope, executionContext);
    const rawRequest = buildRequest(envelope, context, this.#configuration.stream);
    const controller = new AbortController();
    const parentAbort = () => controller.abort("parent_abort");
    signal.addEventListener("abort", parentAbort, { once: true });
    const timer = setTimeout(() => controller.abort("timeout"), this.#configuration.timeoutMs);
    let submitted = false;
    try {
      submitted = true;
      const response = await fetch(this.#configuration.endpointUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#configuration.bearerToken}`,
          "Content-Type": "application/json",
          Accept: this.#configuration.stream ? "text/event-stream" : "application/json",
          "Idempotency-Key": envelope.idempotencyKey,
        },
        body: rawRequest,
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status !== 200) throw new TaskProviderExecutionError("task_provider_http_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (this.#configuration.stream ? !contentType.startsWith("text/event-stream") : !contentType.startsWith("application/json")) throw new TaskProviderExecutionError("task_provider_content_type_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
      const raw = await readBoundedBody(response, this.#configuration.maxOutputBytes);
      const output = this.#configuration.stream ? parseStream(raw, this.#configuration.bearerToken) : parseNonStream(raw, this.#configuration.bearerToken);
      return { status: "PROVIDER_COMPLETE", output, outputHash: taskGatewayHash(output), humanGate: null, dataEgress: "BOUNDED_AUTHORIZED_PROJECT_CONTEXT" };
    } catch (error) {
      if (error instanceof TaskProviderExecutionError) throw error;
      throw new TaskProviderExecutionError(
        controller.signal.aborted ? "task_provider_timeout_or_cancel" : "task_provider_transport_failure",
        submitted ? "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED" : "PROVEN_NOT_SUBMITTED",
        controller.signal.aborted ? 504 : 502,
      );
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", parentAbort);
    }
  }
}
