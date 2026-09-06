# V3-U15-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 14 -> Stage 15 -> Stage 16)

```text
[Stage 14: 分析實驗室 Execution Mode、研究結果與圖表]
  AnalysisResultsSnapshot (不可變快照，含 3 個 ResultFact、Table 1 與 Figure 1 參照、多重校正證明)
         │
         ▼
[Stage 15: 研究結果整合與證據驅動全文寫作工作區]
  1. Intake & Writing Work Order:
     ├─ 檢查 AnalysisResultsSnapshot 與不可變 ResultFact 數位簽章
     └─ 發布 WritingWorkOrder (嚴禁在無正式資料時生成假結果或亮起假完成綠燈)
  2. Results Storyboard & Claim-Evidence Map:
     ├─ 串聯 RQ-01 -> H1 -> fact_rt_t1_diff_mean -> Table 1 / Figure 1
     └─ 主張與證據結構化對照 (ClaimEvidenceLink)，區分理論、方法與結果型主張
  3. Structured Chapter Builders (逐章起草):
     ├─ Title & Structured Abstract (摘要與正文分母、方向、主要 outcome 完全一致)
     ├─ Introduction (文獻缺口 cit_chen2024 與理論 cit_hart1988 對齊)
     ├─ Methods (忠實反映實施現況: RCT 隨機、REC-115-089 知情同意、VR 防動暈中斷 20m+10m)
     ├─ Results (所有統計數字嚴格綁定不可變 ResultFact，嚴禁心算新數字)
     ├─ Discussion (因果邊界明確: 受控實驗室立即後測局限，T2 延宕遷移待驗證)
     └─ Conclusion (保留研究限制，不誇大外部效度)
  4. Publication Tables & Figures Embedding:
     └─ Table 1 (ANCOVA) 與 Figure 1 (交互作用趨勢圖) 直接嵌入，嚴禁文生圖假圖表
  5. Quality & Integrity Gates:
     ├─ 檢查 Discussion 幽靈數據 (NEW_RESULT_IN_DISCUSSION_PROHIBITED)
     ├─ 檢查不可能 p 值 (IMPOSSIBLE_P_VALUE_REPORTED, p=0 會被 FATAL 阻擋)
     └─ 檢查 Fact 綁定完整性 (RESULTS_SECTION_FACT_BINDING_MISSING)
         │
         ▼
  ManuscriptWritingSnapshot (不可變交接快照，含全文章節 AST、Fact 引用清單與 Claim-Evidence 對照)
         │
         ▼
[Stage 16: 老麥科學內容審查、Reviewer #2與逐項修訂 (scientific-review)]
  ├─ 獨立模擬同行評審 (Reviewer #2) 科學內容與方法嚴謹度審查
  ├─ 逐項修訂建議 (Revision Tasks) 與科學一致性對照
  └─ 投稿前最終版定稿與期刊格式合規檢查
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/manuscript-writing/initialize`
   - 驗證 `AnalysisResultsSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `ManuscriptWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/manuscript-writing/complete`
   - 執行 `runManuscriptWritingGateCheck`（阻擋 Results 未綁定 Fact、Discussion 幽靈數據、不可能 p 值等違規）。
   - 原子寫入 `ManuscriptWritingSnapshot`，並將狀態更新為交接至 `scientific-review`。
