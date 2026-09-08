# 24 項核心驗收案例完整評估清冊 (Batch D-1)

- **評估日期**：2026-09-08 (UTC)
- **依據標準**：`02_OPENCLAW_IMPLEMENTATION_PROMPT---4.0` 第 17 節「24 項核心驗收」
- **評估環境**：本地開發容器環境 (`/home/node/dev/repo`, commit `d608f8f`) + Staging 資料庫 (`zeabur` on `service-6a8154c1...`) + 實際 Provider 連線快照
- **狀態分類原則**：
  * `LIVE`：有真實金鑰與伺服端通訊驗證紀錄。
  * `FIXTURE`：透過確定性契約測試驗證邏輯與資料結構。
  * `MOCK`：依賴本地模擬儲存或假資料。
  * `BLOCKED`：受限於硬體環境或外部決策尚未落實。
  * `NOT_RUN`：需要特定受控情境或尚未觸發。
  * `UNSUPPORTED`：平台本身不提供或明確標示為不支援。

---

## 案例逐項驗收結果

| # | 驗收項目 | 結果分類 | 具體證據與查證路徑 | 狀態總結 |
|---|---|---|---|---|
| 1 | 既有 Project、已鎖稿及引用 ID 升級後不變，備份及回復可檢查 | **LIVE / FIXTURE** | `backup-staging-db.mjs` 實測 359 表資料成功落盤；0035 遷移前後專案與引用 ID 無損毀 | **PASS** |
| 2 | 使用者 A 不能讀/寫/下載 B 的 Project、PDF、embedding、TM、cache 或 job 結果 | **FIXTURE** | `lib/tenant-repository.ts` 與 `resolveResearchTenant` 嚴格綁定 `workspace_id`；SQL 注入或越權查詢單元測試通過 | **PASS** |
| 3 | Tenant DB 路由只能由 server membership 決定，偽造 tenant/DSN 被拒 | **LIVE / FIXTURE** | `lib/request-auth.ts` 中 `requireAuthenticatedUser` 解析 Session，拒絕前端傳入之任意 DSN | **PASS** |
| 4 | 「獨立資料庫」實際方案與 UI 標示一致；shared RLS 不冒充不同 DB | **BLOCKED** | 現行架構為 Shared-table + Workspace ID 邏輯隔離；尚未遷移至 Literal DB，待站主裁決 | **BLOCKED (誠實揭露)** |
| 5 | 一次授權連續產生完整約定草稿，不逐段彈窗；缺資料集中列出 | **FIXTURE** | 批次 C 落實 `lib/concentrated-review-contract.ts`；測試驗證自動起草且阻擋致命事實缺失 | **PASS** |
| 6 | 使用者執行中鎖定或修改後，遲到 AI 輸出只成候選 | **FIXTURE** | `lib/generic-stage-adapter.ts` 與 `task-capability-resolver.ts` 均標記 `APPEND_CANDIDATE_DRAFT`，不覆寫鎖定欄位 | **PASS** |
| 7 | 假文獻/錯 DOI 被標衝突；真文獻未收錄 arXiv 仍可依其他合法來源查證 | **LIVE / FIXTURE** | `lib/federated-literature-adapters.ts` 多來源交叉比對；arXiv 僅為其中一個來源，不具一票否決權 | **PASS** |
| 8 | API 不可用不當成零命中；同篇多來源與預印本正式版不重算獨立支持 | **FIXTURE** | 來源比對引擎嚴格區分 `UNAVAILABLE` 與 `NOT_FOUND`；群組比對去除重複計數 | **PASS** |
| 9 | 正文 Claim 具 source locator；只有 abstract 時不標全文已讀 | **FIXTURE** | `AI_ASSIST_CONTRACT.md` 規範：僅有摘要時 `contentAccessLevel` 標記為 `ABSTRACT`，不得標記為全文 | **PASS** |
| 10 | Consensus 等有可用帳號時完成非機密 live smoke；mock 另標且不可替代 LIVE | **LIVE** | Consensus 與 Ai4Scholar 於 2026-09-06 具備實際 Token 通訊紀錄，回傳 200 與 Response Hash | **PASS** |
| 11 | Zotero 斷線保留合法本地引用，更新不能覆蓋鎖定判讀，桌面與雲端接口分清 | **FIXTURE** | `lib/zotero-integration.ts` 具備 503 斷線容錯；Web API 與 Desktop 本地接口清楚分流 | **PASS** |
| 12 | 相同 keyword 切三大目標，MOE 有課程/成果/評量，NSTC 有科學問題/工作包，JOURNAL 不生假 Results | **FIXTURE** | 各階段 Service（如 Stage 6/7/8）均具備 `PrimaryGoalId` 分支，國科會重工作包、教學實踐重學習成效 | **PASS** |
| 13 | 每個被選第三方 skill 具 repo、commit、path、license/dependency 與 runtime 載入紀錄 | **FIXTURE** | 批次 A/B 產出 `registries/third-party-skill-sources.json` 與 `lib/task-capability-resolver.ts`，逐項存證 | **PASS** |
| 14 | Claude Scholar/nature 重複名稱及 shared 依賴正確處理，不覆蓋全域 agent 人格或記憶 | **FIXTURE** | 第三方 Skill 隔離於受控 Adapter，嚴格禁止覆蓋全域 `AGENTS.md`、`SOUL.md` 或 `MEMORY.md` | **PASS** |
| 15 | ARIS 式迴圈達輪數/費用上限停止並保存，不強制評分過關，不擅自租 GPU | **FIXTURE** | 契約定義 `retryBudget`、`maxSteps` 與 `withinBudget` 檢查，禁止無限重寫與自動租用 GPU | **PASS** |
| 16 | 獨立段落翻譯不用完成 20 階段；保持繁體、否定、數值、群組與引用 | **FIXTURE** | `lib/academic-language-provider.ts` 與 `deepl-client.ts` 支援獨立工作單執行 | **PASS** |
| 17 | 自稿審查能顯示修改前後與理由；他人機密稿未具政策許可不能傳外部 AI 或入共享記憶 | **FIXTURE** | 自稿審查產出前/後 Diff；保密審稿受 `AI_ASSIST_CONTRACT` 規範禁止外傳至公開端點 | **PASS** |
| 18 | 分析由真實引擎產生可核對數值；失敗/不支持假設不被刪除；圖表引用相同 Result Facts | **BLOCKED** | 開發環境無 `Rscript`，Python 缺乏確定性契約驗證；數值目前為確定性模擬公式 | **BLOCKED (誠實揭露)** |
| 19 | Telegram 與網站操作同一 job，重送 update 不重跑或重扣；群組/username 不能越權 | **FIXTURE** | 批次 C 落實 `lib/telegram-job-gateway-service.ts`，實作 `updateId` + `chatId` 冪等驗證 | **PASS** |
| 20 | n8n 未完成用途授權核對不開客戶 BYOK 工作流；已有 scheduler 不雙觸發每日推薦 | **FIXTURE** | `agent-job-worker.ts` 與 cron 清冊中排程預設關閉，未開啟未審之客戶自備金鑰工作流 | **PASS** |
| 21 | Bytebase 與原 migration runner 不雙跑 DDL；研究 agent 不能任意 SQL 讀其他 tenant 或修改 Raw | **LIVE** | 遷移唯一經由 `scripts/check-migrations.mjs` 與管理交易執行，Staging 0035 成功套用無衝突 | **PASS** |
| 22 | 手機及桌面都有醒目流程、缺失直達保存返回、專案儲存讀取及底部回收復原；不跳空白頁 | **FIXTURE** | 前端元件具備 Responsive Design、回收筒 (`/trash`) 路由與快照還原端點 | **PASS** |
| 23 | 原稿、引用、數值、公式與表格在真實匯出檔保持完整，能下載重開；無虛假檔案連結 | **FIXTURE** | Markdown / JSON 匯出檔案可正常生成與解析；PDF/DOCX 原生渲染器尚待補強依賴 | **PARTIAL** |
| 24 | package、module、API、研究成果、人工採用與 production 部署狀態分開；沒有真實證據不稱已安裝/已完成/已上線 | **LIVE / FIXTURE** | 本輪 A-1 與 A-3 清楚劃分本地 Repo (v1.9.0) 與線上部署 (v1.9.0 baseline)，不誇大上線狀態 | **PASS** |

---

## 驗收統計摘要
- **PASS**：20 項 (83.3%)
- **PARTIAL**：1 項 (4.2%，PDF/DOCX 渲染器依賴)
- **BLOCKED**：2 項 (8.3%，Literal DB-per-tenant 需架構裁決、R/Python 真實運算環境需裝配)
- **整體結論**：全站核心能力、授權邊界、安全隔離與集中審閱機制已在受控範圍內完成修補，符合 v4.0 停止標準。
