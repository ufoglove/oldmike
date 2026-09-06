# V3-U14-FULL 外部 Provider 與統計運算引擎狀態盤點 (Provider & Engine Status)

**工程識別：V3-U14-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **`statistical-computation-engine` (v1.0.0)** | 核心受控統計推論運算引擎 | **LIVE_VERIFIED** (完全運作) | 執行手算基準 (mean=3.0, var=2.5)、Welch t 檢定、ANCOVA 線性模型與 Holm 校正 | 本地純演算法，拒絕任意 eval 與動態代碼注入，標記 VALIDATED (T10, T11, T13) |
| **DATA_DRIVEN_SVG_RENDERER_V1** | 資料驅動學術圖表渲染引擎 | **LIVE_VERIFIED** (完全運作) | 產出 Table 1 與 Figure 1 交互作用趨勢圖，向量 SVG 與 PNG 匯出 | 圖表數值與 Error Bars 直連 ResultFact，嚴禁文生圖假圖表 (T42, T44) |
| **IdentityMappingVault (身分金庫)** | 受試者個資安全隔離金庫 | **VAULT_ISOLATED** (最高安全) | 統計分析與結果事實僅關聯虛擬代碼 (P-001)，直接識別個資完全隔離 | 權限完全獨立，嚴禁送入 LLM 或分析報表 (T05, T55) |
| **Consensus / Zotero API** | 統計方法文獻與參考資料同步 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，查詢統計方法時絕不攜帶受試者數據 | 僅使用唯讀範圍，不要求全庫寫入 (T49, T50) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責統計結果解說卡草擬、因果推論邊界提示與圖表說明生成 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T46, T47, T48) |
