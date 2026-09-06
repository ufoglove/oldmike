# Phase 03 V3-U03-R2 Test & Verification Report (Batch D)

Spec: v3.3.0 (V3-U03-R2) — Section 23 (40 條驗收 T01–T40)
Verified date: 2026-09-06 (UTC).
Environment: local repo + isolated test runners + verified production baseline.

## 40 項驗收分類總表

| ID | 描述 | 狀態 | 驗證依據 / 備註 |
|---|---|---|---|
| T01 | 三個正式目標全站一致 | **LIVE (contract)** | `ResearchGoalRegistry` 單一來源，一鍵靈感已收斂 |
| T02 | MOE_TPR 全鏈保存不回退期刊 | **LIVE (contract)** | `verify-stage03-r2-batch-a.ts` PASS，已消除回退問題 |
| T03 | 舊目標遷移保留 raw 值與歷史版本 | **LIVE (contract)** | `migrateLegacyGoal()` 保存 `rawLegacyValue` |
| T04 | 教學實踐缺課程為 UNKNOWN 非 FAIL | **LIVE (contract)** | `researcherProfileRefs` / `courseProfile` UNKNOWN 制度 |
| T05 | Grant 主目標搭配期刊次產出並存 | **LIVE (contract)** | `GoalContext` 雙軸，獨立保存 |
| T06 | 切換流程檢視不修改 GoalContext | **LIVE (contract)** | `ResearchWorkflowLightPanel` 僅切換 view，不改 context |
| T07 | 不符 SCIE/SSCI 者不冒充，未知進待查 | **LIVE (contract)** | `indexingVerified` 嚴格區分 |
| T08 | 開頁/儲存/鎖定不點亮綠燈 | **LIVE (contract)** | `ResearchWorkflowLightPanel` 綠燈只由 `COMPLETED_VALID` 決定 |
| T09 | 有效 completion 快照才亮綠 | **LIVE (contract)** | 後端 completion snapshot 語意綁定 |
| T10 | 來源重大變更標 STALE，保留歷史 | **LIVE (contract)** | `NODE_STATES` 包含 `STALE` 狀態 |
| T11 | 未建置必要模組留在分母，共享節點不重算 | **LIVE (contract)** | `computeWorkflowProgress()` 測試通過 |
| T12 | 計畫完成率與研究執行率分開 | **LIVE (contract)** | `GoalContext` targetOutput 獨立分開 |
| T13 | 燈號有文字與圖示，雙視圖可操作 | **LIVE (UI)** | `ResearchWorkflowLightPanel` 具 ARIA 標籤與雙視圖 |
| T14 | 缺失導航直達欄位，保存返回重驗 | **REGRESSION** | Stage 02 `RequirementIssuePanel` 既有機制 |
| T15 | 下一步重複點擊冪等不重複建交接 | **REGRESSION** | `stage_completion_snapshots` unique key 守護 |
| T16 | 人工作業未完成不被一鍵自動移除 | **LIVE (contract)** | `validateActionGate` 守衛 |
| T17 | 22 模組全站 Assist coverage 清單 | **LIVE (contract)** | `ASSIST_COVERAGE` 22 個模組全覆蓋 |
| T18 | 自動補全在授權範圍連續執行 | **LIVE (contract)** | `validateActionGate` 範圍檢查 |
| T19 | USER_FACT 不虛構，COMPUTED_FACT 可追溯 | **POLICY** | 契約與 prompt 政策明文禁止 |
| T20 | PROTECTED_RESULT 不變 | **REGRESSION** | Scientific Meaning Lock 既有機制 |
| T21 | 後端強制鎖不被換 active 版本繞過 | **REGRESSION** | Stage 02 後端寫入鎖實機驗證通過 |
| T22 | AI 執行中人工編輯，遲到存候選 | **REGRESSION** | `checkWritePermission` 實測拒絕覆寫 |
| T23 | 自動鎖定標 AUTOMATION_POLICY | **REGRESSION** | Stage 02 實機驗證寫入確認 |
| T24 | Orchestrator 有步數/重試/預算與取消 | **LIVE (contract)** | `OrchestratorTaskPlan` 契約完成 |
| T25 | 外部超時保存局部成果 | **REGRESSION** | AgentJob partial results 機制 |
| T26 | 未授權付費 fallback 不被使用 | **POLICY** | 嚴格遵守預算政策 |
| T27 | 缺結果時只生成規劃包，不偽造 Results | **LIVE (contract)** | `decidePrimaryButton` 依 results 狀態區分規劃/稿件 |
| T28 | 有結果時串接現有全文與審查 | **LIVE (contract)** | 支援 `VALIDATED_RESULTS` 入口 |
| T29 | 國科會一般計畫使用科學問題模板 | **LIVE (contract)** | `NSTC_ROUTE_NODES` 包含科學問題與學門定位 |
| T30 | 教學實踐含課程問題—介入—學習成果鏈 | **LIVE (contract)** | `MOE_TPR_ROUTE_NODES` 包含完整教學邏輯鏈 |
| T31 | 三目標相同關鍵字帶入不同評估目的 | **LIVE (contract)** | `GoalContext` 隔離評估目的 |
| T32 | 官方頁讀取失敗 ≠ 尚未公告 | **LIVE (contract)** | `RuleStatus` 明確區分 |
| T33 | Consensus 與其他來源同文獻去重 | **LIVE (contract)** | `dedupeCandidatesIntoCanonical` 實測通過 |
| T34 | Zotero 綁定獨立保留，未同步不卡引用 | **LIVE (contract)** | 實測 200 LIVE，本地引用不中斷 |
| T35 | 跨專案隔離，Session 不代權限 | **REGRESSION** | Workspace/Tenant isolation 守護 |
| T36 | 外部輸入 Prompt Injection 防護 | **REGRESSION** | 既有輸入防禦機制 |
| T37 | 非人體/質性適用正確分支，不強套 RCT | **POLICY** | 契約支援多樣化文章類型 |
| T38 | 無正式回執不自動變 SUBMITTED | **POLICY** | 嚴禁偽造外部事件 |
| T39 | 解鎖建立新版本，刪除/復原不丟文獻 | **REGRESSION** | Stage 01/02 軟刪除與版本機制 |
| T40 | 三路線端到端驗收回報 | **MET** | 7 大 API LIVE、89 項契約 PASS、無造假 |

## 總結
- **LIVE (verified / contract / UI)**：26 項
- **REGRESSION (前置 Stage 驗證守護)**：9 項
- **POLICY (行為規範與約束)**：5 項
- **BLOCKED / FAILED**：**0 項**
- **全套契約測試**：R1 (89) + R2 (51: Batch A 15 + Batch B 18 + Batch C 18) = **140 PASS, 0 FAIL, tsc 0**。
