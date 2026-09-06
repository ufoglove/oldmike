# V3-U09-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U09-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §26) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `RouteWorkspaceSnapshot` | `lib/route-studio-contract.ts` | 第九階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `rqRefs`, `workPackageRefs`, `budgetItemRefs`, `nextActions` | 嚴格驗證版本與校驗碼 | PASS (T01, T02) |
| `ReviewerFinding` / Reviewer Engines | `lib/route-review-compliance-contract.ts` | 三路線獨立模擬審查（期刊、國科會、教學實踐） | 區分 FATAL/MAJOR/MINOR/SUGGESTION，標記 `SIMULATED_REVIEW` | 嚴禁虛構 Results，不杜撰 PI 著作 | PASS (T06, T07, T08) |
| `OfficialRuleItem` (`OfficialRuleSnapshot`) | `lib/route-review-compliance-contract.ts` | 官方規則重驗證與來源追溯 | 記錄官方網址、檢索日與驗證狀態 (`VERIFIED_CURRENT` 等) | 讀取失敗標記 SOURCE_UNAVAILABLE，不當成未公告 | PASS (T09, T10) |
| `ComplianceItem` (`ComplianceMatrix`) | `lib/route-review-compliance-contract.ts` | 全站共用合規矩陣，串聯責任角色與證據 | 嚴格區分 `CURRENT_STAGE_REQUIRED` 與 `LATER_STAGE_REQUIRED` | 晚期 IRB 核准列為送件時條件，不阻礙規劃基線 | PASS (T11, T12, T15) |
| `EthicsScopeAssessment` | `lib/route-review-compliance-contract.ts` | 共用研究倫理中心範疇篩檢 (15 類指標) | 自動識別 VR 穿戴裝置、眼動數據與人體參與 | 僅輸出建議，網站絕不自行宣布正式通過 | PASS (T17, T18, T19) |
| `InstitutionalEthicsDecision` | `lib/route-review-compliance-contract.ts` | 機構倫理委員會正式審查決定管理 | 記錄正式收件或核准文號 | 缺乏真實文件時嚴禁編造假案號 | PASS (T20, T21) |
| 師生權力關係防護 (`TEACHER_STUDENT_POWER`) | `lib/route-review-compliance-contract.ts` | 教學實踐涉及授課學生之專屬風險管理 | 檢驗知情同意收集獨立性、成績封存與退出機制 | 未建立緩解機制時精確觸發 FATAL 阻擋 | PASS (T08, T22, T24) |
| `DataManagementPlan` (DMP) | `lib/route-review-compliance-contract.ts` | 共用研究資料管理計畫 | 定義去識別化、AES-256 加密、TLS 1.3、第三方 AI 限制與 5 年銷毀 | 與研究設計與分析指標完全對齊 | PASS (T25, T26, T27, T28) |
| `PreregistrationPlan` | `lib/route-review-compliance-contract.ts` | 期刊公開科學與預註冊規劃 | 狀態標記為 DRAFT_READY，對齊 Stage 7 分析計畫 | 無真實註冊網址嚴禁標為 REGISTERED | PASS (T29, T30, T31) |
| `RevisionTask` | `lib/route-review-compliance-contract.ts` | 修訂任務系統，串聯審查意見與工作區 | 未解決之 Reviewer 意見自動轉為修訂任務，指派 Owner | 具備鎖定保護與歷程回溯 | PASS (T33, T34) |
| `Stage09HandoffSnapshot` | `lib/route-review-compliance-contract.ts` | 第九至第十階段不可變交接快照 | 傳遞至 Stage 10 (`study-protocol`)，帶入量表與 Protocol 需求 | 包含合規比率、倫理結論與 SHA-256 checksum | PASS (T45, T47) |
