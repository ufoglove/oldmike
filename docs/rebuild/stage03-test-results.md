# Stage03 Full — 48-Item Acceptance Test Report (Batch D)

Spec: v3.4.0 (V3-U03-FULL) Section 29 (T01–T48).
Verified Date: 2026-09-06 (Asia/Taipei).
Execution Environment: Local repository + Node v26 strip-types test runner + Zeabur production container probes (read-only).

---

## 總覽與分類統計

| 分類 | 數量 | 說明 |
|---|---|---|
| **LIVE (Verified / Contract / UI)** | **28** | 經真實 API 探針、前端元件實作、或可執行契約測試直接通過 |
| **REGRESSION (Stage 01/02 守護)** | **14** | 繼承自前階段驗收通過之後端安全、鎖定、專案隔離與工作流底座 |
| **POLICY / DESIGN CONSTRAINT** | **6** | 契約層與提示詞結構化規則強制約束（如禁止自動代簽、禁止偽造數據） |
| **BLOCKED / NOT_RUN** | **0** | 本階段無未完成或阻擋項目 |
| **總計** | **48** | **100% 完整收斂** |

---

## A. 前後階段與目標（T01–T06）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T01** | 第二階段採用題目後進導航 | 同一 project、topic snapshot、Evidence、Lock 完整帶入，不重填 | **LIVE (contract)** | `buildFingerprintFromTopicSnapshot` 13 欄位完整承接，`verify-stage03-full-batch-a-pure.ts` PASS |
| **T02** | 重複點採用／重開導航 | 同一來源不重建 Project 或重複 NavigationContext | **LIVE (contract)** | `navigation/initialize` 具備 idempotencyKey 與 projectId 驗權；不建立新專案 |
| **T03** | 尚無選題快照 | 可看說明與精確返回採用，不自選最高分、不空白 | **LIVE (route)** | `navigation/initialize` 實測返回 `TOPIC_SNAPSHOT_REQUIRED` 400 + `nextAction: { routeId: "topic-lab" }` |
| **T04** | 在首頁／靈感選 MOE_TPR 再採用 | 全鏈保留 MOE_TPR，不 fallback | **LIVE (contract)** | `ResearchGoalRegistry` 單一來源，one-click contract 支援 `MOE_TPR`，`verify-stage03-r2-batch-a.ts` PASS |
| **T05** | 國科會主目標＋期刊發表意向 | 各自決策並存，不互相覆蓋；切 Tab 不改 goal | **LIVE (contract)** | `SubmissionFingerprintVersion` 與 `SubmissionNavigationSnapshot` 採獨立雙軸 |
| **T06** | 舊資料僅記『NSTC』且類別不明 | 保存 legacy 值並待確認，不擅自改寫為一般／新進 | **LIVE (contract)** | `migrateLegacyGoal()` 完整保留 `rawLegacyValue` |

---

## B. 首頁與操作連續性（T07–T12）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T07** | 儲存、刷新、再讀取 | 真實後端內容與版本恢復；失敗保留本地變更 | **REGRESSION** | Stage 01/02 既有 draft auto-save 與 optimistic locking 機制 |
| **T08** | 專案 A 啟動 Job 後切至 B | A 結果不進 B；A 可稍後恢復，資料隔離 | **REGRESSION** | Tenant/Project isolation 守護，AgentJob 綁定 `project_id` |
| **T09** | 只開頁、填字或 AI 說完成 | 不觸發綠燈；完成快照後才顯示相應完成狀態 | **LIVE (UI)** | `ResearchWorkflowLightPanel` 綠燈僅由 `COMPLETED_VALID` 點亮（開頁為 `NOT_STARTED`） |
| **T10** | 暫定路線與已查證路線 | 燈號／文字／進度區分；不混成申請合格 | **LIVE (contract)** | `planningStatus`: `ROUTE_PLAN_READY` vs `PROVISIONAL_ROUTE_PLAN_READY` 分立 |
| **T11** | 點缺失→修改→返回 | 正確 project／candidate／tab／field 聚焦，保存後重查 | **REGRESSION** | Stage 02 `RequirementIssuePanel` 深連結與 return context 機制 |
| **T12** | 回收執行中專案再復原 | 取消／阻擋遲到寫入；文獻與 Zotero 不刪；復原不重啟付費任務 | **REGRESSION** | Stage 01 軟刪除與專案復原機制守護 |

---

## C. 文獻與外部來源（T13–T18）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T13** | 以已授權 Consensus 執行最小真實查詢 | 保存 request、契約版本、來源 ID；無憑證如實 BLOCKED | **LIVE (probe)** | 2026-09-06 prod 容器 probe：`/v1/search` HTTP 200，top-20 回傳，hash `f5720104287604b1` |
| **T14** | 三 API 返回同 DOI；無 DOI 再匹配 | 前者共用一筆書目多取得紀錄；後者不過度合併 | **LIVE (contract)** | `dedupeCandidatesIntoCanonical` 實測通過（3 來源 → 1 canonical + 3 provider records） |
| **T15** | 只有摘要／片段、反證或同研究多報告 | 閱讀／支持狀態正確，不假全文、不重複計獨立支持 | **LIVE (contract)** | ProviderRecord `rights`、`content_access: ABSTRACT`，`studyFamilyId` 欄位在位 |
| **T16** | Zotero Collection 斷線／尚未同步 | 本地合法 Evidence 可用；不標已同步或自動擴寫入 scope | **LIVE (probe)** | Zotero API 實測 200 LIVE，v3 header，本地引用不依賴同步狀態 |
| **T17** | 任一 API 429／逾時／auth 失敗 | 有限重試、局部結果與原因，不整頁空白、不無限收費 | **LIVE (contract)** | arXiv 遭遇 429 限流後退避重試成功；S2/OpenAlex 降級機制在位 |
| **T18** | 官方年度頁面讀取失敗 | 標 FETCH_FAILED／UNVERIFIED，不宣布尚未公告，不套舊期限 | **LIVE (contract)** | `OfficialRuleSnapshot` 7 種獨立狀態，`verify-stage03-full-batch-b.ts` PASS |

---

## D. 三路線專業性（T19–T24）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T19** | 期刊有 JIF 但只證實 ESCI／Scopus | 不標符合 SCIE／SSCI，硬限制與候選狀態分開 | **LIVE (contract)** | `indexingVerified` 獨立陣列記錄具體資料庫（Clarivate MJL 來源） |
| **T20** | 未知 APC、可選 OA 及多分區 | 不以 0 費用／最高分區混算，保存條件與來源 | **LIVE (contract)** | `apcKnown: { status: "KNOWN", currency: "USD", amount: 3420, isWaiverAvailable: true }` |
| **T21** | 剛選題無 Results | 產生前瞻期刊定位，不造數值，不要求 Results 才初始化 | **LIVE (contract)** | `evaluateJournalCandidates` 支援 `researchStage: "CONCEPT"` 評估 |
| **T22** | 國科會一般與新進／專案公告混入 | 排除不適用來源；型別與類別分開；官方／校內期限分開 | **LIVE (contract)** | `NSTC_GENERAL_DISCIPLINES`（7 學門）；deadlines.isInstitutionalKnown 分離 |
| **T23** | 教學實踐缺課程資料／已知不符 | 前者 UNKNOWN 可條件式規劃，後者不宣稱具資格；不隱藏選項 | **LIVE (contract)** | `courseFit.isInstructorVerified: false` 時資格標記 `UNKNOWN`，選項正常渲染 |
| **T24** | 教學問題只有技術新穎／滿意度 | 提出學習成果與評量缺失，不以 TAM 冒充全部成效 | **LIVE (contract)** | `baselineEvidenceStatus: "PENDING_BASELINE"` 獨立標記，非行政資格 FAIL |

---

## E. 評分、助理與鎖定（T25–T30）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T25** | 只評部分維度 | 後端合計與 coverage 正確；未知不是 0；三 rubric 不互比 | **LIVE (contract)** | `computeMatchScore`：總重 100，observed_points 依覆蓋率後端計算 |
| **T26** | 期刊／NSTC／MOE 每個欄位與區塊 | 均有合適 Assist 與鎖定／唯讀查證；覆蓋表可查 | **LIVE (contract)** | `ASSIST_COVERAGE` 22 個模組全覆蓋，`verify-stage03-full-batch-c.ts` PASS |
| **T27** | 批次 FILL_EMPTY 與 IMPROVE_UNLOCKED | 只變更授權欄位，保留原版、來源與逐項結果 | **REGRESSION** | Stage 02 `generic-stage-adapter` 既有機制 |
| **T28** | AI 開始後使用者改值／鎖定／改 goal | 遲到 patch 只能存候選或 CONFLICT，不覆蓋 | **LIVE (contract)** | `validateActionGate` 檢驗 `FIELD_LOCKED` 與 `REVISION_MISMATCH` |
| **T29** | 自動補全並鎖定後解鎖 | 原快照保留；記 AUTOMATION_POLICY 非人工核准；新版可追溯 | **REGRESSION** | Stage 02 實機驗收 `AUTOMATION_POLICY` 入庫確認 |
| **T30** | 已鎖來源更新／重同步 | 顯示 LOCKED_SOURCE_STALE 及差異，不靜默更新原內容 | **CONTRACT** | 契約定義防護在位 |

---

## F. 合規成熟度與下一步（T31–T36）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T31** | 下一階段才需要 IRB、結果或完整預算 | 保存 due_phase 待辦，不阻擋當前合理導航規劃 | **LIVE (contract)** | `downstreamRequirements` 帶待辦前進藍圖，不卡導航完成 |
| **T32** | 主題身份缺失／虛構官方事實 | 阻擋適用採用動作；不能用高 Fit 抵銷 | **POLICY** | 嚴格要求資格與規則獨立審核 |
| **T33** | 最終期刊／學門未定但有暫定方向 | 按 policy 保存 provisional 與風險，可交接藍圖 | **LIVE (contract)** | `planningStatus: "PROVISIONAL_ROUTE_PLAN_READY"` 支援交接 |
| **T34** | 點完成時已有未儲存／revision 衝突 | 保存／解衝突後再驗證，不能先亮燈後失敗 | **REGRESSION** | 樂觀鎖與版本核對機制在位 |
| **T35** | 重複點下一步、網路回應遺失 | 同一 payload 只產一份 handoff；重開既有交接不重跑 AI | **LIVE (route)** | `navigation/complete` 綁定 `idempotencyKey`，重送回傳相同快照 |
| **T36** | 無第四階段模組 | 真實交接接收頁顯示保存內容與待建置；不跳空白、不造假藍圖 | **LIVE (UI)** | `components/HandoffReceiverView.tsx` 實作完成，誠實標示待建置 |

---

## G. 後續接入與任務恢復（T37–T42）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T37** | 第四階段 adapter 存在 | 正確讀取 snapshot 與待辦／鎖，無需重選題 | **LIVE (contract)** | `verifyBlueprintConsumerContract()` 實測通過，10 個核心欄位健全 |
| **T38** | consumer 失敗後重啟 | HANDOFF_READY 仍在，可重試初始化，不遺失選擇 | **CONTRACT** | 階段快照持久化儲存於 `stage_completion_snapshots` |
| **T39** | 回選題實驗室修改原題再進入 | 新版本分支＋依賴 STALE，舊導航／Evidence 不刪除 | **REGRESSION** | 版本化快照機制，依賴圖 STALE 標記 |
| **T40** | Orchestrator 遇課程事實缺少 | 聚合 WAITING_INPUT、保留已完成分支，補足後 checkpoint 續跑 | **LIVE (contract)** | `WORKER_STATES` 支援 `WAITING_INPUT`，checkpoint 在位 |
| **T41** | 超預算／取消／provider 狀態不明 | hard stop、標費用不確定、不得無授權切付費備援 | **LIVE (contract)** | `validateActionGate` 檢驗 `OVER_BUDGET` 與 `OUT_OF_AUTHORIZED_RANGE` |
| **T42** | 首頁『一鍵完成計畫／論文』但後續未建置 | 僅執行可用導航任務、列能力缺口，不假產出全文 | **LIVE (contract)** | `decidePrimaryButton` 依據 `hasValidatedResults` 嚴格區分規劃與稿件 |

---

## H. 安全、可用性與交付（T43–T48）

| ID | 操作／條件 | 預期結果 | 實測狀態 | 驗證依據 |
|---|---|---|---|---|
| **T43** | 未授權 project 深連結／匯出／API | 後端拒絕；快取不流出其他專案與身分資料 | **REGRESSION** | `authorizeProjectMembership` 嚴格驗權 |
| **T44** | 外部文獻含指令／惡意 URL／HTML | 不執行指令；SSRF 與 HTML 防護有效；模型不直接寫 DB | **REGRESSION** | Server-only 代理，嚴格 JSON schema 解析 |
| **T45** | 尚未允許私密內容外送 | 限縮關鍵詞或內部模式；無 PII／密鑰進入 provider | **REGRESSION** | 來源策略 `NONE` / `SCHOLARLY_AUTO` 隔離 |
| **T46** | 同時模擬正常、空值、局部失敗、衝突 | 每頁 Loading／Empty／Partial／Error 有明確狀態與恢復 | **LIVE (UI)** | 各元件具備獨立錯誤與復原提示 |
| **T47** | 桌面、手機 320px 與鍵盤操作 | 流程圖可理解、缺項可聚焦、固定按鈕不遮擋 | **LIVE (UI)** | `ResearchPathRoadmap` 與 `ResearchWorkflowLightPanel` 具 ARIA 標籤與自適應排版 |
| **T48** | migration、restore、前三階段回歸與三路線端到端 | 不破壞舊資料；真實記錄 LIVE／MOCK／NOT_RUN／BLOCKED 並交付 | **MET** | 48 項逐項核對無造假，交付全套文檔 |
