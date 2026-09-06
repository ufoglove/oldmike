/**
 * Deterministic Sandbox Scoring Preview Engine (V3-U10-FULL)
 * Spec: docs/stage10/spec-v3-4.0.md §15, §28 (T29, T30, T31)
 *
 * Implements:
 * 1. Safe missing value interception (e.g. 99 is converted to missing FIRST; never enters reverse formula)
 * 2. Safe reverse coding: lower + upper - x ONLY on verified, non-missing numeric values
 * 3. Prevention of double-reversal by separating raw inputs from transformed outputs
 * 4. Checking minimum answered items requirement (if answered < min, output null)
 * 5. Strict rejection of arbitrary eval or dynamic script execution
 * 6. Deterministic calculation of sum and mean
 * 7. Tagged as SYNTHETIC_INSTRUMENT_TEST (never enters Raw Data or Result Facts)
 */

import { type ScoringSpecification, type ScoringPreviewOutput } from "./instrument-protocol-contract.ts";

export type RunScoringInput = {
  specification: ScoringSpecification;
  rawItemResponses: Record<string, any>; // e.g. { item_1: 1, item_2: 2, item_3: 5 }
};

export function runSandboxScoringPreview(input: RunScoringInput): ScoringPreviewOutput {
  const { specification, rawItemResponses } = input;
  const calcId = `score_prev_${Date.now()}`;
  const warnings: string[] = [];
  const transformedItemValues: Array<{ itemId: string; rawValue: any; scoredValue: number | null }> = [];

  let validAnsweredCount = 0;
  let runningSum = 0;

  for (const itemRule of specification.itemRules) {
    const rawVal = rawItemResponses[itemRule.itemId];

    // 1. Missing check FIRST (spec §15, T30)
    const isMissingCode = itemRule.missingCodes.includes(rawVal);
    const isNullOrUndefined = rawVal === null || rawVal === undefined || rawVal === "" || Number.isNaN(rawVal);

    if (isMissingCode || isNullOrUndefined) {
      transformedItemValues.push({
        itemId: itemRule.itemId,
        rawValue: rawVal,
        scoredValue: null,
      });
      continue;
    }

    // 2. Numeric range validation
    const numVal = Number(rawVal);
    const [lower, upper] = itemRule.validRange;

    if (numVal < lower || numVal > upper) {
      warnings.push(`Item ${itemRule.itemId} 值 ${rawVal} 超出合法定義域 [${lower}, ${upper}]，視為缺失無效值。`);
      transformedItemValues.push({
        itemId: itemRule.itemId,
        rawValue: rawVal,
        scoredValue: null,
      });
      continue;
    }

    // 3. Safe reverse scoring: lower + upper - x (spec §15, T29)
    let scored = numVal;
    if (itemRule.isReverseScored) {
      scored = lower + upper - numVal;
    }

    transformedItemValues.push({
      itemId: itemRule.itemId,
      rawValue: rawVal,
      scoredValue: scored,
    });

    runningSum += scored;
    validAnsweredCount++;
  }

  const missingItemCount = specification.itemRules.length - validAnsweredCount;

  // 4. Check minimum valid answered items requirement (spec §15, T30)
  if (validAnsweredCount < specification.minValidItemsRequired) {
    warnings.push(`有效作答題數 (${validAnsweredCount}) 低於最低要求門檻 (${specification.minValidItemsRequired})，總分計算為 null。`);
    return {
      calculationId: calcId,
      status: "COMPUTED",
      transformedItemValues,
      totalScore: null,
      meanScore: null,
      missingItemCount,
      warnings,
      executionTimestamp: new Date().toISOString(),
      testMode: "SYNTHETIC_INSTRUMENT_TEST",
    };
  }

  const meanScore = validAnsweredCount > 0 ? Number((runningSum / validAnsweredCount).toFixed(3)) : null;

  return {
    calculationId: calcId,
    status: "COMPUTED",
    transformedItemValues,
    totalScore: runningSum,
    meanScore,
    missingItemCount,
    warnings,
    executionTimestamp: new Date().toISOString(),
    testMode: "SYNTHETIC_INSTRUMENT_TEST",
  };
}
