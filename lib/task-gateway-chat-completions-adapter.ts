import "server-only";

import {
  executeOpenClawChatCompletion,
  normalizePrivateGatewayBaseUrl,
  type OpenClawMessage,
} from "./openclaw.ts";
import { resolveModelRoute, type ResolvedModelRoute } from "./model-route-catalog.ts";
import {
  TaskProviderExecutionError,
  type TaskAdapterResult,
  type TaskProviderAdapter,
} from "./task-gateway.ts";
import { taskGatewayHash, type TaskEnvelope } from "./task-gateway-contract.ts";
import { authorizedProjectContextHash, type AuthorizedProjectTaskContext } from "./task-context-contract.ts";

type AdapterConfiguration = {
  baseUrl: string;
  bearerToken: string;
  route?: ResolvedModelRoute;
  timeoutMs?: number;
  maxOutputBytes?: number;
  fixtureMode?: boolean;
};

type ParsedOutput = { content: string; label: "老麥"; verificationState: "UNVERIFIED" };

const PROVIDER_IDENTITY = /\b(?:openclaw|codex|chatgpt|openai|anthropic|claude|gemini|deepseek|gpt-[a-z0-9.-]+)\b/iu;

function validateConfiguration(input: AdapterConfiguration) {
  const baseUrl = normalizePrivateGatewayBaseUrl(input.baseUrl);
  if (!baseUrl) throw new TaskProviderExecutionError("task_provider_base_url_rejected", "PROVEN_NOT_SUBMITTED", 503);
  if (typeof input.bearerToken !== "string" || input.bearerToken.length < 16 || input.bearerToken.length > 4_096 || /[\u0000-\u001f\u007f]/u.test(input.bearerToken)) {
    throw new TaskProviderExecutionError("task_provider_credential_unavailable", "PROVEN_NOT_SUBMITTED", 503);
  }
  const route = input.route ?? resolveModelRoute({ modeProfile: "AUTO", operation: "PROJECT_CHAT" });
  const timeoutMs = input.timeoutMs ?? route.timeoutMs;
  const maxOutputBytes = input.maxOutputBytes ?? route.outputLimitBytes;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 25 || timeoutMs > 120_000) throw new TaskProviderExecutionError("task_provider_timeout_invalid", "PROVEN_NOT_SUBMITTED", 503);
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1_024 || maxOutputBytes > 262_144) throw new TaskProviderExecutionError("task_provider_output_bound_invalid", "PROVEN_NOT_SUBMITTED", 503);
  if (route.operation !== "PROJECT_CHAT" || route.endpointFamily !== "CHAT_COMPLETIONS" || route.endpointFeatureState !== "ENABLED" || route.modelOverride !== null) {
    throw new TaskProviderExecutionError("task_provider_route_rejected", "PROVEN_NOT_SUBMITTED", 503);
  }
  return {
    baseUrl,
    bearerToken: input.bearerToken,
    route: { ...route, operation: "PROJECT_CHAT" as const, timeoutMs, outputLimitBytes: maxOutputBytes },
  };
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

function buildMessages(envelope: TaskEnvelope, context: AuthorizedProjectTaskContext): OpenClawMessage[] {
  if (envelope.skillIds.some((skill) => !["scientific-writing", "scientific-critical-thinking", "citation-management"].includes(skill))) throw new TaskProviderExecutionError("task_skill_not_allowed_for_project_chat", "PROVEN_NOT_SUBMITTED", 403);
  if (envelope.toolIds.length !== 1 || envelope.toolIds[0] !== "PORTAL_FORMAL_DATA_READ") throw new TaskProviderExecutionError("task_tool_not_allowed_for_project_chat", "PROVEN_NOT_SUBMITTED", 403);
  const authorizedProjectContext = {
    project: context.project,
    documents: context.documents.map(({ logicalId: _logicalId, ...document }) => document),
    workflowEvents: context.workflowEvents,
    contextHash: context.contextHash,
  };
  return [
    {
      role: "system",
      content: "你是老麥。只依 Portal 已授權且受限的專案脈絡回答；區分使用者輸入、未驗證內容與已驗證證據，不發明引用、結果或完成狀態，不提及底層供應商或模型名稱。",
    },
    {
      role: "user",
      content: JSON.stringify({
        operation: "PROJECT_CHAT",
        authorizedProjectContext,
        userMessage: envelope.payload.kind === "PROJECT_CHAT_MESSAGE" ? envelope.payload.message : "",
      }),
    },
  ];
}

function sanitizeOutput(content: string, bearerToken: string, maximumBytes: number): ParsedOutput {
  const normalized = content.normalize("NFKC").trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > maximumBytes || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) throw new TaskProviderExecutionError("task_provider_output_invalid", "TERMINAL_PROVIDER_REJECTED", 502);
  if (normalized.includes(bearerToken)) throw new TaskProviderExecutionError("task_provider_secret_canary_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
  if (PROVIDER_IDENTITY.test(normalized)) throw new TaskProviderExecutionError("task_provider_identity_disclosure_rejected", "TERMINAL_PROVIDER_REJECTED", 502);
  return { content: normalized, label: "老麥", verificationState: "UNVERIFIED" };
}

export class PrivateChatCompletionsTaskProviderAdapter implements TaskProviderAdapter {
  readonly adapterKind = "PRIVATE_CHAT_COMPLETIONS" as const;
  readonly supportedOperations = ["PROJECT_CHAT"] as const;
  readonly #configuration: ReturnType<typeof validateConfiguration>;

  constructor(input: AdapterConfiguration) { this.#configuration = validateConfiguration(input); }

  async execute(envelope: TaskEnvelope, signal: AbortSignal, executionContext?: AuthorizedProjectTaskContext): Promise<TaskAdapterResult> {
    if (signal.aborted) throw new TaskProviderExecutionError("task_canceled", "PROVEN_NOT_SUBMITTED", 409);
    const context = validateContext(envelope, executionContext);
    const sessionKey = `old-mike-project-chat:${taskGatewayHash({ tenantId: envelope.tenantId, projectId: envelope.projectId })}`;
    const result = await executeOpenClawChatCompletion({
      messages: buildMessages(envelope, context),
      sessionKey,
      operation: "PROJECT_CHAT",
      route: this.#configuration.route,
      baseUrl: this.#configuration.baseUrl,
      bearerToken: this.#configuration.bearerToken,
      signal,
    });
    if (result.kind === "proven-not-submitted") {
      throw new TaskProviderExecutionError(
        result.code === "canceled_before_submission" ? "task_canceled" : "task_provider_request_rejected",
        "PROVEN_NOT_SUBMITTED",
        result.code === "canceled_before_submission" ? 409 : 503,
      );
    }
    if (result.kind === "terminal-rejected") {
      const code = result.code === "http_rejected"
        ? "task_provider_http_rejected"
        : result.code === "response_shape_invalid"
          ? "task_provider_response_shape_invalid"
          : result.code === "content_type_rejected"
            ? "task_provider_content_type_rejected"
            : "task_provider_output_rejected";
      throw new TaskProviderExecutionError(code, "TERMINAL_PROVIDER_REJECTED", 502);
    }
    if (result.kind === "completion-unknown") {
      const timeoutOrCancel = result.code === "provider_deadline" || result.code === "caller_cancel";
      throw new TaskProviderExecutionError(timeoutOrCancel ? "task_provider_timeout_or_cancel" : "task_provider_transport_failure", "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED", timeoutOrCancel ? 504 : 502);
    }
    const output = sanitizeOutput(result.content, this.#configuration.bearerToken, this.#configuration.route.outputLimitBytes);
    return {
      status: "PROVIDER_COMPLETE",
      output,
      outputHash: taskGatewayHash(output),
      humanGate: null,
      dataEgress: "BOUNDED_AUTHORIZED_PROJECT_CONTEXT",
    };
  }
}
