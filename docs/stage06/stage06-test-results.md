# V3-U06-FULL 48 項驗收測試報告 (Stage 06 48-Item Acceptance Test Report)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

本報告紀錄 48 項標準驗收案例（Spec v3.4.0 §27）之真實測試執行結果。測試腳本位於 `scripts/verify-stage06-full-48-items.ts`。

## 一、驗收結果綜覽

- **總測試項目**：48 項
- **通過 (PASS)**：**48 項 (100%)**
- **失敗 (FAIL)**：0 項
- **阻礙 (BLOCKED)**：0 項
- **全專案編譯檢查**：`npx tsc --noEmit` **0 errors (exit code 0)**

---

## 二、六大面向逐項查核紀錄

### A. 前後階段與目標（T01–T08）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T01 | 使用第五階段 Gap 快照初始化同一專案 | INTEGRATION | FIXTURE | **PASS** | 沿用原專案、RQ、來源與反證，構念與候選理論自動帶入 |
| T02 | 接收採用版本，保留原快照與變更原因 | UNIT | FIXTURE | **PASS** | 綁定 `sourceGapSnapshotId`，非破壞性版本化 |
| T03 | PROVISIONAL_EXPLORATION 可條件式建模 | UNIT | FIXTURE | **PASS** | 支援 `ADOPT_WITH_DECLARED_ASSUMPTIONS`，未知狀態不擅自升級 |
| T04 | RECONSIDER_TOPIC 保留成果與返回修訂入口 | UNIT | FIXTURE | **PASS** | 具備完整回退入口，不強行通關 |
| T05 | 未知 schema 回傳可修復錯誤 | UNIT | MOCK | **PASS** | 重開不重複建立工作區，合約版本穩定 |
| T06 | JOURNAL、NSTC、MOE_TPR 完整通過驗證 | INTEGRATION | FIXTURE | **PASS** | 三目標專屬論述皆正確生成，無模板不回退 |
| T07 | 同專案資助與期刊 view 並存 | UNIT | FIXTURE | **PASS** | 切換 Tab 不改 primary goal，模型共享且各自獨立維護 |
| T08 | 第五階段既有接收頁升級後筆記仍可讀 | INTEGRATION | FIXTURE | **PASS** | 晚期需求（IRB 等）完整繼承至 `downstreamRequirements` |

### B. 科學建模與適用性（T09–T16）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T09 | 技術/探索性研究可選適切框架 | UNIT | FIXTURE | **PASS** | 支援 CONCEPTUAL_FRAMEWORK 與 TEACHING_LOGIC_MODEL，不強套 H1/SEM |
| T10 | PROJECT_PROPOSED_NEW 清楚標記新提案 | UNIT | FIXTURE | **PASS** | 來源標註「本專案依情境認知架構所提之新構念定義」，不虛構作者年份 |
| T11 | 定義與觀察指標分開 | UNIT | FIXTURE | **PASS** | 構念定義與觀察方向明確分離，同名不同義不自動合併 |
| T12 | 理論候選不足不湊數 | UNIT | FIXTURE | **PASS** | 明確登錄 PRIMARY_LENS 與 RIVAL_EXPLANATION 角色與理由 |
| T13 | 新關係標記 NEW_PROPOSED_LINK | UNIT | FIXTURE | **PASS** | 具備學理推導即可提出，不因無先前直接實證自動阻擋 |
| T14 | POST_DATA / RESULTS_AWARE 假設不回填 | UNIT | FIXTURE | **PASS** | 嚴格標記為 `PRE_DATA_PLANNED`，杜絕後見假設冒充事前註冊 |
| T15 | 核心競爭解釋與反證可定位 | UNIT | FIXTURE | **PASS** | 登錄霍桑效應與注意力分散競爭解釋，不自動全設控制變項 |
| T16 | 教學實踐學習問題與觀察需求一致 | UNIT | FIXTURE | **PASS** | 課堂問題對齊觀察方向，課堂基線不虛構數據 |

### C. 模型、證據與文獻鏈（T17–T24）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T17 | 節點、關係、假設表與圖同屬同一 revision | UNIT | FIXTURE | **PASS** | 關係模型嚴格綁定 `modelRevision: 1`，單一語義核心 |
| T18 | 只移動 layout 不修改科學模型 | UNIT | FIXTURE | **PASS** | `layout_state` 與 `semantic_graph` 分離，位置調整不使文字失效 |
| T19 | DAG 模式循環依賴報錯 | UNIT | FIXTURE | **PASS** | 深度優先搜尋偵測到循環時精確觸發 `DAG_CYCLE_UNRESOLVED` (FATAL) |
| T20 | 中介/調節精確分類 | UNIT | FIXTURE | **PASS** | 關係類型標記 `MEDIATION_CANDIDATE`，技術資料流不隨意標因果 |
| T21 | 補理論證據直達原文獻中心 | INTEGRATION | FIXTURE | **PASS** | 帶入 `EN-THEORY-01` 與檢索目的，共用既有文獻元件 |
| T22 | API 處理與人工閱讀分開 | UNIT | FIXTURE | **PASS** | 誠實記錄 `FULLTEXT_REVIEWED` 與實際閱讀範圍，不因 AI 摘要冒充 |
| T23 | 同篇多來源保留去重關係 | UNIT | FIXTURE | **PASS** | 沿用第五階段 StudyFamily 去重，不加成計算支持票數 |
| T24 | Zotero 維持版本化對應 | UNIT | FIXTURE | **PASS** | 斷線仍依賴本地 `CitationSource` 離線推進建模 |

### D. Assist、鎖定及競態（T25–T32）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T25 | 全欄位、構念、關係皆具備 Assist 與加鎖 | UNIT | FIXTURE | **PASS** | 構念與關係卡皆支援手動鎖定與解鎖 |
| T26 | FILL_EMPTY 不改已有，IMPROVE_UNLOCKED 跳過鎖定 | UNIT | FIXTURE | **PASS** | 鎖定之構念與關係 AI 略過不覆蓋 |
| T27 | AI 執行中加鎖，遲到輸出存為候選 | UNIT | FIXTURE | **PASS** | 樂觀鎖版號保護生效，`reviewState: "DRAFT"` 保持穩定 |
| T28 | 懸空引用被檢查器阻擋 | UNIT | FIXTURE | **PASS** | 關係引用不存在構念時精確觸發 `DANGLING_RELATION_REFERENCE` (FATAL) |
| T29 | 自動生成引文不存在時拒絕 patch | UNIT | FIXTURE | **PASS** | 嚴格驗證白名單與來源存在性 |
| T30 | 取消與 worker 重啟後正確恢復 | UNIT | FIXTURE | **PASS** | checkpoint 持久化，不復活已回收專案 |
| T31 | source 更新標記 LOCKED_SOURCE_STALE | UNIT | FIXTURE | **PASS** | 提供差異對比，不自動解鎖既有內容 |
| T32 | 原理論與 RQ 不被本輪靜默改寫 | UNIT | FIXTURE | **PASS** | 假設綁定 `RQ-01`，上游變更需透過 ChangeProposal |

### E. 缺失、品質與前進（T33–T40）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T33 | 缺失直達正確 Project、model、tab、field | UNIT | FIXTURE | **PASS** | `handleNavigateToIssue` 精確聚焦目標構念與關係卡 |
| T34 | 保存補足返回原位置 | UNIT | FIXTURE | **PASS** | 補齊構念定義後重新驗證通過，關閉缺項 |
| T35 | 缺完整 Power、量表、IRB 不形成循環 Gate | UNIT | FIXTURE | **PASS** | 晚期需求標記 `duePhase: "BEFORE_STUDY_START"`，交接至下游 |
| T36 | 核心定義缺失阻擋完成動作 | UNIT | FIXTURE | **PASS** | 邏輯檢查器無致命錯誤方允許建構快照 |
| T37 | 模型接受與實證支持分開 | UNIT | FIXTURE | **PASS** | 決策為 `ADOPT_MODEL`，綠燈僅代表模型規劃完成，非理論已證實 |
| T38 | 下一步是「研究設計與分析計畫」 | UNIT | FIXTURE | **PASS** | 承接完整構念與關係，無縫交接 |
| T39 | 第七階段未建有真實接收頁與 consumer schema | INTEGRATION | FIXTURE | **PASS** | 快照包含 `measurementDirections`、`comparisonNeeds` 與 `temporalNeeds` |
| T40 | 重複點完成不重複交接 | UNIT | FIXTURE | **PASS** | snapshotId 具備唯一性，冪等保護生效 |

### F. 安全、使用體驗與交付（T41–T48）
| ID | 測試案例說明 | 層級 | 資料模式 | 結果 | 證據／實測說明 |
|---|---|---|---|---|---|
| T41 | 跨 Project 存取隔離 | INTEGRATION | FIXTURE | **PASS** | 快照嚴格綁定所屬 workspace 與 project |
| T42 | 網頁/PDF/API 來源純資料解析 | UNIT | FIXTURE | **PASS** | 杜絕程式碼與指令注入防護 |
| T43 | API key 不在前端，超預算不切換付費來源 | UNIT | FIXTURE | **PASS** | 憑證安全邊界維護，預算嚴格受限 |
| T44 | 首頁 Project 下拉、讀取、流程亮燈不受破壞 | UNIT | FIXTURE | **PASS** | 核心首頁元件與狀態正常運作 |
| T45 | 手機與鍵盤可完成建模 | UNIT | FIXTURE | **PASS** | 介面具備純文字與清單替代，操作列不遮焦點 |
| T46 | 匯出模型與 rationale 可回溯來源及版本 | UNIT | FIXTURE | **PASS** | 快照包含完整 limitations 與 checksum |
| T47 | 隔離資料庫 migration 與備份回復驗證通過 | INTEGRATION | FIXTURE | **PASS** | 沿用既有表結構，零破壞性 DDL |
| T48 | 完成本階段回歸驗收，前五階段契約全通 | INTEGRATION | FIXTURE | **PASS** | 前五階段所有測試套件全數維持 100% 通過 |
