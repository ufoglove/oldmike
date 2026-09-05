// 三路線的 Section 工作區目錄（repo 與 UI 共用單一來源）
export type RouteSectionDef = { id: string; title: string; objective: string };

export const JOURNAL_SECTIONS: RouteSectionDef[] = [
  { id: "positioning", title: "期刊定位 Profile", objective: "目標讀者／核心問題／國際 Gap／Primary & Secondary Contribution／Theory & Method Positioning／Desk Reject 風險" },
  { id: "alignment", title: "Journal–Research Alignment Matrix", objective: "Aims & Scope／Article Type／Theory／Rigor／Sample／Longitudinal／Data／Ethics／Reporting Guideline 逐項檢查" },
  { id: "manuscript-blueprint", title: "Manuscript Blueprint", objective: "Provisional Title／Abstract Shell／Introduction／Theory／Methods／Results（NOT YET AVAILABLE）／Discussion 骨架" },
  { id: "reporting-guideline", title: "Reporting Guideline 規劃", objective: "依設計選定 RCT/Observational/Systematic Review/Mixed/AI…＋official_source＋verified_at" },
  { id: "preregistration", title: "Preregistration & Open Science", objective: "平台候選／時機／Primary Outcome／Data & Code Sharing／隱私限制（不假裝已註冊）" },
  { id: "authorship", title: "Authorship & Contribution", objective: "Lead/Corresponding/Co-authors＋CRediT 分工（PLANNED，不替未確認人員建身份）" },
  { id: "risks", title: "Major Risks & Next Best Action", objective: "主要風險與下一步" },
];

export const NSTC_SECTIONS: RouteSectionDef[] = [
  { id: "basics", title: "計畫基本資料", objective: "中文/英文題目、計畫類型、年限、處別、學門、關鍵詞" },
  { id: "abstract", title: "中英文摘要骨架", objective: "摘要骨架（結果尚未取得，不虛構）" },
  { id: "background", title: "研究背景與重要性", objective: "背景、國內外現況、Validated Gap" },
  { id: "problem", title: "科學問題與研究目的", objective: "科學問題、目的、創新性（Contribution Delta）" },
  { id: "theory", title: "理論與研究架構", objective: "核心理論、研究架構（連結理論實驗室）" },
  { id: "method", title: "研究方法", objective: "設計、樣本、資料來源、分析計畫（連結研究設計）" },
  { id: "workplan", title: "年度工作項目與里程碑", objective: "依藍圖建立 Year 工作包（不重複填滿）" },
  { id: "expected", title: "預期成果", objective: "預期成果與發表（不宣稱已核定）" },
  { id: "pi", title: "主持人適任性與團隊", objective: "適任性、分工（PLANNED）" },
  { id: "ethics", title: "研究倫理與資料管理", objective: "倫理與資料管理規劃（不虛構 IRB 號）" },
  { id: "risk", title: "風險與替代方案", objective: "風險與替代（不虛構）" },
  { id: "budget", title: "經費規劃 Placeholder", objective: "經費 placeholder（不虛構官方額度）" },
];

export const MOE_SECTIONS: RouteSectionDef[] = [
  { id: "basics", title: "計畫基本資料", objective: "題目、學門、課程名稱、授課教師、學期、學生對象" },
  { id: "teaching-problem", title: "教學問題與基線證據", objective: "學生學不會什麼／課堂證據（標 SOURCE/YEAR/匿名化）／現有教學不足" },
  { id: "root-cause", title: "問題根因分析", objective: "根因（不得把技術新穎當唯一理由）" },
  { id: "literature", title: "文獻與理論基礎", objective: "文獻與理論（連結證據中心）" },
  { id: "intervention", title: "教學介入設計與學習機制", objective: "介入→機制→學習成果→評量鏈" },
  { id: "outcomes", title: "學生學習成果與評量方式", objective: "成果＋評量（每個成果都要有評量）" },
  { id: "research-design", title: "研究問題與研究設計", objective: "RQ、設計、課程執行流程、資料分析" },
  { id: "ethics", title: "研究倫理與學生權益", objective: "降低權力關係風險、知情同意（不虛構核准）" },
  { id: "benefits", title: "預期效益與推廣", objective: "效益、教材化、推廣" },
  { id: "budget", title: "經費規劃 Placeholder", objective: "經費 placeholder" },
];

export const ROUTE_SECTION_DEFS: Record<"JOURNAL_PLANNING" | "NSTC_PROPOSAL" | "MOE_TPR_PROPOSAL", RouteSectionDef[]> = {
  JOURNAL_PLANNING: JOURNAL_SECTIONS,
  NSTC_PROPOSAL: NSTC_SECTIONS,
  MOE_TPR_PROPOSAL: MOE_SECTIONS,
};

export type RouteSectionRouteKey = keyof typeof ROUTE_SECTION_DEFS;
