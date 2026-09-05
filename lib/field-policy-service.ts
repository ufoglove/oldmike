/**
 * Field Policies for AI-Assisted Operations (V3-U02-R1)
 *
 * Implements section 7 & 16 of the V3.1 spec:
 * Defines which fields AI can draft/fill/polish, which require evidence,
 * and strictly forbids AI from inventing human attestations, metrics, signatures, or IRB numbers.
 */

import type { FieldPolicyRule, StageId } from "./stage-operation-contracts.ts";

export const STAGE_FIELD_POLICIES: Record<string, FieldPolicyRule> = {
  // --- Stage 02: Exploration (Radar, One-Click, Topic-Lab) ---
  "radar.exploration_scope": {
    fieldRef: "exploration_scope",
    stageId: "radar",
    label: "探索領域與焦點",
    dataNature: "USER_INPUT",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["EXPLAIN", "DRAFT_FROM_CONTEXT", "POLISH"],
    lockable: true,
  },
  "radar.growth_metric": {
    fieldRef: "growth_metric",
    stageId: "radar",
    label: "文獻成長率與訊號計量",
    dataNature: "METRIC_COMPUTED",
    aiWritable: false, // AI CANNOT modify trend count or percentage without source snapshot
    requiresUserFact: false,
    requiresEvidence: true,
    allowedAssistActions: ["EXPLAIN"],
    lockable: true,
  },
  "one_click.topic_title": {
    fieldRef: "topic_title",
    stageId: "one-click",
    label: "研究題目構想",
    dataNature: "AI_DERIVED",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["DRAFT_FROM_CONTEXT", "POLISH", "EXPLAIN"],
    lockable: true,
  },
  "one_click.inspiration_direction": {
    fieldRef: "inspiration_direction",
    stageId: "one-click",
    label: "靈感方向與核心構想",
    dataNature: "USER_INPUT",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["DRAFT_FROM_CONTEXT", "POLISH", "EXPLAIN"],
    lockable: true,
  },
  "topic_lab.research_question": {
    fieldRef: "research_question",
    stageId: "topic-lab",
    label: "主要研究問題 (RQ)",
    dataNature: "AI_DERIVED",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["DRAFT_FROM_CONTEXT", "POLISH", "EXPLAIN"],
    lockable: true,
  },
  "topic_lab.gap_statement": {
    fieldRef: "gap_statement",
    stageId: "topic-lab",
    label: "研究缺口 (Research Gap)",
    dataNature: "SOURCE_VERIFIED",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: true,
    allowedAssistActions: ["FIND_GAP", "DRAFT_FROM_CONTEXT", "VERIFY_SOURCE"],
    lockable: true,
  },
  "topic_lab.contribution": {
    fieldRef: "contribution",
    stageId: "topic-lab",
    label: "預期學術／實務貢獻",
    dataNature: "AI_DERIVED",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["DRAFT_FROM_CONTEXT", "POLISH", "EXPLAIN"],
    lockable: true,
  },
  "topic_lab.methodology_direction": {
    fieldRef: "methodology_direction",
    stageId: "topic-lab",
    label: "初步研究方法方向",
    dataNature: "AI_DERIVED",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["DRAFT_FROM_CONTEXT", "POLISH", "EXPLAIN"],
    lockable: true,
  },
  "topic_lab.known_limitations": {
    fieldRef: "known_limitations",
    stageId: "topic-lab",
    label: "已知研究限制與邊界",
    dataNature: "AI_DERIVED",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["DRAFT_FROM_CONTEXT", "CRITIQUE", "EXPLAIN"],
    lockable: true,
  },

  // --- Protected Formal Fields (AI WRITE STRICTLY FORBIDDEN) ---
  "ethics.irb_approval_number": {
    fieldRef: "irb_approval_number",
    stageId: "ethics",
    label: "IRB / 倫理審查核定編號",
    dataNature: "HUMAN_ATTESTATION",
    aiWritable: false,
    requiresUserFact: true,
    requiresEvidence: true,
    allowedAssistActions: ["EXPLAIN"],
    lockable: true,
  },
  "analysis.p_value_results": {
    fieldRef: "p_value_results",
    stageId: "analysis",
    label: "實證分析結果與顯著性",
    dataNature: "SOURCE_VERIFIED",
    aiWritable: false,
    requiresUserFact: true,
    requiresEvidence: true,
    allowedAssistActions: ["EXPLAIN"],
    lockable: true,
  },
  "submission-gate.author_signatures": {
    fieldRef: "author_signatures",
    stageId: "submission-gate",
    label: "作者共同簽名與聲明",
    dataNature: "HUMAN_ATTESTATION",
    aiWritable: false,
    requiresUserFact: true,
    requiresEvidence: false,
    allowedAssistActions: ["EXPLAIN"],
    lockable: true,
  },
};

export function getFieldPolicy(stageId: StageId, fieldRef: string): FieldPolicyRule {
  const key = `${stageId}.${fieldRef}`;
  if (STAGE_FIELD_POLICIES[key]) {
    return STAGE_FIELD_POLICIES[key];
  }
  // Safe default: writable if not specified as protected
  return {
    fieldRef,
    stageId,
    label: fieldRef,
    dataNature: "USER_INPUT",
    aiWritable: true,
    requiresUserFact: false,
    requiresEvidence: false,
    allowedAssistActions: ["EXPLAIN", "DRAFT_FROM_CONTEXT", "POLISH"],
    lockable: true,
  };
}

export function isFieldAiWritable(stageId: StageId, fieldRef: string): boolean {
  const policy = getFieldPolicy(stageId, fieldRef);
  return policy.aiWritable;
}
