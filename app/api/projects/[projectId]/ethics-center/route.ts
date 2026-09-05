import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  getEthicsCenter,
  saveEthicsScopeItems,
  runEthicsScreening,
  saveEthicsRiskItems,
  saveEthicsDocument,
  saveInstitutionalEthicsDecision,
  saveDmp,
  savePreregistration,
  registerPreregistration,
  amendPreregistration,
  saveJournalReadiness,
  approveEthicsGate,
  markEthicsOutdated,
  aiDraftEthicsDocuments,
  saveTeacherPowerAnswers,
} from "@/lib/research-ethics-repository";

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
    const result = await getEthicsCenter(tenant, { userId });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "ethics center 讀取失敗" }, { status: 422 });
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
  const listOf = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object") : [];
  try {
    switch (action) {
      case "save-scope": {
        const items = listOf(body.items).map((i) => ({ itemKey: typeof i.itemKey === "string" ? i.itemKey : "", answer: typeof i.answer === "string" ? i.answer : undefined, evidence: typeof i.evidence === "string" ? i.evidence : undefined, requiredAction: typeof i.requiredAction === "string" ? i.requiredAction : undefined, unresolvedQuestion: typeof i.unresolvedQuestion === "string" ? i.unresolvedQuestion : undefined }));
        const r = await saveEthicsScopeItems(tenant, { userId, items });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "run-screening": {
        const r = await runEthicsScreening(tenant, { userId });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-risk": {
        const items = listOf(body.items).map((i) => ({ riskKey: typeof i.riskKey === "string" ? i.riskKey : "", likelihood: typeof i.likelihood === "string" ? i.likelihood : undefined, severity: typeof i.severity === "string" ? i.severity : undefined, affectedPopulation: typeof i.affectedPopulation === "string" ? i.affectedPopulation : undefined, mitigation: typeof i.mitigation === "string" ? i.mitigation : undefined, monitoring: typeof i.monitoring === "string" ? i.monitoring : undefined, responsiblePerson: typeof i.responsiblePerson === "string" ? i.responsiblePerson : undefined, residualRisk: typeof i.residualRisk === "string" ? i.residualRisk : undefined, status: typeof i.status === "string" ? i.status : undefined }));
        const r = await saveEthicsRiskItems(tenant, { userId, items });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-teacher-power": {
        const items = listOf(body.items).map((i) => ({ key: typeof i.key === "string" ? i.key : "", answer: typeof i.answer === "string" ? i.answer : "UNKNOWN", note: typeof i.note === "string" ? i.note : undefined }));
        const r = await saveTeacherPowerAnswers(tenant, { userId, items });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-document": {
        const r = await saveEthicsDocument(tenant, { userId, documentType: typeof body.documentType === "string" ? body.documentType : "", content: typeof body.content === "string" ? body.content : undefined, status: typeof body.status === "string" ? body.status : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-decision": {
        const d = (body.decision && typeof body.decision === "object") ? body.decision as Record<string, unknown> : {};
        const r = await saveInstitutionalEthicsDecision(tenant, {
          userId,
          decision: {
            id: typeof d.id === "string" ? d.id : undefined,
            institution: typeof d.institution === "string" ? d.institution : "",
            decisionType: typeof d.decisionType === "string" ? d.decisionType : "OTHER",
            applicationNumber: typeof d.applicationNumber === "string" ? d.applicationNumber : undefined,
            approvalNumber: typeof d.approvalNumber === "string" ? d.approvalNumber : undefined,
            decisionDate: typeof d.decisionDate === "string" ? d.decisionDate : undefined,
            expiryDate: typeof d.expiryDate === "string" ? d.expiryDate : undefined,
            approvedDocuments: Array.isArray(d.approvedDocuments) ? d.approvedDocuments : undefined,
            conditions: Array.isArray(d.conditions) ? d.conditions : undefined,
            fileReference: typeof d.fileReference === "string" ? d.fileReference : undefined,
            verifiedByUser: typeof d.verifiedByUser === "boolean" ? d.verifiedByUser : undefined,
            approvalStatus: typeof d.approvalStatus === "string" ? d.approvalStatus : undefined,
          },
        });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-dmp": {
        const sections = (body.sections && typeof body.sections === "object") ? body.sections as Record<string, string> : {};
        const r = await saveDmp(tenant, { userId, sections, status: typeof body.status === "string" ? body.status : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-preregistration": {
        const fields = (body.fields && typeof body.fields === "object") ? body.fields as Record<string, unknown> : {};
        const r = await savePreregistration(tenant, { userId, fields });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "register-preregistration": {
        const r = await registerPreregistration(tenant, { userId, registrationUrl: typeof body.registrationUrl === "string" ? body.registrationUrl : "", registrationId: typeof body.registrationId === "string" ? body.registrationId : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "amend-preregistration": {
        const r = await amendPreregistration(tenant, { userId, reason: typeof body.reason === "string" ? body.reason : "", changes: Array.isArray(body.changes) ? body.changes : [] });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-readiness": {
        const items = listOf(body.items).map((i) => ({ key: typeof i.key === "string" ? i.key : "", status: typeof i.status === "string" ? i.status : "NOT_STARTED", note: typeof i.note === "string" ? i.note : undefined }));
        const r = await saveJournalReadiness(tenant, { userId, items });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "approve-gate": {
        const gateType = body.gateType === "ETHICS_PACKAGE_PREPARED" ? "ETHICS_PACKAGE_PREPARED" : "ETHICS_SCOPE_DETERMINED";
        const r = await approveEthicsGate(tenant, { userId, gateType });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "mark-outdated": {
        const r = await markEthicsOutdated(tenant, { userId, reason: typeof body.reason === "string" ? body.reason : "上游變更", sourceTable: typeof body.sourceTable === "string" ? body.sourceTable : "research_design" });
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      case "ai-draft-documents": {
        const types = Array.isArray(body.documentTypes) ? body.documentTypes.filter((t): t is string => typeof t === "string") : [];
        const r = await aiDraftEthicsDocuments(tenant, { userId, documentTypes: types, projectTitle: typeof body.projectTitle === "string" ? body.projectTitle : undefined, designSummary: typeof body.designSummary === "string" ? body.designSummary : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "ethics center 操作失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
