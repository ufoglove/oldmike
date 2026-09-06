# V3-U04-FULL 48 項驗收測試報告 (Stage 04 48-Item Acceptance Test Report)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

本報告紀錄 48 項標準驗收案例（Spec v3.4.0 §25）之真實測試執行結果。測試腳本位於 `scripts/verify-stage04-full-48-items.ts`。

## 一、驗收結果綜覽

- **總測試項目**：48 項
- **通過 (PASS)**：**48 項 (100%)**
- **失敗 (FAIL)**：0 項
- **阻礙 (BLOCKED)**：0 項
- **全專案編譯檢查**：`npx tsc --noEmit` **0 errors (exit code 0)**

---

## 二、六大面向逐項查核紀錄

### A. 前後階段與資料相容（T01–T08）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T01 | 由第三階段完成頁進入 | INTEGRATION | FIXTURE | **PASS** | 同 Project 讀取 `SubmissionNavigationSnapshot`，題目、RQ、路線、來源與待辦全數自動帶入 |
| T02 | 重複初始化、回應遺失後重試 | UNIT | MOCK | **PASS** | 恢復同一藍圖工作區，API 版本一致，不重複扣費或建立衝突工作區 |
| T03 | 第三階段原接收頁有筆記與限制 | INTEGRATION | FIXTURE | **PASS** | 升級為藍圖工作室後，原始限制與待辦完整保留於 `handoffLimitations` |
| T04 | 無交接或不支援之 schema | UNIT | FIXTURE | **PASS** | 拋出 `NAVIGATION_HANDOFF_REQUIRED` 結構化錯誤，指引精確入口，無崩潰 |
| T05 | 舊專案與新版資料並存 | INTEGRATION | FIXTURE | **PASS** | 保留原始 `sourceNavigationSnapshotId` 與版本號，不強制覆寫歷史 |
| T06 | 題目或導航新增來源版本 | UNIT | FIXTURE | **PASS** | 標記衍生工作版本 `fieldRevision: 1`，時間身分標記 `PROPOSED_BEFORE_STUDY`，舊來源不靜默替換 |
| T07 | 暫定路線／資格 UNKNOWN 進入 | UNIT | FIXTURE | **PASS** | 建立條件式規劃，UNKNOWN 保持 UNKNOWN，不自動竄改為 PASS |
| T08 | 同專案國科會＋期刊雙路線布局 | UNIT | FIXTURE | **PASS** | 工作包標記 `routeScope: "SHARED_CORE"`，核心研究問題共用，兩路完成狀態分開 |

### B. 三目標與研究規劃（T09–T16）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T09 | 三目標由首頁到 handoff | INTEGRATION | FIXTURE | **PASS** | `MOE_TPR` 具備專屬模型、驗證器與視圖，全鏈可用，不退回期刊模板 |
| T10 | SCI/SSCI 構想階段無 Results | UNIT | FIXTURE | **PASS** | 規劃資料收集方向，Results 區段標記「待研究執行後填寫」，嚴禁偽造統計值 |
| T11 | 期刊樣例文獻追蹤設計 | UNIT | FIXTURE | **PASS** | 標記為品質建議 (`isOfficialJournalRule: false`)，非官方強制規定 (S1) |
| T12 | 國科會年限與團隊設定 | UNIT | FIXTURE | **PASS** | 不預設三年期 (`isFixedThreeYearAssumption: false`)，預設一年期；多年期需補連續性問題說明 (S2) |
| T13 | 教學實踐缺正式課程／基線 | UNIT | FIXTURE | **PASS** | 無課程資料標記 `UNKNOWN`，基線標記 `PENDING_BASELINE_TASK`，不偽造及格或低成績 (S3) |
| T14 | 教學技能問題只規劃滿意度 | UNIT | FIXTURE | **PASS** | 邏輯檢查器精確觸發 `PEDAGOGICAL_ASSESSMENT_MISALIGNMENT` (MAJOR_WARNING) |
| T15 | 質性、技術或次級資料研究 | UNIT | FIXTURE | **PASS** | 支援探索型與設計評估型 RQ，不強制假定因果假設或中介模型 |
| T16 | 已有資料／已知結果匯入 | UNIT | FIXTURE | **PASS** | 時間身分標記 `PROPOSED_BEFORE_STUDY`，事後整理不得冒充事前假設 |

### C. Evidence 與來源（T17–T24）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T17 | 藍圖點選補 Gap 文獻 | INTEGRATION | FIXTURE | **PASS** | 產生 `role: "GAP"` 定向 `EvidenceNeed`，帶回原 section，交接至第五階段 |
| T18 | Consensus＋多來源取得同篇 | UNIT | MOCK | **PASS** | 透過 Canonical Dedup 去重，同篇文獻不計為多份獨立支持 |
| T19 | API 只有摘要或局部全文 | UNIT | FIXTURE | **PASS** | 誠實標記 `processedCoverage: "MACHINE_PROCESSED_PARTIAL"`，不偽造全文已讀 |
| T20 | 存在相反 Evidence 檢索 | UNIT | FIXTURE | **PASS** | `supportOrCounterevidence` 設為 `BOTH_SUPPORT_AND_COUNTER`，同時探尋支持與反證 |
| T21 | 合法來源 ID 但不支持 Claim | UNIT | FIXTURE | **PASS** | 標記為 `evidenceStatus: "UNVERIFIED"`，不因 ID 存在而自動通過 |
| T22 | Zotero 斷線與本機引用 | UNIT | FIXTURE | **PASS** | 本地 `citationSourceIds` 可持續推進規劃，離線不阻礙藍圖作業 (S5) |
| T23 | 外部 403/429/空結果 | UNIT | FIXTURE | **PASS** | 受限於 `retrievalBudgetCap: 10`，保留局部草稿，不宣稱全球首創 |
| T24 | 官方規則過期／讀取失敗 | INTEGRATION | FIXTURE | **PASS** | 保存 `ruleSnapshotRefs`，民國/西元年分開，要求使用者手動核對 |

### D. AI 與鎖定（T25–T32）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T25 | 全欄位 Envelope 盤點 | UNIT | FIXTURE | **PASS** | 每欄具備 `fieldRef`, `origin`, `fieldRevision`, `isLocked`，來源欄位唯讀不可竄改 |
| T26 | FILL_EMPTY 與 IMPROVE_UNLOCKED | UNIT | FIXTURE | **PASS** | 只處理未加鎖欄位，已鎖定欄位一律安全略過 |
| T27 | FILL_AND_LOCK 鎖定模式 | UNIT | FIXTURE | **PASS** | 自動加鎖標記 `lockPolicy: "AUTOMATION_POLICY"`，保留 `HUMAN_REVIEW_PENDING` |
| T28 | AI 執行中手動改字／加鎖 | UNIT | FIXTURE | **PASS** | 樂觀鎖檢查生效，後續遲到輸出不覆蓋已加鎖之內容 |
| T29 | Autosave 與更新檢查 | UNIT | FIXTURE | **PASS** | 嚴格檢驗 `fieldRevision`，更新後版號遞增 |
| T30 | 換 goal／撤權／回收 | UNIT | FIXTURE | **PASS** | 獨立維護專屬工作區，不套用舊路線結果，不復活已回收專案 |
| T31 | 瀏覽器刷新與中斷恢復 | UNIT | MOCK | **PASS** | 從快照冪等恢復，不重複產生付費 Job |
| T32 | API 回傳防注入與白名單 | UNIT | FIXTURE | **PASS** | 僅接受合約定義之型別與欄位，杜絕任意資料庫更新注入 |

### E. Readiness、燈號與導航（T33–T40）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T33 | RQ 缺 Objective 映射 | UNIT | FIXTURE | **PASS** | 邏輯檢查器精確指認 `RQ_OBJECTIVE_MISALIGNMENT`，標註具體 RQ ID |
| T34 | 工作包 DAG 循環依賴 | UNIT | FIXTURE | **PASS** | 深度優先搜尋偵測依賴循環，正確標記為 `FATAL` 阻礙項 |
| T35 | Gap全文、IRB、Power 未完成 | UNIT | FIXTURE | **PASS** | 標記為 `duePhase: "BEFORE_STUDY_START"`，交接至下游，不造成循環 Gate |
| T36 | 已知資格 UNKNOWN/FAIL 但 Fit 高 | UNIT | FIXTURE | **PASS** | 保持 `instructorEligibilityStatus: "UNKNOWN"`，不偽造可申請 |
| T37 | 缺失導航跳轉與聚焦 | UNIT | FIXTURE | **PASS** | `handleNavigateToIssue` 精確切換至對應 Tab 並高亮 `targetFieldRef` |
| T38 | 儲存/鎖定不假冒科研完成 | UNIT | FIXTURE | **PASS** | 基線標記為 `PLANNING_BASELINE`，非正式科研驗證完成 |
| T39 | 前進時若有 FATAL 錯誤 | UNIT | MOCK | **PASS** | 後端 `POST /complete` 拒絕並回傳 422 `READINESS_BLOCKED` |
| T40 | 手機版面與燈號顯示 | UNIT | FIXTURE | **PASS** | 操作列與分頁不遮擋內容，燈號文字與圖示並存 |

### F. 安全、交接與交付（T41–T48）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T41 | 跨 Project 存取隔離 | INTEGRATION | FIXTURE | **PASS** | 快照嚴格綁定 `workspaceId` 與 `projectId`，禁止越權讀取 |
| T42 | 完成請求冪等保護 | UNIT | FIXTURE | **PASS** | 基於 snapshotId 去重，避免產生衝突交接快照 |
| T43 | 第五階段接收頁準備 | INTEGRATION | FIXTURE | **PASS** | 承接 `evidenceNeedRefs` 與待辦，標示下一專業引擎待建置，不跳空白頁 |
| T44 | 第五階段消費者契約測試 | INTEGRATION | FIXTURE | **PASS** | 讀取快照之 `scope` 與 `objectiveRefs`，無需使用者重複填寫 |
| T45 | 保存成功但導航中斷 | UNIT | FIXTURE | **PASS** | 重開仍可讀取同一不可變 `planningBaselineRef`，無重複 AI 扣費 |
| T46 | 結構化快照 JSON 匯出 | UNIT | FIXTURE | **PASS** | 包含完整 checksum、limitations 與版本資訊 |
| T47 | 付費憑證與預算邊界 | POLICY | FIXTURE | **PASS** | 無憑證採 MOCK/FIXTURE，達上限不私自切換付費 API，誠實標記 |
| T48 | 回歸檢查無壞損 | INTEGRATION | FIXTURE | **PASS** | 前置階段契約測試 89+51+15+24+13 項全數維持 100% 通過 |
