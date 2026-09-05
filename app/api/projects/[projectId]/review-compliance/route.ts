import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  getReviewCompliance,
  runReviewerSimulation,
  setFindingStatus,
  createRevisionTask,
  updateRevisionTask,
  saveEligibility,
  saveOfficialRuleSnapshot,
  runComplianceCheck,
  updateComplianceItem,
  approveComplianceGate,
  markComplianceOutdated,
} from "@/lib/review-compliance-repository";

export const runtime = "nodejs";

type RouteKey = "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";
const ROUTES: RouteKey[] = ["NSTC_PROPOSAL", "MOE_TPR_PROPOSAL"];

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const userId = authenticated.session.user.id;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(userId, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const routeParam = url.searchParams.get("route") as RouteKey | null;
  const routes: RouteKey[] = routeParam && ROUTES.includes(routeParam) ? [routeParam] : ROUTES;
  const results: Record<string, unknown> = {};
  for (const route of routes) {
    try { results[route] = await getReviewCompliance(tenant, { userId, route }); }
    catch (error) { results[route] = { ok: false, error: error instanceof Error ? error.message : "review compliance 讀取失敗" }; }
  }
  return NextResponse.json({ ok: true, routes: results });
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
  const route = typeof body.route === "string" && ROUTES.includes(body.route as RouteKey) ? body.route as RouteKey : null;
  try {
    switch (action) {
      case "run-reviewer": {
        if (!route || typeof body.reviewerType !== "string") return NextResponse.json({ ok: false, error: "route_and_reviewer_type_required" }, { status: 400 });
        const r = await runReviewerSimulation(tenant, { userId, route, reviewerType: body.reviewerType, ai: body.ai === true });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "finding-status": {
        if (typeof body.findingId !== "string" || typeof body.status !== "string") return NextResponse.json({ ok: false, error: "finding_id_and_status_required" }, { status: 400 });
        const r = await setFindingStatus(tenant, { userId, findingId: body.findingId, status: body.status });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "create-revision-task": {
        if (typeof body.findingId !== "string" || typeof body.requiredAction !== "string") return NextResponse.json({ ok: false, error: "finding_id_and_action_required" }, { status: 400 });
        const r = await createRevisionTask(tenant, { userId, findingId: body.findingId, requiredAction: body.requiredAction, severity: typeof body.severity === "string" ? body.severity : undefined, owner: typeof body.owner === "string" ? body.owner : undefined, dueDate: typeof body.dueDate === "string" ? body.dueDate : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "update-revision-task": {
        if (typeof body.taskId !== "string") return NextResponse.json({ ok: false, error: "task_id_required" }, { status: 400 });
        const r = await updateRevisionTask(tenant, { userId, taskId: body.taskId, status: typeof body.status === "string" ? body.status : undefined, resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote : undefined, afterVersion: typeof body.afterVersion === "string" ? body.afterVersion : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-eligibility": {
        const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]).filter((i) => i && typeof i === "object").map((i) => ({ key: typeof i.key === "string" ? i.key : "", status: typeof i.status === "string" ? i.status : "UNKNOWN", evidence: typeof i.evidence === "string" ? i.evidence : undefined, note: typeof i.note === "string" ? i.note : undefined })) : [];
        const r = await saveEligibility(tenant, { userId, items });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-rule-snapshot": {
        const r = await saveOfficialRuleSnapshot(tenant, {
          userId,
          authority: body.authority === "MOE_TPR" ? "MOE_TPR" : "NSTC",
          targetYear: typeof body.targetYear === "number" ? body.targetYear : new Date().getUTCFullYear(),
          documentTitle: typeof body.documentTitle === "string" ? body.documentTitle : "",
          requirement: typeof body.requirement === "string" ? body.requirement : "",
          sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
          verificationStatus: typeof body.verificationStatus === "string" ? body.verificationStatus : undefined,
          effectiveDate: typeof body.effectiveDate === "string" ? body.effectiveDate : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "run-compliance": {
        if (!route) return NextResponse.json({ ok: false, error: "route_required" }, { status: 400 });
        const r = await runComplianceCheck(tenant, { userId, route, targetYear: typeof body.targetYear === "number" ? body.targetYear : new Date().getUTCFullYear() });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "update-compliance-item": {
        if (typeof body.itemId !== "string") return NextResponse.json({ ok: false, error: "item_id_required" }, { status: 400 });
        const r = await updateComplianceItem(tenant, { userId, itemId: body.itemId, currentStatus: typeof body.currentStatus === "string" ? body.currentStatus : undefined, evidence: typeof body.evidence === "string" ? body.evidence : undefined, requiredAction: typeof body.requiredAction === "string" ? body.requiredAction : undefined, missingItem: typeof body.missingItem === "string" ? body.missingItem : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "approve-gate": {
        const allowed = ["NSTC_INTERNAL_REVIEW_PASSED", "NSTC_COMPLIANCE_PASSED", "MOE_TPR_ELIGIBILITY_PASSED", "MOE_TPR_INTERNAL_REVIEW_PASSED", "MOE_TPR_COMPLIANCE_PASSED"];
        const gateType = typeof body.gateType === "string" && allowed.includes(body.gateType) ? body.gateType as "NSTC_INTERNAL_REVIEW_PASSED" | "NSTC_COMPLIANCE_PASSED" | "MOE_TPR_ELIGIBILITY_PASSED" | "MOE_TPR_INTERNAL_REVIEW_PASSED" | "MOE_TPR_COMPLIANCE_PASSED" : null;
        if (!gateType) return NextResponse.json({ ok: false, error: "gate_type_invalid" }, { status: 400 });
        const r = await approveComplianceGate(tenant, { userId, gateType });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "mark-outdated": {
        const r = await markComplianceOutdated(tenant, { userId, reason: typeof body.reason === "string" ? body.reason : "上游變更", sourceTable: typeof body.sourceTable === "string" ? body.sourceTable : "research_design" });
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "review compliance 操作失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
