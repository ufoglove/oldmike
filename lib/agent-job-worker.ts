import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { callOpenClaw } from "./openclaw.ts";
import { resolveModelRoute } from "./model-route-catalog.ts";
import type { ResearchTenant } from "./research-repository.ts";
import {
  appendJobEvent,
  getAgentJob,
  requeueStaleRunningJobs,
  updateAgentJobStatus,
  type AgentJob,
} from "./agent-job-repository.ts";

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }) : null;
async function withClient<T>(operation: (client: PoolClient) => Promise<T>) {
  if (!pool) throw new Error("agent_worker_storage_unavailable");
  const client = await pool.connect();
  try { return await operation(client); } finally { client.release(); }
}
function tenantWhere(): string { return "workspace_id=$1 AND project_id=$2"; }

export type ResearchStartSummary = {
  title_suggestion: string;
  research_focus: string;
  provided_facts: string[];
  proposed_questions: string[];
  unknowns: string[];
  evidence_needed: string[];
  next_action: string;
  source_artifact_version: string | number;
  suggested_fields?: Record<string, { value: string; reason: string }>;
};

function boundedString(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function boundedStrings(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => boundedString(item, maxLen)).filter(Boolean).slice(0, maxItems);
}

export function parseResearchStartSummary(content: string): ResearchStartSummary {
  let candidate = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(candidate);
  if (fence) candidate = fence[1].trim();
  const value = JSON.parse(candidate) as Record<string, unknown>;
  const summary: ResearchStartSummary = {
    title_suggestion: boundedString(value.title_suggestion, 200),
    research_focus: boundedString(value.research_focus, 2000),
    provided_facts: boundedStrings(value.provided_facts, 30, 500),
    proposed_questions: boundedStrings(value.proposed_questions, 20, 500),
    unknowns: boundedStrings(value.unknowns, 20, 500),
    evidence_needed: boundedStrings(value.evidence_needed, 20, 500),
    next_action: boundedString(value.next_action, 1000),
    source_artifact_version: typeof value.source_artifact_version === "number" ? value.source_artifact_version : boundedString(value.source_artifact_version, 100) || 0,
  };
  if (!summary.title_suggestion || !summary.research_focus) throw new Error("invalid_summary_shape");
  if (Array.isArray(value.suggested_fields)) {
    const record: Record<string, { value: string; reason: string }> = {};
    for (const item of value.suggested_fields) {
      const row = item as Record<string, unknown>;
      if (row && typeof row === "object" && typeof row.field === "string" && typeof row.value === "string") {
        record[row.field] = { value: boundedString(row.value, 500), reason: boundedString(row.reason, 300) };
      }
    }
    if (Object.keys(record).length) summary.suggested_fields = record;
  }
  return summary;
}

const SYSTEM_PROMPT = `你是老麥（研究啟動助理）。把使用者的輸入整理成「研究啟動摘要」，輸出單一 JSON 物件，不要輸出其他文字。
嚴格欄位（勿增刪鍵）：
{"title_suggestion": string, "research_focus": string, "provided_facts": string[], "proposed_questions": string[], "unknowns": string[], "evidence_needed": string[], "next_action": string, "source_artifact_version": number|string, "suggested_fields": [{"field": string, "value": string, "reason": string}]}
規則：
- 只依使用者提供的輸入整理；不可發明文獻、DOI、數據、統計或已完成的結果。
- 缺外部文獻時，evidence_needed 要如實寫「需檢索驗證（本摘要依目前輸入產生，尚未檢索）」類內容，不得假裝有大數據結論。
- AI 提出的建議值必須放 suggested_fields 並給 reason；不要把建議寫成事實欄位。
- source_artifact_version 填 0（代表輸入版本由系統另存）。`;

function summaryMessages(inputSnapshot: Record<string, unknown>): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `以下是研究起點輸入（可能來自表單或既有專案）：\n${JSON.stringify(inputSnapshot, null, 2)}` },
  ];
}

async function saveSummaryDocument(tenant: ResearchTenant, actorId: string, summary: ResearchStartSummary): Promise<{ logicalId: string; versionNumber: number; documentId: string }> {
  return withClient(async (client) => {
    const logicalId = `research-start-summary`;
    const prior = (await client.query(
      `SELECT id, version_number AS "versionNumber" FROM research_documents WHERE ${tenantWhere()} AND logical_id=$3 ORDER BY version_number DESC LIMIT 1`,
      [tenant.workspaceId, tenant.projectId, logicalId],
    )).rows[0] as { id: string; versionNumber: number } | undefined;
    const versionNumber = (prior?.versionNumber ?? 0) + 1;
    const documentId = `rsd_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const body = JSON.stringify(summary);
    const contentHash = createHash("sha256").update(body).digest("hex");
    await client.query(
      `INSERT INTO research_documents (id, logical_id, version_number, supersedes_version_id, workspace_id, project_id, created_by_user_id, document_type, title, body, content_hash, stage_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'RESEARCH_START_SUMMARY',$8,$9,$10,'{}')`,
      [documentId, logicalId, versionNumber, prior?.id ?? null, tenant.workspaceId, tenant.projectId, actorId, summary.title_suggestion.slice(0, 200), body, contentHash],
    );
    return { logicalId, versionNumber, documentId };
  });
}

export async function processResearchStartSummary(tenant: ResearchTenant, job: AgentJob): Promise<void> {
  const jobId = job.jobId;
  const log = (eventType: string, detail?: Record<string, unknown>) => { void appendJobEvent({ tenant, jobId, eventType, detail }); };
  log("JOB_STARTED", { taskType: job.taskType, attempt: job.attempt + 1 });
  await updateAgentJobStatus({ tenant, jobId, patch: { status: "RUNNING", leaseUntil: new Date(Date.now() + 5 * 60_000).toISOString(), attempt: job.attempt + 1, checkpoint: { phase: "ai_call" } } });
  // 帶 route：先走主要（vectide）再備援 gateway，與既有翻譯/assist 成功路徑一致；
  // 此 route 僅決定模型上游與預算等級，prompt 內容由 summaryMessages 控制
  // 帶 route：先走主要（vectide）再備援 gateway（與既有翻譯成功路徑一致）；僅決定上游與預算
  const operation = "ACADEMIC_LANGUAGE" as const;
  const route = resolveModelRoute({ modeProfile: "AUTO", operation });
  const result = await callOpenClaw(summaryMessages(job.inputSnapshot), `agent-job:${jobId}`, operation, route);
  if (result.kind === "not-configured") {
    log("JOB_FAILED", { code: "ai_service_not_configured" });
    await updateAgentJobStatus({ tenant, jobId, patch: { status: "FAILED", errorCode: "ai_service_not_configured", errorMessage: "老麥 AI 服務尚未設定；未產生或覆寫任何摘要。", resultReference: {} } });
    return;
  }
  if (result.kind === "invalid-config") {
    log("JOB_FAILED", { code: "ai_service_policy_error" });
    await updateAgentJobStatus({ tenant, jobId, patch: { status: "FAILED", errorCode: "ai_service_policy_error", errorMessage: "AI 服務政策不符；未產生或覆寫任何摘要。" } });
    return;
  }
  if (result.kind === "demo") {
    // demo/fixture 回傳不是真實 AI 結果；不視為成功
    log("JOB_FAILED", { code: "ai_service_not_configured" });
    await updateAgentJobStatus({ tenant, jobId, patch: { status: "FAILED", errorCode: "ai_service_not_configured", errorMessage: "老麥 AI 服務尚未設定（目前為展示模式）；未產生或覆寫任何摘要。" } });
    return;
  }
  if (result.kind === "upstream-error") {
    log("JOB_FAILED", { code: "ai_service_unavailable" });
    await updateAgentJobStatus({ tenant, jobId, patch: { status: "FAILED", errorCode: "ai_service_unavailable", errorMessage: "AI 服務暫時不可用；未產生或覆寫任何摘要。可稍後重試。" } });
    return;
  }
  try {
    const summary = parseResearchStartSummary(result.content);
    const artifact = await saveSummaryDocument(tenant, job.requesterUserId, summary);
    await updateAgentJobStatus({
      tenant,
      jobId,
      patch: {
        status: "SUCCEEDED",
        checkpoint: { phase: "done" },
        resultReference: { summary, artifact, provenance: { modelPromptVersion: "v3u01-research-start-summary/1.0.0", suggestedNotFact: true } },
      },
    });
    log("JOB_SUCCEEDED", { artifact });
  } catch (parseError) {
    // 模型回傳不合格 JSON → 不污染正式欄位；保留失敗診斷
    const message = parseError instanceof Error ? parseError.message.slice(0, 300) : "invalid_json";
    log("JOB_FAILED", { code: "invalid_summary_result", message });
    await updateAgentJobStatus({ tenant, jobId, patch: { status: "FAILED", errorCode: "invalid_summary_result", errorMessage: `模型回傳格式不合格（${message}）；未寫入正式欄位。請重試。` } });
  }
}

export async function dispatchPendingJobs(tenant: ResearchTenant): Promise<number> {
  const requeued = await requeueStaleRunningJobs(tenant, 300);
  const rows = await withClient(async (client) => {
    const result = await client.query(
      `SELECT job_id AS "jobId" FROM agent_jobs WHERE ${tenantWhere()} AND status='QUEUED' ORDER BY created_at ASC LIMIT 5`,
      [tenant.workspaceId, tenant.projectId],
    );
    return result.rows as Array<{ jobId: string }>;
  });
  let dispatched = 0;
  for (const row of rows) {
    const job = await getAgentJob(tenant, row.jobId);
    if (!job) continue;
    if (job.taskType === "RESEARCH_START_SUMMARY") {
      await processResearchStartSummary(tenant, job);
    } else {
      await updateAgentJobStatus({ tenant, jobId: job.jobId, patch: { status: "REQUIRES_ACTION", errorCode: "unknown_task_type", errorMessage: `未支援的 task_type：${job.taskType}` } });
    }
    dispatched += 1;
  }
  return requeued + dispatched;
}
