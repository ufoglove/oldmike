/**
 * Assist Coverage Registry — Spec v3.3.0 (V3-U03-R2) Section 10, 11
 *
 * Declares, for each existing module, what Old Mike can continuously do and what
 * must come from real sources / user / external records. This is the honest
 * coverage report source: one chat button pasted site-wide is NOT coverage.
 */
import { type PrimaryGoalId } from "./research-goal-registry.ts";

export const ASSIST_COVERAGE_CONTRACT = "assist-coverage/1.0.0" as const;

export const FIELD_POLICY_TYPES = [
  "GENERATED_DRAFT",
  "USER_FACT",
  "EXTERNAL_FACT",
  "COMPUTED_FACT",
  "PROTECTED_RESULT",
  "APPROVAL_OR_ATTESTATION",
] as const;
export type FieldPolicyType = (typeof FIELD_POLICY_TYPES)[number];

export type ModuleAssistCoverage = {
  moduleId: string;
  displayName: string;
  routeApplicability: PrimaryGoalId | "ALL";
  allowedContinuations: string[];
  mustNotFabricate: string[];
  realCompletionBasis: string;
  status: "COVERED" | "PARTIAL" | "NOT_YET";
};

export const ASSIST_COVERAGE: ModuleAssistCoverage[] = [
  {
    moduleId: "research-profile",
    displayName: "研究Profile",
    routeApplicability: "ALL",
    allowedContinuations: ["抽取專長", "整理領域", "建議搜尋詞"],
    mustNotFabricate: ["任職", "資源", "設備", "課程"],
    realCompletionBasis: "使用者授權資料或明確聲明",
    status: "COVERED",
  },
  {
    moduleId: "radar",
    displayName: "前沿雷達",
    routeApplicability: "ALL",
    allowedContinuations: ["依來源發現熱門/新興/跨域機會"],
    mustNotFabricate: ["趨勢數字", "成長百分比", "全域計量"],
    realCompletionBasis: "真實 API 查詢與計量快照（OpenAlex group_by 等）",
    status: "COVERED",
  },
  {
    moduleId: "one-click",
    displayName: "一鍵靈感",
    routeApplicability: "ALL",
    allowedContinuations: ["依目標產生有差異構想"],
    mustNotFabricate: ["已驗證 Gap", "引用", "錄取率"],
    realCompletionBasis: "候選產生＋初步 Gap 標待驗證",
    status: "COVERED",
  },
  {
    moduleId: "topic-lab",
    displayName: "選題實驗室",
    routeApplicability: "ALL",
    allowedContinuations: ["相近研究", "可行性", "候選比較"],
    mustNotFabricate: ["研究結果", "設備", "樣本"],
    realCompletionBasis: "採用快照＋授權範圍",
    status: "COVERED",
  },
  {
    moduleId: "navigator",
    displayName: "投稿導航",
    routeApplicability: "ALL",
    allowedContinuations: ["三套匹配", "來源核對", "定位與風險"],
    mustNotFabricate: ["接受保證", "合格保證", "APC/學門/截止日"],
    realCompletionBasis: "官方來源＋規則快照＋使用者確認",
    status: "COVERED",
  },
  {
    moduleId: "blueprint",
    displayName: "研究藍圖",
    routeApplicability: "ALL",
    allowedContinuations: ["整理目的", "RQ", "工作與產出"],
    mustNotFabricate: ["實作進度", "正式核准"],
    realCompletionBasis: "交接快照＋規劃內容",
    status: "COVERED",
  },
  {
    moduleId: "evidence",
    displayName: "文獻與證據中心",
    routeApplicability: "ALL",
    allowedContinuations: ["檢索", "去重", "讀取授權內容", "矩陣"],
    mustNotFabricate: ["閱讀範圍", "Claim 支持", "全文已讀"],
    realCompletionBasis: "ProviderRecord＋Canonical 去重＋來源",
    status: "COVERED",
  },
  {
    moduleId: "gap",
    displayName: "Gap 與新穎性",
    routeApplicability: "ALL",
    allowedContinuations: ["最近研究比較", "差異", "反證與限制"],
    mustNotFabricate: ["首創聲稱", "未搜尋到＝首創"],
    realCompletionBasis: "真實檢索範圍＋日期",
    status: "COVERED",
  },
  {
    moduleId: "theory",
    displayName: "理論與機制",
    routeApplicability: "ALL",
    allowedContinuations: ["比較解釋", "定義構念與命題"],
    mustNotFabricate: ["強制理論/假設"],
    realCompletionBasis: "適用性判斷＋來源",
    status: "COVERED",
  },
  {
    moduleId: "design",
    displayName: "研究設計／分析計畫",
    routeApplicability: "ALL",
    allowedContinuations: ["方法候選", "矩陣", "可計算樣本方案"],
    mustNotFabricate: ["效果量數值", "正式統計"],
    realCompletionBasis: "可追溯計算＋假設透明",
    status: "COVERED",
  },
  {
    moduleId: "nstc-proposal",
    displayName: "國科會計畫書",
    routeApplicability: "NSTC_GENERAL",
    allowedContinuations: ["學術問題", "方法", "工作包", "預期成果與預算草稿"],
    mustNotFabricate: ["人員/價格依據", "申請人確認"],
    realCompletionBasis: "真實來源＋申請人確認",
    status: "COVERED",
  },
  {
    moduleId: "moe-proposal",
    displayName: "教學實踐計畫書",
    routeApplicability: "MOE_TPR",
    allowedContinuations: ["課程問題", "介入", "評量", "課程安排", "申請書"],
    mustNotFabricate: ["課程事實", "學生資料權利"],
    realCompletionBasis: "課程事實＋學生資料權利",
    status: "COVERED",
  },
  {
    moduleId: "ethics",
    displayName: "倫理／IRB",
    routeApplicability: "ALL",
    allowedContinuations: ["清單", "風險", "文件草稿"],
    mustNotFabricate: ["正式判定", "核准"],
    realCompletionBasis: "真實核准紀錄（非 AI 作成）",
    status: "COVERED",
  },
  {
    moduleId: "instruments-protocol",
    displayName: "工具／Protocol",
    routeApplicability: "ALL",
    allowedContinuations: ["工具比較", "程序草稿", "計分與資料規格"],
    mustNotFabricate: ["量表授權", "原文", "效度來源"],
    realCompletionBasis: "授權＋效度來源",
    status: "COVERED",
  },
  {
    moduleId: "execution",
    displayName: "Pilot／正式研究",
    routeApplicability: "ALL",
    allowedContinuations: ["計畫", "排程", "紀錄整理", "完整性檢查"],
    mustNotFabricate: ["真實參與", "同意", "檔案與場域紀錄"],
    realCompletionBasis: "真實紀錄",
    status: "COVERED",
  },
  {
    moduleId: "governance",
    displayName: "資料治理",
    routeApplicability: "ALL",
    allowedContinuations: ["可回復轉換", "字典", "缺失與品質紀錄"],
    mustNotFabricate: ["Raw 改寫", "規則版本"],
    realCompletionBasis: "版本化規則＋轉換紀錄",
    status: "COVERED",
  },
  {
    moduleId: "analysis-lab",
    displayName: "分析實驗室",
    routeApplicability: "ALL",
    allowedContinuations: ["依計畫在隔離環境計算與核對"],
    mustNotFabricate: ["LLM 手填統計", "假完成率"],
    realCompletionBasis: "真實資料＋程式＋Run＋ResultFact",
    status: "COVERED",
  },
  {
    moduleId: "manuscript",
    displayName: "全文協作",
    routeApplicability: "ALL",
    allowedContinuations: ["基於來源逐章成稿", "論述與一致性"],
    mustNotFabricate: ["數值", "引文支持", "實際方法"],
    realCompletionBasis: "ResultFact＋CitationSource",
    status: "COVERED",
  },
  {
    moduleId: "scientific-review",
    displayName: "老麥科學審查",
    routeApplicability: "ALL",
    allowedContinuations: ["多視角問題", "修訂任務與建議"],
    mustNotFabricate: ["官方判定"],
    realCompletionBasis: "模擬審查（不冒充官方）",
    status: "COVERED",
  },
  {
    moduleId: "academic-language",
    displayName: "翻譯與潤稿",
    routeApplicability: "ALL",
    allowedContinuations: ["科學翻譯", "術語與語言改善"],
    mustNotFabricate: ["提高因果/確定性", "變更結果"],
    realCompletionBasis: "Scientific Meaning Lock",
    status: "COVERED",
  },
  {
    moduleId: "review-compliance",
    displayName: "合規／投稿包",
    routeApplicability: "ALL",
    allowedContinuations: ["規則核對", "文件", "引用與附件整理"],
    mustNotFabricate: ["作者聲明", "未送標送"],
    realCompletionBasis: "真實文件＋作者確認",
    status: "COVERED",
  },
  {
    moduleId: "reviewer-response",
    displayName: "Reviewer 回覆",
    routeApplicability: "ALL",
    allowedContinuations: ["對真實意見拆解", "回覆草稿與修訂對照"],
    mustNotFabricate: ["未實改標已修正"],
    realCompletionBasis: "真實意見＋實際修訂",
    status: "COVERED",
  },
];

export function getAssistCoverage(moduleId: string): ModuleAssistCoverage | undefined {
  return ASSIST_COVERAGE.find((m) => m.moduleId === moduleId);
}

export function coverageSummary(): { covered: number; partial: number; notYet: number; total: number } {
  const covered = ASSIST_COVERAGE.filter((m) => m.status === "COVERED").length;
  const partial = ASSIST_COVERAGE.filter((m) => m.status === "PARTIAL").length;
  const notYet = ASSIST_COVERAGE.filter((m) => m.status === "NOT_YET").length;
  return { covered, partial, notYet, total: ASSIST_COVERAGE.length };
}
