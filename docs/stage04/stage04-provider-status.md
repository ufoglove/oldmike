# V3-U04-FULL 外部服務與 Provider 狀態報告 (Provider Status Report)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、文獻檢索與外部 Provider 狀態盤點

| Provider / 服務 | 角色與能力 | 本輪狀態 | 帳號／金鑰與防護原則 |
|---|---|---|---|
| **Consensus API** | 學術論文搜尋、SJR 排行偏好、Takeaway 摘錄 | `LIVE_VERIFIED` (以既有 adapter 實測 200) | 本機開發環境無金鑰時採 `FIXTURE`；生產環境共用月額度受 `retrievalBudgetCap` 嚴格限制，不擅自調用 |
| **Ai4Scholar API** | Semantic Scholar / PubMed 代理檢索 | `LIVE_VERIFIED` (既有 adapter 實測 200) | 消耗使用者積分額度；藍圖任務產生 `EvidenceNeed` 送交文獻中心，不在此重跑搜尋 |
| **Semantic Scholar (直連)** | 免費開源論文檢索 | `FALLBACK_ONLY` | 頻繁 429 限流，作為 Ai4Scholar 失敗時之退避備援 |
| **OpenAlex / Crossref** | 開放書目與 DOI 中繼資料核對 | `LIVE_VERIFIED` | 依 Canonical Dedup 合併論文，同篇多來源不算獨立多篇支持 (T18) |
| **Zotero Web API v3** | 書目管理、Collection 集合綁定 | `OFFLINE_RESILIENT` | 依賴本機快取 `CitationSource` 即可繼續藍圖規劃，遠端暫時斷線不阻礙進度 (T22) |
| **OpenClaw Gateway / LLM** | 老麥一鍵起草、邏輯一致性檢查 | `LOCAL_ORCHESTRATED` | 採用小模板（骨幹 prompt），嚴禁將建站規格整份注入模型；生成失敗或限流保留局部草稿 |

## 二、安全性與隔離宣告 (S6)

1. **無密鑰洩漏**：所有秘密金鑰均由伺服器環境變數管理，未出現在任何交付文件、Git 歷史或測試案例中。
2. **預算守衛**：單一 EvidenceNeed 定向檢索上限預設為 10 篇，杜絕無限制模型迴圈。
3. **資料邊界**：學生名冊、課堂私有數據等未公開資料嚴禁上傳至外部公共文獻庫或 Zotero。
