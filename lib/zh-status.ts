// 全站狀態值 → 專業中文顯示（純顯示層；DB/契約值不變）
const ZH_STATUS: Record<string, string> = {
  // 通用
  LOCKED: "已鎖定", UNLOCKED: "未鎖定", DRAFT: "草稿", APPROVED: "已核准", ACTIVE: "啟用中",
  REJECTED: "已拒絕", PENDING: "待處理", EXPIRED: "已過期", OUTDATED: "已過時", SUPERSEDED: "已被取代",
  INVALIDATED: "已失效", CANCELLED: "已取消", PAUSED: "已暫停", REVOKED: "已撤銷", ARCHIVED: "已封存",
  // 分析執行
  NOT_READY: "未就緒", REVIEW_REQUIRED: "需複核", BLOCKED_BY_DATA: "受資料阻擋", BLOCKED_BY_PLAN: "受計畫阻擋",
  BLOCKED_BY_PERMISSION: "受權限阻擋", READY_FOR_AUTHORIZATION: "可授權", AUTHORIZED: "已授權",
  IN_PROGRESS: "進行中", COMPLETED: "已完成", FAILED: "失敗", QUEUED: "排隊中", RUNNING: "執行中",
  VALID: "有效", VALID_WITH_WARNING: "有效但有警告", INVALID: "無效", NOT_REVIEWED: "未審查",
  FROZEN: "已凍結", NOT_FROZEN: "未凍結", READY: "就緒", READY_WITH_WARNINGS: "就緒但有警告",
  REQUIRES_DATASET_REVISION: "需資料集修訂", BLOCKED: "受阻擋",
  // 結果/事實
  CONFIRMATORY: "確認性", SECONDARY_CONFIRMATORY: "次要確認性", EXPLORATORY: "探索性",
  POST_HOC: "事後分析", NOT_APPLICABLE: "不適用", SUPPORTED: "獲得支持", NOT_SUPPORTED: "未獲支持",
  PARTIALLY_SUPPORTED: "部分支持", MIXED: "結果混合", INCONCLUSIVE: "尚無定論", NOT_TESTED: "未檢驗",
  ANSWERED: "已回答", PARTIALLY_ANSWERED: "部分回答", NOT_ANSWERED: "未回答", NOT_ANALYZED: "未分析",
  DATA_UNAVAILABLE: "資料不可得", METHOD_LIMITATION: "方法限制",
  PRIMARY_CONFIRMATORY: "主要確認性",
  // 章節/段落
  NOT_STARTED: "未開始", OUTLINE_READY: "大綱就緒", EVIDENCE_ASSEMBLED: "證據已彙整",
  CLAIMS_NEED_EVIDENCE: "主張待證據", RESULTS_INCONSISTENT: "結果不一致", USER_REVIEW_REQUIRED: "需使用者複核",
  SUBMITTED: "已送出",
  // 分析門檻/狀態
  SCOPE_SETUP: "範圍設定", STORYLINE: "故事線", WRITING_PLAN: "寫作計畫", STORYBOARD: "結果故事板",
  WRITING: "寫作中", CONSISTENCY_CHECK: "一致性檢查", VALIDATION_REQUIRED: "需驗證",
  V1_SCIENTIFIC_DRAFT: "v1 科學草稿", REVIEW_READY: "可審查", RESULTS_LOCKED: "結果已鎖定",
  RESULTS_FROZEN: "結果已凍結", NOT_FROZEN_RESULTS: "結果未凍結",
  PASS: "通過", PASS_WITH_WARNINGS: "通過但有警告", FAIL: "未通過", WARN: "警告", PENDING_CHECK: "待檢查",
  OPEN: "開啟", UNDER_REVIEW: "審查中", DISCLOSED: "已揭露", RESOLVED: "已解決",
  INCLUDED: "已納入", EXCLUDED: "已排除", INCLUDED_PENDING: "待納入",
  ROBUST: "穩健", MOSTLY_ROBUST: "大致穩健", SENSITIVE: "敏感", INCONSISTENT: "不一致",
  NOT_ASSESSED: "未評估", SUPPORTED_BY_QUALITATIVE_EVIDENCE: "獲質性證據支持",
  REFINED: "已精煉", CONTRADICTED: "受反證", NEW_PROPOSITION_EMERGED: "浮現新命題",
  // 治理/政策
  POLICY_APPROVED: "政策已核准", POLICY_DRAFT: "政策草稿", RESTRICTED: "受限", SAFE: "安全",
  COMPLETE: "完整", BUILDING: "建置中", REVISION_REQUIRED: "需修訂",
  GUIDED_WRITING: "引導寫作", CO_WRITING: "協作寫作", EVIDENCE_TO_DRAFT: "證據轉草稿",
};

export function zhStatus(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const raw = String(value);
  return ZH_STATUS[raw] ?? raw;
}

export default zhStatus;
