# V3-U05-FULL 外部服務與 Provider 狀態報告 (Provider Status Report)

**工程識別：V3-U05-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、文獻檢索與外部 Provider 狀態盤點

| Provider / 服務 | 角色與能力 | 本輪狀態 | 帳號／金鑰與防護原則 |
|---|---|---|---|
| **Consensus API** | 正式參與檢索計畫，提取問題導向之研究候選與 Takeaway | `LIVE_VERIFIED` (既有 adapter 實測 200) | 嚴格受限於 `retrievalBudgetCap`（預設 10 篇）；無金鑰時採 `FIXTURE`，不偽造 LIVE 成功 |
| **Ai4Scholar API** | Semantic Scholar / PubMed 代理檢索 | `LIVE_VERIFIED` (以會員 B 測試 200) | 依積分制計費，檢索任務記錄於 Search Log，不重複調用 |
| **Semantic Scholar (直連)** | 論文 Graph、引用關係與相近研究擴展 | `FALLBACK_ONLY` | 頻繁 429 限流，作為 Ai4Scholar 之備援通道 |
| **OpenAlex / Crossref** | 開放書目、DOI 中繼資料與出版後更正／撤稿通知 | `LIVE_VERIFIED` | 依 Canonical Dedup 去重，同篇多平台取得不重複計票 (T11) |
| **Zotero Web API v3** | Collection 綁定與正式引用匯入 | `OFFLINE_RESILIENT` | 依賴本地快取 `CitationSource` 即可繼續，遠端斷線不阻止 Gap 規劃 (T36) |
| **OpenClaw Gateway / LLM** | 老麥一鍵協作修訂、新穎性邏輯一致性檢查 | `LOCAL_ORCHESTRATED` | 採用小模板任務契約，嚴禁將建站規格整份塞給模型；生成失敗保留局部結果 |

## 二、安全性與隔離宣告 (S9)

1. **無憑證外洩**：所有金鑰由伺服器環境變數管理，未出現在任何交付文件、Git 歷史或測試案例中。
2. **反確認偏差防護**：強制包含反證檢索任務（COUNTEREVIDENCE），嚴禁為追求高分隱匿反向效果。
3. **資料邊界保護**：課堂私有數據、未公開成績與個人識別資料嚴禁上傳至外部公共文獻庫或 Zotero。
