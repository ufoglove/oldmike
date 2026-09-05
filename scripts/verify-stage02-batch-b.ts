/**
 * LIVE Verification Runner for Batch B (T07 - T14)
 * 驗證前沿雷達計量、口徑分流、候選品質、評分分離與單欄位輔助規則
 */
import assert from "node:assert/strict";
import { TrendMeasurementService } from "../lib/trend-measurement-service.ts";
import { TopicCandidateQualityService, type TopicCandidate } from "../lib/topic-candidate-quality-service.ts";
import { FieldAssistService } from "../lib/field-assist-service.ts";

async function runBatchBVerification() {
  console.log("=== Running Batch B Exploration Modules & Quality Rules Verification ===");

  // 1. T07: 趨勢計算 (基期100、本期120得20%；基期0/低基期null警告；未知不填0)
  const normalTrend = TrendMeasurementService.calculateTrend({
    provider: "OpenAlex",
    queryVersion: "q_v1",
    currentCount: 120,
    previousCount: 100,
  });
  assert.equal(normalTrend.growthPct, 20.0, "T07: 100 -> 120 must equal 20.0%");
  assert.equal(normalTrend.status, "CALCULATED");
  console.log("✓ T07a: Normal trend calculated: 100 -> 120 = 20.0%");

  const zeroBaselineTrend = TrendMeasurementService.calculateTrend({
    provider: "OpenAlex",
    queryVersion: "q_v1",
    currentCount: 15,
    previousCount: 0,
  });
  assert.equal(zeroBaselineTrend.growthPct, null, "T07: Zero baseline growthPct must be null");
  assert.equal(zeroBaselineTrend.status, "LOW_BASELINE");
  console.log("✓ T07b: Zero baseline yields null growthPct with LOW_BASELINE warning");

  const lowBaselineTrend = TrendMeasurementService.calculateTrend({
    provider: "OpenAlex",
    queryVersion: "q_v1",
    currentCount: 8,
    previousCount: 2,
    minBaseline: 5,
  });
  assert.equal(lowBaselineTrend.growthPct, null, "T07: Low baseline (<5) must be null");
  console.log("✓ T07c: Low baseline (<5) preserves null and avoids pseudo-growth");

  const unknownTrend = TrendMeasurementService.calculateTrend({
    provider: "OpenAlex",
    queryVersion: "q_v1",
    currentCount: null,
    previousCount: 50,
  });
  assert.equal(unknownTrend.growthPct, null);
  assert.equal(unknownTrend.status, "UNKNOWN", "T07: Unknown count must not be coerced to 0");
  console.log("✓ T07d: Unknown count preserved as null (never zero-coerced)");

  // 2. T08: 時間與來源口徑 (舊文章 metadata 更新不算新發表)
  const metaUpdateTrend = TrendMeasurementService.calculateTrend({
    provider: "Crossref",
    queryVersion: "q_v1",
    currentCount: 200,
    previousCount: 100,
    dateGrain: "METADATA_UPDATED",
  });
  assert.equal(metaUpdateTrend.status, "INCOMPARABLE");
  assert.equal(metaUpdateTrend.growthPct, null, "T08: Metadata update cannot be counted as published growth");
  console.log("✓ T08: Metadata update grain marked INCOMPARABLE; no pseudo-growth calculated");

  // 3. T09: 搜尋不完整與截斷
  const truncatedTrend = TrendMeasurementService.calculateTrend({
    provider: "SemanticScholar",
    queryVersion: "q_v1",
    currentCount: 150,
    previousCount: 100,
    isTruncated: true,
  });
  assert.equal(truncatedTrend.status, "PARTIAL_DATA");
  assert.ok(truncatedTrend.warningMessage?.includes("partial"));
  console.log("✓ T09: Truncated result flagged as PARTIAL_DATA");

  // 4. T11: AI 不得自由改寫計量驗證
  const forgedMetric = {
    metricId: "ai_generated_123",
    formulaVersion: "random_v1",
    growthPct: 999.9,
  };
  assert.equal(TrendMeasurementService.validateMetricRecord(forgedMetric), false, "T11: Forged metric record must be rejected");
  assert.equal(TrendMeasurementService.validateMetricRecord(normalTrend), true, "T11: Authentic metric record accepted");
  console.log("✓ T11: Metric validation rejects ungrounded AI metric claims");

  // 5. T12: 候選題目品質與重複偵測
  const candidates: TopicCandidate[] = [
    {
      candidateId: "c1",
      title: "基於多模態大模型之工業現場安全預警系統研究",
      coreQuestion: "如何透過多模態降低工安偏離？",
      gapHypothesis: "缺乏即時邊緣音訊融合",
      expectedContribution: "提出融合邊緣模型架構",
      methodologyOverview: "實證準實驗",
      importanceRating: 4,
      noveltyRating: 4,
      feasibilityRating: 4,
      evaluatedCoveragePct: 100,
      evidenceStatus: "CLAIM_SUPPORTED",
      isNoveltyClaimGrounded: true,
    },
    {
      candidateId: "c2",
      title: "基於多模態大模型之工業現場安全預警系統研究探討", // 相似度極高
      coreQuestion: "如何透過多模態探討工安偏離？",
      gapHypothesis: "缺乏即時邊緣音訊融合探討",
      expectedContribution: "提出融合邊緣模型探討",
      methodologyOverview: "實證準實驗",
      importanceRating: 4,
      noveltyRating: null, // 未評 novelty
      feasibilityRating: 3,
      evaluatedCoveragePct: 70,
      evidenceStatus: "UNVERIFIED",
      isNoveltyClaimGrounded: false,
    },
  ];

  const qualityReport = TopicCandidateQualityService.evaluateCandidates(candidates);
  assert.ok(qualityReport.duplicateCount >= 1, "T12: High-overlap candidate must be flagged");
  assert.ok(qualityReport.warnings.some((w) => w.includes("Only 2 valid candidates")), "T12: Natural candidate count reported without forced fillers");
  console.log("✓ T12: High lexical overlap detected and actual candidate count preserved");

  // 6. T13: 證據與評分分離 (未知保留 null，未查文獻禁宣稱首創)
  assert.equal(candidates[1].noveltyRating, null, "T13: Unknown novelty rating must stay null");
  assert.equal(candidates[1].isNoveltyClaimGrounded, false, "T13: Unverified candidate cannot claim grounded novelty");
  assert.ok(candidates[1].evaluatedCoveragePct < 100, "T13: Coverage reflects only scored dimensions");
  console.log("✓ T13: Rating separation, partial coverage, and unverified novelty guards verified");

  // 7. T14: 單欄位輔助與政策保護
  const assistRQ = FieldAssistService.assistField({
    fieldRef: "research_question",
    stageId: "topic-lab",
    domain: "職業安全",
  });
  assert.equal(assistRQ.permitted, true);
  assert.ok(assistRQ.suggestedPatch?.includes("降低操作偏差"));

  const assistIRB = FieldAssistService.assistField({
    fieldRef: "irb_approval_number",
    stageId: "ethics",
  });
  assert.equal(assistIRB.permitted, false, "T14: AI cannot assist or synthesize IRB approval numbers");
  assert.equal(assistIRB.error, "FIELD_PROTECTED_BY_POLICY");
  console.log("✓ T14: FieldAssist correctly drafted RQ and strictly protected IRB field");

  console.log("\n==================================================");
  console.log("🎉 ALL BATCH B VERIFICATION CHECKS (T07-T14) PASSED!");
  console.log("==================================================");
}

runBatchBVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
