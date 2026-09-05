/**
 * V3-HOME-02 單一事實來源：模組／能力註冊中心 (Module & Capability Registry)
 * 依規格 docs/rebuild/v3-home-02-spec.md §7（六群地圖）與 §8（解說種子）、§9（共用說明來源）。
 * 供首頁功能地圖、側邊選單、同義詞搜尋、統一說明抽屜、老麥功能解說共用，不得各自維護不一致清單。
 *
 * 群組分類是用來「找功能」，不是強迫使用者依序通過硬性關卡。
 * 能力狀態須反映真實路由與實作；無法獨立成引擎的 seed 名稱，以真實現有工作室路由承接並如實標示，不杜撰路由。
 */

/* ------------------------------------------------------------------ */
/* 群組定義                                                           */
/* ------------------------------------------------------------------ */

export type ModuleGroupId =
  | "exploration" // 探索與選題
  | "planning"    // 文獻與研究規劃
  | "execution"   // 計畫與研究執行
  | "analysis"    // 資料與分析
  | "writing"     // 寫作與品質
  | "submission"  // 投稿與修訂
  | "shared";     // 全程共用

export interface ModuleGroup {
  groupId: ModuleGroupId;
  label: string;
  order: number;
  description: string;
}

export const MODULE_GROUPS: Record<ModuleGroupId, ModuleGroup> = {
  exploration: {
    groupId: "exploration", label: "探索與選題", order: 1,
    description: "從領域、趨勢與問題出發，發現值得深入的研究方向並比較選題。",
  },
  planning: {
    groupId: "planning", label: "文獻與研究規劃", order: 2,
    description: "整理既有證據、確認缺口、建立理論機制並完成可執行的藍圖與設計。",
  },
  execution: {
    groupId: "execution", label: "計畫與研究執行", order: 3,
    description: "依選定路線整理申請文件、倫理審查、工具量表與前導驗證，再到正式執行。",
  },
  analysis: {
    groupId: "analysis", label: "資料與分析", order: 4,
    description: "在保留原始資料前提下治理資料，依分析計畫執行統計／質性分析並產出可重現結果。",
  },
  writing: {
    groupId: "writing", label: "寫作與品質", order: 5,
    description: "依真實證據與結果逐章協作全文，執行自稿模擬審查並精準學術潤稿。",
  },
  submission: {
    groupId: "submission", label: "投稿與修訂", order: 6,
    description: "依目標期刊當下規範組裝投稿包、追蹤送件，並逐條拆解審查意見修訂回覆。",
  },
  shared: {
    groupId: "shared", label: "全程共用工具", order: 7,
    description: "研究全程隨時取用的文獻、老麥協助、任務成果與回收筒快捷功能。",
  },
};

/** 群組名稱 → 該群在首頁地圖中的排序用途。 */
export const GROUP_ORDER: ModuleGroupId[] = [
  "exploration", "planning", "execution", "analysis", "writing", "submission", "shared",
];

/* ------------------------------------------------------------------ */
/* 能力狀態                                                           */
/*   * 狀態（模組能力enum）與「專案研究進度／內容狀態／操作權限」不相混。 *
/* ------------------------------------------------------------------ */

export type CapabilityStatus = "AVAILABLE" | "NOT_BUILT" | "MAINTENANCE" | "CONFIG_REQUIRED";
export type CapabilityNeed =
  | "NONE"                       // 可直接開啟
  | "PROJECT_REQUIRED"           // 需要選定／建立專案才能繼續該功能
  | "PROJECT_OR_STANDALONE";     // 未選專案可作獨立工具，選專案後才納入專案範圍

/** 規格 §8 每張功能卡/說明抽屜需要的統一欄位。 */
export interface ModuleDefinition {
  moduleId: string;
  groupId: ModuleGroupId;
  displayName: string;        // 繁體中文為主
  englishSub?: string;        // 必要時英文副標
  plainSummary: string;       // 一句話用途：能完成什麼，不是「智慧分析」
  expectedOutputs: string;    // 產出摘要（這是規格 §8 指定的「應出現的產出說明」）
  whenToUse: string;
  requiredInputs: string[];   // 需要提供什麼
  steps: [string, string, string];
  saveLocation: string;
  nextModuleId?: string;      // 接續哪個功能
  limitations: string;        // 關鍵限制／不保證
  actionLabel: string;        // 具體行動按鈕文案，避免全站都叫「開始」
  routeNavId: string;         // 相對應的真實前端導覽路由（與 GuidedResearchCenter renderPage 對齊）
  standaloneSupported: boolean;
  capabilityNeed: CapabilityNeed;
  status: CapabilityStatus;   // 真實能力狀態
  synonyms: string[];         // 搜尋同義詞（含使用者口語），不得含私人稿件全文
  helpVersion: string;
  verifiedAt: string;
}

/* ------------------------------------------------------------------ */
/* 模組清單：依規格 §7 六群與 §8 種子，逐一承接真實路由               */
/* ------------------------------------------------------------------ */

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  /* ---------------- 探索與選題 ---------------- */
  radar: {
    moduleId: "radar", groupId: "exploration", displayName: "前沿雷達",
    englishSub: "Frontier Radar", routeNavId: "radar",
    plainSummary: "區分目前熱門與未來新興，發現值得追蹤的研究方向。",
    expectedOutputs: "有來源、日期與範圍的研究機會；不是保證未來預測。",
    whenToUse: "想了解某領域現在哪些議題升溫、哪些可能才剛崛起、值得追蹤時。",
    requiredInputs: ["想探索的研究領域或關鍵字", "感興趣的時間範圍（選用）"],
    steps: ["輸入領域或關鍵字與時間跨度", "檢視出版趨勢與升溫／新興議題分布", "收下候選研究方向並帶入後續選題"],
    saveLocation: "選題階段快照／本機暫存；帶入專案後存於專案資料",
    nextModuleId: "one-click",
    limitations: "根據出版與檢索統計，不保證未來被引用或研究可行性。",
    actionLabel: "探索前沿趨勢", standaloneSupported: true, capabilityNeed: "PROJECT_OR_STANDALONE",
    status: "AVAILABLE",
    synonyms: ["看前沿", "趨勢", "新興", "熱門", "找方向", "find frontier"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "one-click": {
    moduleId: "one-click", groupId: "exploration", displayName: "一鍵靈感",
    englishSub: "One-click Inspiration", routeNavId: "one-click",
    plainSummary: "把研究領域或機會轉成可比較的候選題。",
    expectedOutputs: "候選題、初步 RQ、資料需求與風險；新穎性仍需驗證。",
    whenToUse: "有一個領域或方向，但想把題目具體化成多個可比較的選項時。",
    requiredInputs: ["研究領域／方向或已存的候選方向"],
    steps: ["給定領域或方向", "產出多個候選題與初步 RQ", "挑選想深入的候選題送往選題實驗室"],
    saveLocation: "選題階段資料；候選題可帶入專案",
    nextModuleId: "topic-lab",
    limitations: "候選題只是起點，題目貢獻與新穎性需到 Gap／選題比較中驗證。",
    actionLabel: "產生靈感候選題", standaloneSupported: true, capabilityNeed: "PROJECT_OR_STANDALONE",
    status: "AVAILABLE",
    synonyms: ["給我靈感", "沒有靈感", "靈感", "候選題", "brainstorm"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "topic-lab": {
    moduleId: "topic-lab", groupId: "exploration", displayName: "選題實驗室",
    englishSub: "Topic Lab", routeNavId: "topic-lab",
    plainSummary: "比較候選題的貢獻與可行性，選定值得進一步研究的題目。",
    expectedOutputs: "選題快照、理由與待補資料；不是錄取率。",
    whenToUse: "手上有多個候選題，想依貢獻度、資料可取得性選定一個深入研究時。",
    requiredInputs: ["候選題與初步 RQ（可由一鍵靈感帶入）", "領域與關鍵字"],
    steps: ["綜整或載入候選題", "逐項比較研究貢獻與可行性", "圈選主候選題並存成選題快照"],
    saveLocation: "選題快照與理由；帶入專案後屬該專案",
    nextModuleId: "blueprint",
    limitations: "選題是研究規劃的一部分，不是錄取保證或正式同意。",
    actionLabel: "比較並選定題目", standaloneSupported: true, capabilityNeed: "PROJECT_OR_STANDALONE",
    status: "AVAILABLE",
    synonyms: ["我有想法", "選題", "選題比較", "定題", "題目比較"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  navigator: {
    moduleId: "navigator", groupId: "exploration", displayName: "投稿導航",
    englishSub: "Route & Journal Navigator", routeNavId: "navigator",
    plainSummary: "依研究內容比較目標期刊與可申請的研究計畫路線。",
    expectedOutputs: "候選期刊／學門／申請路線與規範缺項；不是正式投稿或核定。",
    whenToUse: "想決定這項研究較適合投期刊或走國科會／教學實踐計畫，並先看適合路線時。",
    requiredInputs: ["研究主題與大致方法", "個人研究目標（期刊或計畫路線）"],
    steps: ["描述研究內容與目標路線", "比較候選期刊或計畫學門的合適度", "鎖定一條（或並存）路線帶入規劃"],
    saveLocation: "路線／期刊比較紀錄；可建立對應專案",
    nextModuleId: "proposals",
    limitations: "只提供比較與規範參考，不代正式投稿、也不等於核定。",
    actionLabel: "選擇投稿／計畫路線", standaloneSupported: true, capabilityNeed: "PROJECT_OR_STANDALONE",
    status: "AVAILABLE",
    synonyms: ["選期刊", "期刊", "路線", "投稿方向", "target journal"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  /* ---------------- 文獻與研究規劃 ---------------- */
  blueprint: {
    moduleId: "blueprint", groupId: "planning", displayName: "研究藍圖",
    englishSub: "Research Blueprint", routeNavId: "blueprint",
    plainSummary: "把題目、目標與資源整理成可執行的研究總計畫。",
    expectedOutputs: "研究目的、RQ、規劃與版本；未執行內容仍標示為規劃。",
    whenToUse: "已定題目，想統整研究目標、問題與做法成一份總藍圖時。",
    requiredInputs: ["研究題目與背景", "核心研究問題"],
    steps: ["填寫或套用既有題目", "確立目的、RQ 與整體規劃", "儲存藍圖版本交由研究者檢視"],
    saveLocation: "研究藍圖版本庫 (research_blueprints)",
    nextModuleId: "gap",
    limitations: "藍圖是規劃文件，未執行的宣稱仍標示為「規劃」，不當成已驗證結果。",
    actionLabel: "整理研究藍圖", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["藍圖", "研究計畫總覽", "規劃", "blueprint", "總計畫"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  evidence: {
    moduleId: "evidence", groupId: "planning", displayName: "文獻與證據中心",
    englishSub: "Literature & Evidence Center", routeNavId: "evidence",
    plainSummary: "集中搜尋、閱讀、分析並引用本專案文獻與證據。",
    expectedOutputs: "專案文獻列表、Evidence 與引用來源；可連結 Zotero。",
    whenToUse: "需要查文獻、管理引用、或確認某個主張有多少證據支持時。",
    requiredInputs: ["本專案已收錄文獻或 Zotero 收藏集"],
    steps: ["瀏覽／搜尋本專案收錄的文獻", "檢視並標記全文閱讀、引用與 Claim 支持狀態", "把要用的文獻引到對應章節或版本"],
    saveLocation: "專案文獻與證據紀錄 (project literature links, evidence notes)",
    nextModuleId: "gap",
    limitations: "同步失敗不把本地既有文獻顯示成零；書目、全文閱讀、Claim 支持各自獨立。",
    actionLabel: "開啟文獻與證據", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["找文獻", "文獻", "引用", "證據", "reference", "文獻中心"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  gap: {
    moduleId: "gap", groupId: "planning", displayName: "Gap 與新穎性",
    englishSub: "Gap & Novelty Lab", routeNavId: "gap",
    plainSummary: "比較最相近研究，確認研究缺口與新增貢獻。",
    expectedOutputs: "Gap 證據、相近研究矩陣、差異與不確定性。",
    whenToUse: "寫到緒論或想確認題目「新在哪」、避免與既有研究重疊時。",
    requiredInputs: ["本專案文獻與證據", "鎖定的研究問題或主題"],
    steps: ["載入專案文獻與主題", "檢視最相近研究與缺口比較", "紀錄 Gap 判斷、差異與不確定性"],
    saveLocation: "Gap 與新穎性分析 (gap_novelty_analyses)",
    nextModuleId: "theory",
    limitations: "新穎性判斷標示不確定性與證據範圍，不宣稱絕對原創。",
    actionLabel: "確認研究缺口", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["缺口", "新穎性", "novelty", "gap", "研究缺口"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  theory: {
    moduleId: "theory", groupId: "planning", displayName: "理論與機制",
    englishSub: "Theory & Mechanism Lab", routeNavId: "theory",
    plainSummary: "說明研究現象為何可能發生，連結構念與研究問題。",
    expectedOutputs: "理論依據、機制模型、假設或研究命題。",
    whenToUse: "想為研究問題建立「為什麼會這樣」的理論連結與可檢驗機制時。",
    requiredInputs: ["研究問題與主題", "相關文獻或構念"],
    steps: ["梳理關鍵構念與既有理論", "建立機制說明或因果模型", "轉成可檢驗的假設或研究命題"],
    saveLocation: "理論／機制分析 (theory_mechanism_analyses)",
    nextModuleId: "design",
    limitations: "機制是研究者提出的解釋模型，仍需研究設計與資料加以檢驗。",
    actionLabel: "建立理論機制", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["理論", "機制", "假設", "構念", "framework"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  design: {
    moduleId: "design", groupId: "planning", displayName: "研究設計",
    englishSub: "Research Design", routeNavId: "design",
    plainSummary: "決定如何取得能回答研究問題的資料。",
    expectedOutputs: "研究設計、測量需求、樣本依據與分析計畫。",
    whenToUse: "題目與假設確立後，要決定採量／質、實驗／調查、樣本與測量方式時。",
    requiredInputs: ["研究問題或假設", "作者群／測量構念與預期樣本來源"],
    steps: ["選定研究設計類型", "界定測量、樣本與取樣依據", "產出分析計畫與所需工具需求"],
    saveLocation: "研究設計與分析計畫 (research_designs)",
    nextModuleId: "instruments-protocol",
    limitations: "設計與分析計畫是書面規劃，真實資料需依正式收案後完成。",
    actionLabel: "規劃研究設計", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["研究設計", "方法", "抽樣", "樣本", "設計", "methodology"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  /* ---------------- 計畫與研究執行 ---------------- */
  "route-workspace": {
    moduleId: "route-workspace", groupId: "execution", displayName: "研究路線與計畫準備",
    englishSub: "Route & Proposal Workspace", routeNavId: "route-workspace",
    plainSummary: "依選定路線（期刊／國科會／教學實踐）整理將用的申請與研究規劃主軸。",
    expectedOutputs: "路線對齊的規劃內容，期刊與計畫路線可分開並存處理。",
    whenToUse: "已確定要走計畫路線或要同時整理期刊與計畫兩條路線時。",
    requiredInputs: ["已選定或構思的研究路線", "研究藍圖或設計內容"],
    steps: ["確認要走的路線組合", "對應整理該路線需要的內容主軸", "連結到對應的計畫書或全文工作室"],
    saveLocation: "路線工作區與對應計畫文件",
    nextModuleId: "proposals",
    limitations: "路線準備不取代正式核定；計畫書與期刊可並存而不互相推遲。",
    actionLabel: "開啟路線工作區", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["計畫路線", "申請路線", "國科會", "教學實踐", "期刊研究規劃", "route"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  proposals: {
    moduleId: "proposals", groupId: "execution", displayName: "計畫書工作室（國科會／教學實踐）",
    englishSub: "Proposal Studio", routeNavId: "proposals",
    plainSummary: "依選定計畫路線整理申請內容，檢查缺漏。",
    expectedOutputs: "計畫書草稿、工作包與附件準備；不等於申請通過。",
    whenToUse: "準備國科會一般／新進或教育部教學實踐等計畫書與附件時。",
    requiredInputs: ["研究路線類型（國科會／教學實踐）", "研究設計與預算／時程素材"],
    steps: ["選擇計畫類型與對應格式", "逐節填寫或套用藍圖內容", "檢查缺漏並整併附件工作包"],
    saveLocation: "計畫書工作包 (proposal studios / application packages)",
    nextModuleId: "ethics-center",
    limitations: "系統整理草稿，實際送件與核定以主辦單位回執／公文為準。",
    actionLabel: "編輯計畫書內容", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["準備研究計畫", "申請書", "計畫書", "國科會", "教學實踐", "proposal"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "ethics-center": {
    moduleId: "ethics-center", groupId: "execution", displayName: "倫理／IRB",
    englishSub: "Ethics & IRB", routeNavId: "ethics-center",
    plainSummary: "管理適用倫理規劃、機構文件與研究執行限制。",
    expectedOutputs: "文件與授權狀態；網站不自行宣布核准或免審。",
    whenToUse: "研究涉及人體或個人資料、需準備 IRB／REC 或自我檢核時。",
    requiredInputs: ["適用風險等級資料", "機構文件或受試者／資料處理規劃"],
    steps: ["確認適用倫理檢核等級", "準備機構文件與個資／同意規劃", "紀錄正式授權進度與編號（如有）"],
    saveLocation: "倫理與門檻審查紀錄 (research_human_gates)",
    nextModuleId: "instruments-protocol",
    limitations: "僅供文件管理與自我檢核，不替代合格倫理審查委員會之正式審查。",
    actionLabel: "管理倫理合規", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["IRB", "倫理", "審查", "REC", "受試者同意"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "instruments-protocol": {
    moduleId: "instruments-protocol", groupId: "execution", displayName: "工具與 Protocol",
    englishSub: "Instruments & Protocol", routeNavId: "instruments-protocol",
    plainSummary: "管理研究工具、授權、評量與操作流程。",
    expectedOutputs: "工具版本、計分規格與 Protocol/SOP。",
    whenToUse: "定義使用的量表／軟體版本、計分方式或標準化作業流程時。",
    requiredInputs: ["工具與量表清單", "授權或計分／SOP 規格"],
    steps: ["登錄工具與授權依據", "撰寫標準化 SOP 與計分規格", "標記研究主持人檢視門檻"],
    saveLocation: "工具與量表資料庫 (research_instrument_specifications)",
    nextModuleId: "pilot-protocol-validation",
    limitations: "需確認外部量表是否有合法重製或翻譯授權。",
    actionLabel: "配置量表與 SOP", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["問卷", "量表", "SOP", "Protocol", "測量工具"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "pilot-protocol-validation": {
    moduleId: "pilot-protocol-validation", groupId: "execution", displayName: "Pilot 前導驗證",
    englishSub: "Pilot Validation", routeNavId: "pilot-protocol-validation",
    plainSummary: "預試研究工具與流程，找出正式研究前的問題。",
    expectedOutputs: "預試證據、修訂決策與 Protocol 更新；不是正式效果驗證。",
    whenToUse: "正式收案前先小規模試跑流程與題項、確認可行性時。",
    requiredInputs: ["小規模預試資料或受試回饋"],
    steps: ["執行小規模試測", "檢視信度／流暢度與回饋", "更新 Protocol 並記錄修正決策"],
    saveLocation: "前導驗證紀錄 (research_pilot_analyses)",
    nextModuleId: "execution",
    limitations: "Pilot 數據只能用於優化流程與題項，不得當正式研究結論。",
    actionLabel: "記錄前導試測", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["Pilot", "預試", "前導", "試測", "前測"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  execution: {
    moduleId: "execution", groupId: "execution", displayName: "正式研究與執行",
    englishSub: "Formal Study Execution", routeNavId: "execution",
    plainSummary: "管理授權範圍內的研究活動與原始資料來源。",
    expectedOutputs: "執行紀錄與 Raw Data 來源；不自動生成參與者。",
    whenToUse: "倫理通過且前導就緒，開始正式收案／實驗並留存原始資料時。",
    requiredInputs: ["IRB 核准文件", "鎖定的正式執行 SOP"],
    steps: ["追蹤收案與樣本", "記錄異常與脫落", "封存 Raw Data 並產生版本記錄"],
    saveLocation: "執行紀錄與原始資料封存 (research_execution_records)",
    nextModuleId: "governance",
    limitations: "嚴禁捏造或虛構受試者資料；系統不自動生成參與者。",
    actionLabel: "管理正式執行", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["正式研究", "收案", "執行", "實驗", "資料收集"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  /* ---------------- 資料與分析 ---------------- */
  governance: {
    moduleId: "governance", groupId: "analysis", displayName: "資料治理",
    englishSub: "Data Governance", routeNavId: "governance",
    plainSummary: "在保留原始資料的前提下，整理出可追溯的分析資料集。",
    expectedOutputs: "清理規則、資料字典、Analysis Dataset 與來源鏈。",
    whenToUse: "取得原始資料後，想在不改動原檔下建立乾淨、有紀錄的分析用資料時。",
    requiredInputs: ["原始資料檔與來源說明", "變項定義或資料字典起點"],
    steps: ["界定變項與清理規則", "建立資料字典與來源對應", "產出有版本的 Analysis Dataset"],
    saveLocation: "資料治理與分析資料集 (data governance records)",
    nextModuleId: "analysis-lab",
    limitations: "治理不竄改原始檔；任何清理都需可追溯且可重現。",
    actionLabel: "整理分析資料", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["資料治理", "資料清理", "資料字典", "analysis dataset", "整理資料"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "analysis-lab": {
    moduleId: "analysis-lab", groupId: "analysis", displayName: "分析實驗室",
    englishSub: "Analysis Lab", routeNavId: "analysis-lab",
    plainSummary: "依分析計畫處理真實資料，保存可重現的結果與圖表。",
    expectedOutputs: "分析紀錄、結果與圖表；無資料不產生正式結果。",
    whenToUse: "有乾淨分析資料，要正式跑統計／質性分析並保留可重現腳本時。",
    requiredInputs: ["Analysis Dataset", "已核定的研究設計／分析計畫"],
    steps: ["載入分析資料與計畫", "執行分析並保存腳本與輸出", "核對結果與圖表後歸檔"],
    saveLocation: "分析結果與圖表 (analysis records)",
    nextModuleId: "manuscript",
    limitations: "沒有真實資料不自動生成結果；分析需對應事前計畫避免事後挑結果。",
    actionLabel: "執行分析", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["分析研究資料", "跑分析", "統計", "分析結果", "圖表", "數據分析"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  /* ---------------- 寫作與品質 ---------------- */
  manuscript: {
    moduleId: "manuscript", groupId: "writing", displayName: "全文協作",
    englishSub: "Manuscript Studio", routeNavId: "manuscript",
    plainSummary: "用文獻、方法與真實結果逐章建立或修訂論文全文。",
    expectedOutputs: "章節版本、數值與引用可追溯；草稿不等於正式送件。",
    whenToUse: "資料與結果就緒後，開始組裝論文各章或修改現有稿件時。",
    requiredInputs: ["方法與真實結果", "文獻與引用（可由證據中心帶入）", "（選用）既有稿件"],
    steps: ["選擇或上傳稿件／章節", "逐章依證據撰寫或修訂", "儲存草稿版本並追蹤引用"],
    saveLocation: "全文章節與版本（manuscript versions）",
    nextModuleId: "scientific-review",
    limitations: "作者對稿件內容與真實性負責；草稿版本不等於已投稿或已接受。",
    actionLabel: "撰寫或修訂全文", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["撰寫或修訂論文", "論文", "全文", "稿件", "manuscript", "寫論文"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "scientific-review": {
    moduleId: "scientific-review", groupId: "writing", displayName: "自稿科學審查",
    englishSub: "Scientific Self-review", routeNavId: "scientific-review",
    plainSummary: "從模擬審查者角度檢查自己的研究與論述。",
    expectedOutputs: "問題、證據缺口與修訂任務；不是期刊官方意見。",
    whenToUse: "投稿前想用審查者視角自我檢查稿件一致性與證據是否充分時。",
    requiredInputs: ["稿件全文", "方法與結果描述"],
    steps: ["以研究問題為中心檢視稿件", "標出證據／論述風險", "整理成修訂任務清單"],
    saveLocation: "自稿審查紀錄 (scientific reviews)",
    nextModuleId: "reviewer",
    limitations: "模擬審查不保證符合目標期刊或審稿人實際意見。",
    actionLabel: "執行自稿審查", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["自稿審查", "審稿", "模擬公審", "檢查論文", "self-review"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "language-center": {
    moduleId: "language-center", groupId: "writing", displayName: "翻譯與學術潤稿",
    englishSub: "Academic Language", routeNavId: "language-center",
    plainSummary: "改善中英文表達，同時保留數字、術語與引用原意。",
    expectedOutputs: "對照稿、術語與修訂版本；不保證投稿接受。",
    whenToUse: "要把段落中翻英、潤飾英文、或只想處理語言不重跑研究流程時。",
    requiredInputs: ["待翻譯或潤稿文字（可直接輸入）", "研究領域或術語偏好（選用）"],
    steps: ["貼入草稿或從全文帶入", "選擇翻譯／潤稿模式", "檢視對照與修訂後採納"],
    saveLocation: "語言工單版本（可達獨立工具工作區）",
    nextModuleId: "submission-gate",
    limitations: "獨立工具可不用完整研究流程開啟；明示保存位置，不把文字自動當正式證據。",
    actionLabel: "翻譯與潤稿", standaloneSupported: true, capabilityNeed: "PROJECT_OR_STANDALONE",
    status: "AVAILABLE",
    synonyms: ["翻譯", "中翻英", "潤稿", "英文修改", "語言", "translation"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  /* ---------------- 投稿與修訂 ---------------- */
  "submission-gate": {
    moduleId: "submission-gate", groupId: "submission", displayName: "最終投稿規範與文件",
    englishSub: "Submission Gate & Package", routeNavId: "submission-gate",
    plainSummary: "依期刊當下規範核對主文、聲明與附件。",
    expectedOutputs: "投稿包與缺漏清單；只有真實回執才算已投稿。",
    whenToUse: "全文就緒、準備上傳期刊系統前，做最終合規檢查時。",
    requiredInputs: ["定稿全文", "作者與利益衝突等宣告、Cover Letter"],
    steps: ["依目標期刊最新規範逐項核對", "組裝投稿包與附件", "標註待作者送出的項目"],
    saveLocation: "送件閘門與申請包紀錄 (submission gates, application packages)",
    nextModuleId: "journals",
    limitations: "系統給核對清單；實際送件與回執以期刊官方系統為準。",
    actionLabel: "檢查投稿包", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["投稿規範", "投稿包", "Cover Letter", "送件清單", "最終投稿"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  journals: {
    moduleId: "journals", groupId: "submission", displayName: "投稿文件與投遞追蹤",
    englishSub: "Journal Application & Tracking", routeNavId: "journals",
    plainSummary: "管理實際投稿文件與期刊投遞狀態追蹤。",
    expectedOutputs: "投遞資料與當前狀態；只有真實回執才算已投稿。",
    whenToUse: "準備向期刊正式送件並記錄其後續審查狀態時。",
    requiredInputs: ["投稿包內容", "目標期刊"],
    steps: ["整理投遞表單資料", "送出或記錄送件（以官方回執為準）", "追蹤 Review／Decision 狀態"],
    saveLocation: "期刊投稿與追蹤紀錄 (journal submissions)",
    nextModuleId: "reviewer",
    limitations: "投遞以官方回執為準，網站不冒充投稿成功。",
    actionLabel: "管理投稿與追蹤", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["投稿追蹤", "送件", "投期刊", "journal submission"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  reviewer: {
    moduleId: "reviewer", groupId: "submission", displayName: "Reviewer 回覆與修訂",
    englishSub: "Reviewer Response & Revision", routeNavId: "reviewer",
    plainSummary: "拆解真實審查意見，追蹤逐條修訂與回覆。",
    expectedOutputs: "回覆矩陣、修訂稿與版本位置。",
    whenToUse: "收到期刊編輯部 Major/Minor Revision 意見，需逐條回覆時。",
    requiredInputs: ["Decision Letter 與審查意見原文"],
    steps: ["把意見拆成逐條項目", "撰寫禮貌且點對點的回覆與修改位置", "產出乾淨與標註修訂版本"],
    saveLocation: "審查回覆工作區 (review workspaces)",
    nextModuleId: undefined,
    limitations: "回覆請基於真實修改；作者對提供給系統的審稿內容負責。",
    actionLabel: "拆解並回覆", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["Reviewer", "審查意見", "回覆信", "Author Response", "返修"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  "application-package": {
    moduleId: "application-package", groupId: "submission", displayName: "投稿文件與包組裝",
    englishSub: "Application Package Studio", routeNavId: "application-package",
    plainSummary: "把投稿或申請所需主文、聲明與附件組裝成一整包文件。",
    expectedOutputs: "投稿／申請包與缺漏清單；只有真實回執才算已送出。",
    whenToUse: "主文與附件就緒，要打包成一份可檢查、可送出的完整文件組時。",
    requiredInputs: ["定稿主文或計畫內容", "作者與附件檔案（Cover letter、聲明等）"],
    steps: ["選定目標（投稿或申請路線）", "逐項填入並上傳附件", "產出文件包與缺漏清單"],
    saveLocation: "投稿／申請包紀錄（application packages）",
    nextModuleId: "journals",
    limitations: "僅協助組裝與檢查，實際投遞與回執以官方系統為準。",
    actionLabel: "組裝文件包", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["投稿包", "附件", "聲明", "Cover Letter", "application package"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
  "review-compliance": {
    moduleId: "review-compliance", groupId: "submission", displayName: "投稿規範與退修合規",
    englishSub: "Submission Compliance & Re-registration", routeNavId: "review-compliance",
    plainSummary: "依期刊或申請規範核對是否符合要求、並處理退修合規事項。",
    expectedOutputs: "合規核對與退修事項清單；不冒充官方核定。",
    whenToUse: "被要求補資料、格式不合規或退修(Revise)需重新核對規範時。",
    requiredInputs: ["目標規範或退修意見", "目前稿件／文件狀態"],
    steps: ["載入目標規範與現況", "逐項核對合規與缺項", "標記待處理的退修或補件"],
    saveLocation: "合規與退修紀錄（review compliance records）",
    nextModuleId: "reviewer",
    limitations: "提供核對與管理，正式合規與否由目標期刊／機構判定。",
    actionLabel: "核對投稿合規", standaloneSupported: false, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["退修", "規範核對", "合規", "補件", "compliance"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },

  /* ---------------- 共用 ---------------- */
  trash: {
    moduleId: "trash", groupId: "shared", displayName: "回收筒",
    englishSub: "Trash & Recovery", routeNavId: "trash",
    plainSummary: "安全存放已刪除專案，提供復原或徹底清除管理。",
    expectedOutputs: "回收筒內的專案清單；可復原或永久清除，皆顯示真實狀態。",
    whenToUse: "誤刪或想停止某專案、日後可能復原時。",
    requiredInputs: ["「刪除本專案（移至回收筒）」需輸入真實專案名稱再確認"],
    steps: ["在首頁危險區將專案移入回收筒", "於回收筒查看與管理", "點選復原或永久清除"],
    saveLocation: "資料庫軟刪除記錄（projects.trashed_at）",
    nextModuleId: undefined,
    limitations: "復原不會自動重啟外部任務；刪除不影響共用文獻與 Zotero 收藏。",
    actionLabel: "開啟回收筒", standaloneSupported: true, capabilityNeed: "PROJECT_REQUIRED",
    status: "AVAILABLE",
    synonyms: ["回收筒", "垃圾桶", "復原專案", "刪除復原", "trash"],
    helpVersion: "1.0.0", verifiedAt: "2026-09-05",
  },
};

/** 依群組取出模組清單（依群組 order 與模組出現順序排列）。 */
export function modulesForGroup(groupId: ModuleGroupId): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((m) => m.groupId === groupId);
}

/* ------------------------------------------------------------------ */
/* 六個使用者意圖入口（規格 §6）                                       */
/*   入口只引導到既有功能；涉及多個目的地的用「建議目的地」               */
/* ------------------------------------------------------------------ */

export type IntentId =
  | "inspiration"     // 找研究靈感
  | "literature-gap"  // 查文獻與找缺口
  | "proposal"        // 準備研究計畫
  | "analyze"         // 分析研究資料
  | "write"           // 撰寫或修訂論文
  | "translate";      // 翻譯與學術潤稿

export interface IntentEntry {
  intentId: IntentId;
  label: string;
  tagline: string;
  /** 主要目的地（導向既有功能 navId） */
  primaryNavId: string;
  /** 其他可行目的地（intent 入口「建議目的地」） */
  altModuleIds: string[];
}

export const INTENTS: IntentEntry[] = [
  {
    intentId: "inspiration", label: "找研究靈感",
    tagline: "從領域或關鍵字找機會，比較可以研究的題目。",
    primaryNavId: "radar",
    altModuleIds: ["radar", "one-click", "topic-lab"],
  },
  {
    intentId: "literature-gap", label: "查文獻與找缺口",
    tagline: "整理本專案文獻，了解已有成果與尚未解決的問題。",
    primaryNavId: "evidence",
    altModuleIds: ["evidence", "gap"],
  },
  {
    intentId: "proposal", label: "準備研究計畫",
    tagline: "選擇申請路線，整理國科會或教學實踐計畫內容。",
    primaryNavId: "navigator",
    altModuleIds: ["navigator", "route-workspace", "proposals"],
  },
  {
    intentId: "analyze", label: "分析研究資料",
    tagline: "檢查資料與分析計畫，再依計畫正式分析產出結果與圖表。",
    primaryNavId: "analysis-lab",
    altModuleIds: ["governance", "analysis-lab"],
  },
  {
    intentId: "write", label: "撰寫或修訂論文",
    tagline: "用證據與結果建立全文，或檢查自己的現有稿件。",
    primaryNavId: "manuscript",
    altModuleIds: ["manuscript", "scientific-review"],
  },
  {
    intentId: "translate", label: "翻譯與學術潤稿",
    tagline: "翻譯中英文與改善表達，保留數字、術語與引用原意。",
    primaryNavId: "language-center",
    altModuleIds: ["language-center"],
  },
];

export function findIntent(intentId: IntentId): IntentEntry | undefined {
  return INTENTS.find((i) => i.intentId === intentId);
}

/* ------------------------------------------------------------------ */
/* 同義詞搜尋（規格 §9）— 本地索引，不需付費 LLM                       */
/* ------------------------------------------------------------------ */

/** 依使用者輸入，回傳符合的模組。比對：名稱、同義詞、一句話用途、群組名。 */
export function searchModules(query: string): ModuleDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return Object.values(MODULE_REGISTRY);
  const haystacks = (m: ModuleDefinition): string[] => {
    const tokens = [
      m.displayName, m.englishSub ?? "", m.plainSummary,
      ...m.synonyms,
      MODULE_GROUPS[m.groupId]?.label ?? "",
    ].map((s) => (s ?? "").toLowerCase());
    return tokens;
  };
  const explicit = Object.values(MODULE_REGISTRY).filter((m) => {
    const nameHit = m.displayName.toLowerCase().includes(q) || (m.englishSub?.toLowerCase() ?? "").includes(q);
    const synonymHit = m.synonyms.some((s) => s.toLowerCase().includes(q));
    const summaryHit = m.plainSummary.toLowerCase().includes(q);
    const groupHit = (MODULE_GROUPS[m.groupId]?.label ?? "").toLowerCase().includes(q);
    return nameHit || synonymHit || summaryHit || groupHit;
  });
  if (explicit.length) return explicit;
  // 詞級比對：所有 token 拆詞，命中任一詞即算
  return Object.values(MODULE_REGISTRY).filter((m) =>
    haystacks(m).some((h) => h.split(/[\s、＃#/]+/).some((w) => w && q.includes(w) || w && w.includes(q))),
  );
}

/**
 * 給定一組建議同義詞，回傳「最像該意圖」的建議詞（用於搜尋無結果時的提示，規格 §9）。
 * 純提示用，不杜撰功能。
 */
export const SEARCH_SUGGESTION_WORDS: string[] = [
  "靈感", "文獻", "期刊", "翻譯", "缺口", "藍圖", "倫理", "分析", "論文", "回收筒",
];
