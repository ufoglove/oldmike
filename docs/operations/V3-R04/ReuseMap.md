# ReuseMap：既有系統重用與最小擴充清單

## 1. 原則
嚴格重用既有架構，不重複建置監控平台、不新增第二套排程系統、不重建文獻庫、不新增付費訂閱、不引進全站資料庫重構或新導航。

## 2. 元件重用盤點表
| 系統領域 | 現有元件 (R01/R02/R03/U01~U20) | 狀態 / 差距 (Gap) | 本輪最小擴充 | 驗收方式 |
|---|---|---|---|---|
| **任務與工作單** | `AgentJob`, `JobAttempt`, `AdoptionWorkOrder` | 缺少維護專屬之讀取與回歸限制類型 | 擴充 `MaintenanceWorkOrder` 型別與 scope | Contract/Unit test |
| **指標與日誌** | `UsageLedger`, `EventAudit`, `TelemetryLogger` | 缺少集中式服務指標 rollup 定義 | 增加 `ServiceMetricEntry` 聚合結構（零分母保留 null） | 48-item T07~T12 |
| **科研保真** | `ResultFact`, `ProtectedSpan`, `FieldPolicy` | 現有保真規則完整，缺乏維護期回歸綁定 | 複用 `RIC_FACT_PRESERVATION` 規則於回歸測試 | 48-item T13~T18 |
| **文獻與外部整合** | `CitationSource`, `Consensus`, `ZoteroSync` | 需定義來源變更對草稿之 stale 標記 | 擴充 `sourceChangeImpactRefs` 邏輯，不重搜全庫 | 48-item T25~T28 |
| **問題與處置** | `Issue`, `Incident`, `RequirementIssue` | 需標明維護期修補決策 | 支援 `NO_CODE_CHANGE_REQUIRED` 等修補狀態 | 48-item T39 |
| **發布與部署** | `ReleaseManifest`, `PatchManifest`, Zeabur | 現有受控發布管線完備 | 沿用 R02 發布授權規則，無授權停留在 AWAITING | 48-item T40 |
| **排程與事件** | 原生任務排程 / Node 內部計時 | 需防止自動啟用新增排程 | 新排程預設 `DRAFT_DISABLED`，沿用原授權排程 | 48-item T33~T35 |
| **管理後台** | Admin API (`/api/admin/*`) | 缺少維護評估與快照端點 | 新增 `/api/admin/maintenance-review-v3` 路由 | API Route 測試 |

## 3. 資料庫變更說明
- **Migration 需求**：`NONE`（無新增資料表，不更動現有資料表結構，完全以契約型別與快照保存）。
