# V3-U14-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U14-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §30) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `DataGovernanceSnapshot` | `lib/data-governance-contract.ts` | 第十四階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `analysisDatasetVersion`, `analysisDatasetContentHashSha256`, `deferredStatisticalProcessing` | 嚴格校驗資料集雜湊 (3b08e268...) | PASS (T01, T02, T06) |
| `AnalysisWorkOrder` / RQ 矩陣 | `lib/analysis-execution-contract.ts` | 正式分析工作單與執行授權管理 | 綁定已採用之 AnalysisPlan，嚴禁擅自切換主要 RQ | 授權分析角色 (PRIMARY/SECONDARY) 透明留存 | PASS (T07, T08) |
| `StatisticalComputationEngine` | `lib/statistical-computation-engine.ts` | 確定性受控統計推論運算引擎 (v1.0.0) | 執行手算基準驗證 ([1,2,3,4,5] mean=3, var=2.5)、Welch t-test、ANCOVA 線性模型與 Holm 校正 | 本地純演算法，嚴禁任意 eval 或 AI 假造數據 | PASS (T10, T11, T13, T26) |
| `Immutable Result Facts Layer` | `lib/analysis-execution-contract.ts` | 不可變統計結果事實層 (`ResultFact`) | 儲存估計量、95% CI 與 p 值，附加 64 字元 SHA-256 數位簽章 | 嚴禁 AI 或通用編輯器直接改寫數值 | PASS (T17, T41, T45) |
| `Publication Table & Figure Studio` | `lib/analysis-execution-contract.ts` | 出版級學術表圖工作室 (`Table 1`, `Figure 1`) | 表格 cell 與圖形 Error bars 直接綁定 ResultFact | 資料驅動 SVG 渲染引擎，嚴禁文生圖假圖表 | PASS (T42, T43, T44) |
| 誠實報告非顯著結果 | `lib/analysis-execution-contract.ts` | 確保科學誠信與防範 Publication Bias | 非顯著主要結果 ($p \ge .05$) 仍正常發布並通過品質檢查 | 絕不為顯著性偷換模型或隨意剔除樣本 | PASS (T27, T52) |
| p 值異常防護機制 | `lib/statistical-computation-engine.ts` | 嚴格防範統計數值格式化異常 | 檢驗 $p > 0$ 且非 NaN，微小值格式化為 $p < .001$ | 嚴禁輸出 $p = 0$ 或將 null 格式化為 0.000 | PASS (T28) |
| `ScientificInterpretationCard` | `lib/analysis-execution-contract.ts` | 老麥科學判讀與邊界限制卡片 | 提供白話摘要、因果推論邊界警告與實務意義解說 | 僅引用不可變 ResultFact，模型不重算數值 | PASS (T46) |
| `AnalysisResultsSnapshot` | `lib/analysis-execution-contract.ts` | 第十四至第十五階段不可變交接快照 | 傳遞至 Stage 15 (`results-writing`)，帶入 ResultFact 清單 | 包含圖表參照、多重比較校正證明與校驗碼 | PASS (T57, T59) |
