# V3-U15-FULL 實體與相容性映射表 (Compatibility Map)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 邏輯規格實體 (Spec v3.4 §30) | 實體檔案 / 資料庫或合約位置 | 本輪用途 | Adapter / 轉換機制 | 缺項與修改處置 | 驗收狀態 |
|---|---|---|---|---|---|
| `AnalysisResultsSnapshot` | `lib/analysis-execution-contract.ts` | 第十五階段唯一有效輸入來源，零重複輸入 | 承接 `scope`, `resultRecordRefs`, `immutableResultFactManifestRef`, `tableRefs`, `figureRefs` | 嚴格校驗資料集雜湊與 Fact 數位簽章 | PASS (T01, T02, T03) |
| `WritingWorkOrder` / 寫作模式 | `lib/manuscript-writing-contract.ts` | 論文寫作工作單與模式控管 | 支援 FORMAL_SCIENTIFIC_DRAFT, PARTIAL_EVIDENCE_DRAFT, PLANNING_OUTLINE | 無正式資料嚴禁生成假結果 (formalWritingAllowed=false) | PASS (T04, T05, T06) |
| `ResultsStoryboard` | `lib/manuscript-writing-contract.ts` | 全文論述主線與必報結果故事板 | 串聯 RQ-01 $\to$ H1 $\to$ ResultFact $\to$ Table 1 / Figure 1 | 必報不顯著結果不得省略，嚴防選擇性報告 | PASS (T07, T08, T13) |
| `Immutable Result Facts Binding` | `lib/manuscript-writing-contract.ts` | 正文所有統計數字直連 ResultFact 標籤 | Results 段落綁定 fact_rt_t1_diff_mean, cohens_d, Beta1 | AI 與編輯器嚴禁改寫數值或心算新數字 | PASS (T19, T20, T23) |
| `Methods Builder` (Planned vs Performed) | `lib/manuscript-writing-service.ts` | 方法論章節忠實反映實施現況 | 忠實描述 RCT 隨機分組、知情同意、VR 防動暈中斷 (20m+10m) | 嚴禁將未隨機寫成隨機或虛構盲化 | PASS (T21, T24, T25) |
| `Discussion Causal Boundaries` | `lib/manuscript-writing-service.ts` | 討論章節因果推論邊界與幽靈數據防護 | 明確指出受控實驗室立即後測侷限，要求 T2 延宕檢驗 | 嚴禁出現未在 Results 登錄之幽靈數據 (如 AUC 0.99) | PASS (T26, T27, T28) |
| `ClaimEvidenceLink` | `lib/manuscript-writing-contract.ts` | 主張與證據結構化對照表 | 區分 BACKGROUND, GAP, THEORY, METHOD, RESULT | 引用存在且確實支持內容，不張冠李戴 | PASS (T31, T32, T34) |
| `Zotero & CitationSource Renderer` | `lib/manuscript-writing-contract.ts` | 統一引用渲染器與書目生成 | 同一 Renderer 處理作者年份消歧、群組引文與號碼重排 | Zotero 斷線保留本地合法引用，無 Word Live 標 STATIC | PASS (T36, T37, T38, T50) |
| `Embedded Publication Table & Figure` | `lib/manuscript-writing-contract.ts` | 出版級表圖直接嵌入正文 | Table 1 (ANCOVA) 與 Figure 1 (趨勢圖) 直接綁定引用 | 嚴禁調用文生圖模型重畫假圖表 | PASS (T42, T43, T44) |
| `ManuscriptWritingSnapshot` | `lib/manuscript-writing-contract.ts` | 第十五至第十六階段不可變交接快照 | 傳遞至 Stage 16 (`scientific-review`)，帶入審查準備初稿 | 包含全文章節 AST、Fact 引用清單與校驗碼 | PASS (T57, T59) |
