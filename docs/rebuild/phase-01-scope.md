# phase-01-scope.md — V3-U01 範圍（唯一基準）

最小完整流程：登入 → 建立/切換專案 → 輸入領域或關鍵字 → 老麥產生研究啟動摘要 → 保存版本 → 本專案文獻與證據列表 → Zotero 選定 Collection 唯讀連結 → 保存筆記 → 返回專案恢復進度。

## 本次實作（對照現況）
| # | 項目 | 現況 | 處置 |
|---|------|------|------|
| 1 | 首頁研究路徑、專案下拉、顯示名稱、一個 Next Best Action | 大部分已存在（overview 路徑總覽＋下拉常駐＋profile API） | 稽核補缺（自訂顯示名稱 UI 使用者側） |
| 2 | 專案建立/編輯/移至回收筒/復原 | 建立✅；編輯❌；回收筒❌；永久刪除✅(API) | 新增：PATCH meta、trashed_at 軟刪、restore、回收筒清單；UI 移除日常永久刪除 |
| 3 | 權限/版本/文獻多對多 | resolveResearchTenant✅；research_documents 版本鏈✅；literature 多對多✅ | Evidence Note 稽核與補齊 |
| 4 | 老麥對話＋可恢復任務＋不假成功 | chat/assist✅；無持久 job | 新增 agent_jobs/job_events＋worker＋start-summary job＋版本 artifact |
| 5 | 模組建置/研究進度/審查/執行權限分開 | 部分（stageDefinitions/PhaseProgressCards/鎖定原因） | 稽核後最小補齊（module_delivery 登錄表） |
| 6 | Zotero 唯讀選定範圍 | /api/zotero✅ | binding 表＋per-project 匯入稽核＋NEEDS_CONFIGURATION |
| 7 | API/Skills 能力清單 | 無現成文件 | docs/capability-registry（含待查：Paperpal/ai4scholar 官方 API 狀態） |
| 8 | 刷新/重啟/失敗/隔離/備份還原測試 | 部分（QA 慣例） | 本階段測試報告如實列出；migration 隔離驗證 |

## 不包含（不建完整引擎）
前沿計量、候選題池、投稿匹配、完整 Gap/理論/設計、IRB、量表、Pilot、正式研究、統計、全文生成、翻譯引擎、投稿包、審稿回覆（既有已通過者可保留，不刻意關閉）。

## 完成定義
V3_U01_FOUNDATION_VERIFIED（基礎/專案/本地資料流程真實測試）＋V3_U01_ZOTERO_READ_VERIFIED（授權 collection 真實唯讀往返）＋OPENCLAW_INTEGRATION_VERIFIED（真實呼叫回寫錯誤權限驗證）。三項分開，不混為 100%。缺外部憑證則標 BLOCKED_EXTERNAL_CONFIG。
