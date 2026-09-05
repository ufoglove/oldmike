/**
 * Topic Candidate Quality & Deduplication Service (規格第13/14節，T12/T13)
 * 
 * 規則：
 * 1. T12: 檢驗候選題目多樣性，提示重複措辭與換湯不換藥的 candidate。
 * 2. T12: 不足 10 個合理題目時保留實際數量與原因，不硬造湊數題目；單題可進入比較評估。
 * 3. T13: 評分模型分開獨立計算 fit 與 coverage，未知維度保留 null，不把未評分維度按滿分補平。
 * 4. T13: 查無文獻不得標註「全球首創」，僅標示 UNVERIFIED_NOVELTY。
 */

export interface TopicCandidate {
  candidateId: string;
  title: string;
  englishTitle?: string;
  coreQuestion: string;
  gapHypothesis: string;
  expectedContribution: string;
  methodologyOverview: string;
  feasibilityRating?: number | null; // 0-5
  importanceRating?: number | null;  // 0-5
  noveltyRating?: number | null;     // 0-5
  overallFitScore?: number | null;   // 0-100
  evaluatedCoveragePct: number;      // 0-100
  evidenceStatus: "UNVERIFIED" | "CLAIM_SUPPORTED" | "NEEDS_EVIDENCE" | "CONCEPT_ONLY";
  isNoveltyClaimGrounded: boolean;
  duplicateWarning?: string;
}

export interface CandidateQualityReport {
  passedCandidates: TopicCandidate[];
  duplicateCount: number;
  warnings: string[];
  totalReceived: number;
}

export class TopicCandidateQualityService {
  /**
   * 計算兩字串的 Jaccard 相似度（詞彙層面）
   */
  private static calculateJaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, "").split(""));
    const set2 = new Set(str2.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, "").split(""));
    if (set1.size === 0 || set2.size === 0) return 0;
    
    let intersection = 0;
    for (const item of set1) {
      if (set2.has(item)) intersection++;
    }
    const union = set1.size + set2.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * T12: 檢驗題目品質、重述偵測與自然數量保留
   */
  static evaluateCandidates(candidates: TopicCandidate[]): CandidateQualityReport {
    const warnings: string[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const c1 = candidates[i];
        const c2 = candidates[j];
        const sim = this.calculateJaccardSimilarity(c1.title, c2.title);
        if (sim > 0.75) {
          duplicateCount++;
          const warn = `Candidate "${c2.title}" has high phrasing overlap with "${c1.title}" (${Math.round(sim * 100)}% lexical overlap)`;
          c2.duplicateWarning = warn;
          warnings.push(warn);
        }
      }
    }

    // T12: 不足10個題目不硬湊
    if (candidates.length < 10) {
      warnings.push(`Only ${candidates.length} valid candidates were generated based on available signals (no forced fillers).`);
    }

    // T13: 檢核每一候選題目的評分與新穎性宣告
    for (const c of candidates) {
      this.enrichAndVerifyCandidateRubric(c);
    }

    return {
      passedCandidates: candidates,
      duplicateCount,
      warnings,
      totalReceived: candidates.length,
    };
  }

  /**
   * T13: 嚴格依 Rubric 算分，保留 null 維度，分離 fit 與 coverage
   */
  static enrichAndVerifyCandidateRubric(candidate: TopicCandidate): void {
    // 若文獻查無或未驗證，嚴禁標記「全球首創」
    if (candidate.evidenceStatus === "UNVERIFIED" || candidate.evidenceStatus === "CONCEPT_ONLY") {
      candidate.isNoveltyClaimGrounded = false;
    }

    const weights = {
      importance: 30,
      novelty: 30,
      feasibility: 40,
    };

    let scoredPoints = 0;
    let maxScoredWeight = 0;

    if (candidate.importanceRating !== null && candidate.importanceRating !== undefined) {
      scoredPoints += (candidate.importanceRating / 5) * weights.importance;
      maxScoredWeight += weights.importance;
    }
    if (candidate.noveltyRating !== null && candidate.noveltyRating !== undefined) {
      scoredPoints += (candidate.noveltyRating / 5) * weights.novelty;
      maxScoredWeight += weights.novelty;
    }
    if (candidate.feasibilityRating !== null && candidate.feasibilityRating !== undefined) {
      scoredPoints += (candidate.feasibilityRating / 5) * weights.feasibility;
      maxScoredWeight += weights.feasibility;
    }

    candidate.evaluatedCoveragePct = maxScoredWeight;

    // 若有評審維度缺漏，保留 overallFitScore 為實際得分，不擴大乘至100以假裝完整
    if (maxScoredWeight === 0) {
      candidate.overallFitScore = null;
    } else {
      candidate.overallFitScore = Math.round(scoredPoints * 10) / 10;
    }
  }
}
