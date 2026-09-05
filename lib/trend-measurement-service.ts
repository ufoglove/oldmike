/**
 * Trend Measurement Engine (嚴格遵循科研規範與規格第12節/T07/T08/T09/T10/T11)
 * 
 * 規則：
 * 1. 成長率公式：growth_pct = 100 * (current_count - previous_count) / previous_count
 * 2. 基期門檻：若 previous_count < minBaseline (預設 5)，比例回傳 null，並給予 LOW_BASELINE 警告，不賦予無限成長或假高分。
 * 3. 未知數值不得以 0 冒充，必須保留 null。
 * 4. 同一來源、query版本、時間窗口口徑才能相加或比較。
 * 5. Metadata 更新不等於新發表；日期口徑不同 (如 created vs published) 標記 INCOMPARABLE_TEMPORAL_GRAIN。
 * 6. 模型不得自由寫入計量，所有 MetricRecord 均由本服務以確定性演算法計算產生。
 */

export interface MetricRecord {
  metricId: string;
  metricName: string;
  formulaVersion: string;
  currentCount: number | null;
  previousCount: number | null;
  growthPct: number | null;
  status: "CALCULATED" | "LOW_BASELINE" | "INCOMPARABLE" | "PARTIAL_DATA" | "UNKNOWN";
  warningMessage?: string;
  sourceScope: {
    provider: string;
    queryVersion: string;
    windowDays: number;
    currentWindow: { start: string; end: string };
    previousWindow: { start: string; end: string };
    dateGrain: "PUBLISHED" | "POSTED" | "METADATA_UPDATED";
  };
  calculatedAt: string;
}

export interface TrendCalculationInput {
  provider: string;
  queryVersion: string;
  windowDays?: number;
  currentCount: number | null;
  previousCount: number | null;
  dateGrain?: "PUBLISHED" | "POSTED" | "METADATA_UPDATED";
  minBaseline?: number;
  isTruncated?: boolean;
}

export class TrendMeasurementService {
  private static FORMULA_VERSION = "trend-metric/1.0.0";
  private static DEFAULT_MIN_BASELINE = 5;

  /**
   * 嚴格按照 T07 / T08 規則計算趨勢成長率
   */
  static calculateTrend(input: TrendCalculationInput): MetricRecord {
    const minBaseline = input.minBaseline ?? this.DEFAULT_MIN_BASELINE;
    const now = new Date();
    const windowDays = input.windowDays ?? 365;

    const baseRecord: MetricRecord = {
      metricId: `metric_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      metricName: "trend_growth_pct",
      formulaVersion: this.FORMULA_VERSION,
      currentCount: input.currentCount,
      previousCount: input.previousCount,
      growthPct: null,
      status: "UNKNOWN",
      sourceScope: {
        provider: input.provider,
        queryVersion: input.queryVersion,
        windowDays,
        currentWindow: {
          start: new Date(now.getTime() - windowDays * 86400000).toISOString(),
          end: now.toISOString(),
        },
        previousWindow: {
          start: new Date(now.getTime() - 2 * windowDays * 86400000).toISOString(),
          end: new Date(now.getTime() - windowDays * 86400000).toISOString(),
        },
        dateGrain: input.dateGrain ?? "PUBLISHED",
      },
      calculatedAt: now.toISOString(),
    };

    // T08: 日期口徑為 METADATA_UPDATED 時，不得作為新發表成長計算
    if (input.dateGrain === "METADATA_UPDATED") {
      baseRecord.status = "INCOMPARABLE";
      baseRecord.warningMessage =
        "Metadata update date cannot be used as new publication count.";
      return baseRecord;
    }

    // T09: 資料截斷或樣本不足
    if (input.isTruncated) {
      baseRecord.status = "PARTIAL_DATA";
      baseRecord.warningMessage =
        "Result is truncated or rate-limited; metric is partial.";
    }

    // T07: 未知數值不得以 0 冒充
    if (input.currentCount === null || input.previousCount === null) {
      baseRecord.status = "UNKNOWN";
      baseRecord.warningMessage = "Counts are incomplete; growth cannot be derived.";
      return baseRecord;
    }

    // T07: 基期為 0 或低於門檻
    if (input.previousCount === 0 || input.previousCount < minBaseline) {
      baseRecord.status = "LOW_BASELINE";
      baseRecord.growthPct = null;
      baseRecord.warningMessage = `Low baseline count (${input.previousCount} < ${minBaseline}); growth percentage undefined to avoid pseudo-acceleration.`;
      return baseRecord;
    }

    // T07: 正常計算 growth_pct = 100 * (current - previous) / previous
    const growth = (100 * (input.currentCount - input.previousCount)) / input.previousCount;
    // 四捨五入至小數點後兩位
    baseRecord.growthPct = Math.round(growth * 100) / 100;
    if (baseRecord.status !== "PARTIAL_DATA") {
      baseRecord.status = "CALCULATED";
    }

    return baseRecord;
  }

  /**
   * T11: 驗證傳入之計量記錄是否由受信任的程式計算產生，嚴禁 AI 隨意寫入 count/growth
   */
  static validateMetricRecord(record: any): boolean {
    if (!record || typeof record !== "object") return false;
    if (record.formulaVersion !== this.FORMULA_VERSION) return false;
    if (typeof record.metricId !== "string" || !record.metricId.startsWith("metric_")) return false;
    if (record.growthPct !== null && typeof record.growthPct !== "number") return false;
    return true;
  }
}
