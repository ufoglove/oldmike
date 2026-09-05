import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import { getRouteWorkspace, createRouteWorkspace, updateRouteSection, runRouteGate, saveCourseResearchAlignment, markRouteWorkspacesOutdated } from "@/lib/research-route-repository";

export const runtime = "nodejs";

type RouteKey = "JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL";
const ROUTES: RouteKey[] = ["JOURNAL_PLANNING", "NSTC_PROPOSAL", "MOE_TPR_PROPOSAL"];

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const user = authenticated.session.user;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const routeParam = url.searchParams.get("route") as RouteKey | null;
  const routes: RouteKey[] = routeParam && ROUTES.includes(routeParam) ? [routeParam] : ROUTES;
  const results: Record<string, unknown> = {};
  for (const route of routes) {
    try { results[route] = await getRouteWorkspace(tenant, { userId: user.id, route }); }
    catch (error) { results[route] = { ok: false, error: error instanceof Error ? error.message : "route workspace 讀取失敗" }; }
  }
  return NextResponse.json({ ok: true, routes: results });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const user = authenticated.session.user;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const route = typeof body.route === "string" && ROUTES.includes(body.route as RouteKey) ? body.route as RouteKey : null;
  try {
    switch (action) {
      case "create": {
        if (!route) return NextResponse.json({ ok: false, error: "route_required" }, { status: 400 });
        const r = await createRouteWorkspace(tenant, { userId: user.id, route, role: (body.role as "PRIMARY" | "SECONDARY" | "FUTURE_OUTPUT" | "NOT_SELECTED") ?? "SECONDARY", reason: typeof body.reason === "string" ? body.reason : undefined });
        return NextResponse.json(r, { status: r.ok ? 200 : r.locked ? 422 : 400 });
      }
      case "update-section": {
        if (!route || typeof body.sectionId !== "string") return NextResponse.json({ ok: false, error: "route_and_section_required" }, { status: 400 });
        const r = await updateRouteSection(tenant, {
          userId: user.id, route, sectionId: body.sectionId,
          title: typeof body.title === "string" ? body.title : undefined,
          objective: typeof body.objective === "string" ? body.objective : undefined,
          draftContent: typeof body.draftContent === "string" ? body.draftContent : undefined,
          outline: Array.isArray(body.outline) ? body.outline : undefined,
          evidenceLinks: Array.isArray(body.evidenceLinks) ? body.evidenceLinks : undefined,
          citationSources: Array.isArray(body.citationSources) ? body.citationSources : undefined,
          zoteroItems: Array.isArray(body.zoteroItems) ? body.zoteroItems : undefined,
          userApproved: typeof body.userApproved === "boolean" ? body.userApproved : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
          provenance: body.provenance === "AI_PROPOSED" || body.provenance === "USER_REVIEWED" || body.provenance === "USER_PROVIDED" ? body.provenance : undefined,
        });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "gate": {
        if (!route) return NextResponse.json({ ok: false, error: "route_required" }, { status: 400 });
        const payload = (body.payload && typeof body.payload === "object") ? body.payload as Record<string, unknown> : {};
        const r = await runRouteGate(tenant, { userId: user.id, route, payload, lock: body.lock === true });
        return NextResponse.json(r, { status: r.ok ? 200 : 422 });
      }
      case "save-alignment": {
        if (route !== "MOE_TPR_PROPOSAL") return NextResponse.json({ ok: false, error: "alignment_only_for_moe" }, { status: 400 });
        const items = Array.isArray(body.items) ? body.items as { courseObjective?: unknown; teachingProblem?: unknown; intervention?: unknown; learningOutcome?: unknown; assessment?: unknown; researchQuestion?: unknown; id?: unknown }[] : [];
        const r = await saveCourseResearchAlignment(tenant, {
          userId: user.id,
          items: items.map((i) => ({ id: typeof i.id === "string" ? i.id : undefined, courseObjective: typeof i.courseObjective === "string" ? i.courseObjective : "", teachingProblem: typeof i.teachingProblem === "string" ? i.teachingProblem : undefined, intervention: typeof i.intervention === "string" ? i.intervention : undefined, learningOutcome: typeof i.learningOutcome === "string" ? i.learningOutcome : undefined, assessment: typeof i.assessment === "string" ? i.assessment : undefined, researchQuestion: typeof i.researchQuestion === "string" ? i.researchQuestion : undefined })),
        });
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      case "mark-outdated": {
        const r = await markRouteWorkspacesOutdated(tenant, { userId: user.id, reason: typeof body.reason === "string" ? body.reason : "上游變更", sourceTable: typeof body.sourceTable === "string" ? body.sourceTable : "research_design" });
        return NextResponse.json(r, { status: r.ok ? 200 : 400 });
      }
      default:
        return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "route workspace 操作失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
