# V3-U15-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Writing Work Order** (`targetJournalCategory`, `formalWritingAllowed`) | 寫作工作單 | `AUDIT_SCOPE`, `CHECK_FORMAL_ALLOWED` | 系統層級 (Order Lock) | 無正式資料時嚴禁生成假 Results 或亮起假完成綠燈 (T05) |
| **Results Storyboard** (`boundResultFactIds`, `isSignificant`) | 結果故事板 | `ALIGN_STORYBOARD`, `AUDIT_REQUIRED_OUTCOMES` | 矩陣層級 (Storyboard Lock) | 必報不顯著結果不得省略，嚴防選擇性報告 (T07, T13) |
| **Immutable Result Fact Binding** (`boundFactIds`) | 事實綁定 | `INSERT_FACT_NODE`, `VERIFY_FACT_SEAL` | 不可變事實 (Fact Seal Lock) | Results 段落數值直連 ResultFact 標籤，嚴禁心算新數字 (T19, T20, T23) |
| **Methods Builder** (`p_meth_01`) | 方法章節 | `DRAFT_METHODS`, `AUDIT_PLANNED_VS_PERFORMED` | 章節層級 (Section Lock) | 忠實反映 RCT 隨機分組、知情同意與 VR 防動暈中斷流程 (T21, T24, T25) |
| **Results Builder** (`p_res_01`) | 結果章節 | `BIND_RESULT_FACT`, `CHECK_P_VALUE_FORMAT` | 章節層級 (Results Lock) | 數值與效應量直連 Fact，嚴禁輸出 p=0 或 p=0.000 (T22) |
| **Discussion Causal Boundary** (`p_disc_01`) | 討論章節 | `DRAFT_DISCUSSION`, `AUDIT_CAUSAL_CLAIMS` | 章節層級 (Discussion Lock) | 提示因果推論邊界，嚴禁出現未登錄之幽靈數據 (T26, T27, T28) |
| **ClaimEvidenceLink** (`claimType`, `evidenceRelation`) | 主張對照 | `MAP_CLAIM_EVIDENCE`, `VERIFY_SUPPORT` | 連結層級 (Claim Lock) | 引用存在且確實支持內容，不張冠李戴 (T31, T32) |
| **Citation Renderer** (`citationSourceRefs`) | 引用渲染 | `INSERT_CITATION`, `RENDER_BIBLIOGRAPHY` | 引用層級 (Citation Lock) | Zotero 斷線保留本地引用，無 Word Live 標 STATIC_CITATION_EXPORT (T36, T50) |
| **Embedded Tables & Figures** (`embeddedTableRefs`, `embeddedFigureRefs`) | 出版表圖 | `EMBED_TABLE`, `EMBED_FIGURE` | 嵌入層級 (Embedding Lock) | Table 1 與 Figure 1 直接綁定真實數據，嚴禁文生圖假圖表 (T43, T44, T49) |
