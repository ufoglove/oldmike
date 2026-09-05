import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import {
  FoundationRuntimeContractError,
  PROJECT_CHAT_MAX_BODY_BYTES,
  parseProjectChatRequest,
  readBoundedJson,
} from "@/lib/foundation-runtime-contract";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  ProjectTaskContextUnavailable,
  loadAuthorizedProjectTaskContext,
} from "@/lib/task-context-repository";
import {
  TASK_GATEWAY_CONTRACT_VERSION,
  TaskGatewayContractError,
  parseTaskEnvelope,
} from "@/lib/task-gateway-contract";
import { TaskProviderExecutionError } from "@/lib/task-gateway";
import { getServerTaskGateway } from "@/lib/task-gateway-runtime";
import { ModelRouteContractError, resolveModelRoute } from "@/lib/model-route-catalog";

const chatSkills = new Set(["scientific-writing", "scientific-critical-thinking"]);

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function commitment(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return noStore({ ok: false, code: "origin_rejected", error: "Request origin was rejected." }, 403);
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  try {
    const input = parseProjectChatRequest(await readBoundedJson(request, PROJECT_CHAT_MAX_BODY_BYTES));
    const route = resolveModelRoute({ modeProfile: input.modeProfile, operation: "PROJECT_CHAT" });
    const context = await loadAuthorizedProjectTaskContext(auth.session.user.id, input.projectId);
    const taskCommitment = commitment(`${context.tenantId}\n${context.projectId}\n${input.idempotencyKey}`);
    const envelope = parseTaskEnvelope({
      contractVersion: TASK_GATEWAY_CONTRACT_VERSION,
      actionId: `chat:${taskCommitment.slice(0, 24)}`,
      taskId: `chat:${taskCommitment.slice(0, 32)}`,
      tenantId: context.tenantId,
      projectId: context.projectId,
      operation: "PROJECT_CHAT",
      idempotencyKey: input.idempotencyKey,
      createdAt: new Date().toISOString(),
      payload: { kind: "PROJECT_CHAT_MESSAGE", message: input.message, contextHash: context.contextHash, modeProfile: input.modeProfile },
      skillIds: ["scientific-writing", "scientific-critical-thinking"],
      toolIds: ["PORTAL_FORMAL_DATA_READ"],
      continuation: null,
    }, chatSkills);
    const result = await getServerTaskGateway(route).execute(envelope, request.signal, context);
    if (!result.output || typeof result.output !== "object" || Array.isArray(result.output) || typeof (result.output as { content?: unknown }).content !== "string") throw new TaskGatewayContractError("task_output_invalid", 502);
    return noStore({
      ok: true,
      content: (result.output as { content: string }).content,
      label: "老麥",
      verificationState: "UNVERIFIED",
      receipt: {
        taskId: result.receipt.taskId,
        state: result.receipt.state,
        attemptClass: result.receipt.attemptClass,
        sanitizedStatus: result.receipt.sanitizedStatus,
        receiptHash: result.receipt.receiptHash,
      },
    }, 200);
  } catch (error) {
    if (error instanceof ModelRouteContractError) return noStore({ ok: false, code: error.code, error: "所選老麥模式尚未由伺服器啟用。" }, error.status);
    if (error instanceof FoundationRuntimeContractError) return noStore({ ok: false, code: error.code, error: "對話請求未通過固定契約。" }, error.status);
    if (error instanceof ProjectTaskContextUnavailable) return noStore({ ok: false, code: error.code, error: "無法取得此專案的授權脈絡。" }, error.status);
    if (error instanceof TaskProviderExecutionError) return noStore({ ok: false, code: error.code, error: "老麥工作未完成；系統不會盲目重送。", reconciliationRequired: error.completionClass === "COMPLETION_UNKNOWN_RECONCILIATION_REQUIRED" }, error.status);
    if (error instanceof TaskGatewayContractError) return noStore({ ok: false, code: error.code, error: error.code === "task_gateway_disabled" ? "老麥服務目前無法使用，請稍後再試。" : "老麥工作未通過安全契約。" }, error.status);
    return noStore({ ok: false, code: "task_gateway_failed_fail_closed", error: "老麥工作未完成；未顯示假回覆。" }, 502);
  }
}
