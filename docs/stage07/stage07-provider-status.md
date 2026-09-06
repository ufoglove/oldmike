# V3-U07-FULL 外部 Provider 與計算能力狀態盤點 (Provider & Engine Status)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **`planning-calculation-engine` (v1.0.0)** | 核心受控規劃計算引擎 | **LIVE_VERIFIED** (完全運作) | 執行雙獨立樣本連續結果檢定力計算 ($d=0.5, \alpha=0.05, 1-\beta=0.80 \to n=64, N=128, N_{\text{recruit}}=151$)，以及固定可用 $N$ 之可偵測效果情境計算 | 本地確定性演算法，嚴格輸入驗證，禁止任意 AI 執行碼 (T17, T21, T38) |
| **複雜 SEM / 中介 / 多層模型規劃** | 進階統計計算引擎 | **CALCULATION_NOT_SUPPORTED** | 暫無可重現受控本地引擎，系統主動標記不支援並提示需專家審查，嚴禁私自套用簡單 t 檢定公式 (T19) | 明確告知邊界，避免產生誤導性樣本數 (T19) |
| **Consensus API** | 文獻與證據檢索 | **FIXTURE / ADAPTER_READY** | 沿用第五、六階段已有之檢索管線，缺乏即時網路憑證時維持安全降級，不中斷規劃作業 | 不洩漏未公開計畫與敏感資料 (T29, T30) |
| **Zotero Web API v3** | 書目引用與同步 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，離線時完整保留本地引用與 CitationSource | 僅使用唯讀範圍，不要求全庫寫入 (T31) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責文字論述、結構補全與邏輯檢查，不直接改寫計算數值或正式審核狀態 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T34, T35) |
