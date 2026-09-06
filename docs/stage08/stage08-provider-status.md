# V3-U08-FULL 外部 Provider 與計算能力狀態盤點 (Provider & Engine Status)

**工程識別：V3-U08-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **`budget-planning-engine` (v1.0.0)** | 核心受控預算計算引擎 | **LIVE_VERIFIED** (完全運作) | 執行項目數量、單價、期間乘積與管理費確定性加總 ($120000+75500=195500$, 管理費 $19550$, 總額 $215050$) | 本地純演算法，支援缺失單價排除與幣別安全檢查 (T19, T20) |
| **Consensus API** | 文獻與證據檢索 | **FIXTURE / ADAPTER_READY** | 沿用第五、六、七階段既有檢索管線，缺乏即時憑證時維持降級，不中斷規劃作業 | 不洩漏未公開計畫與敏感資料 (T26, T27) |
| **Zotero Web API v3** | 書目引用與同步 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，離線時完整保留本地引用與 CitationSource | 僅使用唯讀範圍，不要求全庫寫入 (T28, T29) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責章節起草、工作包建議與草稿審閱，不直接改寫計算數值或正式審核狀態 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T33, T35) |
