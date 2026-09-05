import "server-only";

import { sha256CanonicalPortable as sha256Canonical } from "./canonical-sha256.ts";
import type { RadarOpportunity, RadarScanResult } from "./research-opportunity-radar-contract.ts";
import type { OneClickInspirationRequest } from "./one-click-inspiration-contract.ts";
import type { OneClickInspirationServiceResult as ServiceResult } from "./one-click-inspiration-service.ts";
import type { TopicValidationResult } from "./research-topic-validation-contract.ts";

// Best-effort persistence of the Research Provenance chain
// (RadarOpportunity -> InspirationRun -> ResearchIdea -> TopicEvaluation).
// Writes never block the caller; failures are swallowed so evidence capture
// cannot break the main feature flow.

type Db = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

function hash(value: unknown) {
  return sha256Canonical(value);
}

export async function saveRadarScan(db: Db, workspaceId: string, userId: string, result: RadarScanResult): Promise<void> {
  const rows = result.globalOpportunities.map((opportunity) => {
    const payload = {
      scanId: result.scanId,
      opportunityId: opportunity.opportunityId,
      title: opportunity.title,
      trend: opportunity.trend,
      maturity: opportunity.maturity,
      opportunityScore: opportunity.opportunityScore,
      grade: opportunity.grade,
      summary: opportunity.summary,
      signals: opportunity.signals,
      gapSignals: opportunity.gapSignals,
      evidence: opportunity.evidence,
      generatedAt: result.generatedAt,
    };
    return {
      id: `radar_${hash(payload).slice(0, 32)}`,
      workspaceId,
      createdBy: userId,
      scanId: result.scanId,
      opportunityId: opportunity.opportunityId,
      title: opportunity.title,
      trend: opportunity.trend,
      maturity: opportunity.maturity,
      opportunityScore: opportunity.opportunityScore,
      grade: opportunity.grade,
      summary: opportunity.summary,
      signals: JSON.stringify(opportunity.signals),
      gapSignals: JSON.stringify(opportunity.gapSignals),
      evidence: JSON.stringify(opportunity.evidence),
      evidenceStatus: opportunity.evidenceStatus,
      generatedAt: result.generatedAt,
      contentHash: hash(payload),
    };
  });
  if (rows.length === 0) return;
  for (const row of rows) {
    await db.query(
      `INSERT INTO radar_opportunities (id,workspace_id,created_by_user_id,scan_id,opportunity_id,title,trend,maturity,opportunity_score,grade,summary,signals,gap_signals,evidence,evidence_status,generated_at,content_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17)
       ON CONFLICT (workspace_id, scan_id, opportunity_id) DO NOTHING`,
      [row.id, row.workspaceId, row.createdBy, row.scanId, row.opportunityId, row.title, row.trend, row.maturity, row.opportunityScore, row.grade, row.summary, row.signals, row.gapSignals, row.evidence, row.evidenceStatus, row.generatedAt, row.contentHash],
    );
  }
}

export async function saveInspirationRun(db: Db, workspaceId: string, userId: string, input: OneClickInspirationRequest, result: ServiceResult): Promise<void> {
  const runPayload = { focus: input.researchFocus, goal: input.researchGoal, radarOpportunityId: (input.radarContext as { opportunityId?: string } | null | undefined)?.opportunityId, inputHash: result.inputHash, generatedAt: new Date().toISOString() };
  const runId = `insp_${hash(runPayload).slice(0, 32)}`;
  await db.query(
    `INSERT INTO inspiration_runs (id,workspace_id,created_by_user_id,radar_opportunity_id,focus,goal,input_hash,evidence_status,generated_at,content_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
    [runId, workspaceId, userId, (input.radarContext as { opportunityId?: string } | null | undefined)?.opportunityId ?? null, input.researchFocus, input.researchGoal, result.inputHash, result.evidenceStatus, new Date().toISOString(), hash(runPayload)],
  );
  for (let index = 0; index < result.candidates.length; index += 1) {
    const candidate = result.candidates[index];
    const ideaPayload = { runId, index, ideaType: candidate.ideaType, titleZh: candidate.titleZh, titleEn: candidate.titleEn, researchQuestion: candidate.researchQuestion, score: candidate.score };
    await db.query(
      `INSERT INTO research_ideas (id,workspace_id,created_by_user_id,inspiration_run_id,idea_index,idea_type,title_zh,title_en,research_question,fields,score,evidence_status,content_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [`idea_${hash(ideaPayload).slice(0, 32)}`, workspaceId, userId, runId, index + 1, candidate.ideaType, candidate.titleZh, candidate.titleEn, candidate.researchQuestion, JSON.stringify(candidate), candidate.score, candidate.evidenceStatus, hash(ideaPayload)],
    );
  }
}

export async function saveTopicEvaluation(db: Db, workspaceId: string, userId: string, result: TopicValidationResult, provenance: { ideaId?: string } = {}): Promise<void> {
  const payload = {
    validationId: result.validationId,
    ideaId: provenance.ideaId,
    topicTitle: result.decomposition.find((d) => d.label === "Problem")?.value || "",
    version: result.version,
    score: result.score.total,
    generatedAt: new Date().toISOString(),
  };
  await db.query(
    `INSERT INTO topic_evaluations (id,workspace_id,created_by_user_id,idea_id,topic_title,version,parameters,decomposition,gap_matrix,novelty,score,reviewer2,recommended_next_step,evidence_status,generated_at,content_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16) ON CONFLICT (id) DO NOTHING`,
    [`eval_${hash(payload).slice(0, 32)}`, workspaceId, userId, provenance.ideaId ?? null, result.decomposition.find((d) => d.label === "Problem")?.value || result.decomposition[0]?.value || "", result.version,
      JSON.stringify(result.parameters), JSON.stringify(result.decomposition), JSON.stringify(result.gapMatrix), JSON.stringify(result.novelty), JSON.stringify(result.score), JSON.stringify(result.reviewer2),
      result.recommendedNextStep, result.evidenceStatus, new Date().toISOString(), hash(payload)],
  );
}
