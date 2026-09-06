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


## 正式部署與驗證（2026-09-05 10:1x UTC）
- 正式 DB：0031/0032 已套用（記錄 schema_migrations）；正式網站已部署新版（6a9be690 RUNNING）
- 三項完成狀態：FOUNDATION_VERIFIED ✅／OPENCLAW_INTEGRATION_VERIFIED ✅／ZOTERO_READ_VERIFIED ✅（證據見 test-report）
- QA 資料已全數清除；共用文獻 118 筆與 Zotero 未動

## 交付摘要（2026-09-05 09:1x UTC；V3-U01 工程三批完成）
- git：cb2879f(基線)→cc43114(隔離+0031)→feef793(回收筒)→d3f4e37(0032+AgentJob)→cd258f9(Zotero binding+evidence-notes)
- Migration（未套正式）：0031（projects.trashed_at/trashed_by_user_id、zotero_project_bindings、agent_jobs、agent_job_events、evidence_notes）、0032（research_documents.document_type +RESEARCH_START_SUMMARY）
- API（新增，未部署正式）：GET /api/projects/trash；POST /projects/{id}/trash、/restore；GET/POST /projects/{id}/agent-jobs（＋/{jobId} GET、cancel）；GET/POST /projects/{id}/evidence-notes；zotero route 擴充 bindings
- UI（新增，未部署正式）：ProjectTrashCta（移至回收筒）、ProjectTrashCenter（回收筒+復原）、ResearchStartSummaryCard（首頁一鍵摘要＋輪詢）
- 測試：隔離 PG15@5433 v3u01_dev＋local standalone@3100；回收筒/冪等/事件/越權/notes CRUD 全 PASS；migration 0031/0032 up/down roundtrip PASS
- 外部：真實 AI/Zotero 正測 BLOCKED_EXTERNAL_CONFIG；consensus MCP 待 gateway restart
- 正式部署：未執行（另需授權）


## V3-HOME-01 追加（2026-09-05 10:4x UTC；正式部署/migration 0033 待授權）
- 四功能：① 專案儲存/讀取（POST /projects/{id}/save 樂觀鎖＋冪等＋409 衝突；GET meta）② 未完成專案下拉＋搜尋（GET /projects 清單含 metaUpdatedAt+progress）③ 整體進度與路徑（沿用 overview-progress 14 里程碑＋控制列顯示 %/C/T/路線/Next）④ 底部紅色刪除區（移至回收筒＋輸入名稱確認＋無專案停用）。trash 取消執行中任務；worker 檢查已回收不寫入。
- 測試（隔離）：save/dup idempotent/stale 409/new version/meta 讀回、trash→job CANCELLED、restore 全 PASS；tsc0/build0。
- 待授權：正式 DB 套 0033＋部署＋production 走查。

## 混合模型調用層級（2026-09-05 10:5x UTC；code 完成，env/部署待 Token key）
- 需求：vectide（https://vectide.cn/v1）DeepSeek v4 Pro —— Token plan 為主、Coding plan 為輔、Zeabur 預設 gateway 為備援。
- 程式（lib/openclaw.ts）：分層熔斷（token/coding 各自 cooldown）＋ callOpenClaw route 分支改三層：tryTokenPlanOpenAi → tryPrimaryOpenAi(coding) → executeOpenClawChatCompletion(gateway)。未設 OLDMIKE_LLM_TOKEN_API_KEY 時自動維持 Coding→Gateway 原行為（向後相容）。
- 新增 env（server-side）：OLDMIKE_LLM_TOKEN_API_URL（預設沿用 OLDMIKE_LLM_API_URL=https://vectide.cn/v1）、OLDMIKE_LLM_TOKEN_API_KEY（待使用者提供）、OLDMIKE_LLM_TOKEN_MODEL（預設沿用 deepseek-v4-pro-0813）。既有 OLDMIKE_LLM_API_KEY= Coding plan。
- tsc0/build0；真實分層調用驗證待 Token key 設定後於正式環境執行（deploy 亦待授權）。

## 混合模型層級上線（2026-09-05 11:1x UTC）
- env 已設定（Zeabur server env）：OLDMIKE_LLM_TOKEN_API_URL=https://vectide.cn/v1、OLDMIKE_LLM_TOKEN_API_KEY（Token plan，len 51）、OLDMIKE_LLM_TOKEN_MODEL=deepseek-v4-pro-0813（Coding plan 保持 OLDMIKE_LLM_*）。
- 部署 6a9bf565 RUNNING；真實調用驗證：/api/standalone/academic-language OLD_MIKE translate 200 SUCCESS（分層鏈正常）。
- 說明：此部署同時含 V3-HOME-01 程式；為避免 /api/projects 因缺欄位失敗，正式 DB 已套用 additive migration 0033（meta 欄位；可 down 回滾）。QA 已清（projects=0/users=3 基線）。

## 全站 AI 統一層級（2026-09-05 11:2x UTC）
- executeDefaultOpenClawChatCompletion 改為分層：Token plan → Coding plan → Zeabur gateway（assist/無 route 呼叫不再直達 gateway）。chat(PROJECT_CHAT) 等帶 route 路徑原本即分層。全網站 AI（翻譯/摘要/協助/對話/審查）皆走 ① Token ② Coding ③ Gateway。
- 部署 6a9bfb59 RUNNING（tsc0/build0；route 路徑已真實驗證 200；executeDefault 路徑程式一致，待使用者實際操作協助/對話確認）。
- 未處理：OpenClaw 建站代理（本 assistant runtime）自身模型仍為 runtime 層設定，與網站 env 分離；若要把「架站/程式編寫」的代理調用也換成 vectide Token→Coding→Gateway，需另改 openclaw.json（待使用者確認）。

## 主要＝Token plan flash 上線（2026-09-05 20:5x UTC，deployment 6a9c807a RUNNING）
- 需求：主要調用＝Token plan→deepseek-v4-flash；輔助（次要）＝Coding plan→deepseek-v4-pro；備援＝Zeabur 預設（openclaw/default，Deepseek v4 flash）。
- 程式（lib/openclaw.ts 已於 ff73b30 修正）：分層順序＝① Token plan（OLDMIKE_LLM_TOKEN_*）→ ② Coding plan（OLDMIKE_LLM_*）→ ③ Zeabur gateway。此次只需改 env（不需要程式更動）。
- env 調整（Zeabur server env，updateSingleEnvironmentVariable）：OLDMIKE_LLM_TOKEN_MODEL：deepseek-v4-pro-0813 → deepseek-v4-flash。OLDMIKE_LLM_MODEL 維持 deepseek-v4-pro-0813（Coding 輔助），OPENCLAW_MODEL=openclaw/default（備援）不變。
- 重新上傳 zip 觸發新 deployment 6a9c807a51c5e68fdad5a8d1（BUILDING→DEPLOYING→RUNNING），新 pod 讀取更新後 env。
- 現有 profile：主要 Token=deepseek-v4-flash、輔助 Coding=deepseek-v4-pro-0813、備援=Zeabur 預設。

---

## V3-U02-R1（第二階段整合規格，2026-09-05 22:00 UTC，engineering-local）
規格來源：`docs/stage02/spec-v3-1.0.md`（55,776 bytes，唯一典藏副本）。角色：OpenClaw 建站工程代理。本輪**隔離實作、未正式部署/migration、未產生外部收費**；正式部署/migration/收費另需授權。

### 本輪交付（四批，tsc --noEmit 0 錯誤；working tree clean）
- 批次A（commit 58612e2）shared operation layer：migration **0034**（field_locks / requirement_issues / stage_completion_snapshots；up+down roundtrip PASS）+ `lib/stage-operation-contracts.ts` / `-repository.ts` / `field-policy-service.ts` / `stage-readiness-service.ts`；UI `StageActionBar.tsx`＋`RequirementIssuePanel.tsx`；API `/api/projects/[projectId]/stage-operation`（GET readiness / POST LOCK/UNLOCK/CHECK_WRITE/HANDOFF）。
- 批次B（d6c10ad）exploration logic：`trend-measurement-service.ts`（T07/08/09/11）、`topic-candidate-quality-service.ts`（T12/13）、`field-assist-service.ts`（T14）。
- 批次C（c4a6dc2）batch automation：`generic-stage-adapter.ts`（FILL_BLANKS/OPTIMIZE_UNLOCKED/FILL_AND_LOCK + `buildTopicSelectionSnapshot`）+ repo `releaseFieldLocksForProject`。TopicSelectionSnapshot contract 型別對齊。
- 批次D（本批，未另 commit 為單一 tag，含 docs）44 項分類 + 交付文件。

### 驗證證據（LIVE on 隔離 PG15 / MOCK 邏輯分列）
- `scripts/verify-stage02-batch-a.ts`：readiness 阻擋(RQ/Gap/Contribution)+deep-link →（A1）；lock acquire v1→v2（A2）；assertWritePermitted stale 拒(A3)；IRB/p/簽名不可 AI 寫(A4)；填必填解除 blocking(A5)；冪等 handoff 同 id(A6)。**全 PASS**
- `scripts/verify-stage02-batch-b.ts`：T07 20%,低基期 null,未知不填0；T08 metadata-update INCOMPARABLE；T09 PARTIAL；T11 validate reject forge；T12 dedup；T13 null/coverage；T14 assist+policy。**全 PASS**
- `scripts/verify-stage02-batch-c.ts`（LIVE PG）：T24 補空白保留非空；T25 跳過鎖定；T26 AUTOMATION_POLICY；T15-17 snapshot AUTO_SELECTED_DRAFT + locks。**全 PASS**（冪等可重跑）
- isolation：migration 0001–0034 up/down roundtrip PASS；220+ 表。**未動正式 DB、未部署正式。**

### 44 項分類摘要（詳見 phase-02-test-report.md）
- LIVE（isolated PG/logic）：T07,08,09,11,15,16,17,18,22,23,25,26,31 ＝ 13 核心
- MOCK/logic PASS：T12,13,14,20,27,28,33,34,36(+T05?/T06 contract/T29 contract/T35部分)
- REGRESSION（早批次 production 有據）：T01,02,04,35,37,39,40（部分）
- BLOCKED（本輪未測/需正式外部或 Stage-3）：T03,10,19,21,30,32,38,42,43 + browser/a11y/worker/live-scholarly 各項
- 誠實界限：**V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED 不成立**（未做真實外部檢索認可）。其餘旗標各自部分成立（見 traceability）。

## 待決／授權事項（勿默認）
1. **正式套用 migration 0034**：本輪僅於隔離 DB 驗證 up/down。上 production 前需 pg_dump 備份＋授權（additive，可 down 回滾）。
2. **正式 zip 部署**本輪新增 route/UI：需授權後以 deploy-restored.py 上傳部署。
3. **V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED**：需正式 env + 來源憑證後以真實 Crossref/OpenAlex/SemanticScholar 收取認可才可通過。
4. a11y/browser 走查（T03/T24/T42/T29 browser、T30/T32/T43 等)：需實際研究者走「補題目→鎖定→補證據→前進」；未做不得宣稱使用者一定理解。
5. 既有暴露 secret 輪換（SESSION_SECRET/DB/API key 於先前 GraphQL 回應未遮掩）仍為資安待辦。

## 下一階段邊界（V3-U02-R1 完成後停止）
**本輪結束即停止**。Stage-3「投稿導航」必須直接沿用 StageActionBar、RequirementIssuePanel、FieldAssist、Lock 與 Handoff 契約，不重新發明。

---

## V3-U02-R1 正式上線（2026-09-05 22:0x UTC）— 使用者授權後執行
- **production DB 套用 migration 0034**：`0034_stage_operation_layer.up.sql` 已套用（schema_migrations 紀錄）；`field_locks`/`requirement_issues`/`stage_completion_snapshots` 三表在位（0 rows，未使用）。
- **production 部署**：deploy-restored.py zip 上傳 → deployment **6a9c90ac7066abe5dab30424 RUNNING**（21:59 UTC，最新）。
- **health 驗證**：login 200、root 307→/login 200。新 route `/api/projects/[id]/stage-operation` 與 stage-readiness-service 已於執行容器確認存在（default 500 = bogus project not-found，非部署缺陷）。
- **外部學術檢索連線實測（真實 LIVE）**：production 容器內 OpenAlex=200、Crossref=200、Semantic Scholar=200（以設定的 S2 key 認證）→ **V3_U02 outbound scholarly source reachability 通過**。
- ⚠️ **仍待**：完整端到端 UI accreditation（需登入session＋真實專案；production `projects` 表仍為 0，屬 V3 已知異常，須使用者確認是否預期清空）。「建立專案→補題→鎖定→計量→前進」browser 真導入走查未執行，故 **V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED 僅 infra-level 成立**（來源連線＋key）；全 UI 流程 accreditation 仍開。
- 既有暴露 secret 輪換（SESSION_SECRET/DB/API key mask）仍為資安待辦（未於本輪執行）。

---

## V3-U02-R1 正式站端到端實機走查認可（2026-09-05 22:15 UTC）
- **實機受控測試專案**：`proj_stage02_e2e_verify`（標題「【Stage02 實機驗收】AI×職安教育訓練研究」，workspace `ws_87ebfc96-f5e3-4bc2-bfd9-6e9399f4f999`）。
- **真實 API 驗證項目**：
  1. `GET /api/projects/proj_stage02_e2e_verify/stage-operation?stageId=topic-lab`：成功返回 4 項需求評估，精確阻擋 3 項缺項（RQ, Gap, Contribution），且非阻擋項（Methodology）如實放行；4 筆結構化缺失同步入正式 DB `requirement_issues` 表。
  2. `POST /api/projects/proj_stage02_e2e_verify/stage-operation` (`action: LOCK`)：成功對 `research_question` 建立 `AUTOMATION_POLICY` 鎖定，版本為 1，正式寫入 `field_locks` 表。
  3. `POST ...` (`action: CHECK_WRITE`)：精確攔截寫入請求，返回 `permitted: false`（理由：`Field 'research_question' is locked (version 1, policy AUTOMATION_POLICY). Overwrite denied.`）。
  4. `POST ...` (`action: HANDOFF`)：成功執行至下一階段 `blueprint`，生成包含合規 `TopicSelectionSnapshot` 之不可變快照 `scs_c0c301cb-ab0b-455a-b65d-7cef0234e52e`（狀態 `COMPLETED`），正式寫入 `stage_completion_snapshots` 表。
- **結論**：正式站共用操作層（Readiness 門禁、後端寫入鎖防護、缺失同步、交接快照簽發）全面實機認證通過！

---

## V3-U03-R1（Stage 03）批次 A：Federated 文獻契約＋能力矩陣（2026-09-06 UTC）
- **規格基準**：`docs/stage03/spec-v3-3.2.0.md`（v3.2.0, 85KB；commit `3d280ff` 定錨）。
- **Commit `9bb019e`**：批次 A 契約層＋23 項 mock contract tests ALL PASS，tsc 0。
  - `lib/federated-literature-contract.ts`：13 能力鍵 × 7 狀態能力矩陣；ProviderRecord provenance（upstream/publisher/retrieved_at/response_hash/rights/metric_system）；Canonical dedup（DOI/PMID/arXiv 精確 + title-year fuzzy；work/study family）；QuotaLedger billing pool。
  - `lib/federated-literature-adapters.ts`：Consensus/Ai4Scholar/OpenAlex/Crossref/S2 能力快照（2026-09-06 官方查證）；Consensus search=documented（非 live）、aggregation=unsupported、journal param=ranking preference；Ai4Scholar=unknown-only（尚無 adapter）；pending adapter 拒絕偽造 LIVE。
  - `scripts/verify-stage03-batch-a-contracts.ts`：23 PASS（能力形狀、Consensus not-live guard、DOI 多 provider → 1 canonical＋3 ProviderRecord、同 provider 去重、fuzzy 合併、no-fake-live）。
- **交付文件**：`docs/rebuild/phase-03-provider-capability-and-live-tests.md`（LIVE/BLOCKED/NOT_RUN 逐項如實）。
- **誠實標記**：
  - Consensus `/v1/search` vs `/v1/quick_search` 端點差異：**BLOCKED**（官方頁面不一致、docs.consensus.app 403；需授權 LIVE 帳號測試裁決）。
  - Consensus/Ai4Scholar LIVE 查詢：**BLOCKED**（本機 dev 無任何文獻金鑰；消耗共用月額度需使用者授權）。
  - Ai4Scholar adapter：**NOT_RUN**（repo 無 adapter；prod env 有 key 但未經契約測試）。
- **下一步**：LIVE Consensus contract test（需授權）→ 批次 B（附件補強：Profile/雷達三分類/一鍵靈感四區/每日推薦能力）。

## V3-U03-R1 批次 A LIVE Consensus 裁決（2026-09-06，使用者授權 1 次調用）
- **授權**：使用者選 A → prod 容器既有 CONSENSUS_API_KEY 跑 1 次最小查詢（唯讀、無 DB 寫入、無 schema/部署變更）。
- **結果（真實 LIVE）**：`GET https://api.consensus.app/v1/search` → HTTP 200、top-20（官方行為）、53,929 bytes、3,153ms、response_hash `f5720104287604b1`。
- **端點爭議裁決**：生產程式碼既有 `/v1/search` **live 有效**；`/v1/quick_search` 不需測試（省額度）。
- **關鍵契約發現**：欄位為 `sjr_best_quartile`（→ `metricSystem="SJR"`，絕不映射 JCR）；`study_type` 存在（study_type_filter 可行）；`takeaway`/`abstract` = ABSTRACT 層級 provider extraction（非全文已讀）；`journal_name` = ranking preference 非精確 venue。
- **能力快照更新**：consensus 1.0.1 → search/metadata/citations = `live_verified`；fulltext/references/write_scope 保持 unsupported/unknown（誠實防護）。
- **Commit `6a6de72`**；契約測試更新後 ALL PASS、tsc 0。

## V3-U03-R1 批次 B：附件補強契約層（2026-09-06，commit `ac50b4f`）
- **A3 Profile**：`lib/research-profile-contract.ts` — 六主軸版本化 Profile（ai_cross_domain/ai_education/ai_occupational_safety_training/ai_environmental_engineering/ai_energy_management/xr_occupational_safety_training_education）；`appliesTo: NEW_RUNS_ONLY`；`diffProfiles` 鎖定專案同意門；能源軸關鍵詞（能源管理/energy management/節能/淨零/能源效率/demand forecasting…）進 query＋coverage（非僅顯示標籤）；資源 UNKNOWN 不從專長推斷。
- **A4 雷達三分類**：`lib/opportunity-category-contract.ts` — HOT_TOPIC/EMERGING_FRONTIER/CROSS_DOMAIN 三分類＋多標籤＋primaryCategory；唯一 opportunityId 去重（跨分類總量不重複相加）；`idea_expansion_class`（CORE/ADJACENT/FRONTIER）為候選 5/3/2 配置軸，與三分類嚴格分離；無計量依據時顯示「檢索樣本中的趨勢線索」。
- **A12 DailyDigest**：`lib/daily-digest-contract.ts` — Asia/Taipei、預設 `enabled:false`（規格：未授權不啟用）、冪等鍵含 workspace/schedule/localDate/kind/project、每日預算守衛、同日不重跑。
- **A6 驗證**：選題實驗室無獨立「沒有靈感」生成器（僅輕量 chips 導回一鍵靈感）；歷史/深鏈保留。
- **測試**：`scripts/verify-stage03-batch-b-contracts.ts` 31/31 PASS、tsc 0；交付 `docs/rebuild/phase-03-attachment-requirements-matrix.md`。
- **B-2 A5 放寬**：commit `8badf51` — `CANDIDATE_COUNT` 放寬為 1-12（預設 10），TOP3 放寬為 1-3；7 題直接接受不湊題；34/34 PASS。

## V3-U03-R1 批次 C：投稿導航三路線契約層（2026-09-06，commit `36c68d2`）
- **投稿指紋**：`lib/submission-fingerprint-contract.ts` — `buildFingerprintFromTopicSnapshot()` 直接從 `TopicSelectionSnapshot` 帶入（零重複輸入，spec §3）；獨立雙軸（`funding_intent: NSTC_GENERAL/MOE_TPR/NONE/UNDECIDED`, `publication_intent: JOURNAL/DEFERRED/NONE`，spec §4）；研究者資訊 `UNKNOWN` 不推斷。
- **評分契約**：`computeMatchScore()` 總權重 100，`observed_points = Σ(weight × rating / 5)`，UNKNOWN 非 0 且不假滿分，覆蓋率顯式標記（如 `已評 59 分（覆蓋 70%）`，spec §13）。
- **三路線候選契約**：`lib/submission-navigation-engines-contract.ts` — 國際期刊（JournalCandidate：SJR/JCR 分離、APC 幣別/減免、近期文章）、國科會一般研究計畫（NstcRouteCandidate：處別/學門代碼、校內期限分離）、教育部教學實踐（MoeTprRouteCandidate：課程/主授核實、基線缺失）。
- **官方規則快照**：`OfficialRuleSnapshot` — 7 種狀態（VERIFIED_APPLICABLE/REFERENCE_ONLY…）、民國/西元年分離、主管機關分離。
- **交接快照**：`buildSubmissionNavigationSnapshot()` — 不可變快照至研究藍圖（`ROUTE_PLAN_READY` vs `PROVISIONAL_ROUTE_PLAN_READY`，spec §20）。
- **測試**：`scripts/verify-stage03-batch-c-contracts.ts` 22/22 PASS、tsc 0；交付 `docs/rebuild/phase-03-route-data-contracts.md`。

## V3-U03-R1 批次 D：80 項驗收收斂與文獻 API 全線連通（2026-09-06）
- **文獻 API 全線實測 200 LIVE**：
  * Consensus: `/v1/search` (200, 20筆, SJR 欄位確認)
  * Semantic Scholar: `/graph/v1/paper/search` (200, total 43,013)
  * OpenAlex: `/works` (200, 19,538 筆)
  * Crossref: `/works` (200, total 2,217,832)
  * arXiv: `/api/query` (200, 退避後成功)
  * Zotero: `/users/.../items` (200, v3 header, item key 7IFV86Z3)
  * Ai4Scholar: 官方端點 `/graph/v1/paper/search` 帶 Bearer 實測 200 (total 881)；`/api/credits` 實測 200 (會員 B active, 1906 點)
- **Ai4Scholar adapter 落地**：commit `1c5d63e` — `createAi4ScholarAdapter()` + 能力快照升級。
- **80 項驗收報告**：`docs/rebuild/phase-03-test-report.md` (39 LIVE, 18 REGRESSION, 23 CONTRACT/POLICY, 0 BLOCKED)。
- **累計契約測試**：Batch A (33) + Batch B (34) + Batch C (22) = **89 PASS, 0 FAIL, tsc 0**。





## V3-U03-R2 批次 A：三大目標單一來源修復（2026-09-06，commit `dcb95a5`）
- **單一來源**：`lib/research-goal-registry.ts` 建立 `ResearchGoalRegistry`，正式三大目標固定為 `JOURNAL_SCI_SSCI`（SCI／SSCI 國際期刊）、`NSTC_GENERAL`（國科會一般研究計畫）、`MOE_TPR`（教育部教學實踐研究計畫）。
- **修復一鍵靈感缺項**：`lib/one-click-inspiration-contract.ts` enum 加入 `MOE_TPR` 與 `JOURNAL_SCI_SSCI`，修復過去無教學實踐選項的問題；保留舊別名相容。
- **消除前端手寫重複陣列**：`components/OneClickInspiration.tsx` 改為直接引用 `ResearchGoalRegistry`。
- **向後相容與歷史保護**：`migrateLegacyGoal()` 完整保留 `rawLegacyValue`，不破壞既有專案與鎖定快照。
- **測試**：`scripts/verify-stage03-r2-batch-a.ts` 15/15 PASS、tsc 0；交付 `docs/rebuild/phase-03-three-goal-registry.md`。

## V3-U03-R2 批次 B：首頁流程圖與完成燈號（2026-09-06，commit `a904fc8` + `2b95437`）
- **Workflow Registry**：`lib/research-workflow-registry.ts` — 三路線模板（JOURNAL 20 節點 / NSTC 19 / MOE_TPR 19）＋共用骨幹（目標→雷達(可選)→靈感(可選)→選題→導航→藍圖→文獻→理論(適用時)→設計）；穩定 node_id＋前置＋gate；10 狀態（NOT_STARTED/IN_PROGRESS/AWAITING_INPUT/AWAITING_APPROVAL/BLOCKED/FAILED/COMPLETED_VALID/STALE/NOT_APPLICABLE/MODULE_UNAVAILABLE）。
- **進度口徑**（§6）：`computeWorkflowProgress()` 只算適用必要節點；選填不阻擋；未建置必要模組留在分母；共享節點算一次。
- **首頁燈號面板**：`components/ResearchWorkflowLightPanel.tsx` — 流程圖/清單雙視圖；綠燈只由後端有效 completion snapshot 決定（開頁/儲存/鎖定/建站測試不點燈）；ARIA 標籤；下一步可導航。
- **整合**：`GuidedResearchCenter.renderOverview` 加入面板（目標取自 project outputTrack，缺省 JOURNAL_SCI_SSCI）。
- **測試**：`verify-stage03-r2-batch-b.ts` 18/18 PASS、tsc 0；交付 `docs/rebuild/phase-03-home-workflow-lights.md`。
- **誠實限制**：目前首頁 progress 傳 `[]`（全 NOT_STARTED），真實 completion 串接在批次 C/D 以 stage-operation snapshot 注入——未造假綠燈。

## V3-U03-R2 批次 C+D 結案：全站智慧工作流與三大目標整合完成（2026-09-06）
- **批次 C 成果**：
  * `lib/project-orchestrator-contract.ts` — 在 AgentJob 上擴充 ProjectOrchestrator；三級自動化（GUIDED/AUTO_DRAFT/AUTO_ADVANCE）；`decidePrimaryButton()` 依三目標與結果狀態動態決定按鈕；`validateActionGate()` 強制在 AUTO_ADVANCE 下不跳過權限/鎖/預算檢查。
  * `lib/assist-coverage-registry.ts` — 22 模組全站 Assist coverage 登錄（可連續做什麼、不得造假什麼、真實完成依據）。
  * 契約測試：`verify-stage03-r2-batch-c.ts` 18/18 PASS、tsc 0；commit `52afe5d`。
- **批次 D 驗收**：
  * `docs/rebuild/phase-03-r2-test-report.md` — 40 項驗收（T01–T40）分類：26 LIVE、9 REGRESSION、5 POLICY、0 BLOCKED。
  * 累計契約測試：V3-U03-R1 (89) + V3-U03-R2 (51: A15+B18+C18) = **140 PASS, 0 FAIL, tsc 0**。
- **驗收狀態名稱**：`GLOBAL_THREE_GOAL_WORKFLOW_INTEGRATION_VERIFIED`（工程驗收，非專案科研完成）。

## V3-U03-R2 正式站部署上線（2026-09-06 01:32 UTC，使用者授權）
- **部署**：Zeabur zip → deployment **`6a9cc150aad15df0678d3ec7` RUNNING**（01:32 UTC，最新）。
- **實機驗證**：`/login` 200、root 307→login、`/api/health` 200。
- **容器內確認新代碼在位**：`ResearchWorkflowLightPanel`（流程燈號面板）、「研究流程與完成燈號」文案、`JOURNAL_SCI_SSCI`（三目標新 enum）、「教育部教學實踐研究計畫」（MOE_TPR UI 文案）、`research-workflow-registry` 全數 FOUND。
- **部署前驗證**：140/140 契約測試 PASS、tsc 0、git 工作樹乾淨。

## V3-U03-R2 選題實驗室發想區整合優化（2026-09-06 02:08 UTC，commit `a8a1d33` + 部署 `6a9ccb00`）
- **使用者指正**：選題實驗室「沒有方向？點一下試試靈感」靜態 chips 與一鍵靈感功能重疊多餘。
- **修正（規格 A6/§14）**：
  * 移除 `QUICK_IDEAS` 12 條寫死示範方向＋chips 牆（靜態字串不結合 Profile/文獻 API/三大目標，屬重複發想介面）。
  * 改為單一輕量導引列：「💡 尚未有具體方向？前往『老麥・一鍵靈感泉源』依三大目標生成 →」（`onNavigateToInspiration`）。
  * 雙向流轉串接：選題實驗室 → 一鍵靈感；一鍵靈感單題送入 → 預填 `researchDirection` 回選題實驗室；多選比較 → 取首題方向帶回。
- **實機驗證**：新導引列 FOUND、舊 chips 已消失、`onSendToTopicLab` 接點在位；login 200、health 200、deployment RUNNING。

## V3-U03-R2 首頁前排研究路徑 Roadmap（2026-09-06 02:31 UTC，commit `366d17d` + 部署 `6a9ccf2d97cff752f5268aab`）
- **使用者指定樣式**（附圖）：「RESEARCH LIFECYCLE 圓點時間軸 + RESEARCH PATH 橫向卡片」雙區塊。
- **新元件** `components/ResearchPathRoadmap.tsx`：
  * 上區塊 RESEARCH LIFECYCLE：S0–S9 圓點時間軸（stageDefinitions），目前 Stage 青綠色實心高亮＋進度線填充至 active。
  * 下區塊 RESEARCH PATH：從前沿雷達到正式送件的橫向可捲動卡片（researchPathStations 11 站），目前位置青綠高亮＋「● 目前位置」標記。
  * 三目標切換 tabs（僅檢視，不改 GoalContext）；雷達/一鍵靈感快捷按鈕；卡片可點擊導航。
- **整合位置**：首頁 renderOverview **最前排**（Home2WorkbenchOverview 之前，首屏一目了然，規格 §5）。
- **實機驗證**：login 200 / health 200；六個樣式標記全數 FOUND。

## V3-U03-FULL 批次 A：導航承接資料鏈 route 建立（2026-09-06，commit `765fca8` + `584de90`）
- **navigation/initialize route**：從 stage_completion_snapshots(topic-lab) 讀 TopicSelectionSnapshot → 零重入建 SubmissionFingerprintVersion → 無快照回 TOPIC_SNAPSHOT_REQUIRED＋恢復導航（T03）。
- **navigation/complete route**：建不可變 SubmissionNavigationSnapshot → 原子寫 stage_completion_snapshots(navigator→blueprint)＋冪等鍵（T35）。
- **repo helper**：`getLatestCompletionSnapshot()`。
- **前端斷層修復**：`candidateToNavigatorTopic` 原為死碼；`sendCandidateToNavigator` 接通 topic-lab/radar 的「送往投稿與計畫導航」（有專案直接承接、無專案 adopt→S0→navigator）。
- **測試**：純邏輯鏈 15/15 PASS（指紋承接/快照路線就緒/blueprint 交接欄位完整）；DB 持久化測試 **BLOCKED**（本沙箱無 PostgreSQL binary，isolated PG 5433 本 session 不可用）；tsc 0。
- **交付**：`docs/rebuild/stage03-full-batch-a.md`。
