# InputContractMapping：承接 R03 與 R02 產物映射

## 1. 上游產物核對基準
本輪任務以既有真实產物為基礎，不以提示詞或口頭宣稱為依據：
- **R01 整合快照**：`ReleaseReadinessSnapshot`（v3.4.0, commit: `b1f7e16`），驗證 80 項（78 PASS）。
- **R02 上線快照**：`ProductionLaunchSnapshot`（v3.4.0, launchMode: `NORMAL_PRODUCTION`, zeabur_prod_001），驗證 64 項（62 PASS）。
- **R03 採用快照**：`RealProjectDeliverySnapshot`（v3.4.0, target: `RESEARCH_PLANNING_BASELINE`, deliverableId: `fdm_001`），驗證 48 項（46 PASS）。

## 2. 上游語義門禁核對
- **R03 語義 Gate**：`FIRST_REAL_DELIVERABLE_ACCEPTED_AND_ADOPTION_REVIEW_COMPLETE`
  * 原產物清單：摘要、引言、文獻矩陣、理論機制、方法規劃。
  * 限制旗標保留：
    - `engineeringProgressNotInResearchDenominator = true`
    - `rawResearchFactMutationAuthorized = false`
    - `submissionPaymentPublicationAuthorized = false`
    - `unspecifiedProductionChangeAuthorized = false`
  * 本輪處置：歷史 `false` 授權原樣保留，不因 R04 維護開啟改為 `true`。本輪任何額外操作均由獨立 `MaintenanceWorkOrder` 受限發起。

## 3. 欄位與 Adapter 映射清單
| 上游實體 / 欄位 | R04 映射目標 | 處置方式 |
|---|---|---|
| `r03Snapshot.snapshotId` | `upstreamRealProjectDeliveryRef` | 直接引用，雜湊校驗 `upstreamRealProjectDeliveryDigest` |
| `r03Snapshot.upstreamProductionLaunchRef` | `productionLaunchRef` | 追溯保留生產部署關聯 |
| `r03Snapshot.workOrder.projectId` | `allowedProjectDocumentRefs` | 限制觀測範圍至指定授權專案 |
| `r03Snapshot.remainingResearchActions` | `remainingResearchActions` | 繼承後續科研義務，不因 R04 結束而關閉 |
| `r02Snapshot.environmentManifest` | `observedReleaseConfigPromptRefs` | 記錄現行生產環境配置版本 |

若 upstream snapshot 缺失，系統自動標記 `UPSTREAM_EVIDENCE_PENDING`，不捏造假首件成果或假採用紀錄。
