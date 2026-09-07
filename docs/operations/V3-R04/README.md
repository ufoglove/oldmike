# V3-R04-FULL 營運品質監測、AI品質回歸與受控維護交付說明

## 1. 任務定位與非科研階段宣告
本維護工作單（V3-R04-FULL）為使用者於 U01～U20、R01～R03 完成後另行要求之**有限維護任務**。
- **非科研第 21 階段**：不計入任何研究進度分母（`engineeringProgressNotInResearchDenominator=true`）。
- **非全站重建或再部署**：不重新部署生產站點、不重新執行資料庫遷移、不重做首件研究。
- **嚴格安全邊界**：
  * `rawResearchFactMutationAuthorized=false`（嚴禁變造真實研究事實）
  * `submissionPaymentPublicationAuthorized=false`（未經明確授權不得執行投稿、付款或對外公開）
  * `unspecifiedProductionChangeAuthorized=false`（未經授權禁止生產環境變更）

## 2. 交付物清冊
- **契約定義**：`lib/maintenance-review-v3-contract.ts`（Schema 版本 `maintenance-review/3.4.0`）
- **服務實作**：`lib/maintenance-review-v3-service.ts`（品質指標聚合、門禁評估、Snapshot 建構）
- **管理路由**：`app/api/admin/maintenance-review-v3/route.ts`（GET 門禁評估 / POST Snapshot 生成）
- **驗收套件**：`scripts/verify-stage-r04-full-48-items.ts`（48 項全項驗收：46 PASS, 0 FAIL, 2 NOT_RUN 誠實標示）
- **Consumer 驗證**：`scripts/verify-r04-consumer-contract.ts`（快照契約與冪等性檢查 PASS）
- **架構與政策文件**（本目錄）：
  * `InputContractMapping.md`（承接 R03/R02 產物映射）
  * `ReuseMap.md`（既有架構重用與擴充清單）
  * `MaintenanceWorkOrder.md`（本次工作單與權限邊界）
  * `MetricDefinitions.md`（服務成功、內容正確與真人採用指標定義）
  * `QualityPolicy.md`（SLO、硬性保真與樣本不足處置政策）
  * `ProviderAndSourceImpactPolicy.md`（外部 Provider 錯誤分類、Zotero 與官方規則時效影響）
  * `EvaluationSuiteIndex.md`（AI 語義評估、三目標回歸與資料治理）
  * `MaintenanceReviewReport.md`（第一次維護檢查真實報告）
  * `IssueDisposition.md`（問題分級、處置與 NO_CODE_CHANGE_REQUIRED 決策）
  * `MaintenanceReviewSnapshot-schema.md`（快照契約與下游相容性）
  * `KnownIssues.md`（待觀測與真人確認事項）

## 3. 狀態結論
- **Review 處置狀態**：`MAINTENANCE_REVIEW_AND_CONTROL_HANDOFF_COMPLETE`
- **控制驗證狀態**：`PASSED`
- **當前營運健康狀態**：`WITHIN_CONFIRMED_TARGET`
- **程式修補狀態**：`NO_CODE_CHANGE_REQUIRED`（無新增產品缺陷，不為交差修碼）
- **排程狀態**：`DRAFT_DISABLED`（新增排程預設關閉，保留原有授權）
- **後續行動**：交接完成後停止，回到既有研究與維護工作，不自動開啟 R05 或新必經階段。
