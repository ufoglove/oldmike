# V3-U14-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U14-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 13 -> Stage 14 -> Stage 15)

```text
[Stage 13: 資料治理、清理與 Analysis Dataset]
  DataGovernanceSnapshot (不可變快照，含封存之 Analysis Dataset 版本、SHA-256 雜湊與延後統計義務)
         │
         ▼
[Stage 14: 分析實驗室 Execution Mode、研究結果與圖表工作區]
  1. Intake & Dataset Hash Verification:
     ├─ 檢查 DataGovernanceSnapshot 與分析資料集雜湊 (3b08e268...)
     └─ 發布 AnalysisWorkOrder (未經授權嚴禁啟動正式統計運算)
  2. Deterministic Statistical Computation Pipeline:
     ├─ 基準驗證: 數列 [1,2,3,4,5] 驗證 mean=3.0, sample variance (ddof=1) = 2.5
     ├─ 獨立雙樣本檢定: Welch t-test (T1 反應時間組間差值 -913.1ms, p < .01, Cohen's d)
     ├─ 基線共變數控制: ANCOVA 線性模型 (控制 T0 基線後介入處理效應 Beta1 = -945.2ms)
     └─ 多重比較校正: Holm-Bonferroni step-down 運算 (調整後 p 值透明登錄)
  3. Immutable Result Facts Layer:
     ├─ 運算結果寫入不可變 ResultFact，附加 SHA-256 數位簽章密封
     └─ AI 與文字編輯器嚴禁直接改寫 ResultFact 數值與 p 值
  4. Publication Table & Figure Studio:
     ├─ Table 1: 組間比較與 ANCOVA 結果表 (cell 直接綁定 ResultFact)
     └─ Figure 1: 交互作用趨勢圖 (DATA_DRIVEN_SVG_RENDERER_V1 資料驅動渲染，嚴禁假圖表)
  5. Scientific Interpretation & Honesty Check:
     ├─ 老麥科學解說卡: 提示因果推論邊界 (實習場域局限與延宕遷移需求)
     └─ 科學誠信: 確保非顯著結果如實發布，無 p-hacking 或模型偷換現象
         │
         ▼
  AnalysisResultsSnapshot (不可變交接快照，含不可變 ResultFact 清單、圖表路徑與多重校正證明)
         │
         ▼
[Stage 15: 研究結果整合與證據驅動全文寫作 (results-writing)]
  ├─ 論文 Results 章節直接引用不可變 ResultFact 標籤
  ├─ 插入由真實資料渲染之 Table 1 與 Figure 1
  └─ 撰寫基於真實估計量與因果邊界之 Discussion 章節
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/analysis-execution/initialize`
   - 驗證 `DataGovernanceSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `AnalysisExecutionWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/analysis-execution/complete`
   - 執行 `runAnalysisExecutionGateCheck`（阻擋核心 RQ 結果缺失、SHA-256 數位簽章無效、p 值格式異常等違規）。
   - 原子寫入 `AnalysisResultsSnapshot`，並將狀態更新為交接至 `results-writing`。
