import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import * as ex from "@/lib/research-execution-repository";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try { return NextResponse.json(await ex.getExecutionCenter(tenant, { userId: authenticated.session.user.id }), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "執行中心讀取失敗" }, { status: 422 }); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
  const str = (v: unknown): string => typeof v === "string" ? v : "";
  const uid = authenticated.session.user.id;
  try {
    let r: { ok: boolean; error?: string; [k: string]: unknown };
    switch (action) {
      case "run-activation": r = await ex.runActivationReview(tenant, { userId: uid }); break;
      case "save-site": r = await ex.saveSite(tenant, { userId: uid, site: obj(body.site) }); break;
      case "save-team": r = await ex.saveTeamMember(tenant, { userId: uid, member: obj(body.member) }); break;
      case "save-campaign": r = await ex.saveCampaign(tenant, { userId: uid, campaign: obj(body.campaign) }); break;
      case "save-screening": r = await ex.saveScreening(tenant, { userId: uid, screening: obj(body.screening) }); break;
      case "save-consent": r = await ex.saveConsent(tenant, { userId: uid, consent: obj(body.consent) }); break;
      case "enroll": r = await ex.enrollParticipant(tenant, { userId: uid, participant: obj(body.participant) }); break;
      case "allocate": r = await ex.recordAllocation(tenant, { userId: uid, allocation: obj(body.allocation) }); break;
      case "list-allocations": r = await ex.listAllocationsForRole(tenant, { userId: uid, role: str(body.role) }); break;
      case "create-session": r = await ex.createStudySession(tenant, { userId: uid, session: obj(body.session) }); break;
      case "update-session": r = await ex.updateStudySession(tenant, { userId: uid, sessionId: str(body.sessionId), status: str(body.status) || undefined, actualStart: str(body.actualStart) || undefined, actualEnd: str(body.actualEnd) || undefined, completionStatus: str(body.completionStatus) || undefined, safetyStatus: str(body.safetyStatus) || undefined }); break;
      case "save-delivery": r = await ex.saveDeliveryRecord(tenant, { userId: uid, delivery: obj(body.delivery) }); break;
      case "save-administration": r = await ex.saveInstrumentAdministration(tenant, { userId: uid, administration: obj(body.administration) }); break;
      case "submit-form": r = await ex.submitResearchForm(tenant, { userId: uid, submission: obj(body.submission) }); break;
      case "create-correction": r = await ex.createCorrection(tenant, { userId: uid, correction: obj(body.correction) }); break;
      case "record-qualitative": r = await ex.recordQualitative(tenant, { userId: uid, record: obj(body.record) }); break;
      case "record-sensor": r = await ex.recordSensorCollection(tenant, { userId: uid, record: obj(body.record) }); break;
      case "record-log-batch": r = await ex.recordLogBatch(tenant, { userId: uid, batch: obj(body.batch) }); break;
      case "record-ai-run": r = await ex.recordAiRun(tenant, { userId: uid, run: obj(body.run) }); break;
      case "create-ingestion": r = await ex.createIngestionBatch(tenant, { userId: uid, batch: obj(body.batch) }); break;
      case "register-asset": r = await ex.registerRawAsset(tenant, { userId: uid, asset: obj(body.asset) }); break;
      case "freeze-raw": r = await ex.freezeRawData(tenant, { userId: uid, checks: Array.isArray(body.checks) ? body.checks.map((c) => obj(c)) : [] }); break;
      case "lock-raw": r = await ex.lockRawData(tenant, { userId: uid, checks: Array.isArray(body.checks) ? body.checks.map((c) => obj(c)) : [] }); break;
      case "run-closeout": r = await ex.runCloseout(tenant, { userId: uid }); break;
      case "confirm-closeout": r = await ex.confirmCloseout(tenant, { userId: uid }); break;
      case "generate-report": r = await ex.generateCloseoutReport(tenant, { userId: uid }); break;
      case "run-availability": r = await ex.runDataAvailabilityCheck(tenant, { userId: uid }); break;
      case "create-snapshot": r = await ex.createExecutionSnapshot(tenant, { userId: uid }); break;
      case "record-deviation": r = await ex.recordFormalDeviation(tenant, { userId: uid, deviation: obj(body.deviation) }); break;
      case "record-adverse-event": r = await ex.recordFormalAdverseEvent(tenant, { userId: uid, event: obj(body.event) }); break;
      case "create-query": r = await ex.createDataQuery(tenant, { userId: uid, query: obj(body.query) }); break;
      case "resolve-query": r = await ex.resolveDataQuery(tenant, { userId: uid, queryId: str(body.queryId), response: str(body.response), resolutionStatus: str(body.resolutionStatus) || undefined }); break;
      case "save-follow-up": r = await ex.saveFollowUp(tenant, { userId: uid, followUp: obj(body.followUp) }); break;
      case "record-withdrawal": r = await ex.recordWithdrawal(tenant, { userId: uid, withdrawal: obj(body.withdrawal) }); break;
      case "create-amendment": r = await ex.createAmendment(tenant, { userId: uid, amendment: obj(body.amendment) }); break;
      case "submit-amendment": r = await ex.submitAmendment(tenant, { userId: uid, amendmentId: str(body.amendmentId) }); break;
      case "approve-amendment": r = await ex.approveAmendment(tenant, { userId: uid, amendmentId: str(body.amendmentId) }); break;
      case "resume-study": r = await ex.resumeFormalStudy(tenant, { userId: uid, resume: obj(body.resume) }); break;
      case "record-blinding": r = await ex.recordBlinding(tenant, { userId: uid, record: obj(body.record) }); break;
      case "record-session-activity": r = await ex.recordSessionActivity(tenant, { userId: uid, activity: obj(body.activity) }); break;
      case "extras": r = await ex.getExecutionExtras(tenant, { userId: uid }); break;
      case "pause-study": r = await ex.pauseFormalStudy(tenant, { userId: uid, pauseType: str(body.pauseType), reason: str(body.reason), authority: str(body.authority) || undefined, restartConditions: str(body.restartConditions) || undefined }); break;
      case "approve-gate": {
        const allowed = ["FORMAL_STUDY_ACTIVATED", "RECRUITMENT_AND_DATA_COLLECTION_OPEN", "FORMAL_DATA_ACQUISITION_OPEN", "FORMAL_DATA_COLLECTION_COMPLETE", "RAW_DATA_LOCKED_AND_HANDOFF_READY"];
        const gateType = typeof body.gateType === "string" && allowed.includes(body.gateType) ? body.gateType as "FORMAL_STUDY_ACTIVATED" | "RECRUITMENT_AND_DATA_COLLECTION_OPEN" | "FORMAL_DATA_ACQUISITION_OPEN" | "FORMAL_DATA_COLLECTION_COMPLETE" | "RAW_DATA_LOCKED_AND_HANDOFF_READY" : null;
        if (!gateType) return NextResponse.json({ ok: false, error: "gate_type_invalid" }, { status: 400 });
        r = await ex.approveExecutionGate(tenant, { userId: uid, gateType }); break;
      }
      default: return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "執行中心操作失敗。" }, { status: 422 });
  }
}
