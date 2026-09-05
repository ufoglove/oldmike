# PROJECT_STATE.md — 老麥科研寫作平台 V3-U01

更新：2026-09-05 07:5x UTC（建站代理記錄）
範圍基準：docs/rebuild/phase-01-scope.md（V3-U01 唯一範圍）。本檔供對話中斷後恢復，不把聊天當唯一記憶。

## 目前 commit / 來源
- /home/node/dev/repo 已 git init（main）：
  - cb2879f V3-U01 baseline（重建樹＋本日前修復）
  - cc43114 V3-U01 isolated env＋migration 0031（up/down roundtrip PASS）
- tgz 快照：v3u01-baseline-SOURCE-20260905.tgz（git 建立前）。
- production 最後部署：6a9bc0aa918d24b236ebc1cc RUNNING（09-05 07:1x，reset/GapNoveltyLab/BlueprintStudio 修復）。本階段「不動正式網站替換」。

## 已完成能力（真實測試）
- 登入（Better Auth）、顯示名稱變更 API（/api/account/profile）與 UI（ProfileDisplayNameForm，管理者可見）。
- 專案建立/切換（projects + workspaces + workspace_members；topbar 下拉常駐；/api/projects preview+create 201 實測）。
- 重置（永久）API：tenant-repository remove() 執行期 schema 驅動引擎（32 張 append-only 守衛＋FK 拓樸＋殘留檢查）；前端 ProjectResetZone 兩步確認（V3 後將改回收筒優先，見 GAP-01）。
- 文獻與證據中心：/api/projects/{id}/literature GET（items+matrix，110 筆 canonical literature_items 存在 DB）；Evidence Matrix；角色多選（BACKGROUND…DISCUSSION）；多對多 ProjectLiteratureLink。
- Zotero：/api/zotero GET（collections 實測 200，3 collections）＋/api/projects/{id}/zotero（per-project route 存在，行為待稽核）；ZOTERO_API_KEY/USER_ID 已配置。
- 老麥服務：OpenClaw gateway＋vectide primary 主備援（openclaw.ts）；chat route；assist surfaces（S0/evidence/gap/theory…）。翻譯 OLD_MIKE/DEEPL 實測 SUCCESS（max_tokens 8192＋截斷修復）。
- Gap 與新穎性（重建 GapNoveltyLab）＋研究藍圖（ResearchBlueprintStudio）已接線（前次部署）。

## 進行中（本階段要新增）
- 回收筒（軟刪除/復原）：目前無（projects.status CHECK 只允許 ACTIVE/LEGACY_UNCLAIMED → 新增 trashed_at 欄位方案；API list/get/trash/restore）。
- AgentJob 持久任務底座：DB 無 agent_jobs 表（已查）；需 migration 0031＋worker。
- 研究啟動摘要 job＋版本保存。
- Zotero Project–Collection binding 分開保存（現況：zotero_bindings 表不存在）。
- docs/rebuild/*（本批已建骨架：architecture-audit/phase-01-scope/data-contracts/requirements-traceability/phase-01-test-report/deployment-and-rollback/PROJECT_STATE）。
- git 基線與 DB pg_dump 備份驗證（待授權：見 OPEN QUESTIONS）。

## 隔離測試環境（已建立，2026-09-05 08:0x）
- sandbox 本機 PostgreSQL 15.19 @127.0.0.1:5433（data dir /home/node/dev/v3u01-pg；user postgres trust）
- DB v3u01_dev：基底＝repo migrations 0001–0025（部分後期鏈因重建樹缺檔/順序問題中斷，見 R1）＋從 production 以唯讀目錄查詢複製 4 張文獻/Zotero 表（literature_items/project_literature_links/citation_sources/zotero_connections，DDL 存 /home/node/dev/v3u01-literature-tables.sql）
- migration 0031 up/down roundtrip 於 v3u01_dev 驗證 PASS（目前 re-UP 保留環境）
- production 為 PostgreSQL 18.6；sandbox pg_dump 15 無法直接 dump（version mismatch），pgdg repo 不可達；未對 production 做任何寫入

## 基線（2026-09-05 07:5x 實測，唯一 DB db=zeabur，host service-6a8154c1…）
- schema_migrations 記錄到 0030_external_language_provider_gateway（09-04 05:49 applied，recorded_by=check-migrations --record-all）
- 筆數：users=3、workspaces=3、projects=0、literature_items=110、research_documents=0、research_blueprints=0、project_artifacts=0、submission_navigator_runs=0
- ⚠️ 異常待確認：users=3 但 projects=0。Joseph 若預期有舊專案，此 DB 內沒有（可能早於 09-04 清空或資料在另一實例）。需登入實測確認。
- ⚠️ repository database/migrations 只有到 0025（50 檔）；0026–0030 的 up/down SQL 不在 repo、不在任何快照（已在 repo-snapshot-*.tgz、V2.zip、restore-* 全數搜尋）。DB 內表存在（migration 已記錄）。隔離環境重建 schema 需先補回或改以 pg_dump schema 為來源。

## 待決事項（需使用者授權，勿默認）
1. DB 0 專案異常：請登入確認專案清單（是預期清空？還是資料遺失待查？）
2. 隔離環境：sandbox 無本機 PG（127.0.0.1:5432 無回應）。選項：A) sandbox 安裝 PostgreSQL 建 disposable DB（本機驗證 migration/測試）；B) 授權直接在正式 DB 套用 additive migration（先 pg_dump 備份）；C) 建立 Zeabur staging service＋獨立 DB。
3. migration 0031+（agent_jobs、trashed_at 等）套用時點與環境。
4. 正式部署切換時點（本階段預設不切換；程式碼可 build 驗證）。
5. 永久重置 API 去留：V3 規範以回收筒為主、無保護一鍵清空不提供 → 建議 UI 移除重置，保留 API 僅供授權管理路徑。

## OPEN ISSUES
- consensus MCP server 誤殺後 runtime 重啟出現雙實例；已清雙實例，工具仍 Not connected → 需 gateway 重整或下次 session 驗證。
- 真實 AI 正測需正式/staging env（gateway base pathname 限制）。

## 下一批工作（收尾）
- 回收筒/摘要卡/文獻中心 UI 瀏覽器走查（playwright 或正式環境）
- 最終交付：修改清單＋測試報告＋授權清單（正式部署需另授權）
- consensus MCP 重整（gateway restart）
1) docs/rebuild 五份文件補完（audit/scope/contracts/traceability/test-report/deploy）
2) 差異矩陣定稿 → 3) migration 0031 撰寫（隔離驗證）→ 4) trash/restore API＋UI → 5) AgentJob 底座＋start-summary → 6) Zotero binding 稽核與最小 UI → 7) 測試報告＋授權清單
