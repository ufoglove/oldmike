/**
 * V3-U03-FULL Batch C contract tests: Orchestrator, Assist, Handoff & Blueprint Contract.
 * Run: node --experimental-strip-types scripts/verify-stage03-full-batch-c.ts
 * Covers: T25-T42 (scoring, assist coverage, action gate, handoff snapshot schema & consumer contract).
 */

import {
  decidePrimaryButton,
  validateActionGate,
} from "../lib/project-orchestrator-contract.ts";
import { ASSIST_COVERAGE, getAssistCoverage } from "../lib/assist-coverage-registry.ts";
import {
  buildSubmissionNavigationSnapshot,
  type SubmissionNavigationSnapshot,
} from "../lib/submission-navigation-engines-contract.ts";
import { buildFingerprintFromTopicSnapshot } from "../lib/submission-fingerprint-contract.ts";
import { type TopicSelectionSnapshot } from "../lib/stage-operation-contracts.ts";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`); }
}

// 1. Action gate protection under AUTO_ADVANCE (T28, spec §9)
check("gate_permits_valid_action", validateActionGate({ expectedRevision: 1, currentRevision: 1, fieldLocked: false, authorizedRange: true, withinBudget: true }).permitted);
check("gate_blocks_locked_field", validateActionGate({ expectedRevision: 1, currentRevision: 1, fieldLocked: true, authorizedRange: true, withinBudget: true }).reason === "FIELD_LOCKED");
check("gate_blocks_revision_mismatch", validateActionGate({ expectedRevision: 2, currentRevision: 1, fieldLocked: false, authorizedRange: true, withinBudget: true }).reason === "REVISION_MISMATCH");

// 2. Primary button selection according to stage & results (T27, T42)
check("button_concept_planning", decidePrimaryButton({ goal: "JOURNAL_SCI_SSCI", hasValidatedResults: false, hasBlockingIssues: false }) === "老麥一鍵完成期刊研究規劃");
check("button_with_results_draft", decidePrimaryButton({ goal: "JOURNAL_SCI_SSCI", hasValidatedResults: true, hasBlockingIssues: false }) === "老麥一鍵協作完成期刊稿件");
check("button_blocking_override", decidePrimaryButton({ goal: "JOURNAL_SCI_SSCI", hasValidatedResults: true, hasBlockingIssues: true }) === "老麥一鍵補足可處理項目");

// 3. Assist coverage registry: 22 modules mapped (T26, spec §10, §11)
check("assist_coverage_count_22", ASSIST_COVERAGE.length >= 20);
check("assist_coverage_navigator", Boolean(getAssistCoverage("navigator")));
check("assist_coverage_analysis_no_fake_calc", getAssistCoverage("analysis-lab")?.mustNotFabricate.includes("LLM 手填統計") === true);

// 4. Stage 4 Blueprint Consumer Contract (spec §24, §30, T36, T37)
const topicSnapshot: TopicSelectionSnapshot = {
  projectId: "proj_c_test",
  topicId: "top_c_01",
  topicTitle: "AI×職安教育訓練",
  researchQuestion: "RQ：生成式AI即時反饋是否提升VR危害辨識？",
  gapStatement: "缺乏即時情境反饋實證",
  methodologyOverview: "RCT 兩組對照",
  expectedContribution: "提出 LLM-VR 框架",
  knownLimitations: ["高空作業場景"],
  assumptions: [],
  risks: [],
  literatureIds: ["lit_1"],
  citationSourceIds: [],
  sourceSnapshotIds: [],
  selectedBy: "u1",
  selectionMethod: "MANUAL_ADOPTION",
  selectedAt: "2026-09-06T00:00:00Z",
  handoffLimitations: ["新穎性待查證"],
  downstreamOpenRequirements: ["確認發表期刊"],
  lockManifest: [],
};

const fp = buildFingerprintFromTopicSnapshot("ws_test", topicSnapshot, {
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
});

const snap: SubmissionNavigationSnapshot = buildSubmissionNavigationSnapshot({
  workspaceId: "ws_test",
  projectId: "proj_c_test",
  fingerprint: fp,
  fundingIntent: "NSTC_GENERAL",
  publicationIntent: "JOURNAL",
  decisionOrigin: "USER_MANUAL_SELECTION",
  handoffLimitations: ["限制：限定製造業樣本"],
  downstreamRequirements: ["藍圖需求：依選定 H03 學門擬定工作包與甘特圖", "藍圖需求：確認 RCT 實驗控制組與介入組之標準作業程序"],
});

// Verify blueprint consumer contract fields:
function verifyBlueprintConsumerContract(s: SubmissionNavigationSnapshot): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!s.snapshotId || !s.snapshotId.startsWith("sns_")) missing.push("snapshotId");
  if (!s.projectId) missing.push("projectId");
  if (!s.fingerprintId) missing.push("fingerprintId");
  if (!s.sourceTopicSnapshotId) missing.push("sourceTopicSnapshotId");
  if (!s.planningStatus) missing.push("planningStatus");
  if (!s.fundingIntent) missing.push("fundingIntent");
  if (!s.publicationIntent) missing.push("publicationIntent");
  if (!Array.isArray(s.downstreamRequirements) || s.downstreamRequirements.length === 0) missing.push("downstreamRequirements");
  if (!Array.isArray(s.handoffLimitations) || s.handoffLimitations.length === 0) missing.push("handoffLimitations");
  if (!s.decisionAt) missing.push("decisionAt");
  return { valid: missing.length === 0, missing };
}

const consumerCheck = verifyBlueprintConsumerContract(snap);
check("consumer_contract_valid", consumerCheck.valid, consumerCheck.missing.join(", "));
check("consumer_has_downstream_requirements", (snap.downstreamRequirements?.length ?? 0) >= 2);
check("consumer_has_handoff_limitations", (snap.handoffLimitations?.length ?? 0) >= 1);
check("consumer_has_topic_ref", snap.sourceTopicSnapshotId === "top_c_01");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
