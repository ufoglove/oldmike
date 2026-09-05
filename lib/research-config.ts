export type StageState = "done" | "active" | "locked";

export type Stage = {
  id: `S${number}`;
  short: string;
  title: string;
  state: StageState;
};

export const stageDefinitions = [
  { id: "S0", key: "S0_INTAKE", short: "01", title: "選題啟動", state: "done" },
  { id: "S1", key: "S1_SCOUT", short: "02", title: "投稿與計畫導航", state: "locked" },
  { id: "S2", key: "S2_QUESTION", short: "03", title: "文獻與研究設計", state: "locked" },
  { id: "S3", key: "S3_DESIGN", short: "04", title: "理論與機制", state: "locked" },
  { id: "S4", key: "S4_EXECUTE", short: "05", title: "執行與統計", state: "locked" },
  { id: "S5", key: "S5_ANALYZE", short: "06", title: "結果確認", state: "locked" },
  { id: "S6", key: "S6_WRITE", short: "07", title: "全文", state: "locked" },
  { id: "S7", key: "S7_SUBMIT", short: "08", title: "老麥審查", state: "locked" },
  { id: "S8", key: "S8_REVISE", short: "09", title: "正式送件", state: "locked" },
  { id: "S9", key: "S9_ARCHIVE", short: "10", title: "封存與結案", state: "locked" },
] as const satisfies readonly (Stage & { key: string })[];

export type ResearchPathStation = {
  key: string;
  title: string;
  navId: string;
  stage: ProjectStageId;
  note: string;
};

export const researchPathStations = [
  { key: "station-radar", title: "前沿雷達", navId: "radar", stage: "S0", note: "探索升溫方向" },
  { key: "station-inspiration", title: "一鍵靈感", navId: "one-click", stage: "S0", note: "快速產生候選方向" },
  { key: "station-topic-lab", title: "選題實驗室", navId: "topic-lab", stage: "S0", note: "驗證並鎖定題目" },
  { key: "station-navigator", title: "投稿與計畫導航", navId: "navigator", stage: "S1", note: "選刊、選門與資格對照" },
  { key: "station-literature-design", title: "文獻與研究設計", navId: "evidence", stage: "S2", note: "證據與研究設計" },
  { key: "station-theory", title: "理論與機制", navId: "theory", stage: "S3", note: "核心理論與機制模型" },
  { key: "station-design", title: "研究設計", navId: "design", stage: "S4", note: "研究設計與分析計畫" },
  { key: "station-analysis", title: "執行與統計", navId: "analysis", stage: "S4", note: "資料與分析" },
  { key: "station-manuscript", title: "全文", navId: "outputs", stage: "S6", note: "計畫書／論文" },
  { key: "station-review", title: "老麥審查", navId: "reviewer", stage: "S7", note: "審稿與返修" },
  { key: "station-submission", title: "正式送件", navId: "submission-gate", stage: "S8", note: "送件前總檢查" },
] as const satisfies readonly ResearchPathStation[];

export function stageNumberFromKey(stageKey: string): string {
  const match = /^S(\d)/.exec(stageKey);
  return match ? match[1] : "0";
}

export type ProjectStageId = (typeof stageDefinitions)[number]["id"];
export type ProjectStageKey = (typeof stageDefinitions)[number]["key"];
export const projectStageIds = stageDefinitions.map(({ id }) => id) as ProjectStageId[];
export const projectStageKeys = stageDefinitions.map(({ key }) => key) as ProjectStageKey[];

export type NavigationItem = {
  icon: string;
  label: string;
  prompt: string;
};

export const canonicalDomains = [
  "AI × 教育",
  "AI × 職業安全與教育訓練",
  "AI × 環境工程與環境資源管理",
  "AI × 能源跨領域應用",
  "AR/VR/XR × 教育",
  "AR/VR/XR × 職業安全與教育訓練",
] as const;

export type CanonicalDomain = (typeof canonicalDomains)[number];

export const outputTrackIds = ["NSTC", "MOE", "SCI", "SSCI"] as const;
export type OutputTrackId = (typeof outputTrackIds)[number];

export type OutputTrack = {
  id: OutputTrackId;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  prompt: string;
};

export type DomainArea = {
  code: string;
  title: CanonicalDomain;
  detail: string;
  tone: string;
};

export const stages = stageDefinitions;

export const navigation: NavigationItem[] = [
  { icon: "grid", label: "研究總覽", prompt: "請整理目前研究專案的 stage、證據健康度、阻塞項與唯一下一步。" },
  { icon: "spark", label: "選題實驗室", prompt: "請啟動 topic-innovation-lab，從真實問題、研究對象、可用資源與預期成果開始。" },
  { icon: "search", label: "前沿雷達", prompt: "請啟動 horizon-scan，先定義時間窗、資料庫與查證範圍，再整理最新前沿與爭議。" },
  { icon: "book", label: "證據中心", prompt: "請檢查目前 evidence ledger，整理 claim、來源、驗證日期、矛盾與缺口。" },
  { icon: "flask", label: "研究設計", prompt: "請檢查目前研究問題是否足以進入 study-design，列出 estimand、偏誤、倫理與資料 gate。" },
  { icon: "chart", label: "分析工作室", prompt: "請檢查 analysis plan、資料字典、缺失值、主要分析與敏感度分析是否完整。" },
  { icon: "file", label: "計畫與論文", prompt: "請依目前 project state 判斷可進入的 NSTC、MOE、SCI 或 SSCI 產出階段，不要跳過上游 gate。" },
];

export const quickPrompts: Array<[string, string]> = [
  ["建立新研究", "請啟動 project-init，從我的專業背景建立一個新研究專案。先盤點必要資訊，不要自行假設。"],
  ["評估研究缺口", "請依目前專案的證據庫執行 gap-novelty，區分已驗證證據、推論與待查證項目。"],
  ["規劃 NSTC 計畫", "請檢查目前專案是否具備進入 NSTC proposal 階段的條件，列出缺失與唯一建議下一步。"],
  ["規劃教育部計畫", "請先確認我適用的教育部計畫類型與最新徵件，再檢查目前專案進入 MOE proposal 階段的條件；不得套用未核驗的固定格式。"],
];

export const outputTracks: OutputTrack[] = [
  { id: "NSTC", title: "國科會計畫", subtitle: "研究創新與方法嚴謹", description: "以科學問題、原創性、研究設計、可行性與預期貢獻建立競爭力。", icon: "國", prompt: "以國科會專題研究計畫為目標" },
  { id: "MOE", title: "教育部計畫", subtitle: "教學實踐與人才培育", description: "依確切徵件處理教學成效、人才培育、KPI、執行治理與永續擴散。", icon: "教", prompt: "以教育部計畫為目標，先確認確切徵件類型" },
  { id: "SCI", title: "SCI 國際期刊", subtitle: "技術、實證與機制", description: "建立可重現方法、可靠分析、機制解釋與對國際研究前沿的貢獻。", icon: "S", prompt: "以 SCI original research article 為目標" },
  { id: "SSCI", title: "SSCI 國際期刊", subtitle: "理論、行為與社會影響", description: "強化理論定位、構念與機制、研究設計，以及教育與組織情境的外部效度。", icon: "SS", prompt: "以 SSCI original research article 為目標" },
];

export const domainAreas: DomainArea[] = [
  { code: "AI·EDU", title: "AI × 教育", detail: "學習成效、適性學習、教師協作與教育治理", tone: "teal" },
  { code: "AI·OSH", title: "AI × 職業安全與教育訓練", detail: "風險辨識、行為改變、人因與訓練移轉", tone: "amber" },
  { code: "AI·ENV", title: "AI × 環境工程與環境資源管理", detail: "環境預測、污染治理、資源配置與決策", tone: "blue" },
  { code: "AI·ENE", title: "AI × 能源跨領域應用", detail: "需求預測、效率最佳化、韌性與淨零轉型", tone: "olive" },
  { code: "XR·EDU", title: "AR/VR/XR × 教育", detail: "沉浸學習、認知負荷、臨場感與知識移轉", tone: "violet" },
  { code: "XR·OSH", title: "AR/VR/XR × 職業安全與教育訓練", detail: "危害模擬、應變決策、技能保留與真實移轉", tone: "rust" },
];
