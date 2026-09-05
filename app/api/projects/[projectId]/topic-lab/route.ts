import "server-only";

import { NextResponse } from "next/server";
import { originAllowed } from "@/lib/auth-http";
import { guardSensitiveAuthRateLimit } from "@/lib/persistent-rate-limit";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { resolveResearchTenant, ResearchStorageUnavailable } from "@/lib/research-repository";
import {
  parseTopicLabRequest,
  topicLabInputHash,
  TopicLabContractError,
  type TopicLabAnalyzeRequest,
} from "@/lib/topic-lab-contract";
import {
  approveTopicLabCandidate,
  findTopicLabRunByIdempotency,
  getLatestTopicLabRun,
  promoteTopicLabCandidate,
  saveTopicLabAnalysis,
  TopicLabRepositoryError,
  TopicLabStorageUnavailable,
} from "@/lib/topic-lab-repository";
import { TopicLabSourceProviderError } from "@/lib/topic-lab-source-provider";
import { executeTopicLabAnalysis, TopicLabGenerationError } from "@/lib/topic-lab-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32_768;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request) {
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new TopicLabContractError("request_too_large", 413);
  const text = await request.text();
  if (!text || Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) throw new TopicLabContractError("invalid_topic_lab_input", text ? 413 : 400);
  try { return JSON.parse(text) as unknown; } catch { throw new TopicLabContractError("invalid_json", 400); }
}

function publicError(error: unknown) {
  if (error instanceof TopicLabContractError) return json({ ok: false, code: error.code, error: "選題實驗室要求未通過固定資料契約。" }, error.status);
  if (error instanceof TopicLabSourceProviderError) return json({ ok: false, code: error.code, error: "公開來源未通過老麥的受控讀取政策。" }, error.status);
  if (error instanceof TopicLabGenerationError) return json({ ok: false, code: error.code, stage: error.stage, reasonEnum: error.reasonEnum, elapsedBucket: error.elapsedBucket, providerAttemptClass: error.providerAttemptClass, recoverableFields: error.recoverableFields, error: `老麥研究方案未完成（${error.stage}）；目前草稿未變更。` }, error.status);
  if (error instanceof TopicLabRepositoryError) return json({ ok: false, code: error.code, error: "選題實驗室操作未通過專案與版本契約。" }, error.status);
  if (error instanceof TopicLabStorageUnavailable || error instanceof ResearchStorageUnavailable) return json({ ok: false, code: "topic_lab_storage_unavailable", error: "選題實驗室目前無法安全讀取正式專案資料。" }, 503);
  return json({ ok: false, code: "topic_lab_unavailable", error: "老麥目前無法完成這項選題操作。" }, 503);
}

async function authorize(projectId: string) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return { response: authenticated.response } as const;
  const tenant = await resolveResearchTenant(authenticated.session.user.id, projectId);
  if (!tenant) return { response: json({ ok: false, code: "topic_lab_not_found" }, 404) } as const;
  return { authenticated, tenant } as const;
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    const run = await getLatestTopicLabRun(authorized.tenant);
    return json({ ok: true, run: run ? { runId: run.id, versionNumber: run.versionNumber, resultHash: run.resultHash, analysis: run.resultPayload } : null });
  } catch (error) {
    return publicError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!originAllowed(request)) return json({ ok: false, code: "origin_rejected", error: "要求來源不符合安全政策。" }, 403);
  try {
    const { projectId } = await context.params;
    const authorized = await authorize(projectId);
    if ("response" in authorized) return authorized.response;
    const parsed = parseTopicLabRequest(await readBody(request));
    const limited = await guardSensitiveAuthRateLimit({ scope: `topic-lab:${parsed.operation}`, identifier: `${authorized.authenticated.session.user.id}:${projectId}`, windowSeconds: 600, max: parsed.operation === "ANALYZE" ? 12 : 20 });
    if (limited) return limited;

    if (parsed.operation === "ANALYZE") {
      const existing = await findTopicLabRunByIdempotency(authorized.tenant, parsed.idempotencyKey);
      if (existing) {
        if (existing.inputHash !== topicLabInputHash(parsed)) throw new TopicLabRepositoryError("idempotency_payload_conflict");
        return json({ ok: true, idempotent: true, sourceCapability: "REPLAY", runId: existing.id, versionNumber: existing.versionNumber, resultHash: existing.resultHash, analysis: existing.resultPayload });
      }
      const observedAt = new Date();
      const executed = await executeTopicLabAnalysis(parsed as TopicLabAnalyzeRequest, { observedAt, signal: request.signal });
      const analysis = executed.analysis;
      const saved = await saveTopicLabAnalysis({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, request: parsed, analysis });
      return json({ ok: true, idempotent: saved.idempotent, sourceCapability: executed.sourceCapability, providerStates: executed.providerStates, providerSubmissionCount: executed.providerSubmissionCount, runId: saved.id, versionNumber: saved.versionNumber, resultHash: saved.resultHash, analysis: saved.resultPayload }, saved.idempotent ? 200 : 201);
    }
    if (parsed.operation === "APPROVE_CANDIDATE") {
      const gate = await approveTopicLabCandidate({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, idempotencyKey: parsed.idempotencyKey, runId: parsed.runId, candidateId: parsed.candidateId, candidateHash: parsed.candidateHash, rationale: parsed.rationale });
      return json({ ok: true, humanGateId: gate.id, artifactVersionId: gate.artifactVersionId, candidateHash: gate.candidateHash, idempotent: gate.idempotent }, gate.idempotent ? 200 : 201);
    }
    const promotion = await promoteTopicLabCandidate({ tenant: authorized.tenant, userId: authorized.authenticated.session.user.id, idempotencyKey: parsed.idempotencyKey, runId: parsed.runId, candidateId: parsed.candidateId, candidateHash: parsed.candidateHash, humanGateId: parsed.humanGateId });
    return json({ ok: true, promotionId: promotion.id, studyVersionId: promotion.studyVersionId, idempotent: promotion.idempotent }, promotion.idempotent ? 200 : 201);
  } catch (error) {
    return publicError(error);
  }
}
