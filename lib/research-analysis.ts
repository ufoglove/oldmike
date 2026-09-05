import { ALLOWED_ANALYSIS_METHODS, type AnalysisMethod, normalizeAnalysisParameters, sha256Canonical, type AnalysisParameters } from "./research-contract.ts";

export type NumericVector = readonly (number | null | undefined)[];

function finiteValues(values: NumericVector): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function round(value: number, precision: number, mode: AnalysisParameters["rounding"]): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  const scaled = Math.abs(value * factor);
  const floor = Math.floor(scaled);
  const fraction = scaled - floor;
  const tolerance = Number.EPSILON * Math.max(1, scaled) * 4;
  let rounded = floor;
  if (fraction > 0.5 + tolerance) rounded += 1;
  else if (Math.abs(fraction - 0.5) <= tolerance && (mode === "HALF_UP" || floor % 2 === 1)) rounded += 1;
  return Math.sign(value) * rounded / factor;
}

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  return values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
}

function ranks(values: readonly number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index);
  const result = new Array<number>(values.length);
  for (let start = 0; start < ordered.length;) {
    let end = start + 1;
    while (end < ordered.length && ordered[end].value === ordered[start].value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let cursor = start; cursor < end; cursor += 1) result[ordered[cursor].index] = rank;
    start = end;
  }
  return result;
}

function pearson(x: readonly number[], y: readonly number[]): number | null {
  if (x.length !== y.length || x.length < 2) return null;
  const xMean = mean(x);
  const yMean = mean(y);
  const numerator = x.reduce((sum, value, index) => sum + (value - xMean) * (y[index] - yMean), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, value) => sum + (value - xMean) ** 2, 0)
      * y.reduce((sum, value) => sum + (value - yMean) ** 2, 0),
  );
  return denominator === 0 ? null : numerator / denominator;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let z = value - 1;
  let x = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (z + index + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a: number, b: number, x: number): number {
  const maxIterations = 200;
  const epsilon = 3e-14;
  const minimum = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < minimum) d = minimum;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = iteration * (b - iteration) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    result *= d * c;
    aa = -(a + iteration) * (qab + iteration) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < minimum) d = minimum;
    c = 1 + aa / c;
    if (Math.abs(c) < minimum) c = minimum;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < epsilon) return result;
  }
  throw new Error("analysis_beta_convergence_failed");
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2)
    ? front * betaFraction(a, b, x) / a
    : 1 - front * betaFraction(b, a, 1 - x) / b;
}

function studentTCdf(t: number, degreesOfFreedom: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) throw new Error("invalid_t_distribution_input");
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  const tail = 0.5 * regularizedBeta(x, degreesOfFreedom / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

function pValue(t: number, degreesOfFreedom: number, parameters: AnalysisParameters): number {
  const cdf = studentTCdf(t, degreesOfFreedom);
  if (parameters.tail === "TWO_SIDED") return Math.min(1, 2 * Math.min(cdf, 1 - cdf));
  return parameters.alternative === "LESS" ? cdf : 1 - cdf;
}

export type AnalysisResult = { method: AnalysisMethod; parameters: AnalysisParameters; payload: Record<string, unknown>; resultHash: string; inputHash: string; engine: string; engineVersion: string };

export const ANALYSIS_ENGINE = "old-mike-deterministic-stats";
export const ANALYSIS_ENGINE_VERSION = "1.1.0";

export type DeterministicAnalysisInput = { datasetSha256: string; analysisPlanHash: string; method: AnalysisMethod; parameters?: Partial<AnalysisParameters>; values?: NumericVector; x?: NumericVector; y?: NumericVector; groupA?: NumericVector; groupB?: NumericVector };

export function runDeterministicAnalysis(input: DeterministicAnalysisInput): AnalysisResult {
  if (!ALLOWED_ANALYSIS_METHODS.includes(input.method)) throw new Error("analysis_method_not_allowlisted");
  if (!/^[0-9a-f]{64}$/.test(input.datasetSha256) || !/^[0-9a-f]{64}$/.test(input.analysisPlanHash)) throw new Error("analysis_hash_binding_invalid");
  const parameters = normalizeAnalysisParameters(input.method, input.parameters ?? {});
  const r = (value: number) => round(value, parameters.precision, parameters.rounding);
  const payload: Record<string, unknown> = { missingCount: 0 };

  if (input.method === "DESCRIPTIVE_STATISTICS") {
    const values = finiteValues(input.values ?? []);
    payload.count = values.length;
    payload.missingCount = (input.values ?? []).length - values.length;
    payload.mean = r(mean(values));
    payload.variance = r(variance(values));
    payload.minimum = values.length ? r(Math.min(...values)) : null;
    payload.maximum = values.length ? r(Math.max(...values)) : null;
  } else if (input.method === "MISSING_VALUE_SUMMARY") {
    const values = input.values ?? [];
    payload.count = values.length;
    payload.missingCount = values.filter((value) => value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))).length;
    payload.presentCount = Number(payload.count) - Number(payload.missingCount);
  } else if (input.method === "CORRELATION") {
    const x = input.x ?? [];
    const y = input.y ?? [];
    if (x.length !== y.length) throw new Error("correlation_lengths_mismatch");
    const pairs = x.map((value, index) => [value, y[index]] as const)
      .filter(([a, b]) => typeof a === "number" && Number.isFinite(a) && typeof b === "number" && Number.isFinite(b));
    if (pairs.length < 3) throw new Error("correlation_insufficient_observations");
    const xs = pairs.map(([value]) => value as number);
    const ys = pairs.map(([, value]) => value as number);
    const coefficient = pearson(parameters.correlation === "SPEARMAN" ? ranks(xs) : xs, parameters.correlation === "SPEARMAN" ? ranks(ys) : ys);
    const degreesOfFreedom = pairs.length - 2;
    const perfect = coefficient !== null && Math.abs(coefficient) >= 1 - Number.EPSILON * 8;
    const statistic = coefficient === null || perfect ? null : coefficient * Math.sqrt(degreesOfFreedom / (1 - coefficient ** 2));
    const probability = perfect ? 0 : statistic === null ? null : pValue(statistic, degreesOfFreedom, parameters);
    payload.count = pairs.length;
    payload.missingCount = x.length - pairs.length;
    payload.correlation = coefficient === null ? null : r(coefficient);
    payload.correlationType = parameters.correlation;
    payload.tStatistic = statistic === null ? null : r(statistic);
    payload.degreesOfFreedom = degreesOfFreedom;
    payload.pValue = probability === null ? null : r(probability);
    payload.alpha = parameters.alpha;
    payload.significant = probability === null ? false : probability < parameters.alpha;
  } else {
    let groupA: number[];
    let groupB: number[];
    let missingCount: number;
    if (parameters.pairing === "PAIRED") {
      const rawA = input.groupA ?? [];
      const rawB = input.groupB ?? [];
      if (rawA.length !== rawB.length) throw new Error("paired_lengths_mismatch");
      const pairs = rawA.map((value, index) => [value, rawB[index]] as const)
        .filter(([a, b]) => typeof a === "number" && Number.isFinite(a) && typeof b === "number" && Number.isFinite(b));
      groupA = pairs.map(([value]) => value as number);
      groupB = pairs.map(([, value]) => value as number);
      missingCount = rawA.length - pairs.length;
    } else {
      groupA = finiteValues(input.groupA ?? []);
      groupB = finiteValues(input.groupB ?? []);
      missingCount = (input.groupA ?? []).length + (input.groupB ?? []).length - groupA.length - groupB.length;
    }
    if (groupA.length < 2 || groupB.length < 2) throw new Error("comparison_insufficient_observations");
    const difference = mean(groupA) - mean(groupB);
    let standardError: number;
    let degreesOfFreedom: number;
    let testLabel: string;
    if (parameters.pairing === "PAIRED") {
      const differences = groupA.map((value, index) => value - groupB[index]);
      standardError = Math.sqrt(variance(differences) / differences.length);
      degreesOfFreedom = differences.length - 1;
      testLabel = "PAIRED_STUDENT";
    } else if (parameters.test === "STUDENT") {
      degreesOfFreedom = groupA.length + groupB.length - 2;
      const pooledVariance = ((groupA.length - 1) * variance(groupA) + (groupB.length - 1) * variance(groupB)) / degreesOfFreedom;
      standardError = Math.sqrt(pooledVariance * (1 / groupA.length + 1 / groupB.length));
      testLabel = "UNPAIRED_STUDENT";
    } else {
      const a = variance(groupA) / groupA.length;
      const b = variance(groupB) / groupB.length;
      standardError = Math.sqrt(a + b);
      degreesOfFreedom = (a + b) ** 2 / ((a ** 2) / (groupA.length - 1) + (b ** 2) / (groupB.length - 1));
      testLabel = "UNPAIRED_WELCH";
    }
    const statistic = standardError === 0 ? null : difference / standardError;
    const probability = statistic === null ? null : pValue(statistic, degreesOfFreedom, parameters);
    payload.groupACount = groupA.length;
    payload.groupBCount = groupB.length;
    payload.meanDifference = r(difference);
    payload.standardError = r(standardError);
    payload.tStatistic = statistic === null ? null : r(statistic);
    payload.degreesOfFreedom = r(degreesOfFreedom);
    payload.pValue = probability === null ? null : r(probability);
    payload.alpha = parameters.alpha;
    payload.significant = probability === null ? false : probability < parameters.alpha;
    payload.test = testLabel;
    payload.missingCount = missingCount;
  }

  const provenance = { method: input.method, parameters, engine: ANALYSIS_ENGINE, engineVersion: ANALYSIS_ENGINE_VERSION };
  const inputHash = sha256Canonical({ datasetSha256: input.datasetSha256, analysisPlanHash: input.analysisPlanHash, ...provenance });
  const resultHash = sha256Canonical({ ...provenance, datasetSha256: input.datasetSha256, analysisPlanHash: input.analysisPlanHash, payload });
  return { method: input.method, parameters, payload, resultHash, inputHash, engine: ANALYSIS_ENGINE, engineVersion: ANALYSIS_ENGINE_VERSION };
}

export function redactAnalysisOutput(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  if (serialized.includes("@") || serialized.includes("postgres") || serialized.includes("token")) throw new Error("analysis_output_sensitive");
  return value;
}
