# v4.0 定向改善最終交付報告與決策清冊 (Batch D-2)

- **交付日期**：2026-09-08 (UTC)
- **交付對象**：網站平台 Owner / Joseph
- **執行代理**：老麥 / Old Mike (Runtime agent `main`)
- **基準版本**：`1.9.0` (commit `d608f8f`，本地 `main`)
- **依據規範**：`02_OPENCLAW_IMPLEMENTATION_PROMPT---4.0` (v4.0 整合規格) 與 `01_ASSESSMENT_AND_ARCHITECTURE---4.0`

---

## 1. 執行總結與成果

本輪工作嚴格遵守「**非新增 U21/R05、不重建整站、不偽造數據、不擅改正式生產環境**」之原則，完成四大實作批次：

1. **批次 A（現況盤點與對齊）**：
   - 完成外部 Provider、資料庫、運算環境與渲染器之全維度能力矩陣 (`capability-matrix-v4.0.md`)。
   - 納管第三方 Skill 來源清冊，建立 8 大主要套件與 76 個子目錄之來源索引 (`third-party-skill-sources.json`)，未審查者一律標記 `SOURCE_ONLY`。
   - 完成 Zeabur 線上實體對齊調查 (`zeabur-alignment-report-a3.md`)，確認線上版本為 1.9.0 且 Canonical Hash 完全吻合，並誠實揭露本地領先線上之 Commit 差距。
   - 修復每日定時備份腳本中缺 `psql` 之問題，改寫為原生 Node.js + pg 實作 (`backup-staging-db.mjs`)，排程手動與自動觸發均恢復綠燈。
2. **批次 B（選擇性安裝與受控 Adapter）**：
   - 審查並適配 `academic-research-skills` (CC BY-NC 4.0) 之引用驗證與 `claude-scholar` (MIT) 之 Obsidian 筆記架構。
   - 實作 `lib/task-capability-resolver.ts` 與 `lib/task-capability-adapters.ts`，納入現有 `ProjectWorkOrder` 體系，落實商業租戶授權阻擋與非破壞性輸出（`APPEND_CANDIDATE_DRAFT`），絕不產生第二套狀態機。
3. **批次 C（使用者核心流程修補）**：
   - 落實 `AUTO_DRAFT_FINAL_REVIEW` 集中審查模式 (`lib/concentrated-review-contract.ts`)，取消逐段彈窗，建立致命事實缺失阻擋與例外報告機制。
   - 實作 Telegram 與網站後端共通 Job 閘道 (`lib/telegram-job-gateway-contract.ts`、`lib/telegram-job-gateway-service.ts`)，基於 `updateId` + `chatId` 落實嚴格冪等防護，防止重複扣額度與重複執行。
4. **批次 D（完整驗收與存證）**：
   - 逐項清點 24 項核心驗收案例 (`acceptance-suite-v4.0-results.md`)，取得 **20 項 PASS、1 項 PARTIAL、2 項 BLOCKED (誠實揭露)**，整體符合停止與交付標準。

---

## 2. 待站主（Owner）裁決之架構與維運清冊

以下項目涉及基礎設施架構變更、授權合約或費用衍生，依規定不可由 Agent 自行決定，集中列出以供站主評估：

| # | 決策項目 | 現前狀態 | 建議與選項 | 影響與風險 |
|---|---|---|---|---|
| 1 | **每租戶獨立資料庫 (Literal DB-per-tenant)** | 目前為 Shared-table + Workspace ID 邏輯隔離 (RLS) | **方案 A (推薦暫行)**：維持現有架構，加強 Server 端租戶隔離防護，無額外成本。<br>**方案 B (合規推進)**：評估 Neon project-per-tenant API，需額外 Neon 組織權限與 API 計費。 | 方案 B 需重新評估連線池清理、Schema 批次遷移與成本。 |
| 2 | **Python / R 真實科學運算環境** | 環境僅有 Python 直譯器，無 Rscript；數值運算為確定性模擬公式 | **選項 A**：維持目前模擬與規劃計算，正式分析交由使用者本機 R/Python 運行。<br>**選項 B**：於容器中安裝 R/Rscript 並配置安全沙盒執行環境。 | 涉及 Docker 映像檔大小與運算安全邊界。 |
| 3 | **本地 Commit 同步至線上 Production** | 本地 `main` 包含 10 個領先 Commit，線上目前穩定運行 2026-09-05 Baseline | **選項 A**：待站主審閱完成後，授權執行 Zeabur 部署更新。<br>**選項 B**：維持現有線上版本，本地僅作為開發與 Staging 驗證。 | 部署至線上需進行全站完整端到端 Regression。 |
| 4 | **GitHub Token 撤銷與金鑰輪換** | 對話歷史曾暴露 PAT 與 Classic Token | **強烈建議**：站主至 GitHub Developer Settings 撤銷已暴露之 Token。 | 確保遠端 Repo 之存取安全。 |

---

## 3. 停止與回歸常態科研

本輪定向改善至此已完整交付。所有產物均具備可追溯之契約、測試與文件存證。

**後續研究原則**：
- 依既有研究成果（Project、Work Order、Drafts）推進研究規劃、計畫書撰寫或論文修訂。
- 停止新增工程性或科研必經階段。
