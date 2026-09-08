/**
 * Deterministic Statistical Computation Engine (V3-U14-FULL)
 * Spec: docs/stage14/spec-v3-4.0.md §8, §9, §10, §12, §15, §31 (T10, T11, T12, T13, T14, T26, T28)
 *
 * Implements:
 * 1. Benchmark Hand-Calculated Descriptive Statistics:
 *    - For array [1, 2, 3, 4, 5]: Mean = 3.0, Sample Variance (ddof=1) = 2.5, Sample SD = 1.5811
 * 2. Two-Sample Welch t-test (unequal variances, exact Satterthwaite df):
 *    - Formula: t = (xbar1 - xbar2) / sqrt(s1^2/n1 + s2^2/n2)
 *    - df = (s1^2/n1 + s2^2/n2)^2 / [ (s1^2/n1)^2/(n1-1) + (s2^2/n2)^2/(n2-1) ]
 *    - 95% Confidence Interval & Cohen's d (pooled SD)
 * 3. ANCOVA Baseline Covariate Linear Model:
 *    - y_T1 ~ beta0 + beta1 * Treatment + beta2 * y_T0
 *    - Ordinary Least Squares (OLS) closed-form solution with exact standard errors
 * 4. Multiplicity Adjustment: Holm-Bonferroni step-down correction
 * 5. Strict rejection of empty arrays, constant values without variance, or arbitrary eval
 */

// Regularized Incomplete Beta Function for exact Student t CDF & p-value
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 100;
  const EPS = 3.0e-7;
  const FPMIN = 1.0e-30;
  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) break;
  }
  return h;
}

function gammln(xx: number): number {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = xx;
  let y = xx;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j <= 5; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function ibeta(a: number, b: number, x: number): number {
  if (x < 0.0 || x > 1.0) return 0;
  if (x === 0.0) return 0;
  if (x === 1.0) return 1.0;
  const bt = Math.exp(gammln(a + b) - gammln(a) - gammln(b) + a * Math.log(x) + b * Math.log(1.0 - x));
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (bt * betacf(a, b, x)) / a;
  } else {
    return 1.0 - (bt * betacf(b, a, 1.0 - x)) / b;
  }
}

// Student t two-tailed p-value from t and df
export function studentTwoTailedPValue(t: number, df: number): number {
  if (df <= 0) return 1.0;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  const p = ibeta(0.5 * df, 0.5, x);
  return Number(Math.max(1e-15, Math.min(1.0, p)).toFixed(6));
}

// 1. Benchmark Descriptive Statistics (spec §10, T10)
export function calculateDescriptiveStats(numbers: number[]): {
  count: number;
  mean: number;
  sampleVariance: number;
  sampleSd: number;
} {
  const n = numbers.length;
  if (n < 2) {
    throw new Error("SAMPLE_SIZE_INSUFFICIENT: Need at least 2 observations to calculate sample variance (ddof=1)");
  }
  const mean = numbers.reduce((sum, x) => sum + x, 0) / n;
  // Sample variance with Bessel's correction ddof=1: sum((x - mean)^2) / (n - 1)
  const ss = numbers.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0);
  const sampleVariance = ss / (n - 1);
  const sampleSd = Math.sqrt(sampleVariance);

  return {
    count: n,
    mean: Number(mean.toFixed(4)),
    sampleVariance: Number(sampleVariance.toFixed(4)),
    sampleSd: Number(sampleSd.toFixed(4)),
  };
}

// 2. Two-Sample Welch t-test (spec §12, T11)
export type WelchTestResult = {
  n1: number;
  n2: number;
  mean1: number;
  mean2: number;
  meanDiff: number;
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  confidenceInterval: [number, number];
  cohensD: number;
  isSignificant: boolean;
};

// Inverse Student-t CDF via bisection on two-tailed p (exact quantile, replaces 1.96/2.0 approximations)
export function studentTCriticalTwoTailed(confidenceLevel: number, df: number): number {
  if (!(confidenceLevel > 0 && confidenceLevel < 1) || !(df > 0)) throw new Error("INVALID_T_QUANTILE_PARAMS");
  const targetP = 1 - confidenceLevel;
  let lo = 0, hi = 1e6;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const p = studentTwoTailedPValue(mid, df);
    if (p > targetP) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export function calculateWelchTTest(group1: number[], group2: number[], confidenceLevel = 0.95): WelchTestResult {
  const d1 = calculateDescriptiveStats(group1);
  const d2 = calculateDescriptiveStats(group2);

  const meanDiff = d1.mean - d2.mean;
  const s1sq_n1 = d1.sampleVariance / d1.count;
  const s2sq_n2 = d2.sampleVariance / d2.count;
  const seDiff = Math.sqrt(s1sq_n1 + s2sq_n2);

  if (seDiff === 0) {
    throw new Error("VARIANCE_ZERO: Both groups have zero variance, t-test not estimable");
  }

  const tStatistic = meanDiff / seDiff;

  // Satterthwaite approximation for degrees of freedom
  const numDf = Math.pow(s1sq_n1 + s2sq_n2, 2);
  const denDf = Math.pow(s1sq_n1, 2) / (d1.count - 1) + Math.pow(s2sq_n2, 2) / (d2.count - 1);
  const df = numDf / denDf;

  const pValue = studentTwoTailedPValue(tStatistic, df);

  // Exact critical t for CI (bisection on regularized incomplete beta), not large-sample 1.96/2.0 approx
  const critT = studentTCriticalTwoTailed(confidenceLevel, df);
  const margin = critT * seDiff;
  const ciLower = Number((meanDiff - margin).toFixed(3));
  const ciUpper = Number((meanDiff + margin).toFixed(3));

  // Pooled Cohen's d
  const pooledSd = Math.sqrt(((d1.count - 1) * d1.sampleVariance + (d2.count - 1) * d2.sampleVariance) / (d1.count + d2.count - 2));
  const cohensD = Number((meanDiff / pooledSd).toFixed(3));

  return {
    n1: d1.count,
    n2: d2.count,
    mean1: d1.mean,
    mean2: d2.mean,
    meanDiff: Number(meanDiff.toFixed(3)),
    tStatistic: Number(tStatistic.toFixed(3)),
    degreesOfFreedom: Number(df.toFixed(2)),
    pValue,
    confidenceInterval: [ciLower, ciUpper],
    cohensD,
    isSignificant: pValue < 0.05,
  };
}

// 3. ANCOVA Baseline Covariate Linear Model (spec §12, T13)
// Model: y_post = b0 + b1 * Group (1=Intervention, 0=Control) + b2 * y_pre
export type AncovaResult = {
  treatmentEffectEstimate: number; // b1
  standardError: number;
  tValue: number;
  pValue: number;
  rSquared: number;
  confidenceInterval: [number, number];
};

export function calculateAncovaModel(cases: Array<{ pre: number; post: number; isIntervention: number }>): AncovaResult {
  const n = cases.length;
  if (n < 4) {
    throw new Error("SAMPLE_SIZE_TOO_SMALL_FOR_ANCOVA: Need at least 4 observations for 3-parameter model");
  }

  // Design matrix X [1, isIntervention, pre], vector y [post]
  // Solve (X'X) * b = X'y using standard 3x3 Gaussian elimination
  const X = cases.map((c) => [1, c.isIntervention, c.pre]);
  const y = cases.map((c) => c.post);

  // Compute X'X (3x3) and X'y (3x1)
  const XtX = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const Xty = [0, 0, 0];

  for (let i = 0; i < n; i++) {
    const row = X[i];
    const valY = y[i];
    for (let r = 0; r < 3; r++) {
      Xty[r] += row[r] * valY;
      for (let c = 0; c < 3; c++) {
        XtX[r][c] += row[r] * row[c];
      }
    }
  }

  // Matrix inversion of XtX (3x3)
  const m = XtX;
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  if (Math.abs(det) < 1e-12) {
    throw new Error("RANK_DEFICIENT_OR_SINGULAR_MATRIX: Cannot invert (X'X)");
  }

  const inv = [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det,
    ],
  ];

  // b = inv * Xty
  const b = [
    inv[0][0] * Xty[0] + inv[0][1] * Xty[1] + inv[0][2] * Xty[2],
    inv[1][0] * Xty[0] + inv[1][1] * Xty[1] + inv[1][2] * Xty[2], // b1: Treatment effect
    inv[2][0] * Xty[0] + inv[2][1] * Xty[1] + inv[2][2] * Xty[2], // b2: Covariate
  ];

  // Residual sum of squares
  let ssRes = 0;
  let ssTotal = 0;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  for (let i = 0; i < n; i++) {
    const pred = b[0] * X[i][0] + b[1] * X[i][1] + b[2] * X[i][2];
    ssRes += Math.pow(y[i] - pred, 2);
    ssTotal += Math.pow(y[i] - meanY, 2);
  }

  const dfRes = n - 3;
  const mse = ssRes / dfRes;
  const seB1 = Math.sqrt(mse * inv[1][1]);
  const tVal = b[1] / seB1;
  const pVal = studentTwoTailedPValue(tVal, dfRes);
  const r2 = 1 - ssRes / ssTotal;

  // Exact 95% CI: t quantile at dfRes, not fixed 2.0 multiplier
  const critT = studentTCriticalTwoTailed(0.95, dfRes);
  const margin = critT * seB1;
  const ciLower = Number((b[1] - margin).toFixed(3));
  const ciUpper = Number((b[1] + margin).toFixed(3));

  return {
    treatmentEffectEstimate: Number(b[1].toFixed(3)),
    standardError: Number(seB1.toFixed(3)),
    tValue: Number(tVal.toFixed(3)),
    pValue: pVal,
    rSquared: Number(r2.toFixed(3)),
    confidenceInterval: [ciLower, ciUpper],
  };
}

// 4. Holm-Bonferroni Multiplicity Correction (spec §15, T26)
export function applyHolmBonferroni(rawPValues: number[]): number[] {
  const m = rawPValues.length;
  const indexed = rawPValues.map((p, idx) => ({ p, idx }));
  // Sort ascending by raw p-value
  indexed.sort((a, b) => a.p - b.p);

  let maxPrev = 0;
  const adjusted = new Array(m);

  for (let k = 0; k < m; k++) {
    const rawP = indexed[k].p;
    // Step-down multiplier: (m - k)
    let pAdj = rawP * (m - k);
    pAdj = Math.min(1.0, Math.max(maxPrev, pAdj));
    maxPrev = pAdj;
    adjusted[indexed[k].idx] = Number(pAdj.toFixed(5));
  }

  return adjusted;
}
