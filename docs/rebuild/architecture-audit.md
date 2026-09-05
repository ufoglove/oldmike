# architecture-audit.md — V3-U01 現況盤點（2026-09-05 07:5x UTC 實測）

盤點方法：原始碼 grep/find、tsc/build、production container 檔案比對、production API 登入實測（QA 帳號已清除）、直接 DB 查詢（環境變數 DATABASE_URL=POSTGRES_URI=POSTGRES_CONNECTION_STRING 指向同一 DB）。

## 技術棧
Next.js（App Router, standalone）＋pg（直接 SQL repository 層，無 ORM）＋Better Auth＋Zeabur 單一 service。後端金鑰只存 server env（驗證過 env 名稱清單，無前端暴露）。

## 路由與登入（✅）
- 82 條 app/api route 原始碼=production 一致；匿名掃描 0×500（401/403/405/404 皆守衛行為）。
- /api/auth/*（Better Auth）、/api/account/profile（顯示名稱變更）、/api/account/status。
- 權限模型：users→workspaces(owner)→projects(created_by)＋workspace_members；resolveResearchTenant 伺服器驗證。全新帳號需 personal workspace 否則 503 workspace_not_provisioned（設計）。

## 專案（⚠️）
- projects 表：project_id/workspace_id/created_by/title/status(ACTIVE|LEGACY_UNCLAIMED)/legacy/storage_backend/created_at/updated_at。無軟刪除欄位、無編輯 API（僅 create/remove）。重置為永久刪除（tenant-repository.remove()，09-05 已改為執行期 schema 驅動＋殘留檢查）。
- DB 現況：projects=0（異常，見 PROJECT_STATE OPEN QUESTIONS）。

## 文獻與證據中心（✅ 大部分）
- literature_items=110（canonical），ProjectLiteratureLink 多對多＋角色；GET /api/projects/{id}/literature 回 items+matrix+filter（實測 200）。
- Evidence Matrix、reading_status/evidence_status 分層存在。→ V3 缺口：Evidence Note 編輯/保存 API 與 UI 待稽核定位；project 視圖 filter 已支援。

## Zotero（⚠️ 部分）
- /api/zotero GET 實測 200 回 3 collections（key：25S7X2RD/PNDLK8AR/TW3MBALL）；ZOTERO_API_KEY/USER_ID 配置。
- /api/projects/[projectId]/zotero route 存在（行為待稽核：bind/import 未驗證）；無 zotero_bindings 表 → Project–Collection binding 需新表（migration）。
- 規範要求：Web API v3 唯讀、binding 分開保存、item_version/library_version/last_successful_sync、NEEDS_CONFIGURATION 狀態。

## 老麥/任務底座（⚠️）
- OpenClaw gateway＋vectide primary 主備援＋熔斷；chat/assist 皆有。翻譯 OLD_MIKE/DEEPL 實測 SUCCESS（09-05 修 max_tokens 截斷）。
- 無 agent_jobs/agent_job_events 表（DB 已查）；無持久 job store/worker → V3 需建 migration 0031 底座（QUEUED/RUNNING/PARTIAL/SUCCEEDED/FAILED/CANCELLED/REQUIRES_ACTION＋lease/checkpoint/idempotency_key/provider_request_id/usage/error_code/result_reference）。
- 研究啟動摘要：quick-start 已有 S0 intake 與 AI draft（assist S0_RESEARCH_TEXT）；缺「保存新版本 artifact」的明確版本鏈與 job 記錄。

## 已知已修（本日前，production 已上線）
- 重置 append-only 回歸（tenant-repository 執行期結構）、Gap 新版 UI 重建（GapNoveltyLab）、藍圖接線（ResearchBlueprintStudio）、導覽死鏈（ethics/review-compliance/application-package/one-click/topic-validation）、首頁路徑總覽＋重置區、翻譯截斷（max_tokens＋repairTailClosers）。

## 風險（本階段）
- R1：repo 缺 migration 0026–0030 檔案（記錄在 DB）→ 隔離重建需 pg_dump schema 或補檔。
- R2：DB projects=0 異常待確認。
- R3：sandbox 無本機 PG → 隔離測試環境未定（待授權選項）。
- R4：非 git repo、無 CI；品質以 tsc/build/手動實測把關。
- R5：單一正式 service 直接部署風險；V3 切換需另授權。
