import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import * as l from "@/lib/research-language-repository";

export const runtime = "nodejs";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
const str = (v: unknown): string => typeof v === "string" ? v : "";
const arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((i): i is string => typeof i === "string") : [];

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try { return NextResponse.json(await l.getLanguageCenter(tenant, { userId: authenticated.session.user.id }), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "語言中心讀取失敗。" }, { status: 422 }); }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = str(body.action);
  const uid = authenticated.session.user.id;
  try {
    let r: Record<string, unknown>;
    switch (action) {
      case "create-work-order": r = await l.createLanguageWorkOrder(tenant, { userId: uid, serviceMode: str(body.serviceMode), routeMode: str(body.routeMode) || undefined, requestedDepth: str(body.requestedDepth) || undefined, targetJournal: str(body.targetJournal) || undefined, selectedSections: arr(body.selectedSections) }); break;
      case "save-finding": r = await l.saveLanguageFinding(tenant, { userId: uid, workOrderId: str(body.workOrderId), section: str(body.section), issueType: str(body.issueType), originalText: str(body.originalText), suggestedText: str(body.suggestedText), rationale: str(body.rationale) || undefined, risk: str(body.risk) || undefined, severity: str(body.severity) || undefined }); break;
      case "update-decision": r = await l.updateLanguageFindingDecision(tenant, { userId: uid, workOrderId: str(body.workOrderId), findingId: str(body.findingId), decision: str(body.decision) }); break;
      case "save-qa": r = await l.saveLanguageQaResult(tenant, { userId: uid, workOrderId: str(body.workOrderId), checkKind: str(body.checkKind), status: str(body.status), issues: str(body.issues) || undefined }); break;
      case "save-disclosure": r = await l.saveLanguageDisclosure(tenant, { userId: uid, workOrderId: str(body.workOrderId), toolCategory: str(body.toolCategory), purpose: str(body.purpose) || undefined, sectionsAffected: str(body.sectionsAffected) || undefined, disclosureDraft: str(body.disclosureDraft) || undefined }); break;
      case "approve": r = await l.approveLanguageWorkOrder(tenant, { userId: uid, workOrderId: str(body.workOrderId) }); break;
      default: return NextResponse.json({ ok: false, error: "language_action_not_supported" }, { status: 422 });
    }
    if (r.ok === false) return NextResponse.json(r, { status: 422 });
    return NextResponse.json(r, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "語言中心操作失敗。" }, { status: 422 });
  }
}
