import "server-only";

import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { ResearchStorageUnavailable, resolveResearchTenant } from "@/lib/research-repository";
import * as g from "@/lib/research-data-governance-repository";

export const runtime = "nodejs";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
const arr = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.map((i) => obj(i)) : [];
const str = (v: unknown): string => typeof v === "string" ? v : "";

export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const authenticated = await requireAuthenticatedUser();
  if (!authenticated.ok) return authenticated.response;
  const { projectId } = await context.params;
  let tenant;
  try { tenant = await resolveResearchTenant(authenticated.session.user.id, projectId); } catch (error) { if (error instanceof ResearchStorageUnavailable) return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 }); throw error; }
  if (!tenant) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  try { return NextResponse.json(await g.getGovernanceCenter(tenant, { userId: authenticated.session.user.id }), { status: 200 }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "資料治理中心讀取失敗。" }, { status: 422 }); }
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
  const uid = authenticated.session.user.id;
  try {
    let r: { ok: boolean; error?: string; failed?: unknown; [k: string]: unknown };
    switch (action) {
      case "lists": r = await g.getGovernanceLists(tenant, { userId: uid }); break;
      case "run-raw-audit": r = await g.runRawDataAudit(tenant, { userId: uid }); break;
      case "save-catalog": r = await g.saveCatalogItem(tenant, { userId: uid, item: obj(body.item) }); break;
      case "save-variable": r = await g.saveCanonicalVariable(tenant, { userId: uid, variable: obj(body.variable) }); break;
      case "approve-variable": r = await g.approveCanonicalVariable(tenant, { userId: uid, canonicalName: str(body.canonicalName) }); break;
      case "snapshot-dictionary": r = await g.snapshotDataDictionary(tenant, { userId: uid, reason: str(body.reason) || undefined }); break;
      case "save-mapping": r = await g.saveMapping(tenant, { userId: uid, mapping: obj(body.mapping) }); break;
      case "approve-mapping": r = await g.approveMapping(tenant, { userId: uid, sourceAssetId: str(body.sourceAssetId), sourceFieldName: str(body.sourceFieldName), approvedBy: str(body.approvedBy) }); break;
      case "save-deid-plan": r = await g.saveDeidPlan(tenant, { userId: uid, plan: obj(body.plan) }); break;
      case "run-deidentification": r = await g.runDeidentification(tenant, { userId: uid, run: obj(body.run) }); break;
      case "save-cleaning-rule": r = await g.saveCleaningRule(tenant, { userId: uid, rule: obj(body.rule) }); break;
      case "run-pipeline": r = await g.runPipeline(tenant, { userId: uid, pipelineKey: str(body.pipelineKey), params: obj(body.params) }); break;
      case "quarantine": r = await g.createQuarantineRecord(tenant, { userId: uid, record: obj(body.record) }); break;
      case "adjudicate": r = await g.createAdjudication(tenant, { userId: uid, adjudication: obj(body.adjudication) }); break;
      case "resolve-duplicate": r = await g.resolveDuplicate(tenant, { userId: uid, resolution: obj(body.resolution) }); break;
      case "classify-missing": r = await g.classifyMissing(tenant, { userId: uid, items: arr(body.items) }); break;
      case "flag-outlier": r = await g.flagOutlier(tenant, { userId: uid, flag: obj(body.flag) }); break;
      case "save-inclusion": r = await g.saveInclusionDecision(tenant, { userId: uid, decision: obj(body.decision) }); break;
      case "run-scoring": r = await g.runScaleScoring(tenant, { userId: uid, run: obj(body.run) }); break;
      case "save-derived": r = await g.saveDerivedVariable(tenant, { userId: uid, variable: obj(body.variable) }); break;
      case "save-longitudinal": r = await g.saveLongitudinalLink(tenant, { userId: uid, link: obj(body.link) }); break;
      case "save-harmonization": r = await g.saveHarmonizationRule(tenant, { userId: uid, rule: obj(body.rule) }); break;
      case "run-sensor": r = await g.runSensorProcessing(tenant, { userId: uid, run: obj(body.run) }); break;
      case "run-eventlog": r = await g.runEventLogProcessing(tenant, { userId: uid, run: obj(body.run) }); break;
      case "save-transcript": r = await g.saveTranscriptRecord(tenant, { userId: uid, record: obj(body.record) }); break;
      case "save-ai-dataset": r = await g.saveAiDataset(tenant, { userId: uid, record: obj(body.record) }); break;
      case "check-ai-leakage": r = await g.checkAiLeakage(tenant, { userId: uid, datasetKey: str(body.datasetKey) }); break;
      case "save-cohort": r = await g.saveCohort(tenant, { userId: uid, cohort: obj(body.cohort) }); break;
      case "build-clean": r = await g.buildCleanDataset(tenant, { userId: uid, params: obj(body.params) }); break;
      case "validate-clean": r = await g.validateCleanDataset(tenant, { userId: uid, datasetId: str(body.datasetId), reviewer: str(body.reviewer) || undefined }); break;
      case "build-analysis-dataset": r = await g.buildAnalysisDataset(tenant, { userId: uid, dataset: obj(body.dataset) }); break;
      case "freeze-analysis": r = await g.freezeAnalysisDataset(tenant, { userId: uid, datasetId: str(body.datasetId) }); break;
      case "lock-analysis": r = await g.lockAnalysisDataset(tenant, { userId: uid, datasetId: str(body.datasetId), checks: arr(body.checks) }); break;
      case "run-quality": r = await g.runQualityAssessment(tenant, { userId: uid }); break;
      case "generate-report": r = await g.generateDataPreparationReport(tenant, { userId: uid }); break;
      case "handoff": r = await g.createHandoffPackage(tenant, { userId: uid }); break;
      case "save-review": r = await g.saveValidationReview(tenant, { userId: uid, review: obj(body.review) }); break;
      case "snapshot": r = await g.createResearchSnapshot(tenant, { userId: uid }); break;
      case "blueprint-v6": r = await g.writeBlueprintV6(tenant, { userId: uid }); break;
      case "approve-access-policy": r = await g.approveDataAccessPolicy(tenant, { userId: uid, zone: str(body.zone) }); break;
      case "approve-cleaning-rule": r = await g.approveCleaningRule(tenant, { userId: uid, ruleId: str(body.ruleId) }); break;
      case "approve-access-policy": r = await g.approveDataAccessPolicy(tenant, { userId: uid, zone: str(body.zone) }); break;
      case "approve-cleaning-rule": r = await g.approveCleaningRule(tenant, { userId: uid, ruleId: str(body.ruleId) }); break;
      case "approve-access-policy": r = await g.approveDataAccessPolicy(tenant, { userId: uid, zone: str(body.zone) }); break;
      case "approve-cleaning-rule": r = await g.approveCleaningRule(tenant, { userId: uid, ruleId: str(body.ruleId) }); break;
      case "approve-access-policy": r = await g.approveDataAccessPolicy(tenant, { userId: uid, zone: str(body.zone) }); break;
      case "approve-cleaning-rule": r = await g.approveCleaningRule(tenant, { userId: uid, ruleId: str(body.ruleId) }); break;
      case "approve-gate": {        const allowed = ["DATA_GOVERNANCE_AND_SCHEMA_APPROVED", "CLEAN_DATASET_VALIDATED", "ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY"];
        const gateType = typeof body.gateType === "string" && allowed.includes(body.gateType) ? body.gateType as "DATA_GOVERNANCE_AND_SCHEMA_APPROVED" | "CLEAN_DATASET_VALIDATED" | "ANALYSIS_DATASET_V1_LOCKED_AND_ANALYSIS_READY" : null;
        if (!gateType) return NextResponse.json({ ok: false, error: "gate_type_invalid" }, { status: 400 });
        r = await g.approveGovernanceGate(tenant, { userId: uid, gateType }); break;
      }
      default: return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "資料治理中心操作失敗。" }, { status: 422 });
  }
}
