# V3-U11-FULL 外部 Provider 與預試驗證引擎狀態盤點 (Provider & Engine Status)

**工程識別：V3-U11-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **`rater-calibration-engine` (v1.0.0)** | 核心受控評分者信度計算引擎 | **LIVE_VERIFIED** (完全運作) | 嚴格計算兩評分員 Cohen's Kappa ($Po=0.90, Pe=0.28, \kappa=0.861$) 與一致性百分比 ($90\%$) | 純本地確定性演算法，嚴禁 AI 隨機捏造信度值 (T09, T13) |
| **HTC Vive Pro Eye SDK / VR Log** | 穿戴式眼動通訊日誌系統 | **SYNTHETIC_TEST / SIMULATED** | 模擬 1,000 次事件通訊壓力測試，驗證平均延遲 38.5ms (<50ms) 與丟包率 0.2% | 本地沙盒通訊測試，標記 SYNTHETIC_TEST，不混入研究資料 (T17, T18) |
| **DeepSeek AI Module (v4-pro)** | 自適應鷹架生成輔助模組 | **VALIDATED_FOR_PILOT** | 驗證固定隨機種子 (Seed)、封閉第三方資料快取與啟用人工介入中斷機制 | 模型版本更新時強制觸發 REVALIDATION_REQUIRED (T19, T20) |
| **Consensus / Zotero API** | 預試文獻與參考資料同步 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，離線時完整保留本地引用 | 僅使用唯讀範圍，不要求全庫寫入 (T15, T16) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責測試清單生成、偏差日誌歸納與修訂提案草擬 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T33, T34, T35) |
