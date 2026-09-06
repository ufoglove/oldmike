# V3-U06-FULL 第六階段相容映射表 (Stage 06 Compatibility Map)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、第五階段契約承接與映射

| 第五階段實體／路由 | 本輪第六階段用途 | 映射模型／實體 | 相容防護機制 |
|---|---|---|---|
| `GapEvidenceSnapshot` (`stage_completion_snapshots` where `stageId='gap-novelty'`) | 第六階段初始化唯一輸入來源，零重複輸入 | `TheoryWorkspace` (`sourceGapSnapshotId`) | 唯讀綁定；若快照不存在回傳 `GAP_HANDOFF_REQUIRED` |
| `candidateTheories` & `competingExplanationHints` | 提供候選理論池與競爭機制初始線索 | `TheoryCandidate` / `AlternativeExplanation` | 繼承自第五階段實證文獻，不捏造不存在的理論來源 |
| `downstreamRequirements` | 承接晚期需求（Power、正式量表、IRB） | `TheoryWorkspace.downstreamRequirements` | 標記 `due_phase: "RESEARCH_DESIGN"` / `"BEFORE_STUDY_START"`，不形成循環 Gate |
| 第五階段建立之第六階段接收頁 | 升級為第六階段完整工作區 | `TheoryMechanismStudioView.tsx` | 保留原摘要、RQ、待辦、理論需求與返回按鈕，不跳空白頁 |

## 二、三目標專業建模差異化映射

| 目標 ID | 專屬模型實體 | 核心評估維度 | 禁止與限制行為 |
|---|---|---|---|
| `JOURNAL_SCI_SSCI` | `JournalModelRationale` | 理論定位與 Gap 回應、相近研究區隔、機制辯護、未測邊界 | 嚴禁在未有真實資料前宣稱因果已證實或 p<0.05；樣例文獻建議標記為品質建議非硬性法規 (S1) |
| `NSTC_GENERAL` | `NstcModelRationale` | 科學問題重要性、命題邏輯推導、跨領域價值、工作包對齊 | 不預設三年期，分年度工作包對齊研究問題遞進，不重新選學門 (S2) |
| `MOE_TPR` | `MoeTprModelRationale` | 課堂真實問題、教學介入活動、學習機制（活動≠機制）、成效評量規準 | 評量方向以實作規準與歷程日誌為主，嚴禁單純以滿意度問卷代替技能成效 (S3) |

## 三、8 種建模取徑 (Modeling Approaches)

- 支援 `THEORY_TESTING`、`THEORY_BUILDING`、`CONCEPTUAL_FRAMEWORK`、`TEACHING_LOGIC_MODEL`、`DESIGN_SCIENCE`、`TECHNICAL_OR_PREDICTIVE`、`QUALITATIVE_EXPLORATORY`、`MIXED_OR_MULTI_COMPONENT`。
- 技術與探索性研究可選適切框架，不強迫套用具名理論、H1/H2 或 SEM 中介模型。
