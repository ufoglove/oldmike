# V3-U05-FULL 48 項驗收測試報告 (Stage 05 48-Item Acceptance Test Report)

**工程識別：V3-U05-FULL｜日期：2026-09-06｜版本：v3.4.0**

本報告紀錄 48 項標準驗收案例（Spec v3.4.0 §27）之真實測試執行結果。測試腳本位於 `scripts/verify-stage05-full-48-items.ts`。

## 一、驗收結果綜覽

- **總測試項目**：48 項
- **通過 (PASS)**：**48 項 (100%)**
- **失敗 (FAIL)**：0 項
- **阻礙 (BLOCKED)**：0 項
- **全專案編譯檢查**：`npx tsc --noEmit` **0 errors (exit code 0)**

---

## 二、六大面向逐項查核紀錄

### A. 前後階段與三目標（T01–T08）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T01 | 有效 BlueprintPlanningSnapshot 初始化 | INTEGRATION | FIXTURE | **PASS** | 沿用原 Project、Goal、RQ、EvidenceNeed，不要求使用者重新輸入 |
| T02 | 同一交接重複初始化 | UNIT | MOCK | **PASS** | 恢復同一工作區，版本與 ID 穩定，不重複建立付費 Job |
| T03 | 舊交接接收頁之筆記與待辦完整繼承 | INTEGRATION | FIXTURE | **PASS** | 晚期需求（如 IRB 送審）完整帶入 `downstreamRequirements` |
| T04 | 未支援之 schema 或跨專案 ID | UNIT | FIXTURE | **PASS** | 嚴格驗證來源，不符回傳錯誤並提供修復入口，不偷偷採用其他資料 |
| T05 | JOURNAL_SCI_SSCI 國際差異化模板 | UNIT | FIXTURE | **PASS** | 具備期刊專屬綜合，無事前假結果或偽造 p 值 (S1) |
| T06 | NSTC_GENERAL 科學問題與創新重點 | UNIT | FIXTURE | **PASS** | 聚焦科學重要性與跨領域價值，不因相同關鍵字私自更動學門 (S2) |
| T07 | MOE_TPR 貫穿全鏈，課堂基線缺漏標記 | INTEGRATION | FIXTURE | **PASS** | 缺課堂基線誠實標記 `PENDING_BASELINE_TASK`，不編造學生成績 (S3) |
| T08 | 計畫與期刊視圖共用文獻但保留各自判準 | UNIT | FIXTURE | **PASS** | 切換 Tab 不改 primary_goal，各自完成狀態獨立維護 |

### B. 檢索、API 與去重（T09–T16）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T09 | EvidenceNeed 產生寬/精確/反證任務 | INTEGRATION | FIXTURE | **PASS** | 強制產生反證查詢任務（COUNTEREVIDENCE），保存查詢語法 |
| T10 | Consensus 正式參與檢索計畫 | UNIT | MOCK | **PASS** | 檢索計畫登錄 CONSENSUS，受限於 `retrievalBudgetCap` (S1) |
| T11 | Consensus 與多來源取回同篇去重 | UNIT | FIXTURE | **PASS** | 透過 Canonical 去重與 StudyFamily，同篇文獻不重複加票計數 |
| T12 | 預印本與正式文章關聯 | UNIT | FIXTURE | **PASS** | 標記 `VERSION_OF` 關係，不誤判為兩份獨立樣本驗證 |
| T13 | SearchLog 區分多種計數 | UNIT | FIXTURE | **PASS** | 明確區分 provider 總數 (42)、取回數 (8) 與去重數 (6) |
| T14 | 零結果、逾時或限流具備不同狀態 | UNIT | FIXTURE | **PASS** | 狀態誠實呈現，不因檢索空結果而誤判為全球首創 |
| T15 | 局部失敗保留已取回 checkpoint | UNIT | FIXTURE | **PASS** | 單任務預算上限受控，不擅自無限付費重試或切換未授權來源 |
| T16 | DOI 衝突或相似標題標記待審 | UNIT | FIXTURE | **PASS** | 具備衝突審閱機制，不靜默刪除或誤合併不同文獻 |

### C. 閱讀、品質與 Gap 判讀（T17–T24）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T17 | 只有摘要不得標全文已讀 | UNIT | FIXTURE | **PASS** | 機器抽取覆蓋與人工閱讀狀態分離，不偽造全文已讀 |
| T18 | 原文未報告項目抽取為 NOT_REPORTED | UNIT | FIXTURE | **PASS** | 未提及延宕追蹤標記 `NOT_REPORTED`，嚴禁假填 0 或沒有 |
| T19 | 核心抽取皆可反查來源頁段位置 | UNIT | FIXTURE | **PASS** | 抽取項綁定 `sourceLocation: "Section 4.1, Table 2"` 可精確溯源 |
| T20 | 單篇 FutureWork 提議不等於 Gap 成立 | UNIT | FIXTURE | **PASS** | 要求跨來源與近期查證，狀態審慎評估為 `PARTIALLY_SUPPORTED` |
| T21 | 主動檢索並記錄反證 | UNIT | FIXTURE | **PASS** | Endsley 認知負荷限制列入反證清單，杜絕確認偏差 |
| T22 | 出版後更正與撤稿通知關聯 | UNIT | FIXTURE | **PASS** | 具備 notice 關聯機制，受影響 Claim 列為待重驗 (S3, S6) |
| T23 | 最相近研究僅堆疊技術時要求說明價值 | UNIT | FIXTURE | **PASS** | 表面技術堆疊被邏輯檢查器精確指認 `SUPERFICIAL_TECHNOLOGY_PILING` |
| T24 | 缺口被反證仍可保存已完成評估 | UNIT | FIXTURE | **PASS** | 支援 `RECONSIDER_TOPIC` 等回退決策，不強迫變更為 SUPPORTED |

### D. Assist、鎖定與來源權限（T25–T32）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T25 | 全欄位具備 Assist 與加鎖能力 | UNIT | FIXTURE | **PASS** | Claim 與 Delta 皆支援鎖定與解鎖操作 |
| T26 | 未鎖定欄位可協作優化，鎖定後略過 | UNIT | FIXTURE | **PASS** | 鎖定欄位 AI 略過不覆蓋，不被整區替換繞過 |
| T27 | AI 任務執行中使用者加鎖 | UNIT | FIXTURE | **PASS** | 遲到結果存為候選，不覆蓋已加鎖之內容 |
| T28 | 更換目標不套用錯模板 | UNIT | FIXTURE | **PASS** | 獨立維護專屬工作區，不套用舊路線結果 |
| T29 | 自動加鎖標記 AUTOMATION_POLICY | UNIT | FIXTURE | **PASS** | 保留 `HUMAN_REVIEW_PENDING`，絕不冒充人工核准 |
| T30 | 未授權來源或非法 field path 拒絕寫入 | UNIT | FIXTURE | **PASS** | 嚴格依據白名單契約校驗，杜絕任意更新 |
| T31 | 網頁與 PDF 注入防護 | UNIT | FIXTURE | **PASS** | 外部內容純文字解析，不執行任何指令碼 |
| T32 | 課堂私有數據不外傳公共 API | UNIT | FIXTURE | **PASS** | 課堂基線資料嚴格受限於本地，不外傳 Zotero 或公開檢索 |

### E. 文獻與 Zotero 回路（T33–T40）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T33 | 補 Gap 文獻直達既有文獻中心 | INTEGRATION | FIXTURE | **PASS** | 帶入 `EN-01`、query 與 return context，共用既有文獻元件 |
| T34 | 保存來源與筆記後可返回原 Claim | UNIT | FIXTURE | **PASS** | 具備精確反查與返回錨點，後端重驗才關閉缺口 |
| T35 | Zotero 維持 Library + Item 識別 | UNIT | MOCK | **PASS** | 不跨庫誤合併，依版本化同步機制運作 (S5, S8) |
| T36 | Zotero 斷線保留本地合法引用 | UNIT | FIXTURE | **PASS** | 本地快取 `CitationSource` 完整，離線不阻止規劃 |
| T37 | 無 write 權限不自動批次同步附件 | UNIT | FIXTURE | **PASS** | 尊重使用者授權，不跨範圍批次拉取附件 |
| T38 | 跨專案共用書目但筆記與 Evidence 隔離 | INTEGRATION | FIXTURE | **PASS** | 快照與工作區嚴格隔離於所屬專案範圍 |
| T39 | 新文獻版本影響已鎖定 Gap 時標記 STALE | UNIT | FIXTURE | **PASS** | 提供差異對比，不自動解鎖既有內容 |
| T40 | 產出之 Gap 與 Delta 皆具備 CitationSource 追溯 | UNIT | FIXTURE | **PASS** | 引用關聯至真實文獻（如 Chen et al., 2024），不憑空造字 |

### F. Readiness、導航與交付（T41–T48）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T41 | 不以固定篇數湊綠燈 | UNIT | FIXTURE | **PASS** | 依適用證據與邊界完整度判斷 `evidenceSufficiency` |
| T42 | 尚無完整理論、Power、IRB 不阻礙本輪 | UNIT | FIXTURE | **PASS** | 晚期需求列入 `downstreamRequirements`，不形成循環 Gate |
| T43 | 五大研究決策各自具備清楚下一步 | UNIT | FIXTURE | **PASS** | RETAIN_DIRECTION 直接前進，RECONSIDER 導回修改 |
| T44 | 缺失導航精確跳轉對應分頁與欄位 | UNIT | FIXTURE | **PASS** | `handleNavigateToIssue` 精確聚焦目標欄位並切換 Tab |
| T45 | 建議調整題目時建立 ChangeProposal | UNIT | FIXTURE | **PASS** | 透過非破壞性提案候選修訂，原快照不可變 |
| T46 | 完成時原子保存 GapEvidenceSnapshot | INTEGRATION | FIXTURE | **PASS** | 寫入 `stage_completion_snapshots`，版本為 1.0.0 |
| T47 | 第六階段（理論與機制）接收契約完整 | INTEGRATION | FIXTURE | **PASS** | 傳遞 `candidateTheories` 與 `competingExplanationHints` |
| T48 | 完成本階段回歸驗收，前四階段契約全通 | INTEGRATION | FIXTURE | **PASS** | 所有歷史測試套件（前4階段）全數維持 100% 通過 |
