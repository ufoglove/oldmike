import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import {
  getInstrumentStudio,
  generateMeasurementMap,
  addInstrumentCandidate,
  compareCandidates,
  selectInstrument,
  saveInstrumentPermission,
  saveInstrumentTranslation,
  saveInstrumentScoring,
  saveTestBlueprint,
  saveSkillAssessment,
  saveQualitativeInstrument,
  saveDigitalEvent,
  saveSensorSpecification,
  saveAnnotationGuideline,
  saveInterventionMaterial,
  saveFidelityPlan,
  saveScheduleRow,
  saveDataCaptureField,
  linkInstrumentEvidence,
  saveProtocolSection,
  generateProtocolDraft,
  runEthicsAlignment,
  runAnalysisAlignment,
  runPilotReadiness,
  approveInstrumentsGate,
  writeBlueprintV4,
  aiDraftInstrumentContent,
  markInstrumentProtocolOutdated,
} from "@/lib/research-instrument-repository";

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
    const result = await getInstrumentStudio(tenant, { userId });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "工具與 Protocol 工作室讀取失敗" }, { status: 422 });
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
  const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value)) ? value as Record<string, unknown> : {};
  const str = (value: unknown): string => typeof value === "string" ? value : "";
  const arr = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object") : [];
  try {
    switch (action) {
      case "generate-map": { const r = await generateMeasurementMap(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "add-candidate": { const r = await addInstrumentCandidate(tenant, { userId, candidate: obj(body.candidate), targetLinkId: str(body.targetLinkId) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "compare-candidates": { const r = await compareCandidates(tenant, { userId, scores: arr(body.scores).map((s) => ({ linkId: str(s.linkId), scores: obj(s.scores) as Record<string, number> })) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "select-instrument": { const r = await selectInstrument(tenant, { userId, linkId: str(body.linkId) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-permission": { const r = await saveInstrumentPermission(tenant, { userId, linkId: str(body.linkId), permission: obj(body.permission) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-translation": { const r = await saveInstrumentTranslation(tenant, { userId, linkId: str(body.linkId), translation: obj(body.translation) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-scoring": { const r = await saveInstrumentScoring(tenant, { userId, linkId: str(body.linkId), scoring: obj(body.scoring) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-test-blueprint": { const r = await saveTestBlueprint(tenant, { userId, blueprint: obj(body.blueprint), items: arr(body.items) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-skill": { const r = await saveSkillAssessment(tenant, { userId, skill: obj(body.skill) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-qualitative": { const r = await saveQualitativeInstrument(tenant, { userId, instrument: obj(body.instrument) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-event": { const r = await saveDigitalEvent(tenant, { userId, event: obj(body.event) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-sensor": { const r = await saveSensorSpecification(tenant, { userId, sensor: obj(body.sensor) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-annotation": { const r = await saveAnnotationGuideline(tenant, { userId, guideline: obj(body.guideline) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-intervention": { const r = await saveInterventionMaterial(tenant, { userId, material: obj(body.material) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-fidelity": { const r = await saveFidelityPlan(tenant, { userId, materialId: str(body.materialId), plan: obj(body.plan) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-schedule": { const r = await saveScheduleRow(tenant, { userId, row: obj(body.row) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-data-field": { const r = await saveDataCaptureField(tenant, { userId, field: obj(body.field) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "link-evidence": { const r = await linkInstrumentEvidence(tenant, { userId, linkId: str(body.linkId), literatureId: str(body.literatureId) || undefined, citationSourceId: str(body.citationSourceId) || undefined, zoteroItemKey: str(body.zoteroItemKey) || undefined, role: str(body.role) || undefined, supportedClaim: str(body.supportedClaim) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "save-protocol-section": { const r = await saveProtocolSection(tenant, { userId, sectionId: str(body.sectionId), content: typeof body.content === "string" ? body.content : obj(body.content), reason: str(body.reason) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "generate-protocol": { const r = await generateProtocolDraft(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "run-ethics-alignment": { const r = await runEthicsAlignment(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "run-analysis-alignment": { const r = await runAnalysisAlignment(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "run-pilot-readiness": { const r = await runPilotReadiness(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "approve-gate": { const r = await approveInstrumentsGate(tenant, { userId }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "write-blueprint-v4": { const r = await writeBlueprintV4(tenant, { userId, protocolVersionId: str(body.protocolVersionId) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "ai-draft": { const r = await aiDraftInstrumentContent(tenant, { userId, kind: body.kind === "ITEM_DRAFT" || body.kind === "PROTOCOL_SECTION" ? body.kind : "CANDIDATE_SEARCH", payload: obj(body.payload) }); return NextResponse.json(r, { status: r.ok ? 200 : 422 }); }
      case "mark-outdated": { const r = await markInstrumentProtocolOutdated(tenant, { userId, reason: str(body.reason) || "上游變更", sourceTable: str(body.sourceTable) || "research_design", sourceId: str(body.sourceId) || undefined }); return NextResponse.json(r, { status: r.ok ? 200 : 400 }); }
      default: return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "工具與 Protocol 工作室操作失敗。";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
