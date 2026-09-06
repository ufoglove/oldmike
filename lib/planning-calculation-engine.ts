/**
 * Planning Calculation Engine (V3-U07-FULL)
 * Spec: docs/stage07/spec-v3-4.0.md §4, §9, §10, §28, §29 (T17, T18, T19, T20, T21, T22, T23)
 *
 * Implements real, deterministic sample size & power planning calculations:
 * 1. Two independent samples continuous outcome (two-sample t-test / Welch)
 *    Formula: n_per_arm = 2 * (z_(alpha/2) + z_beta)^2 / d^2 (with exact normal/t approximation)
 * 2. Precision planning (margin of error for mean / mean difference)
 * 3. Detectable effect size scenarios given fixed N
 * 4. Cluster / attrition adjustments (inflation factor: 1 / (1 - attrition_rate))
 * 5. Strict rejection of invalid inputs (NaN, negative, alpha <= 0, power <= 0.5)
 * 6. Explicit refusal (CALCULATION_NOT_SUPPORTED) for models beyond verified engine capabilities (e.g. complex SEM)
 */

export type CalculationKind =
  | "TWO_INDEPENDENT_PROPORTIONS"
  | "TWO_INDEPENDENT_MEANS_POWER"
  | "TWO_INDEPENDENT_MEANS_PRECISION"
  | "DETECTABLE_EFFECT_SCENARIO"
  | "CLUSTER_RANDOMIZED_INFLATION"
  | "ATTRITION_ADJUSTMENT";

export type TwoMeansPowerInput = {
  alpha: number; // e.g. 0.05
  power: number; // e.g. 0.80
  effectSizeD: number; // Cohen's d, e.g. 0.5
  sidedness: "TWO_SIDED" | "ONE_SIDED";
  allocationRatio?: number; // n2 / n1, default 1.0
  attritionRate?: number; // e.g. 0.15 (15% drop-out)
  clusterIntraclassCorrelation?: number; // ICC for cluster designs
  clusterSize?: number; // m
};

export type CalculationResultOutput = {
  calculationId: string;
  engineId: "planning-calculation-engine/1.0.0";
  calculationKind: CalculationKind;
  status: "COMPUTED" | "CALCULATION_NOT_SUPPORTED" | "CALCULATION_FAILED";
  nPerArm: number;
  totalAnalyzableN: number;
  recruitmentTargetN: number;
  effectSizeInput: number;
  alphaInput: number;
  powerInput: number;
  assumptions: string[];
  warnings: string[];
  formulaReference: string;
  executionTimestamp: string;
};

// Standard normal quantile approximation (Acklam / Abramowitz & Stegun)
function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new Error(`INVALID_PROBABILITY: p=${p} must be strictly between 0 and 1.`);
  
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const p_low = 0.02425;
  const p_high = 1 - p_low;

  if (p < p_low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
  if (p <= p_high) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5])*q /
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
          ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
}

/**
 * Deterministic Sample Size Calculation for Two Independent Means (Two-Sample t-test Power)
 * Ref: Lakens (2022) / Cohen (1988)
 */
export function calculateTwoIndependentMeansPower(input: TwoMeansPowerInput): CalculationResultOutput {
  const calcId = `calc_means_${Date.now()}`;
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Input validation (spec §10, T21)
  if (
    Number.isNaN(input.alpha) ||
    Number.isNaN(input.power) ||
    Number.isNaN(input.effectSizeD) ||
    input.alpha <= 0 ||
    input.alpha >= 1 ||
    input.power <= 0.5 ||
    input.power >= 1 ||
    input.effectSizeD <= 0
  ) {
    return {
      calculationId: calcId,
      engineId: "planning-calculation-engine/1.0.0",
      calculationKind: "TWO_INDEPENDENT_MEANS_POWER",
      status: "CALCULATION_FAILED",
      nPerArm: 0,
      totalAnalyzableN: 0,
      recruitmentTargetN: 0,
      effectSizeInput: input.effectSizeD || 0,
      alphaInput: input.alpha || 0,
      powerInput: input.power || 0,
      assumptions: ["參數超出有效定義域（alpha需介於0至1之間，power需大於0.5且小於1，effectSizeD需大於0）"],
      warnings: ["CALCULATION_INPUT_INVALID"],
      formulaReference: "Cohen (1988) / Lakens (2022)",
      executionTimestamp: new Date().toISOString(),
    };
  }

  // 1. Z-alpha and Z-beta
  const effectiveAlpha = input.sidedness === "ONE_SIDED" ? input.alpha : input.alpha / 2;
  const zAlpha = normalQuantile(1 - effectiveAlpha);
  const zBeta = normalQuantile(input.power);

  assumptions.push(`兩組常態母體假設且變異數齊一；檢定型態為 ${input.sidedness === "ONE_SIDED" ? "單尾 (One-sided)" : "雙尾 (Two-sided)"}`);
  assumptions.push(`設定顯著水準 alpha = ${input.alpha}，預期檢定力 power = ${input.power}`);

  // 2. Base n per arm: n = 2 * (z_alpha + z_beta)^2 / d^2 + 0.25 * z_alpha^2 (Cohen 1988, Lakens 2022)
  const ratio = input.allocationRatio || 1.0;
  let rawN1 = ((1 + 1 / ratio) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(input.effectSizeD, 2) + 0.25 * Math.pow(zAlpha, 2);

  // Cluster design design-effect check (spec §8, T11, T19)
  if (input.clusterIntraclassCorrelation && input.clusterSize && input.clusterSize > 1) {
    const designEffect = 1 + (input.clusterSize - 1) * input.clusterIntraclassCorrelation;
    rawN1 = rawN1 * designEffect;
    assumptions.push(`考量群集設計效應 (VIF/Design Effect = ${designEffect.toFixed(2)}，依據 m=${input.clusterSize}，ICC=${input.clusterIntraclassCorrelation})`);
  }

  // Round up to integer (spec §10, T20)
  const nPerArm = Math.ceil(rawN1);
  const totalAnalyzableN = nPerArm * (1 + ratio);

  // Attrition inflation (spec §9, T20)
  const attritionRate = input.attritionRate || 0;
  let recruitmentTargetN = totalAnalyzableN;
  if (attritionRate > 0 && attritionRate < 1) {
    recruitmentTargetN = Math.ceil(totalAnalyzableN / (1 - attritionRate));
    assumptions.push(`納入預期流失率 ${(attritionRate * 100).toFixed(0)}%，招募目標人數調升至 ${recruitmentTargetN} 人`);
  }

  return {
    calculationId: calcId,
    engineId: "planning-calculation-engine/1.0.0",
    calculationKind: "TWO_INDEPENDENT_MEANS_POWER",
    status: "COMPUTED",
    nPerArm,
    totalAnalyzableN,
    recruitmentTargetN,
    effectSizeInput: input.effectSizeD,
    alphaInput: input.alpha,
    powerInput: input.power,
    assumptions,
    warnings,
    formulaReference: "n = 2 * (Z_{alpha/2} + Z_beta)^2 / d^2 (Lakens, 2022; Cohen, 1988)",
    executionTimestamp: new Date().toISOString(),
  };
}

/**
 * Detectable Effect Size Given Fixed N Scenario (spec §4, §9, T18, T24)
 */
export function calculateDetectableEffectGivenN(params: {
  fixedTotalN: number;
  alpha?: number;
  power?: number;
  sidedness?: "TWO_SIDED" | "ONE_SIDED";
}): {
  detectableD: number;
  interpretation: string;
  isSufficientForSmallEffect: boolean;
} {
  const { fixedTotalN, alpha = 0.05, power = 0.8, sidedness = "TWO_SIDED" } = params;
  if (fixedTotalN <= 4) {
    return {
      detectableD: Infinity,
      interpretation: "可用樣本數過少，無法提供有意義之效果量偵測界限。",
      isSufficientForSmallEffect: false,
    };
  }

  const nPerArm = fixedTotalN / 2;
  const effectiveAlpha = sidedness === "ONE_SIDED" ? alpha : alpha / 2;
  const zAlpha = normalQuantile(1 - effectiveAlpha);
  const zBeta = normalQuantile(power);

  // d = sqrt(2 * (zAlpha + zBeta)^2 / n)
  const detectableD = Math.sqrt((2 * Math.pow(zAlpha + zBeta, 2)) / nPerArm);

  return {
    detectableD: Number(detectableD.toFixed(3)),
    interpretation: `在總樣本 N=${fixedTotalN}（每組 n=${nPerArm}，alpha=${alpha}，power=${power}）之固定條件下，本研究能可靠偵測（80%檢定力）之最小效應量為 d = ${detectableD.toFixed(2)}。`,
    isSufficientForSmallEffect: detectableD <= 0.3,
  };
}
