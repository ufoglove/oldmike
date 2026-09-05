import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  getApplicationPackage,
  savePackageFile,
  approvePackageFile,
  approvePackageGate,
  updateSubmissionRecord,
  saveGrantDecision,
  markPackagesOutdated,
} from "@/lib/application-package-repository";

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
    try { results[route] = await getApplicationPackage(tenant, { userId, route }); }
    catch (error) { results[route] = { ok: false, error: error instanceof Error ? error.message : "application package 讀取失敗" }; }
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
      case "save-file": {
        if (!route || typeof body.fileType !== "string") return NextResponse.json({ ok: false, error: "route_and_file_type_required" }, { status: 400 });
        const r = await savePackageFile(tenant, { userId, route, fileType: body.fileType, content: typeof body.content === "string" ? body.content : "", sourceSections: Array.isArray(body.sourceSections) ? body.sourceSections : undefined, evidenceLinks: Array.isArray(body.evidenceLinks) ? body.evidenceLinks : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "approve-file": {
        if (!route || typeof body.fileType !== "string") return NextResponse.json({ ok: false, error: "route_and_file_type_required" }, { status: 400 });
        const r = await approvePackageFile(tenant, { userId, route, fileType: body.fileType });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "approve-package": {
        if (!route) return NextResponse.json({ ok: false, error: "route_required" }, { status: 400 });
        const r = await approvePackageGate(tenant, { userId, route });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "update-submission": {
        if (!route || typeof body.status !== "string") return NextResponse.json({ ok: false, error: "route_and_status_required" }, { status: 400 });
        const r = await updateSubmissionRecord(tenant, { userId, route, status: body.status, evidence: typeof body.evidence === "string" ? body.evidence : "" });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-grant-decision": {
        if (!route || typeof body.authority !== "string" || typeof body.decision !== "string") return NextResponse.json({ ok: false, error: "route_authority_decision_required" }, { status: 400 });
        const r = await saveGrantDecision(tenant, { userId, route, authority: body.authority, decision: body.decision, decisionDate: typeof body.decisionDate === "string" ? body.decisionDate : undefined, amount: typeof body.amount === "number" ? body.amount : undefined, applicationNumber: typeof body.applicationNumber === "string" ? body.applicationNumber : undefined, conditions: Array.isArray(body.conditions) ? body.conditions : undefined, fileReference: typeof body.fileReference === "string" ? body.fileReference : undefined, verifiedByUser: typeof body.verifiedByUser === "boolean" ? body.verifiedByUser : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "mark-outdated": {
        const r = await markPackagesOutdated(tenant, { userId, reason: typeof body.reason === "string" ? body.reason : "上游變更", sourceTable: typeof body.sourceTable === "string" ? body.sourceTable : "research_design" });
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "application package 操作失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
