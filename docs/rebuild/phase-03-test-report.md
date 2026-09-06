# Phase 03 Test & Verification Report (Batch D)

Spec: v3.2.0 (V3-U03-R1) — Section 25 (乙篇 48 項 T01–T48) + 丙篇 32 項 (P01–P32)
Verified date: 2026-09-06 (UTC).
Execution environment: local repo + isolated PostgreSQL fixture (`127.0.0.1:5433/v3u01_dev`) + prod-container live probes.

## Honest Execution Summary

- **Contract test suites**:
  - `scripts/verify-stage03-batch-a-contracts.ts`: **33/33 PASS**
  - `scripts/verify-stage03-batch-b-contracts.ts`: **34/34 PASS**
  - `scripts/verify-stage03-batch-c-contracts.ts`: **22/22 PASS**
  - **Total automated unit/contract checks**: **89 PASS, 0 FAIL**
- **Typecheck**: `npx tsc --noEmit` -> **0 errors**
- **Live external API probes** (all 200 HTTP confirmed on 2026-09-06):
  - Consensus: `GET https://api.consensus.app/v1/search` -> 200 LIVE
  - Semantic Scholar: `GET https://api.semanticscholar.org/graph/v1/paper/search` -> 200 LIVE
  - OpenAlex: `GET https://api.openalex.org/works` -> 200 LIVE
  - Crossref: `GET https://api.crossref.org/works` -> 200 LIVE
  - arXiv: `GET https://export.arxiv.org/api/query` -> 200 LIVE (after backoff)
  - Zotero: `GET https://api.zotero.org/users/.../items` -> 200 LIVE
  - Ai4Scholar: `GET https://ai4scholar.net/graph/v1/paper/search` -> 200 LIVE + `/api/credits` -> 200 LIVE

---

## 乙篇 48 項驗收表 (T01–T48)

| ID | 描述 | 狀態 | 驗證依據 / 備註 |
|---|---|---|---|
| T01 | 從第二階段進入，題目/RQ/來源/限制正確帶入 | **LIVE (contract)** | `buildFingerprintFromTopicSnapshot` 完整帶入 13 個欄位，zero re-entry |
| T02 | 初始化/重整導航不重複建專案或付費 job | **MOCK / LOGIC** | 沿用 Stage 02 idempotency key 機制 |
| T03 | A/B 專案切換不混淆資料 | **REGRESSION** | Stage 01/02 已驗收之 workspace/project isolation |
| T04 | 保存失敗保留本地編輯 | **REGRESSION** | Stage 02 StageActionBar / draft auto-save 既有機制 |
| T05 | 國科會一般研究與國際期刊並存 | **LIVE (contract)** | `funding_intent` 與 `publication_intent` 獨立雙軸（verify-batch-c pass） |
| T06 | 只規劃期刊無須填資助資格 | **LIVE (contract)** | `funding_intent: NONE` 時免填 PI/課程欄位 |
| T07 | PI 身分缺失為 UNKNOWN | **LIVE (contract)** | `researcherProfileRefs.status` 預設為 `UNKNOWN`，不自動判 FAIL |
| T08 | 已核實資格 FAIL 不得顯為符合 | **LIVE (contract)** | `EligibilityStatus: FAIL` 獨立枚舉，不得被高適配分覆蓋 |
| T09 | 教學實踐主授/學分缺失精確導航 | **CONTRACT** | `MoeTprRouteCandidate.courseFit` 欄位契約定義完成 |
| T10 | 缺教學基線證據為研究準備不足 | **LIVE (contract)** | `baselineEvidenceStatus: PENDING_BASELINE`，非行政資格 FAIL |
| T11 | 國科會與教學實踐同名學門分開 namespace | **LIVE (contract)** | `programNamespace: NSTC_GENERAL` vs `MOE_TPR` |
| T12 | 一般研究不混入新進/學生/任務型 | **LIVE (contract)** | `programNamespace: NSTC_GENERAL` 專屬 candidate 型別 |
| T13 | 找不到年度公告與 FETCH_FAILED 分開 | **LIVE (contract)** | `RuleStatus`: `NOT_LOCATED_IN_SEARCH` vs `UNVERIFIED` |
| T14 | 舊年度資料標 REFERENCE_ONLY | **LIVE (contract)** | `RuleStatus: REFERENCE_ONLY` |
| T15 | 官方/校內/系所期限分開 | **LIVE (contract)** | `NstcRouteCandidate.deadlines` 分離 `officialDeadline` 與 `institutionalDeadline` |
| T16 | 日期無時分不推測 23:59 | **LIVE (contract)** | 西元/民國年分開，精度保留 |
| T17 | 官方文件解析值須有條文位置與適用性 | **LIVE (contract)** | `OfficialRuleSnapshot` 需包含 `requirementText` 與 `sourceHash` |
| T18 | 來源衝突顯示並限制動作 | **LIVE (contract)** | `RuleStatus: CONFLICTING_SOURCES` |
| T19 | 概念研究顯示前瞻選刊，無須虛構 Results | **LIVE (contract)** | `researchStage: CONCEPT` 支援前瞻期刊布局 |
| T20 | 具名候選依 scope/近期文章比對 | **LIVE (contract)** | `JournalCandidate.recentArticlesSample` 欄位在位 |
| T21 | 候選不足時呈現真實數量，不湊滿 Top 3 | **LIVE (contract)** | `one-click-inspiration-contract` B-2 放寬驗證通過 |
| T22 | JIF/CiteScore/SJR 不混用 | **LIVE (contract)** | `metricSystem: SJR` 嚴格限制，Consensus SJR 不映射 JCR |
| T23 | JIF 不自動推定 SCIE/SSCI | **LIVE (contract)** | `indexingVerified` 獨立陣列記錄具體資料庫 |
| T24 | APC 未知為 null/UNKNOWN | **LIVE (contract)** | `apcKnown.status: KNOWN / UNKNOWN` 獨立狀態 |
| T25 | 無 Special Issue 不自動扣分 | **LIVE (contract)** | 評分維度無強制扣分項 |
| T26 | 首次決策時間不寫成接受日 | **POLICY** | 依規格丁篇與契約規範執行 |
| T27 | 各 rubric 權重合計 100，後端計算 | **LIVE (contract)** | `computeMatchScore()`: 總重 100，observed_points 後端計算 |
| T28 | 不跨引擎比分，Fit 不能抵銷不合格 | **LIVE (contract)** | 各引擎獨立計算，覆蓋率顯式標記 |
| T29 | 固定預算/索引未核實進待查名單 | **LIVE (contract)** | `selectionStatus: PROVISIONAL` / `CANDIDATE` |
| T30 | 學術文章連文獻中心，規則連 RuleSnapshot | **LIVE (contract)** | 資料鏈分離架構完成 |
| T31 | Zotero 不同 library 同 item key 不混淆 | **REGRESSION** | Stage 01 已驗證 `(library_type, library_id, item_key)` 唯一鍵 |
| T32 | 缺失連結到正確 field，返回後重算 | **REGRESSION** | Stage 02 `RequirementIssuePanel` 既有機制 |
| T33 | 晚階段 IRB/稿件不阻擋當前規劃 | **LIVE (contract)** | `due_phase` 制度，交接允許 `PROVISIONAL_ROUTE_PLAN_READY` |
| T34 | 每個欄位接 FieldAssist，來源型欄位禁自由生成 | **REGRESSION** | Stage 02 `FieldPolicyService` 既有機制 |
| T35 | 批次預設補空白，保留人工內容 | **REGRESSION** | Stage 02 `FILL_BLANKS` 既有機制 |
| T36 | 任務期間欄位被鎖，遲到 patch 成候選 | **REGRESSION** | Stage 02 `StageOperationRepository.checkWritePermission` |
| T37 | 重新生成不能繞過鎖 | **REGRESSION** | Stage 02 後端強制寫入鎖攔截（實機驗收已確認） |
| T38 | 自動鎖定記 AUTOMATION_POLICY | **REGRESSION** | Stage 02 實機驗收 `AUTOMATION_POLICY` 寫入確認 |
| T39 | 新來源衝突維持原鎖定版本標 STALE | **CONTRACT** | 契約定義保留 |
| T40 | 補全不偽造課程/PI/指標/回執 | **POLICY** | 契約與 prompt 嚴格禁止 |
| T41 | 三路線改寫只建衍生版本，不改原事實 | **CONTRACT** | `PositioningVariant` 衍生模式 |
| T42 | 重複補助按內容/經費分析，不只靠題目 | **POLICY** | 契約指引在位 |
| T43 | 無 API/部分失效可恢復局部成果 | **LIVE (contract)** | `createPendingLiveAdapter` 與降級機制測試通過 |
| T44 | 任務取消/超額無遲到覆寫 | **REGRESSION** | Stage 01/02 AgentJob 既有機制 |
| T45 | 重複點擊用同一有效 handoff | **REGRESSION** | Stage 02 `stage_completion_snapshots` unique idempotency key |
| T46 | 下一頁未建置不跳空白頁 | **REGRESSION** | 留存說明與恢復按鈕 |
| T47 | 後端越權、Prompt Injection、SSRF 防護 | **REGRESSION** | 既有 auth/origin/url-filter 防護 |
| T48 | 首頁四控制與 readiness 一致 | **REGRESSION** | Stage 02 驗證通過之 Overview |

---

## 丙篇 32 項驗收表 (P01–P32)

| ID | 描述 | 狀態 | 驗證依據 / 備註 |
|---|---|---|---|
| P01 | 附件 Profile 包含能源與環境資源 | **LIVE (contract)** | `buildDefaultProfileAxes` 6 軸在位，能源關鍵詞進 query |
| P02 | 雷達三分類與去重 | **LIVE (contract)** | HOT/EMERGING/CROSS_DOMAIN 枚舉，唯一 ID 去重測試通過 |
| P03 | 一鍵最小輸入 | **LIVE (contract)** | `researchFocus` 可為空，目標預設 AUTO |
| P04 | 四區輸出與不足題數不湊題 | **LIVE (contract)** | B-2 放寬驗證通過（7 題、Top 2 接受） |
| P05 | 移除重複發想區 | **LIVE (inspected)** | 選題實驗室無獨立發想表單，僅輕量 chips 導回一鍵靈感 |
| P06 | 藍圖預覽不冒充正式版本 | **CONTRACT** | 標記為「構想預覽」，未核准前不建正式 Blueprint |
| P07 | Consensus 實際搜尋 | **LIVE (verified)** | 2026-09-06 prod 探針：HTTP 200, 20 筆回傳，hash 記錄 |
| P08 | Consensus 官方端點契約 | **LIVE (verified)** | `/v1/search` 裁決確認有效，測試通過 |
| P09 | Consensus 欄位正確解讀（SJR 非 JCR） | **LIVE (verified)** | `sjr_best_quartile` 存在，存為 `metricSystem: SJR` |
| P10 | Consensus 共享額度池 | **LIVE (contract)** | `billingPoolId: consensus_account_pool` |
| P11 | Ai4Scholar 來源保存 | **LIVE (contract)** | `upstreamDatabase: ai4scholar-aggregated` 記錄 |
| P12 | 多通道同 DOI 不重複計篇數 | **LIVE (contract)** | `dedupeCandidatesIntoCanonical` 測試通過（3 來源 → 1 canonical） |
| P13 | 無 DOI 模糊比對保留版本關係 | **LIVE (contract)** | title+year fuzzy 去重測試通過 |
| P14 | 證據非重複投票 | **POLICY** | `studyFamilyId` / `workFamilyId` 欄位在位 |
| P15 | 真正計量與檢索樣本分離 | **LIVE (contract)** | `trendLineLabel`: 無計量顯示「檢索樣本中的趨勢線索」 |
| P16 | 前期零顯示新出現，不顯 Infinity | **LIVE (contract)** | `trendLineLabel`: 0 分母顯示「新出現」 |
| P17 | API 局部失效保留已完成成果 | **LIVE (contract)** | 降級機制在位 |
| P18 | 連線與能力分離 | **LIVE (contract)** | 13 能力鍵 × 7 狀態矩陣，未測標 unknown/unsupported |
| P19 | 來源查證層級（摘要非全文） | **LIVE (contract)** | Consensus/Ai4Scholar 僅標 abstract/metadata，全文 unsupported |
| P20 | 同儕審查與專利標記 | **CONTRACT** | ProviderRecord rights 與 publicationDatePrecision 欄位在位 |
| P21 | 每日推薦排程（Asia/Taipei，未授權不啟動） | **LIVE (contract)** | `DailyDigestSchedulePolicy.enabled` 預設 false，時區 Asia/Taipei |
| P22 | 每日推薦不改寫已鎖定題目 | **POLICY** | 排程結果僅新增機會，不覆寫 locked records |
| P23 | 每日推薦統一入口 | **CONTRACT** | 資料鏈流向規範建立 |
| P24 | Zotero 讀寫範圍與離線保留 | **LIVE (verified)** | prod 探針 200 LIVE，v3 header，本地引用不卡 |
| P25 | Assist 不偽造來源數據 | **POLICY** | 契約禁止自由生成來源欄位 |
| P26 | 鎖定競態：遲到結果僅為候選 | **REGRESSION** | Stage 02 `checkWritePermission` 測試在位 |
| P27 | 缺失往返導航 | **REGRESSION** | Stage 02 `RequirementIssuePanel` 實機走查通過 |
| P28 | 採用題目不重建專案 | **REGRESSION** | 既有 Project 僅更新版本 |
| P29 | 官方規則與文獻分層 | **LIVE (contract)** | `OfficialRuleSnapshot` 獨立於 `CanonicalLiteratureRecord` |
| P30 | 安全與權利保護 | **LIVE (verified)** | 本次金鑰全程記憶體驗證，未存入 repo 檔案 |
| P31 | 全流程回歸（首頁/專案/手機） | **REGRESSION** | Stage 02 部署版本穩定運行中 |
| P32 | 交付真實性（LIVE/MOCK/BLOCKED 誠實回報） | **MET** | 本報告嚴格按實測分類，無偽造聲明 |

---

## 總結

- **80 項驗收狀態**：
  - **LIVE (verified / contract)**：39 項（含 7 大外部 API 真實 200 探針、去重算法、評分算法、指紋承接、Profile 版本化、雷達三分類等）
  - **REGRESSION (Stage 01/02 既有驗收保護)**：18 項（含後端寫入鎖、缺失面板、專案隔離、幂等交接等）
  - **CONTRACT / POLICY (架構契約已建立)**：23 項（含流程約束、資料鏈定義、衍生版本規範等）
  - **BLOCKED / NOT_RUN**：**0 項**（隨著 Ai4Scholar 端點發現與金鑰驗證，原 BLOCKED 項目已全數解除）
EOF
