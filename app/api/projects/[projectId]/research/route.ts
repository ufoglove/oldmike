import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { assertClaimPublishable, attachClaimEvidence, createHumanGate, createResearchVersion, exportResearchArchive, getResearchOverview, lockResearchVersion, registerDataset, registerEvidence, ResearchContractViolation, ResearchStorageUnavailable, resolveResearchTenant, runAnalysis, supportClaim, transitionResearch, verifyEvidence } from "@/lib/research-repository";
import { sha256Canonical } from "@/lib/research-contract";
import { ANALYSIS_ENGINE, ANALYSIS_ENGINE_VERSION } from "@/lib/research-analysis";

function failClosed(code = "research_unavailable", status = 503) { return NextResponse.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store" } }); }

function isResearchSchemaUnavailable(error: unknown) {
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? (error as { code: string }).code
    : "";
  return code === "42P01" || code === "42703" || code === "3D000";
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser(); if (!auth.ok) return auth.response;
  try {
    const { projectId } = await context.params;
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return NextResponse.json({ ok: false, code: "research_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, research: await getResearchOverview(tenant) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isResearchSchemaUnavailable(error)) return failClosed("research_schema_unavailable");
    if (error instanceof ResearchStorageUnavailable) return failClosed();
    return failClosed("research_not_found", 404);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const auth = await requireAuthenticatedUser(); if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.operation !== "string") return failClosed("invalid_research_operation", 400);
  try {
    const { projectId } = await context.params;
    const tenant = await resolveResearchTenant(auth.session.user.id, projectId);
    if (!tenant) return NextResponse.json({ ok: false, code: "research_not_found" }, { status: 404 });
    const operation = body.operation;
    if (operation === "workflow.transition") return NextResponse.json({ ok: true, event: await transitionResearch(tenant, { fromStage: String(body.fromStage), toStage: String(body.toStage), stageDetail: typeof body.stageDetail === "string" ? body.stageDetail : undefined, artifactRefs: Array.isArray(body.artifactRefs) ? body.artifactRefs : [], humanGateId: typeof body.humanGateId === "string" ? body.humanGateId : undefined }) });
    if (operation === "design.create") return NextResponse.json({ ok: true, version: await createResearchVersion(tenant, { kind: "study", logicalId: String(body.logicalId), payload: (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>, contentHash: String(body.contentHash), userId: auth.session.user.id, expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined, stageDetail: typeof body.stageDetail === "string" ? body.stageDetail : "S1_DESIGN_DRAFT" }) }, { status: 201 });
    if (operation === "analysis-plan.create") return NextResponse.json({ ok: true, version: await createResearchVersion(tenant, { kind: "analysisPlan", logicalId: String(body.logicalId), payload: (body.parameters && typeof body.parameters === "object" ? body.parameters : {}) as Record<string, unknown>, contentHash: String(body.contentHash), userId: auth.session.user.id, expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined, method: String(body.method), engine: ANALYSIS_ENGINE, engineVersion: ANALYSIS_ENGINE_VERSION }) }, { status: 201 });
    if (operation === "dataset.register") return NextResponse.json({ ok: true, dataset: await registerDataset(tenant, { artifactId: String(body.artifactId), artifactPath: String(body.artifactPath), sha256: String(body.sha256), mediaType: String(body.mediaType), byteSize: Number(body.byteSize), schemaSummary: body.schemaSummary ?? {} }) }, { status: 201 });
    if (operation === "analysis.run") {
      if (typeof body.idempotencyKey !== "string" || typeof body.datasetId !== "string" || typeof body.analysisPlanId !== "string") throw new ResearchContractViolation("analysis_binding_required");
      const result = await runAnalysis(tenant, { datasetId: body.datasetId, analysisPlanId: body.analysisPlanId, idempotencyKey: body.idempotencyKey, datasetSha256: String(body.datasetSha256), analysisPlanHash: String(body.analysisPlanHash), method: body.method as never, parameters: body.parameters as never, values: body.values as never, x: body.x as never, y: body.y as never, groupA: body.groupA as never, groupB: body.groupB as never });
      return NextResponse.json({ ok: true, result: { method: result.method, parameters: result.parameters, payload: result.payload, resultHash: result.resultHash, inputHash: result.inputHash, engine: result.engine, engineVersion: result.engineVersion } });
    }
    if (operation === "version.lock") return NextResponse.json({ ok: true, version: await lockResearchVersion(tenant, { kind: body.kind as never, id: String(body.id), contentHash: String(body.contentHash) }) });
    if (operation === "evidence.register") return NextResponse.json({ ok: true, evidence: await registerEvidence(tenant, { sourceIdentity: String(body.sourceIdentity), sourceVersion: String(body.sourceVersion), sourceHash: String(body.sourceHash), verificationMethod: String(body.verificationMethod), retrievedAt: String(body.retrievedAt), excerpt: String(body.excerpt), locator: String(body.locator), verificationActor: auth.session.user.id, identityStatus: "UNVERIFIED" }) }, { status: 201 });
    if (operation === "evidence.verify") return NextResponse.json({ ok: true, evidence: await verifyEvidence(tenant, { evidenceSourceId: String(body.evidenceSourceId), humanGateId: String(body.humanGateId) }) }, { status: 201 });
    if (operation === "claim.create") return NextResponse.json({ ok: true, version: await createResearchVersion(tenant, { kind: "claim", logicalId: String(body.logicalId), payload: { claimText: String(body.claimText) }, contentHash: String(body.contentHash), userId: auth.session.user.id, claimStatus: body.claimStatus === "SUPPORTED" ? "AI_PROPOSED" : "AI_PROPOSED", sourceIdentityStatus: "UNVERIFIED" }) }, { status: 201 });
    if (operation === "claim.attach-evidence") return NextResponse.json({ ok: true, relation: await attachClaimEvidence(tenant, { claimVersionId: String(body.claimVersionId), evidenceSourceId: String(body.evidenceSourceId), supportStatus: "AI_PROPOSED" }) });
    if (operation === "claim.support") return NextResponse.json({ ok: true, claim: await supportClaim(tenant, { claimVersionId: String(body.claimVersionId), evidenceSourceId: String(body.evidenceSourceId), humanGateId: String(body.humanGateId) }) }, { status: 201 });
    if (operation === "claim.publish") return NextResponse.json({ ok: true, publication: await assertClaimPublishable(tenant, String(body.claimVersionId)) });
    if (operation === "human-gate.create") return NextResponse.json({ ok: true, gate: await createHumanGate(tenant, { gateType: body.gateType as never, artifactType: String(body.artifactType), artifactVersionId: String(body.artifactVersionId), approvedContentHash: String(body.approvedContentHash), decision: body.decision as never, rationale: typeof body.rationale === "string" ? body.rationale : undefined }) }, { status: 201 });
    if (operation === "document.create") return NextResponse.json({ ok: true, version: await createResearchVersion(tenant, { kind: "document", logicalId: String(body.logicalId), payload: { title: String(body.title), body: String(body.body) }, contentHash: String(body.contentHash), userId: auth.session.user.id, expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined, documentType: String(body.documentType), stageDetail: typeof body.stageDetail === "string" ? body.stageDetail : "S7_DOCUMENT_DRAFT" }) }, { status: 201 });
    if (operation === "archive.export") { const archive = await exportResearchArchive(tenant); return NextResponse.json({ ok: true, archive, archiveHash: sha256Canonical(archive) }); }
    return failClosed("unsupported_research_operation", 400);
  } catch (error) {
    if (isResearchSchemaUnavailable(error)) return failClosed("research_schema_unavailable");
    if (error instanceof ResearchContractViolation) return failClosed(error.code, 409);
    if (error instanceof ResearchStorageUnavailable) return failClosed();
    return failClosed();
  }
}
