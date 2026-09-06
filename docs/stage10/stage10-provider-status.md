# V3-U10-FULL 外部 Provider 與計分引擎狀態盤點 (Provider & Engine Status)

**工程識別：V3-U10-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **`scoring-preview-engine` (v1.0.0)** | 核心受控沙盒計分預覽引擎 | **LIVE_VERIFIED** (完全運作) | 執行嚴格先缺失過濾、安全反向轉碼 ($lower+upper-x$)、最低作答門檻檢驗與加總平均運算 | 純本地確定性演算法，嚴禁任意 eval 或代碼注入，標記 SYNTHETIC_INSTRUMENT_TEST (T29, T30, T31) |
| **DeepL / Translation API** | 翻譯與文化調適草稿協助 | **FIXTURE / ADAPTER_READY** | 協助產生初步題項語言調適草稿，保留原版對照與修改點 | 機器翻譯嚴禁標記為 Validated Translation，認知訪談留作 Stage 11 (T19, T20) |
| **Consensus / Lit API** | 工具文獻與測量品質檢索 | **FIXTURE / ADAPTER_READY** | 檢索原作者發表文獻與心理計量學指標 (Cronbach's alpha 等) | 他人樣本品質不寫成本專案實證結果，無憑證不回假全文 (T13, T14, T15) |
| **Zotero Web API v3** | 量表手冊與參考文獻同步 | **MOCK / CONTRACT_VERIFIED** | 保持 Library + Item + Version 版本對應，離線時完整保留本地引用 | 僅使用唯讀範圍，不要求全庫寫入 (T16) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責工具選用理由草擬、Protocol 章節組裝與一致性檢查 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T38, T39, T40) |
