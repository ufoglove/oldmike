export const V2_ALPHA4_CONTRACT_VERSION = "old-mike-v2-alpha4/1.0.0" as const;
export const V2_ALPHA4_TARGET_CATALOG_VERSION = "old-mike-output-targets/2026-08-24" as const;

export const V2_ALPHA4_TARGETS = Object.freeze([
  { id: "SCI", label: "SCI 國際期刊（實際以 SCIE 收錄驗證）", enabled: true, verificationCollection: "SCIE", availability: "ALPHA4" },
  { id: "SSCI", label: "SSCI 國際期刊", enabled: true, verificationCollection: "SSCI", availability: "ALPHA4" },
  { id: "NSTC", label: "國科會專題研究計畫（原科技部）", enabled: false, verificationCollection: null, availability: "UPCOMING_ALPHA5" },
  { id: "MOE", label: "教育部教學實踐研究計畫", enabled: false, verificationCollection: null, availability: "UPCOMING_ALPHA5" },
] as const);

export type V2Alpha4TargetId = (typeof V2_ALPHA4_TARGETS)[number]["id"];
export type V2Alpha4EnabledTargetId = "SCI" | "SSCI";
export type V2Alpha4Status = "READY" | "NEEDS_FIX" | "BLOCKED" | "STALE";

export const V2_ALPHA4_STATUS_VALUES = ["READY", "NEEDS_FIX", "BLOCKED", "STALE"] as const;
export const V2_ALPHA4_REVIEW_LENSES = ["EIC", "METHODOLOGY", "DOMAIN", "PERSPECTIVE", "DEVILS_ADVOCATE"] as const;
export const V2_ALPHA4_SOURCE_CONTRACTS = Object.freeze({
  CLARIVATE_MJL: { authority: "CURRENT_SCIE_SSCI_COVERAGE_AND_MONTHLY_CHANGES", mode: "READONLY_FUTURE", liveEnabled: false },
  OFFICIAL_JOURNAL_PUBLISHER: { authority: "AIMS_SCOPE_AUTHOR_GUIDE_ETHICS_AI_DATA_FEES_CHECKLIST_ISSUES_CALLS", mode: "READONLY_FUTURE", liveEnabled: false },
  CROSSREF: { authority: "DOI_METADATA_CROSS_CHECK", mode: "READONLY_FUTURE", liveEnabled: false },
  OPENALEX_SEMANTIC_SCHOLAR: { authority: "DISCOVERY_CROSS_CHECK_ONLY", mode: "REUSE_ALPHA3", liveEnabled: false },
  CONSENSUS: { authority: "OPTIONAL_DISABLED", mode: "DISABLED", liveEnabled: false },
  GOOGLE_SCHOLAR: { authority: "MANUAL_SEARCH_LINK_AND_DOI_BIBTEX_RIS_IMPORT_ONLY", mode: "NO_SCRAPING", liveEnabled: false },
} as const);
export const V2_ALPHA4_STAGE_RAIL = Object.freeze([
  { id: "FIT", label: "主題／期刊適配", shortLabel: "適配" },
  { id: "EVIDENCE_GAP", label: "證據地圖與可辯護缺口", shortLabel: "證據" },
  { id: "RESEARCH_CONTRACT", label: "理論、方法、倫理、測量與分析契約", shortLabel: "研究契約" },
  { id: "MANUSCRIPT", label: "結果／圖表到完整稿件", shortLabel: "稿件" },
  { id: "FIVE_LENS_REVIEW", label: "五鏡獨立學術審查", shortLabel: "審查" },
  { id: "TARGETED_REVISION", label: "目標修訂（最多兩輪）", shortLabel: "修訂" },
  { id: "CITATION_AUDIT", label: "引用存在、metadata 與語境查核", shortLabel: "引用" },
  { id: "POLICY_AUDIT", label: "官方期刊政策與提交查核", shortLabel: "政策" },
  { id: "COVER_LETTER", label: "由稿件事實產生 Cover Letter", shortLabel: "信函" },
  { id: "SUBMISSION_PACKAGE", label: "提交套件", shortLabel: "套件" },
  { id: "REVIEW_RESPONSE", label: "逐點審查回覆帳本", shortLabel: "回覆" },
] as const);
