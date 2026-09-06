# V3-U05-FULL 第五階段相容映射表 (Stage 05 Compatibility Map)

**工程識別：V3-U05-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、第四階段契約承接與映射

| 第四階段實體／路由 | 本輪第五階段用途 | 映射模型／實體 | 相容防護機制 |
|---|---|---|---|
| `BlueprintPlanningSnapshot` (`stage_completion_snapshots` where `stageId='blueprint'`) | 第五階段初始化唯一輸入來源，零重複輸入 | `GapReviewWorkspace` (`sourceBlueprintSnapshotId`) | 唯讀綁定；若快照不存在回傳 `BLUEPRINT_HANDOFF_REQUIRED` |
| `EvidenceNeed` (陣列) | 轉換為定向檢索任務與 Gap Claim 來源依據 | `LiteratureSearchTask` (`evidenceNeedId`) / `GapClaim` | 保留原始 `needId` 與 `role`，不重起無關之發散搜尋 |
| `downstreamRequirements` | 承接晚期需求（IRB、Power、樣本數） | `GapReviewWorkspace.downstreamRequirements` | 標記 `due_phase: "BEFORE_STUDY_START"`，不形成循環 Gate |
| 第四階段建立之第五階段交接接收頁 | 升級為第五階段完整工作區 | `GapNoveltyStudioView.tsx` | 保留原摘要、RQ、待辦、文獻連結與返回按鈕，不跳空白頁 |

## 二、三目標專業評估差異化映射

| 目標 ID | 專屬模型實體 | 核心評估維度 | 禁止與限制行為 |
|---|---|---|---|
| `JOURNAL_SCI_SSCI` | `JournalSpecificGapSynthesis` | 國際文獻版圖、可辯護之理論貢獻、最相近國際競爭者、方法嚴謹性 | 嚴禁在無實際研究資料前捏造 Results 或 p 值；樣例文獻建議標記為品質建議非硬性法規 (S1) |
| `NSTC_GENERAL` | `NstcSpecificGapSynthesis` | 科學問題重要性、與國內外創新比較、主持人過去研究延續性、跨領域價值 | 僅針對一般專題計畫，不因相同關鍵字私自更換學門代碼 (S2) |
| `MOE_TPR` | `MoeTprSpecificGapSynthesis` | 課堂真實問題檢驗、教學介入學理、學習機制、學生歷程評量規準 | 課堂基線缺失誠實標記 `PENDING_BASELINE_TASK`，嚴禁編造不及格率或滿意度代替成效 (S3) |

## 三、既有文獻與證據中心整合 (S1, S2, S5)

- **不自建第二套文獻庫**：列表、上傳、PDF/正文檢閱、標籤、筆記均導向既有文獻中心。
- **Consensus API 正式參與**：與 Ai4Scholar、Semantic Scholar、OpenAlex、Crossref 共享 Adapter，依任務調用，不全並行浪費額度。
- **Canonical 去重與 StudyFamily**：同篇多平台取得保留單一正式書目，預印本與期刊版標記 `VERSION_OF`，不重複計數為獨立支持。
