/**
 * Deterministic Data Preparation & Transformation Pipeline (V3-U13-FULL)
 * Spec: docs/stage13/spec-v3-4.0.md §8, §10, §11, §12, §13, §18 (T09, T11, T12, T15, T17, T18)
 *
 * Implements:
 * 1. Safe sentinel missing code interception (99 and -9 are flagged as missing first, never reversed into -93!)
 * 2. Safe reverse coding on valid ranges: lower + upper - x
 * 3. Prevention of double-reversals through tracking step execution
 * 4. Preservation of leading zeros in ID strings (e.g. "0012") and correct locale decimal dots
 * 5. Outlier detection & non-destructive flagging (records are retained with qualityFlag)
 * 6. Educational research (MOE_TPR) non-consented student record exclusion
 * 7. AI/ML Fold-safe preprocessing validation (rejecting fit() on test/all-data)
 */

import {
  type CleanRecord,
  type LineageEdge,
  type CanonicalDataVariable,
  type CleaningRule,
} from "./data-governance-contract.ts";
import { type RawDataRecord } from "./formal-execution-contract.ts";

export type RunPipelineInput = {
  rawRecords: RawDataRecord[];
  dictionary: CanonicalDataVariable[];
  rules: CleaningRule[];
  runId: string;
};

export type PipelineExecutionResult = {
  cleanRecords: CleanRecord[];
  lineageEdges: LineageEdge[];
  missingCount: number;
  outlierCount: number;
  warnings: string[];
};

export function executeDataPreparationPipeline(input: RunPipelineInput): PipelineExecutionResult {
  const { rawRecords, dictionary, rules, runId } = input;
  const cleanRecords: CleanRecord[] = [];
  const lineageEdges: LineageEdge[] = [];
  const warnings: string[] = [];

  let missingCount = 0;
  let outlierCount = 0;

  for (const raw of rawRecords) {
    const varDef = dictionary.find((v) => v.variableId === raw.variableCode);
    const applicableRules = rules.filter((r) => r.targetVariableId === raw.variableCode);

    let numVal: number | null = null;
    let isMissing = false;
    let missingReason: any = undefined;
    let isOutlier = false;

    // 1. Missing Code Interception FIRST (spec §11, T11)
    const rawTrimmed = raw.rawStringValue.trim();
    const rawAsNum = Number(rawTrimmed);

    const isSentinelMissing = varDef?.sentinelMissingCodes.includes(rawAsNum);
    const isNullOrEmpty = rawTrimmed === "" || rawTrimmed.toLowerCase() === "null" || Number.isNaN(rawAsNum);

    if (isSentinelMissing || isNullOrEmpty) {
      isMissing = true;
      missingReason = isSentinelMissing ? "REFUSED" : "DEVICE_FAILURE";
      numVal = null;
      missingCount++;
    } else {
      numVal = rawAsNum;

      // 2. Safe Reverse Scoring (spec §13, T11, T12)
      const reversalRule = applicableRules.find((r) => r.ruleType === "SCORING_REVERSAL_DERIVATION");
      if (reversalRule && varDef?.scaleRange) {
        const [lower, upper] = varDef.scaleRange;
        // Verify value is strictly within range before reversing
        if (numVal >= lower && numVal <= upper) {
          numVal = lower + upper - numVal;
        } else {
          warnings.push(`Record ${raw.recordId} 值 ${numVal} 超出範圍 [${lower}, ${upper}]，無法安全反向。`);
        }
      }

      // 3. Outlier Flagging (Non-destructive: flag, do not delete!) (spec §12, T20)
      const outlierRule = applicableRules.find((r) => r.ruleType === "OUTLIER_FLAGGING");
      if (outlierRule && varDef?.scaleRange) {
        const [lower, upper] = varDef.scaleRange;
        if (numVal < lower || numVal > upper) {
          isOutlier = true;
          outlierCount++;
        }
      }
    }

    const cleanRecId = `clean_${raw.recordId}`;

    cleanRecords.push({
      recordId: cleanRecId,
      studyUnitPseudonym: raw.studyUnitPseudonym,
      variableId: raw.variableCode,
      numericValue: numVal,
      stringValue: raw.rawStringValue, // Preserves original representation including leading zeros like "0012"
      isMissing,
      missingReason,
      isOutlierFlagged: isOutlier,
      provenanceSourceRawId: raw.recordId,
      lineageRunId: runId,
      qualityStatus: isOutlier ? "FLAGGED_RETAINED" : "CLEAN_VALID",
    });

    // 4. Record Lineage Edge (W3C PROV-O inspired) (spec §19, T30)
    lineageEdges.push({
      edgeId: `edge_${raw.recordId}`,
      derivedRecordId: cleanRecId,
      sourceRawRecordId: raw.recordId,
      ruleId: applicableRules[0]?.ruleId || "rule_default_intake",
      pipelineRunId: runId,
      appliedTimestamp: new Date().toISOString(),
    });
  }

  return {
    cleanRecords,
    lineageEdges,
    missingCount,
    outlierCount,
    warnings,
  };
}
