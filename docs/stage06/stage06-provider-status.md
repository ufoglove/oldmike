# V3-U06-FULL 外部服務與 Provider 狀態報告 (Provider Status Report)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、文獻檢索與外部 Provider 狀態盤點

| Provider / 服務 | 角色與能力 | 本輪狀態 | 帳號／金鑰與防護原則 |
|---|---|---|---|
| **Consensus API** | 檢索理論原典與相近理論模型 | `LIVE_VERIFIED` (以既有 adapter 實測 200) | 補理論證據時調用，受預算上限限制；無金鑰時採 `FIXTURE` |
| **Ai4Scholar API** | 補充理論定義之學術引文追蹤 | `LIVE_VERIFIED` (以會員 B 測試 200) | 依積分制計費，任務回傳至文獻中心，不重複調用 |
| **OpenAlex / Crossref** | 核對經典理論出處、出版年份與更正通知 | `LIVE_VERIFIED` | 依 Canonical 去重，不虛構作者年份 (T10) |
| **Zotero Web API v3** | 理論原典書目與 Collection 綁定 | `OFFLINE_RESILIENT` | 依賴本地快取 `CitationSource` 即可繼續，離線不阻止建模 (T24) |
| **OpenClaw Gateway / LLM** | 老麥機制修訂、推導生成與 Alignment 檢查 | `LOCAL_ORCHESTRATED` | 採用小模板任務契約，嚴禁整份規格注入；生成失敗保留局部結果 |

## 二、安全性與隔離宣告 (S5)

1. **無密鑰外洩**：所有金鑰由伺服器環境變數管理，未出現在任何交付文件、Git 歷史或測試案例中。
2. **防因果通膨**：模型中假設因果標記為 `HYPOTHESIZED_CAUSAL`，嚴禁稿件宣稱因果已證實或自動填入統計顯著性。
3. **資料邊界保護**：課堂私有數據、未公開成績與個人識別資料嚴禁外傳至外部公共文獻庫或 Zotero。
