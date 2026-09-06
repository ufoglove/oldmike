# V3-U13-FULL 外部 Provider 與資料處理管線狀態盤點 (Provider & Pipeline Status)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Pipeline Module | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **`data-preparation-pipeline` (v1.0.0)** | 確定性受控資料清理管線 | **LIVE_VERIFIED** (完全運作) | 執行缺失碼優先過濾 (99/-9)、安全反向計分 ($lower+upper-x$)、前導零保留與極端值標記 | 本地純演算法，拒絕任意 eval 與動態腳本執行，標記 DATA_PREPARATION_DIAGNOSTIC (T09, T11, T12) |
| **Parquet / Structured File Storage** | 分析資料集持久化與封存 | **LIVE_VERIFIED** (完全運作) | 封存 Per-Protocol 分析資料集，計算 64 字元 SHA-256 數位簽章 | 原始 Raw Data 維持不可變，分析資料集鎖定後禁止原地覆寫 (T17, T43, T44) |
| **IdentityMappingVault (身分金庫)** | 受試者個資安全隔離金庫 | **VAULT_ISOLATED** (最高安全) | 獨立金庫加密儲存真實身分與聯絡方式，分析資料集僅使用虛擬代碼 (P-001) | 權限完全獨立，嚴禁送入 LLM 或進入分析資料庫 (T25, T26) |
| **Consensus / Zotero API** | 資料清理方法與文獻追溯 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，查詢清理方法時絕不攜帶受試者資料 | 僅使用唯讀範圍，不要求全庫寫入 (T38) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責字典名稱建議、缺失原因整理與資料品質診斷報告草擬 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T33, T34, T35) |
