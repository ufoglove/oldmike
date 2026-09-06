# V3-U12-FULL 外部 Provider 與硬體/AI 系統狀態盤點 (Provider & System Status)

**工程識別：V3-U12-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Device / Module | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **HTC Vive Pro Eye SDK (v2.1)** | 穿戴式 VR 與眼動日誌擷取 | **LIVE_VERIFIED** (完全運作) | 實體擷取毫秒級凝視反應時間 (RT_MS_T0=3421.5ms, RT_MS_T1=1850.2ms)，採樣率 90Hz，時間同步 2.1ms | 原始資料直存不可變層，附帶 SHA-256 簽章，受試者虛擬代碼標註 (T17, T19, T21) |
| **DeepSeek AI Module (v4-pro)** | 自適應即時語意引導介入 | **LOCKED_STUDY_VERSION** | 固定 Prompt v1.2、溫度 0.2、固定種子 42，提供受控自適應情境鷹架 | 試驗期間嚴禁任意切換版本；若有切換觸發 MODEL_VERSION_CHANGED 警告 (T12, T20) |
| **IdentityMappingVault (身分金庫)** | 受試者直接個資加密管理 | **VAULT_ISOLATED** (最高安全) | 獨立金庫加密儲存真實身分與聯絡方式，研究頁面僅呈現 P-001 等虛擬代碼 | 權限完全獨立，嚴禁送入 LLM 或分析資料集 (T05, T28, T37) |
| **Consensus / Zotero API** | 執行期參考文獻與協議核對 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，離線時完整保留本地引用 | 僅使用唯讀範圍，不要求全庫寫入 (T15, T16) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責偏差歸納、營運指標彙整與品質檢查，嚴禁代簽同意書或捏造數據 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T33, T34, T35) |
