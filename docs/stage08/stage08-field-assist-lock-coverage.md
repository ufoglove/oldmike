# V3-U08-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U08-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Journal Positioning** (`targetJournalCategory`, `coreContribution`) | 結構/論述 | `EXPLAIN`, `DRAFT`, `ALIGN_SCOPE` | 區塊層級 (Section Lock) | 鎖定後 AI 建議僅存為候選，禁止直接覆寫 (T34) |
| **Manuscript Results Slot** (`resultsSlots`, `p_jnl_03`) | 資料插槽 | `EXPLAIN_SLOT`, `LIST_METRICS` | 嚴格鎖定 (Strict Lock) | 嚴禁在未收案前虛構顯著統計數值或假圖表 (T09, T33) |
| **Protected Facts** (`PLANNING_CALC_REF`, `CITATION_SOURCE_REF`) | 受保護節點 | `AUDIT_FACT`, `REPLACE_REF` | 不可變節點 (Node Lock) | AI 生成或協作時禁止擅自修改樣本數 $N=151$ 或單位 (T21, T32) |
| **NSTC Work Packages** (`WorkPackageItem`, `milestones`) | 矩陣項目 | `EXPLAIN`, `DRAFT_TASKS`, `SCHEDULE_WP` | 項目層級 (Package Lock) | 修改若影響來源設計則需建立 ChangeProposal (T22) |
| **NSTC PI Experience** (`piExperienceSummary`) | 人事事實 | `SOURCE_IMPORT`, `LIST_GAPS` | 欄位層級 (Field Lock) | 缺乏真實著作時保留待補，嚴禁杜撰老麥虛構履歷 (T12) |
| **MOE Assessment Matrix** (`courseAssessmentMatrix`) | 課程矩陣 | `EXPLAIN`, `ALIGN_RUBRICS`, `AUDIT_WEEK` | 列層級 (Row Lock) | 技能目標僅測滿意度問卷時觸發警告並導航修正 (T15) |
| **MOE Local Evidence** (`localEvidenceRef`, `pedagogicalProblem`) | 教學痛點 | `EXPLAIN`, `IMPORT_LOCAL_LOGS` | 欄位層級 (Field Lock) | 嚴禁以外部一般文獻冒充本班現場真實學生基線 (T14) |
| **Budget Planning Items** (`quantity`, `unitCost`, `periods`) | 預算明細 | `EXPLAIN`, `CALCULATE_BUDGET`, `CHECK_RULES` | 記錄層級 (Record Lock) | 數值由程式確定性計算，禁止 LLM 隨意填寫總金額 (T19, T20) |
| **Section AST Paragraphs** (`content`, `factBindings`) | 結構文字 | `GUIDED`, `CO_WRITE`, `FILL_EMPTY` | 段落層級 (Paragraph Lock) | 人工修改中加鎖，遲到輸出存為候選衝突 (T35, T36) |
