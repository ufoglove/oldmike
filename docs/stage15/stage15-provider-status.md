# V3-U15-FULL 外部 Provider 與寫作引擎狀態盤點 (Provider & Engine Status)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **Manuscript Builder Service (v1.0.0)** | 核心證據驅動寫作引擎 | **LIVE_VERIFIED** (完全運作) | 逐章起草 (Title, Abstract, Introduction, Methods, Results, Discussion, Conclusion)，所有結果數值嚴格綁定不可變 ResultFact 標籤 | 嚴禁 AI 改寫數值或心算新百分比，Discussion 幽靈數據觸發 FATAL (T19, T27) |
| **Table & Figure Embedding** | 出版級表圖嵌入渲染 | **LIVE_VERIFIED** (完全運作) | Table 1 (ANCOVA 結果表) 與 Figure 1 (交互作用趨勢圖) 直接嵌入正文 | 資料驅動渲染，嚴禁文生圖假圖表 (T43, T44) |
| **Citation Renderer (CitationSource + Zotero)** | 統一引用渲染與書目生成 | **MOCK / CONTRACT_VERIFIED** | 同一 Renderer 處理作者年份消歧、群組引文與號碼重排 | Zotero 斷線保留本地合法引用，無 Word Live 標 STATIC (T36, T50) |
| **Consensus / Lit API** | 寫作期文獻補強檢索 | **FIXTURE / ADAPTER_READY** | 缺背景或方法文獻時建立定向 EvidenceNeed，檢索 query 嚴禁攜帶受試者資料 | 不洩漏 Raw 或未公開稿段 (T35) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責章節論述、段落起草與科學解說，僅引用已核准 Fact 與文獻 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T14, T15, T45) |
