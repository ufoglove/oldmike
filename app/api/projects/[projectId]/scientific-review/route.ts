import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import * as s from "@/lib/research-scientific-review-repository";

export const runtime = "nodejs";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
const str = (v: unknown): string => typeof v === "string" ? v : "";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try { return NextResponse.json(await s.getScientificReviewCenter(tenant, { userId: authenticated.session.user.id }), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "老麥科學審查讀取失敗。" }, { status: 422 }); }
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
      case "start-review": r = await s.startScientificReview(tenant, { userId: uid }); break;
      case "add-finding": r = await s.addScientificFinding(tenant, { userId: uid, reviewRunId: str(body.reviewRunId), severity: str(body.severity), issueType: str(body.issueType) || undefined, title: str(body.title), description: str(body.description), recommendedAction: str(body.recommendedAction) || undefined, destinationModule: str(body.destinationModule) || undefined }); break;
      case "update-decision": r = await s.updateFindingDecision(tenant, { userId: uid, reviewRunId: str(body.reviewRunId), findingId: str(body.findingId), decision: str(body.decision), response: str(body.response) || undefined }); break;
      case "create-task": r = await s.createRevisionTask(tenant, { userId: uid, reviewRunId: str(body.reviewRunId), findingId: str(body.findingId), title: str(body.title), requiredAction: str(body.requiredAction) || undefined, destinationModule: str(body.destinationModule) || undefined, severity: str(body.severity) || undefined }); break;
      case "update-task": r = await s.updateTaskStatus(tenant, { userId: uid, reviewRunId: str(body.reviewRunId), taskId: str(body.taskId), status: str(body.status) }); break;
      case "complete-review": r = await s.completeScientificReview(tenant, { userId: uid, reviewRunId: str(body.reviewRunId) }); break;
      default: return NextResponse.json({ ok: false, error: "scientific_review_action_not_supported" }, { status: 422 });
    }
    if (r.ok === false) return NextResponse.json(r, { status: 422 });
    return NextResponse.json(r, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "老麥科學審查操作失敗。" }, { status: 422 });
  }
}
