/**
 * Deterministic Rater Calibration Engine (V3-U11-FULL)
 * Spec: docs/stage11/spec-v3-4.0.md §8, §28 (T09)
 *
 * Implements:
 * 1. Deterministic Cohen's Kappa for 2 raters on categorical rubric levels
 *    Formula: Kappa = (Po - Pe) / (1 - Pe)
 *    Po = observed agreement, Pe = chance agreement
 * 2. Percent agreement calculation
 * 3. Strict rejection of empty or mismatched case ratings
 * 4. Never AI-hallucinated Kappa values
 */

export type RaterRatingPair = {
  caseId: string;
  rater1Score: number; // e.g. 1 to 4
  rater2Score: number; // e.g. 1 to 4
};

export type CalibrationCalculationOutput = {
  totalCases: number;
  observedAgreement: number; // Po
  chanceAgreement: number;   // Pe
  cohensKappa: number;       // Kappa
  percentAgreement: number;  // Po * 100%
  interpretation: string;
  isAcceptable: boolean;     // Kappa >= 0.70
};

export function calculateCohensKappa(ratings: RaterRatingPair[]): CalibrationCalculationOutput {
  const n = ratings.length;
  if (n === 0) {
    throw new Error("EMPTY_RATINGS: ratings array must contain at least 1 case");
  }

  // Find all unique score categories
  const categories = Array.from(
    new Set([...ratings.map((r) => r.rater1Score), ...ratings.map((r) => r.rater2Score)])
  ).sort((a, b) => a - b);

  let agreeCount = 0;
  const countRater1: Record<number, number> = {};
  const countRater2: Record<number, number> = {};

  for (const cat of categories) {
    countRater1[cat] = 0;
    countRater2[cat] = 0;
  }

  for (const r of ratings) {
    if (r.rater1Score === r.rater2Score) {
      agreeCount++;
    }
    countRater1[r.rater1Score] = (countRater1[r.rater1Score] || 0) + 1;
    countRater2[r.rater2Score] = (countRater2[r.rater2Score] || 0) + 1;
  }

  // Observed Agreement (Po)
  const po = agreeCount / n;

  // Expected Chance Agreement (Pe)
  let pe = 0;
  for (const cat of categories) {
    const p1 = (countRater1[cat] || 0) / n;
    const p2 = (countRater2[cat] || 0) / n;
    pe += p1 * p2;
  }

  // Cohen's Kappa = (Po - Pe) / (1 - Pe)
  let kappa = 1.0;
  if (Math.abs(1 - pe) > 1e-9) {
    kappa = (po - pe) / (1 - pe);
  }

  const roundedKappa = Number(kappa.toFixed(3));
  const percentAgreement = Number((po * 100).toFixed(1));

  let interpretation = "評分者間信度良好 (Substantial / Almost Perfect)";
  if (roundedKappa < 0.40) {
    interpretation = "評分者信度不足 (Poor / Slight Agreement)";
  } else if (roundedKappa < 0.70) {
    interpretation = "評分者信度中等，建議修訂 Rubric 錨點 (Moderate Agreement)";
  }

  return {
    totalCases: n,
    observedAgreement: Number(po.toFixed(3)),
    chanceAgreement: Number(pe.toFixed(3)),
    cohensKappa: roundedKappa,
    percentAgreement,
    interpretation,
    isAcceptable: roundedKappa >= 0.70,
  };
}
