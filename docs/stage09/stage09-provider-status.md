# V3-U09-FULL 外部 Provider 與審查能力狀態盤點 (Provider & Reviewer Status)

**工程識別：V3-U09-FULL｜日期：2026-09-06｜版本：v3.4.0**

| Provider / Engine | 模組定位 | 現行能力狀態 | 本輪使用策略 | 安全與防護邊界 |
|---|---|---|---|---|
| **Simulated Review Engine** (v1.0.0) | 三路線專屬模擬審查 | **LIVE_VERIFIED** (完全運作) | 針對 Journal (PRE_STUDY)、NSTC (科學/方法/PI) 與 MOE (教學/評量/師生) 進行差異化審查 | 嚴格標記 SIMULATED_REVIEW，禁止虛構 Results 或偽造著作 (T06, T07, T08) |
| **Official Rules Evaluator** | 官方規則重驗證 | **FIXTURE / ADAPTER_READY** | 追蹤國科會、教育部與期刊投稿最新作業要點，標記驗證狀態 | 來源失敗標記 SOURCE_UNAVAILABLE，不捏造截止日 (T09, T10) |
| **Ethics Scope Screener** | 倫理範疇篩檢引擎 | **LIVE_VERIFIED** (完全運作) | 評估人體受試、穿戴式 VR、眼動生理指標等 15 類指標，輸出 REVIEW_LIKELY_REQUIRED | 僅為系統初篩，絕不代替所屬機構審查會宣告免審 (T17, T19) |
| **Consensus / Lit API** | 文獻增強與證據補足 | **FIXTURE / ADAPTER_READY** | 當 Reviewer 指出 Gap/Theory 證據不足時，導航直達既有文獻中心補足 | 不洩漏未公開計畫與敏感審查筆記 (T39, T40) |
| **AI Assist Orchestrator** | 老麥一鍵協作 | **SANDBOXED_MOCK / FIXTURE** | 負責建議修訂、修訂任務生成與合規自檢，不直接改寫已鎖定內容 | 嚴格白名單 patch，遵循 If-Match 樂觀鎖 (T35, T36) |
