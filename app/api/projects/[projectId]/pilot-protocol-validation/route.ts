import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  getPilotCenter, setApplicability, savePilotComponent, savePilotCriteria, runPilotAuthorization,
  createPilotSession, recordCognitiveInterview, recordPretestResult, recordTechnicalRun, recordSensorResult,
  recordLogValidation, recordAiResult, recordInterventionResult, recordRecruitment, savePilotDataset,
  reviewDatasetCombination, recordPilotDeviation, recordAdverseEvent, createPilotIssue, createPilotRevisionTask,
  updatePilotRevisionTask, assessMaterialChange, makePilotDecision, generatePilotReport, saveValidationItem,
  createProtocolV2, runFormalStudyReadiness, approvePilotGate, writeBlueprintStudyReady, linkPilotEvidence,
  markPilotOutdated,
} from "@/lib/research-pilot-repository";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const userId = authenticated.session.user.id;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(userId, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await getPilotCenter(tenant, { userId }), { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Pilot 中心讀取失敗" }, { status: 422 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const userId = authenticated.session.user.id;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(userId, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
  const str = (v: unknown): string => typeof v === "string" ? v : "";
  const arr = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object") : [];
  try {
    switch (action) {
      case "set-applicability": { const r = await setApplicability(tenant, { userId, applicability: obj(body.applicability) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-component": { const r = await savePilotComponent(tenant, { userId, component: obj(body.component) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-criteria": { const r = await savePilotCriteria(tenant, { userId, criteria: arr(body.criteria) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "run-authorization": { const r = await runPilotAuthorization(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "create-session": { const r = await createPilotSession(tenant, { userId, session: obj(body.session) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-interview": { const r = await recordCognitiveInterview(tenant, { userId, record: obj(body.record) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-pretest": { const r = await recordPretestResult(tenant, { userId, result: obj(body.result) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-technical": { const r = await recordTechnicalRun(tenant, { userId, run: obj(body.run) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-sensor": { const r = await recordSensorResult(tenant, { userId, result: obj(body.result) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-log": { const r = await recordLogValidation(tenant, { userId, result: obj(body.result) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-ai": { const r = await recordAiResult(tenant, { userId, result: obj(body.result) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-intervention": { const r = await recordInterventionResult(tenant, { userId, result: obj(body.result) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-recruitment": { const r = await recordRecruitment(tenant, { userId, summary: obj(body.summary) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-dataset": { const r = await savePilotDataset(tenant, { userId, dataset: obj(body.dataset) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "combination-review": { const r = await reviewDatasetCombination(tenant, { userId, decision: str(body.decision), rationale: str(body.rationale) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-deviation": { const r = await recordPilotDeviation(tenant, { userId, deviation: obj(body.deviation) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "record-adverse-event": { const r = await recordAdverseEvent(tenant, { userId, event: obj(body.event) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "create-issue": { const r = await createPilotIssue(tenant, { userId, issue: obj(body.issue) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "create-revision-task": { const r = await createPilotRevisionTask(tenant, { userId, task: obj(body.task) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "update-revision-task": { const r = await updatePilotRevisionTask(tenant, { userId, taskId: str(body.taskId), status: str(body.status) || undefined, resolutionNote: str(body.resolutionNote) || undefined, afterVersion: str(body.afterVersion) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "assess-material-change": { const r = await assessMaterialChange(tenant, { userId, changeType: str(body.changeType), description: str(body.description), flags: Array.isArray(body.flags) ? body.flags.map((f) => str(f)) : undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "make-decision": { const r = await makePilotDecision(tenant, { userId, decision: str(body.decision), rationale: str(body.rationale) || undefined, userApproved: body.userApproved === true }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "generate-report": { const r = await generatePilotReport(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-validation-item": { const r = await saveValidationItem(tenant, { userId, item: obj(body.item) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "create-protocol-v2": { const r = await createProtocolV2(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "run-readiness": { const r = await runFormalStudyReadiness(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "approve-gate": {
        const allowed = ["PILOT_EXECUTION_AUTHORIZED", "PILOT_AND_PROTOCOL_VALIDATED", "FORMAL_STUDY_EXECUTION_READY"];
        const gateType = typeof body.gateType === "string" && allowed.includes(body.gateType) ? body.gateType as "PILOT_EXECUTION_AUTHORIZED" | "PILOT_AND_PROTOCOL_VALIDATED" | "FORMAL_STUDY_EXECUTION_READY" : null;
        if (!gateType) return NextResponse.json({ ok: false, error: "gate_type_invalid" }, { status: 400 });
        const r = await approvePilotGate(tenant, { userId, gateType });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "write-blueprint-study-ready": { const r = await writeBlueprintStudyReady(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "link-evidence": { const r = await linkPilotEvidence(tenant, { userId, issueId: str(body.issueId) || undefined, literatureId: str(body.literatureId) || undefined, citationSourceId: str(body.citationSourceId) || undefined, zoteroItemKey: str(body.zoteroItemKey) || undefined, role: str(body.role) || undefined, note: str(body.note) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "mark-outdated": { const r = await markPilotOutdated(tenant, { userId, reason: str(body.reason) || "上游變更", sourceTable: str(body.sourceTable) || "study_protocol" }); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
      default: return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pilot 中心操作失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
