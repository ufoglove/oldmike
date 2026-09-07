## V3-U19-FULL-R2：第十九階段完整規格補強（2026-09-07 UTC）

- **規格基準**：`docs/stage19/spec-v3-4.0.md`（完整 36 節、664 行；R2 收錄整份，SHA-256 `093a9932…`）。
- **契約補強**（`lib/submission-tracking-v3-contract.ts` → v1.1.0）：
  * §4 SubmissionCase（publicationFamilyId、外部 ID 唯一性 scope、IMPORTED_EXISTING_CASE）/ DestinationLegKind / SubmissionRoundKind（同稿新 Round 非二次初投）。
  * §3/§5 ProviderCapability 8 項＋三模式 GUIDED_MANUAL/READ_ONLY_SYNC/AUTHORIZED_WRITE。
  * §6 ActionIntent（actor/operation/packageDigest/聲明/validUntil/singleUse）＋ExecutionAuthorizationEvent（scopeDigest）。
  * §8 Attempt 狀態機（DRAFT_INTENT…CONFIRMED＋OUTCOME_UNKNOWN/RECONCILIATION_REQUIRED）＋attemptIdempotencyKey。
  * §10 EvidenceTier 7-tier（USER_REPORTED…UNVERIFIED）＋Receipt idStatus(ID_PENDING)。
  * §11 SubmissionEvent（effectiveAt/providerSequence/normalizedLabel）＋StatusProjection；§16 DecisionCategory 12＋DecisionRecord；§18 ReviewResponseWorkOrder＋responseKind；§30 規格 20 錯誤碼（R1 舊碼走 LEGACY_ERROR_CODE_ALIASES）；§32 snapshot v1.1（case/leg/round/intent/decision/statusMapping/intakeMode）。
- **服務補強**（`lib/submission-tracking-v3-service.ts`）：R1 簽名相容；新增 provider registry/resolveProviderMode、createSubmissionCase/standardDestinationLegs（三路線）/openRound/importExistingCase、createActionIntent/confirmActionIntent（角色＋聲明門）、Attempt reconcile/reserveDuplicate/cancelLocal、ingestReceiptForCase（expectedTarget/round/ID_PENDING）、projectStatus（舊信晚到不覆蓋）、mapStatusText（Decision in Process→DECISION_PENDING）、recordDecisionRecord、review splitReviewComment/assertSourceComplete/createConflictDisposition、checkResponseClaims(claim checker)、ReviewResponseWorkOrder、deadline(DATE_ONLY/timezone)、withdrawal stage、transfer/assessAppeal、setOutcome（Accept≠Publish、Award≠Funds）、verifyInboundWebhook/isolateExtracted/htmlSafe/assertDisclosure（入站隔離）。
- **API 層**：既有 submission-tracking-v3 routes 契約相容保留；欄位透過新 service 富化。
- **驗收證據**：`scripts/verify-stage19-full-72-items.ts` **對齊規格 §35 T01–T72（72/72 PASS，3 NOT_RUN**：LIVE 官方入口送件、email/webhook connector LIVE、UI 深度整合）；`verify-stage19-stage20-consumer-contract.ts` **44/44 PASS**（case/leg/round、provider 三模式、ActionIntent、DecisionRecord、7-tier evidence、U20 receiver 門）。`npx tsc --noEmit` 0 errors；回歸 U18（79）、U17（66）、U16（60）、U15（60）、U14（60）＋各 consumer（27/61/72/70）全 PASS。
- **誠實標記**：submission_execution_authorized=false 恆定；GUIDED_MANUAL 不臆造 endpoint；Decision in Process≠Accept；接受≠出版、核定≠款到/人體研究授權；R1≠R0（新 Round＋新授權）；fixture≠真實稿件已送件；未部署 Zeabur、未跑正式 DB migration。
- **停止邊界**：完成第十九階段 R2 後停止，等待 V3-U20「接受／核定後作業與成果管理」。

## V3-U19-FULL：第十九階段「正式送件、狀態追蹤與審查往返」建置完成（2026-09-06/07 UTC）
- **規格基準**：`docs/stage19/spec-v3-4.0.md`（依使用者 Telegram 訊息內文九節收錄）。
- **上游 Gate 對照**：`FINAL_PACKAGE_LOCKED_AND_HANDOFF_READY`（packageLocked + decision ≠ NOT_READY）；未 lock 阻擋進入追蹤。
- **核心實體與契約**：`lib/submission-tracking-v3-contract.ts`（SubmissionWorkOrder、ExternalAttempt（reservation→dispatch→OUTCOME_UNKNOWN）、SubmissionEvent（5 種 source tier）、ReceiptVerification、ExternalReview/ExternalReviewItem、UpstreamRevisionRef、FormalDecision、SubmissionTrackingSnapshot、Stage20ReceiverState、19 個錯誤碼）。
- **核心服務**：`lib/submission-tracking-v3-service.ts`：承接 U18 `FinalSubmissionPackageSnapshot` 零重複輸入；pre-submit authorization（綁 target/actor/operation/content hash/有效期）；attempt reservation 後派送；timeout 標 OUTCOME_UNKNOWN（不自動重送/換 provider）；active-submission guard（不可繞過）；事件/回執（USER_REPORTED ≠ 官方收件；verified 僅 OFFICIAL 來源）；external review 隔離（≠ U09/U16 模擬）＋ per-item Response Matrix（需實際證據）；upstream revision ref；R1 再送（需新 QA/確認/lock/新授權）；正式決策僅 verified 來源；`SubmissionTrackingSnapshot`（stageKey=V3-U19，nextStageId=post-acceptance）與 Stage 20 receiver。
- **後端 API 路由**（`/api/projects/:projectId/submission-tracking-v3/*`）：
  * initialize（ACL＋body/DB 讀 U18 快照＋package-lock gate）
  * attempt（reservation / DISPATCH / OUTCOME_UNKNOWN / VERIFY_RECEIPT；GUIDED_MANUAL）
  * events（時間軸事件與回執，source tier 分流）
  * review（CREATE_REVIEW / ADD_ITEM / RESPOND / UPSTREAM_REF / DECISION）
  * complete（R1 再送授權→SubmissionTrackingSnapshot→持久化 stageId=`submission-tracking`，idempotencyKey=`comp_st_<snapshotId>`＋U20 receiver）
  * export（json／timeline／response-matrix／qa-report／markdown，其餘 EXPORT_FORMAT_UNSUPPORTED）
  * receiver（U20 可重開接收頁，不空白、不循環 Gate）
- **驗收證據（實際執行）**：
  * `scripts/verify-stage19-full-72-items.ts`：**72/72 PASS，3 NOT_RUN**（LIVE 官方入口送件、email/webhook 入站連線、UI 深度整合）。
  * `scripts/verify-stage19-stage20-consumer-contract.ts`：**44/44 PASS**。
  * `npx tsc --noEmit`：0 errors；回歸：U18（79）、U17（66）、U16（60）、U15（60）、U14（60）、U13（48）。
- **誠實標記**：submission_execution_authorized=false 恆定（除非使用者明確授權）；GUIDED_MANUAL 不臆造 endpoint；等待審查是正常狀態不捏造接受；Reviewer recommend accept ≠ editor accept；接受≠出版、核定≠款到或人體研究授權；R1 ≠ R0（需新授權）；fixture ≠ 真實稿件已送件；未部署 Zeabur、未跑正式 DB migration。
- **停止邊界**：完成第十九階段後停止，等待 V3-U20「接受／核定後作業與成果管理」指令。

## V3-U18-FULL-R2：第十八階段完整規格補強（2026-09-06/07 UTC）
- **規格基準**：`docs/stage18/spec-v3-4.0.md`（641 行完整版；SHA-256 `5d608c92…aab07f5`，與使用者附檔逐字一致）。
- **完整規格補強（相較 R1 摘要版）**：
  * FinalPackageWorkOrder（§4）：target options（JOURNAL_INITIAL_SUBMISSION／NSTC_GENERAL_APPLICATION／MOE_TPR_APPLICATION／LOCAL_PREFLIGHT）。
  * Official Rule Resolver（§5）：7 態（VERIFIED_APPLICABLE／PREVIOUS_YEAR_REFERENCE／PENDING_OFFICIAL_ANNOUNCEMENT／SOURCE_UNAVAILABLE／CONFLICTING／UNVERIFIED／SUPERSEDED）。
  * SubmissionFieldMap（§8）：三路線欄位；author/PI 需 human declaration；初始 NOT_READY。
  * Visibility（§13）：REVIEWER_VISIBLE…INTERNAL_AUDIT；Title Page 在雙匿名下 EDITOR_ONLY。
  * Bundle 分流（§28）：EXTERNAL_SUBMISSION_BUNDLE vs INTERNAL_COMPLIANCE_EVIDENCE_PACKAGE。
  * 狀態機（§29）：DRAFT…LOCKED_READY；PARTIAL_PREFLIGHT/BLOCKED/STALE/SUPERSEDED/WITHDRAWN_FROM_RELEASE。
  * ready_for_action（§30）：READY_FOR_AUTHOR_SUBMISSION（期刊）／READY_FOR_INSTITUTIONAL_REVIEW（NSTC/MOE 先校內）／PREFLIGHT_ONLY。
  * submissionStatus=NOT_SUBMITTED_BY_THIS_STAGE；19 個規格錯誤碼（§32）。
- **驗收證據（實際執行）**：
  * `scripts/verify-stage18-full-66-items.ts`：**79 PASS**（66 原始 + 13 R2 情境），3 NOT_RUN。
  * `scripts/verify-stage18-stage19-consumer-contract.ts`：**70/70 PASS**。
  * `npx tsc --noEmit`：0 errors；回歸：U17（66）、U16（60）、U15（60）、U14（60）、U13（48）。
- **誠實標記**：submission_execution_authorized=false 恆定；READY ≠ SUBMITTED/官方核准；DOCX/PDF/LaTeX 無 renderer 標 UNSUPPORTED；ApprovalSubjectManifest 無循環 hash；未部署 Zeabur、未跑正式 DB migration；fixture ≠ 真實稿件已合規或已送件。
- **停止邊界**：完成第十八階段完整版後停止，等待 V3-U19「正式送件、狀態追蹤與審查往返」指令。

## V3-U18-FULL：第十八階段「目標期刊／計畫最終合規、送件文件與成果包」建置完成（2026-09-06/07 UTC）
- **規格基準**：`docs/stage18/spec-v3-4.0.md`（依使用者 Telegram 訊息內文八節收錄）。
- **上游 Gate 對照**：`LANGUAGE_EDITION_READY_FOR_FINAL_COMPLIANCE`；`USE_BLOCKED`／`SOURCE_STALE` 的 languageReleaseState 阻擋合規；`formal_compliance_allowed=false` 僅可做預檢，不自動變完整科學核准。
- **核心實體與契約**：`lib/final-submission-v3-contract.ts`（SubmissionRoute、三路線 profile（Journal/Nstc/Moe）、OfficialRuleSnapshot、PackageDocument、ApprovalSubjectManifest、AuthorApprovalRecord、PackageReadiness、FinalSubmissionPackageSnapshot、Stage19ReceiverState、17 個錯誤碼）。
- **核心服務**：`lib/final-submission-v3-service.ts`：承接 U17 `LanguageQualitySnapshot` 零重複輸入；三路線 profile；scope gate（partial 僅預檢）；規則快照（來源/條文/年度/版本/hash，不填未查證 APC/索引/截止日）；衍生文件 + renderer gate（DOCX/PDF/LaTeX 如實 UNSUPPORTED）；匿名化 QA（metadata/註解/修訂/表圖/附件，不只刪第一頁姓名）；References QA；ApprovalSubjectManifest（hash 不含 approval 事件，避免循環）；approve digest；freeze→confirm→lock；`FinalSubmissionPackageSnapshot`（stageKey=V3-U18，nextStageId=submission-tracking）與 Stage 19 receiver。
- **後端 API 路由**（`/api/projects/:projectId/final-submission-v3/*`）：
  * initialize（ACL＋body/DB 讀 U17 快照＋USE_BLOCKED/SOURCE_STALE 阻擋＋scope gate）
  * check（匿名化/References/render QA）
  * approve（核准綁定具體檔案 digest；通訊作者轉述不得冒充每位作者點擊）
  * freeze（freeze 後才收 approval，避免 hash 循環）
  * lock（真人確認＋核准齊備才 Package Lock；AI 鎖草稿 ≠ 作者同意）
  * complete（QA→freeze→approvals→lock→FinalSubmissionPackageSnapshot→持久化 stageId=`final-compliance`，idempotencyKey=`comp_fs_<snapshotId>`＋U19 receiver）
  * export（json／package-manifest／approval-subjects／qa-report／markdown，其餘 EXPORT_FORMAT_UNSUPPORTED）
  * receiver（U19 可重開接收頁，不空白、不循環 Gate）
- **驗收證據（實際執行）**：
  * `scripts/verify-stage18-full-66-items.ts`：**66/66 PASS，3 NOT_RUN**（DOCX/PDF/LaTeX renderer round-trip、官方規則即時重驗、UI 深度整合）。
  * `scripts/verify-stage18-stage19-consumer-contract.ts`：**44/44 PASS**。
  * `npx tsc --noEmit`：0 errors；回歸：U17（66）、U16（60）、U15（60）、U14（60）、U13（48）。
- **誠實標記**：submission_execution_authorized=false 恆定；READY_FOR_AUTHOR_SUBMISSION／READY_FOR_INSTITUTIONAL_REVIEW/SUBMISSION 均不等於 SUBMITTED 或官方核准；DOCX/PDF/LaTeX 無 renderer 標 UNSUPPORTED 不以 Markdown 冒稱可送件；靜態 References 不冒充 Zotero Word 動態欄位；未部署 Zeabur、未跑正式 DB migration；fixture ≠ 真實稿件已合規或已送件。
- **停止邊界**：完成第十八階段後停止，等待 V3-U19「正式送件與審查追蹤」指令。

## V3-U17-FULL-R2：第十七階段完整規格補強（2026-09-06/07 UTC）
- **規格基準**：`docs/stage17/spec-v3-4.0.md`（682 行完整版；SHA-256 `77025dc7…66d4c8`，與使用者附檔逐字一致）。
- **完整規格補強（相較 R1 摘要版）**：
  * SemanticUnit（§9）：6 種 ProtectionKind；subject/group/timepoint/negation/certainty/causal ceiling/qualifiers。
  * ProtectedSpanManifest + Token Codec（§10）：opaque nonce 包覆、schema allowlist、occurrences；opaque token ≠ 匿名化。
  * Provider verification tiering（§6）：DOCUMENTED→LIVE_VERIFIED；6 provider 快照；DeepL Write 與 Translate 分開。
  * DeepL 核對（§7）：Translate v2／Write correct+rephrase／API Pro／10 KiB body UTF-8 bytes 計量。
  * EditIntensity（§16）：CONSERVATIVE／BALANCED／SUBSTANTIVE_LANGUAGE_EDIT。
  * BudgetPlanner（§23）：estimated/reserved/reported/reconciled、PROVIDER_OUTCOME_UNKNOWN。
  * language release state（§30）：DRAFT…USE_BLOCKED；PARTIAL_LANGUAGE_RELEASE 不自動升 full。
  * 18 個規格錯誤碼（§31）。
- **驗收證據（實際執行）**：
  * `scripts/verify-stage17-full-60-items.ts`：**66 PASS**（60 原始 + 6 新增：tiering/Write 分離/budget/protected span codec/NO_DERIVATIVE/opaque token），4 NOT_RUN。
  * `scripts/verify-stage17-stage18-consumer-contract.ts`：**72/72 PASS**。
  * `npx tsc --noEmit`：0 errors；回歸：U16（60/60）、U15（60/60）、U14（60/60）、U13（48/48）。
- **誠實標記**：DeepL/LanguageTool 無 Live key 標 NOT_CONFIGURED；老麥語義模型 CONTRACT_TESTED（本地確定性）；opaque token 非匿名化；語言版就緒≠送件/期刊接受；未部署 Zeabur、未跑正式 DB migration。
- **停止邊界**：完成第十七階段完整版後停止，等待 V3-U18「目標期刊／計畫最終合規、送件文件與成果包」指令。

## V3-U17-FULL：第十七階段「翻譯、學術潤稿、術語一致性與語言品質」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage17/spec-v3-4.0.md`（依使用者 Telegram 訊息內文收錄九節）。
- **上游 Gate 對照**：`SCIENTIFIC_REVISION_READY_FOR_LANGUAGE`；`USE_BLOCKED`／`SOURCE_STALE` 的 scientificReleaseState 阻擋語言處理；不要求固定稿件 v1/v2。
- **核心實體與契約**：`lib/language-quality-v3-contract.ts`（LanguageWorkOrder、LanguageSegment（UTF-8 bytes）、FidelityCheckKind 15 種、FidelityIssue、TermBinding、ProviderCapability、LanguageQualitySnapshot、Stage18ReceiverState、17 個錯誤碼）。
- **核心服務**：`lib/language-quality-v3-service.ts`：承接 U16 `ScientificReviewSnapshot` 零重複輸入；scope 檢查（partial 不自動升整稿）；UTF-8 分段；保真檢查（數值/方向/分母/時點/否定/因果強度/確認探索/群組互換，超越 token 數量）；術語檢查；Provider capability manifest（DeepL Translate/Write、老麥 MOCK、LanguageTool、Google/Azure fallback 如實標示）；QA 聚合；`LanguageQualitySnapshot`（stageKey=V3-U17，nextStageId=final-compliance）與 Stage 18 receiver。
- **後端 API 路由**（`/api/projects/:projectId/language-quality-v3/*`）：
  * initialize（ACL＋body/DB 讀 U16 快照＋USE_BLOCKED/SOURCE_STALE 阻擋）
  * segments（scope 強制、UTF-8 分段、超長標記）
  * check（保真/術語/QA，FATAL 不得 PASS）
  * adopt（採用前後端重驗保真，FIDELITY_FATAL_ISSUE 阻擋；target 鎖不被批次覆寫）
  * complete（保真+術語+QA→LanguageQualitySnapshot→持久化 stageId=`translation-polish`，idempotencyKey=`comp_lq_<snapshotId>`＋U18 receiver）
  * export（json／fidelity-report／qa-report／alignment／markdown，其餘 UNSUPPORTED）
  * receiver（U18 可重開接收頁，不空白、不循環 Gate）
- **驗收證據（實際執行）**：
  * `scripts/verify-stage17-full-60-items.ts`：**60/60 PASS，4 NOT_RUN**（Live DeepL、Live LanguageTool、DOCX/PDF/LaTeX round-trip、UI 深度整合）。
  * `scripts/verify-stage17-stage18-consumer-contract.ts`：**45/45 PASS**。
  * `npx tsc --noEmit`：0 errors；回歸：U16（60/60）、U15（60/60）、U14（60/60）、U13（48/48）。
- **誠實標記**：DeepL Translate/Write、LanguageTool 無 Live key 如實標 NOT_CONFIGURED（不假裝接通）；老麥語義模型為本地確定性規則（MOCK）；語言版就緒≠正式送件、全作者同意或期刊接受；fixture 通過不代表真實稿件已翻譯；未部署 Zeabur、未跑正式 DB migration。
- **停止邊界**：完成第十七階段後停止，等待 V3-U18「目標期刊／計畫最終合規、送件文件與成果包」指令。

## V3-U16-FULL-R2：第十六階段完整規格補強（2026-09-06 UTC，第二輪）
- **規格基準**：`docs/stage16/spec-v3-4.0.md`（760 行完整版；SHA-256 `29157b04…0c4583c9`，與使用者附檔逐字一致）。
- **完整規格補強（相較第一輪簡版）**：
  * ReviewCoverageMatrix（§5）：章節/主張/結果/方法/引用/表圖/倫理逐項，未審標 NOT_ASSESSED，不產生假綠勾（T10）。
  * 9 角色庫（§8）：EDITOR_TRIAGE…REVIEWER_2_CHALLENGER，按文章類型啟用，多角色為模擬非真人獨立驗證。
  * ReviewCapabilityManifest（§7）：Zotero／citeproc／LLM 生成式審查如實標 UNSUPPORTED。
  * ScientificFinding 完整欄位（§18）：category（12 類）、finding_origin、source_excerpt、evidence_for/against、coverage_limit、disposition、adjudicated_by。
  * ScientificReviewPackage + LanguagePolishingHandoffPackage（§31）：共用 refs 不複製 Raw。
  * scientificReleaseState（§30）：DRAFT_REVIEW…USE_BLOCKED；fullManuscriptLanguageAllowed + languageAllowedScopeRefs 精確 scope。
  * 20 個規格錯誤碼（§32）收錄於契約。
- **驗收證據（實際執行）**：
  * `scripts/verify-stage16-full-60-items.ts`：**60/60 PASS，3 NOT_RUN**（UI 深度整合、LLM live Reviewer adapter、DOCX/PDF/LaTeX round-trip）。
  * `scripts/verify-stage16-stage17-consumer-contract.ts`：**61/61 PASS**（完整規格擴充斷言：角色庫、coverage、capability、packages、release state）。
  * `npx tsc --noEmit`：0 errors；回歸：U15（60/60）、U14（60/60）、U13（48/48）。
- **誠實標記**：所有 AI 審查輸出標 SIMULATED REVIEW；Reviewer #2 為確定性規則引擎；未部署 Zeabur、未跑正式 DB migration；fixture 通過不代表真實稿件審查完成；綠燈＝內部科學審查完成，非期刊接受。
- **停止邊界**：完成第十六階段完整版後停止，等待 V3-U17「翻譯、學術潤稿、術語一致性與語言品質」指令。

## V3-U16-FULL：第十六階段「老麥科學內容審查、Reviewer #2壓力測試與逐項修訂」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage16/spec-v3-4.0.md`（v3.4.0；依使用者 Telegram 訊息內文收錄，非附檔）。
- **上游 Gate 對照**：`MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW`（正式）；`WRITING_SCOPE_AND_SOURCES_READY`／`PLANNING_OUTLINE` 視為規劃模式，initialize 直接阻擋正式審查；不要求固定稿件 v1 字串。
- **核心實體與契約**：`lib/scientific-review-v3-contract.ts`（ReviewWorkOrder、ScientificFinding 含 basis／alternativeExplanation／minimalRevisionPath／verificationStatus／duplicateOf、RevisionProposal、ReReviewDecision、MeaningConstraint、UpstreamReviewRequest、ScientificReviewSnapshot、Stage17ReceiverState）。
- **核心服務**：`lib/scientific-review-v3-service.ts`：承接 U15 `ManuscriptWritingSnapshot` 零重複輸入；確定性機械 QA（數值綁定／幽靈數據／p 值／誠實非顯著／hash／表圖 refs）；Reviewer #2 建設性挑戰（證據＋替代解釋＋最小修正路徑，不強迫大樣本 RCT，全標 SIMULATED REVIEW）；Finding 去重；Author Response Matrix（作者可有據不同意）；重審決策（達上限保留未解問題 CLOSED_WITH_UNRESOLVED，不強制 PASS）；Scientific Meaning Constraints（數值／N／方向／時點／假設狀態／因果邊界保護值檢查）；`ScientificReviewSnapshot`（stageKey=V3-U16，nextStageId=translation-polish）與 Stage 17 receiver。
- **後端 API 路由**（`/api/projects/:projectId/scientific-review-v3/*`）：
  * initialize（ACL＋body/DB 讀 U15 快照＋規劃模式阻擋）
  * reviewer2（SIMULATED 挑戰生成＋去重＋約束）
  * findings（Finding／修訂／上游回送薄驗證層）
  * respond（作者裁決＋回覆；ACCEPTED_RISK 不能解除虛構／無權／過期來源）
  * re-review（重審裁決）
  * complete（機械 QA＋Response Matrix＋重審＋Meaning Constraints＋快照建構＋持久化到 `stage_completion_snapshots`（stageId=`scientific-review`，idempotencyKey=`comp_sr_<snapshotId>`）＋U17 receiver）
  * export（json／findings-manifest／meaning-constraints／qa-report／markdown，其餘 UNSUPPORTED）
  * receiver（U17 可重開接收頁，不空白、不循環 Gate）
- **驗收證據（實際執行）**：
  * `scripts/verify-stage16-full-60-items.ts`：**60/60 PASS，3 NOT_RUN**（誠實分級；NOT_RUN＝UI 深度整合、LLM live Reviewer adapter、DOCX/PDF/LaTeX round-trip）。
  * `scripts/verify-stage16-stage17-consumer-contract.ts`：**38/38 PASS**。
  * `npx tsc --noEmit`：**0 errors**。
  * 回歸：Stage 13（48/48）、Stage 14（60/60）、Stage 15（60/60）全數 PASS。
- **誠實標記**：所有 AI 審查輸出標 SIMULATED REVIEW；Reviewer #2 為確定性規則引擎（LLM adapter NOT_RUN）；未部署 Zeabur、未跑正式 DB migration；fixture 通過不代表真實稿件審查完成。
- **停止邊界**：完成第十六階段後停止，等待下一階段（V3-U17 翻譯與學術潤稿）指令。

## V3-U15-FULL-R2：第十五階段增量補全與誠實驗收（2026-09-06 UTC，第二輪）
- **規格基準**：`docs/stage15/spec-v3-4.0.md`（v3.4.0；SHA-256 `0901c747…e17dcc3`，與使用者附檔逐字元一致）。
- **本輪增量修復（相較於第一輪 U15）**：
  * **DB 持久化交接已實際接通**：`manuscript-writing/complete` 現在真正呼叫 `StageOperationRepository.saveCompletionSnapshot`（stageId=`results-writing`、idempotencyKey=`comp_mw_<snapshotId>`、nextStageId=`scientific-review`），與 Stage 4–13 的交接模式一致；DB 不可用時如實回報 `persistence.status=STORAGE_UNAVAILABLE`，不假裝成功（規格 §28）。
  * **DB 讀取來源已實際接通**：`manuscript-writing/initialize` 現在會從 `stage_completion_snapshots` 讀取 Stage 14 的 `AnalysisResultsSnapshot`（body 未提供時），並完成 requireAuthenticatedUser + resolveResearchTenant ACL 檢查（規格 §2、§27）。
  * **`ManuscriptEvidencePackage` 已實作**（規格 §30）：scope accounting（MAIN_TEXT/TABLE/FIGURE/SUPPLEMENT/OUT_OF_SCOPE_WITH_REASON/NOT_PERFORMED_WITH_REASON）、storyline/section brief/methods source/result usage/claim-evidence/quote locator/table/figure/citation/bibliography/zotero/terminology/profile/reporting refs、upstreamVersions、AI audit summary ref、disclosure inputs ref；含 `packageId` 與 SHA-256 內容 hash。
  * **`ManuscriptWritingSnapshot` 已擴充**：新增 `sourceAnalysisSnapshotContentHashSha256`、`evidencePackageId`、`evidencePackageContentHashSha256`、快照 ID 加入 UUID 鹽以確保唯一性。
  * **U16 接收頁 API 已建立**：`GET /api/projects/:projectId/manuscript-writing/receiver`，回傳 `Stage16ReceiverState`（receiver/1.0.0），顯示稿件摘要、模式、QA 旗標、bound fact/citation/table/figure 計數、待辦及 `reEntryPoint`（可重開 U15，不跳空白頁，不循環 Gate）；U16 未建置時仍可重開（規格 §30、T59）。
  * **真實匯出端點已建立**：`GET /api/projects/:projectId/manuscript-writing/export?format=json|references|fact-manifest|qa-report|markdown`（規格 §28 最低交付），真實回傳 bytes 與 Content-Disposition；References 為 STATIC_CITATION_EXPORT 佔位（如實標注，不偽造 DOI/作者）；Markdown 為 manifest 級（章節全文需 round-trip，X-Note 標注）。
  * **Stage 16 Consumer Contract Test**：`scripts/verify-stage15-stage16-consumer-contract.ts`（27/27 PASS），涵蓄 schema 穩定性、hash、evidence package、receiver 回鏈、無循環 Gate、AI 自鎖 ≠ 人工核准。
  * **60 項驗收測試去陶態化**：原 18 項恆 `true` 的斷言改為真實檢驗（T11/T18/T33/T34/T35/T36/T39/T40/T41/T50/T51/T53/T54 等）；失敗會真實 FAIL（開發過程中 T39 即曾真實抓到失敗並修正）。誠實報告模式 `NOT_RUN` 函式已就位。
  * **`AnalysisResultsSnapshot` 契約擴充**：新增 `unperformedAnalysisReasons[]`（規格 §14 未執行分析處置），U14 service 與測試 fixture 同步更新。
- **驗收證據（本輪實際執行）**：
  * `scripts/verify-stage15-full-60-items.ts`：**60/60 PASS**（誠實斷言版）。
  * `scripts/verify-stage15-stage16-consumer-contract.ts`：**27/27 PASS**。
  * `npx tsc --noEmit`：**0 errors**。
- **停止邊界（依規格 §32）**：未部署 Zeabur、未跑正式 DB migration、未開始第十六階段 Reviewer 實作、未重建翻譯潤稿。Stage 15 UI 深度整合（一鍵協作按鈕、章節編輯器接 U15 service）、DOCX/LaTeX 匯出、Zotero Live Fields 為**後續輪次工作**，如實列於 stage15-provider-status.md。

## V3-U15-FULL：第十五階段「研究結果整合與證據驅動全文寫作」建置完成（2026-09-06 UTC，第一輪）
- **規格基準**：`docs/stage15/spec-v3-4.0.md`（v3.4.0；68.4KB）。
- **核心實體與契約**：
  * `lib/manuscript-writing-contract.ts`：證據驅動全文寫作工作室（`ManuscriptWorkspace`、`WritingWorkOrder`，支援 FORMAL_SCIENTIFIC_DRAFT / PARTIAL_EVIDENCE_DRAFT / PLANNING_OUTLINE 三種模式）、Results Storyboard（串聯 RQ-01 -> H1 -> ResultFact -> Table 1 / Figure 1）、Claim-Evidence Map（`ClaimEvidenceLink`，區分 BACKGROUND / GAP / THEORY / METHOD / RESULT / INTERPRETATION）、全文章節 AST（`ManuscriptSection` 與 `ManuscriptParagraph`，包含 Title/Abstract、Introduction、Methods、Results、Discussion、Conclusion）、不可變 ResultFact 綁定（所有正文數值直連 fact_rt_t1_diff_mean / fact_rt_t1_cohens_d / fact_ancova_treatment_effect 標籤）、出版表圖嵌入（Table 1 與 Figure 1 直接引用，嚴禁文生圖假圖表）、不可變交接快照契約（`ManuscriptWritingSnapshot`）。
  * `lib/manuscript-writing-service.ts`：承接第十四階段 `AnalysisResultsSnapshot` 零重複輸入建立寫作工作區；逐章起草完整 IMRaD 結構（忠實反映 RCT 隨機、REC-115-089 知情同意、VR 防動暈中斷 20m+10m 實施現況；Discussion 因果邊界明確提示 T2 延宕遷移待驗證）；品質檢查器（檢驗 Results 未綁定 Fact `RESULTS_SECTION_FACT_BINDING_MISSING`、Discussion 幽靈數據 `NEW_RESULT_IN_DISCUSSION_PROHIBITED`、不可能 p 值 `IMPOSSIBLE_P_VALUE_REPORTED`）；建構第十六階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/manuscript-writing/initialize`：冪等恢復或承接 Stage 14 快照建立寫作工作區（零重複輸入）。
  * `POST /api/projects/:projectId/manuscript-writing/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="scientific-review"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage15-full-60-items.ts`：60 項標準驗收測試套件（**60/60 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 14）驗收測試回歸：全數維持 **100% PASS**（累積 600 項驗收全通）。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage15/`）：
  * `stage15-compatibility-map.md`（相容映射）
  * `stage15-data-flow.md`（資料流向與端點說明）
  * `stage15-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage15-provider-status.md`（外部 Provider 與寫作引擎狀態盤點）
  * `stage15-manuscript-writing-handoff-contract.md`（交接快照契約）
  * `stage15-test-results.md`（60 項驗收測試報告）
  * `stage15-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * 本階段產出證據驅動科學初稿，不進行翻譯潤稿、不保證期刊錄用、不正式投稿；**本輪第十五階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U14-FULL：第十四階段「分析實驗室 Execution Mode、研究結果與圖表」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage14/spec-v3-4.0.md`（v3.4.0；66.2KB）。
- **核心實體與契約**：
  * `lib/analysis-execution-contract.ts`：分析工作單（`AnalysisWorkOrder`，嚴格綁定已核定之分析資料集與 RQ）、分析運行帳本（`AnalysisRun`，完整記錄模型參數、自由度、效應量與 CI）、不可變結果事實層（`ResultFact`，附加 64 字元 SHA-256 數位簽章，AI 與通用編輯器嚴禁改寫數值）、出版級表圖工作室（`PublicationTable` Table 1、`PublicationFigure` Figure 1，由資料驅動 SVG 渲染引擎渲染，cell 與 error bars 直接綁定 ResultFact，嚴禁文生圖假圖表）、老麥科學結果解說卡（`ScientificInterpretationCard`，提示因果推論邊界與實務意義）、科學誠信檢驗（非顯著主要結果 p >= .05 仍如實報告發布，無 p-hacking）、不可變交接快照契約（`AnalysisResultsSnapshot`）。
  * `lib/statistical-computation-engine.ts`：確定性受控統計推論運算引擎（v1.0.0），實現手算基準驗證（[1,2,3,4,5] mean=3.0, var=2.5）、獨立雙樣本 Welch t-test（T1 反應時間組間差值 -913.1ms, p < .01, Cohen d = -9.744）、基線共變數控制 ANCOVA 線性模型（控制 T0 後介入處理效應 Beta1 = -945.2ms, R2 = 0.991）、Holm-Bonferroni 多重比較 step-down 校正運算；嚴禁輸出 p=0 或將 NaN/null 格式化為 0.000。
  * `lib/analysis-execution-service.ts`：承接第十三階段 `DataGovernanceSnapshot` 零重複輸入建立分析工作區；閘門檢查器（檢驗核心 RQ 結果缺失 `PRIMARY_RQ_RESULT_MISSING`、ResultFact 數位簽章無效 `RESULT_FACT_CRYPTO_SEAL_INVALID`、p 值格式異常 `P_VALUE_FORMAT_ANOMALY_DETECTED`）；建構第十五階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/analysis-execution/initialize`：冪等恢復或承接 Stage 13 快照建立分析實驗室工作區（零重複輸入）。
  * `POST /api/projects/:projectId/analysis-execution/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="results-writing"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage14-full-60-items.ts`：60 項標準驗收測試套件（**60/60 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 13）驗收測試回歸：全數維持 **100% PASS**（累積 540 項驗收全通）。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage14/`）：
  * `stage14-compatibility-map.md`（相容映射）
  * `stage14-data-flow.md`（資料流向與端點說明）
  * `stage14-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage14-provider-status.md`（外部 Provider 與引擎狀態盤點）
  * `stage14-analysis-execution-handoff-contract.md`（交接快照契約）
  * `stage14-test-results.md`（60 項驗收測試報告）
  * `stage14-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * 本階段僅負責統計分析計算、結果驗證與圖表生成，不提前撰寫整篇論文、不做母語潤稿、不正式投稿；**本輪第十四階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U13-FULL：第十三階段「資料治理、清理與 Analysis Dataset」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage13/spec-v3-4.0.md`（v3.4.0；62.4KB）。
- **核心實體與契約**：
  * `lib/data-governance-contract.ts`：資料分區（`IDENTITY_VAULT`、`RAW_IMMUTABLE`、`STAGING_QUARANTINE`、`CLEAN_DERIVED`、`ANALYSIS_RELEASE`，身分金庫嚴格隔離，虛擬代碼 P-001）、標準化資料字典與來源映射（`CanonicalDataVariable`、`SourceFieldMapping`，保留前導零 0012 與小數點 locale，sentinel 缺失碼隔離）、清理規則（`CleaningRule`）、Clean 紀錄（`CleanRecord`）、分析範圍（`AnalysisScope`）、分析資料集發布版本（`AnalysisDatasetRelease`，封存鎖定並計算 SHA-256 簽章）、資料品質摘要與血緣追蹤（`DataQualitySummary` 標記 DATA_PREPARATION_DIAGNOSTIC、`LineageEdge` 直溯原始 Raw ID 與 Rule）、不可變交接快照契約（`DataGovernanceSnapshot`）。
  * `lib/data-preparation-pipeline.ts`：確定性受控資料清理管線（v1.0.0），實現缺失碼優先攔截（99/-9 先轉譯為 null，嚴防產生 6-99=-93 錯誤）、安全反向轉碼（lower+upper-x 僅對有效範圍運算，防重複反向）、非破壞性極端值標記（FLAGGED_RETAINED，不為顯著性隨意刪除數據）、教育情境未同意學生紀錄隔離（MOE_TPR 防洩漏）、AI 切分 Fold-safe Fit 防洩漏檢驗；拒絕任意 eval 注入。
  * `lib/data-governance-service.ts`：承接第十二階段 `FormalExecutionSnapshot` 零重複輸入建立資料治理工作區；閘門檢查器（檢驗分析資料集未發布 `ANALYSIS_DATASET_NOT_RELEASED`、AI 前處理全資料 Fit 違規 `DATA_LEAKAGE_PREPROCESSING_FIT_VIOLATION`、未同意學生紀錄外洩 `UNCONSENTED_STUDENT_DATA_LEAKED_TO_RESEARCH`）；建構第十四階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/data-governance/initialize`：冪等恢復或承接 Stage 12 快照建立資料治理工作區（零重複輸入）。
  * `POST /api/projects/:projectId/data-governance/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="analysis-execution"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage13-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 12）驗收測試回歸：全數維持 **100% PASS**（累積 480 項驗收全通）。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage13/`）：
  * `stage13-compatibility-map.md`（相容映射）
  * `stage13-data-flow.md`（資料流向與端點說明）
  * `stage13-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage13-provider-status.md`（外部 Provider 與管線狀態盤點）
  * `stage13-data-governance-handoff-contract.md`（交接快照契約）
  * `stage13-test-results.md`（48 項驗收測試報告）
  * `stage13-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * 本階段僅負責資料治理、計分轉換與 Analysis Dataset 封存，不做統計推論檢定、不撰寫假論文 Results；**本輪第十三階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U12-FULL：第十二階段「正式研究執行與資料蒐集」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage12/spec-v3-4.0.md`（v3.4.0；55.8KB）。
- **核心實體與契約**：
  * `lib/formal-execution-contract.ts`：正式研究執行放行閘門（`FormalExecutionGate`）、執行授權（`ExecutionAuthorization`，綁定 REC-115-089 倫理核准函）、身分識別金庫（`IdentityMappingVault`，真實個資加密隔離，工作區僅用虛擬代碼 P-001，絕不上傳 LLM）、受試者註冊與追蹤（`StudyUnit`、`RecruitmentRecord`，教育情境落實成績評定分離確認）、篩檢與知情同意（`EligibilityAssessment`、`ConsentRecord`，未有真實簽署檔案嚴禁標記 CONSENTED）、試驗 Session 追蹤（`StudySession`，T0/介入/T1/T2）、介入忠實度（`ProtocolFidelityRecord`，落實防動暈中斷 20m+10m）、偏差日誌與安全事件（`ProtocolDeviation`、`SafetyEvent`）、不可變原始資料層（`RawDataRecord`，Append-only 儲存與 SHA-256 簽章，任何修改走 `DataCorrectionRecord`）、硬體與 AI 脈絡追蹤（`HardwareAndAIProvenance`，採樣率 90Hz、同步 2.1ms、固定種子，模型切換發出警告）、營運儀表板（`StudyOperationsDashboard`，目標規劃 N=151 與實際收案 N=4 嚴格分離）、不可變交接快照契約（`FormalExecutionSnapshot`）。
  * `lib/formal-execution-service.ts`：承接第十一階段 `PilotValidationSnapshot` 零重複輸入建立正式執行工作區；放行檢查器（檢驗未獲倫理授權擅自啟動人體研究 `UNAUTHORIZED_FORMAL_HUMAN_RESEARCH_PROHIBITED`、虛假簽名同意書 `FABRICATED_CONSENT_SIGNATURE_PROHIBITED`、試驗期間 AI 模型版本切換 `MODEL_VERSION_CHANGED_DURING_STUDY`）；建構第十三階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/formal-execution/initialize`：冪等恢復或承接 Stage 11 快照建立正式執行工作區（零重複輸入）。
  * `POST /api/projects/:projectId/formal-execution/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="data-governance"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage12-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 11）驗收測試回歸：全數維持 **100% PASS**（累積 432 項驗收全通）。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage12/`）：
  * `stage12-compatibility-map.md`（相容映射）
  * `stage12-data-flow.md`（資料流向與端點說明）
  * `stage12-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage12-provider-status.md`（外部 Provider 與系統狀態盤點）
  * `stage12-formal-execution-handoff-contract.md`（交接快照契約）
  * `stage12-test-results.md`（48 項驗收測試報告）
  * `stage12-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * 本階段僅負責正式資料收案存證，不做統計分析、不撰寫假 Results；**本輪第十二階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U11-FULL：第十一階段「Pilot／工具預試與 Protocol 驗證」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage11/spec-v3-4.0.md`（v3.4.0；54.1KB）。
- **核心實體與契約**：
  * `lib/pilot-validation-contract.ts`：嚴格研究資料分層（`SYNTHETIC_TEST`、`INTERNAL_DRY_RUN`、`COGNITIVE_PRETEST`、`PILOT_RESEARCH_DATA`、`FORMAL_RESEARCH_DATA`）、預試放行閘門與許可（`PilotReadinessAssessment`、`PilotExecutionPermission`，非人體內部預演與人體預試嚴格隔離）、預試計畫（`PilotPlan`，`plannedN` 不自動充當 `actualN`）、認知訪談紀錄（`CognitiveInterviewRecord`，僅記錄匿名代碼 P-01 與題目指導語澄清）、評分者信度校準（`RaterCalibrationRun`）、技術與 AI 系統預試（`TechnicalPilotRecord`、`AIResearchSystemValidation`，通訊延遲 38.5ms < 50ms，丟包率 0.2%）、Study Protocol 流程乾跑與偏差日誌（`ProtocolDryRun`、`PilotProtocolDeviation`，落實 94 分鐘演練與防動暈中斷 20m+10m）、品質儀表板（`PilotDataQualityMetric`，全面標記 `PILOT_DIAGNOSTIC`）、修訂提案管道（`PilotRevisionProposal`，涉及知情同意或受試負擔自動標記 `ETHICS_AMENDMENT_MAY_BE_REQUIRED`）、正式研究放行評估（`FormalStudyReadinessAssessment`，缺乏正式倫理批件時標記 `CONDITIONALLY_READY`，不自動通關）、不可變交接快照契約（`PilotValidationSnapshot`）。
  * `lib/rater-calibration-engine.ts`：確定性受控評分者信度計算引擎（v1.0.0），基於真實演算法計算兩評分員 Cohen Kappa (Po=0.90, Pe=0.28, Kappa=0.861) 與一致性百分比 (90%)，拒絕 AI 隨意捏造信度值。
  * `lib/pilot-validation-service.ts`：承接第十階段 `InstrumentProtocolSnapshot` 零重複輸入建立預試工作區；放行檢查器（檢驗未獲倫理許可放行人體預試 `UNAUTHORIZED_HUMAN_PILOT_PROHIBITED`、未獲正式倫理批件標記正式執行就緒 `FORMAL_EXECUTION_ETHICS_PREREQUISITE_MISSING`、評分者信度不足警告 `RATER_CALIBRATION_INSUFFICIENT`）；建構第十二階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/pilot-validation/initialize`：冪等恢復或承接 Stage 10 快照建立 Pilot 工作區（零重複輸入）。
  * `POST /api/projects/:projectId/pilot-validation/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="formal-execution"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage11-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 10）驗收測試回歸：全數維持 **100% PASS**（累積 384 項驗收全通）。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage11/`）：
  * `stage11-compatibility-map.md`（相容映射）
  * `stage11-data-flow.md`（資料流向與端點說明）
  * `stage11-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage11-provider-status.md`（外部 Provider 與預試驗證引擎狀態盤點）
  * `stage11-pilot-validation-handoff-contract.md`（交接快照契約）
  * `stage11-test-results.md`（48 項驗收測試報告）
  * `stage11-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * **本輪第十一階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U10-FULL：第十階段「研究工具、量表、教學／實驗材料與 Study Protocol」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage10/spec-v3-4.0.md`（v3.4.0；57.8KB）。
- **核心實體與契約**：
  * `lib/instrument-protocol-contract.ts`：多類別研究工具實體（`InstrumentDefinition`、`InstrumentVersion`、`ProjectInstrumentUse`，包含毫秒級 VR 眼動日誌規格、NASA-TLX 中文短版量表 metadata、高空危害處置表現規準 Rubrics）、版權與動作權限矩陣（`PermissionRecord`，嚴格控管 `EXPORT_ITEMS` 與 `DIGITAL_ADMINISTRATION` 動作權限）、翻譯與文化調適計畫（`TranslationAdaptationPlan`，機器翻譯不標記 Validated Translation，認知訪談明確留作 Stage 11 任務）、活動與測量時程（`ActivityScheduleItem`，涵蓋 T0 基線、介入單元、T1 立即後測與 T2 延宕測量）、Data Capture Schema（`DataCaptureField`，對齊 DataDictionary 與變數代碼，PII 密鑰加密隔離）、Study Protocol 標準作業程序草稿組裝器（`StudyProtocolDocument`，包含防動暈安全中斷流程與倫理版本完全對齊）、不可變交接快照契約（`InstrumentProtocolSnapshot`）。
  * `lib/scoring-preview-engine.ts`：確定性受控沙盒計分預覽引擎（v1.0.0），實現缺失值優先過濾（99 missing code 先解碼為 null，嚴防產生 $6-99=-93$）、安全反向轉碼（$lower+upper-x$ 僅對有效數值運算，防範重複反向）、最低有效作答題數門檻檢驗與加總/平均運算；測試資料標記 `SYNTHETIC_INSTRUMENT_TEST`，絕不污染正式受試者資料庫。
  * `lib/instrument-protocol-service.ts`：承接第九階段 `Stage09HandoffSnapshot` 零重複輸入建立工具與 Protocol 工作區；三重一致性檢查器（檢驗主要 RQ 缺乏對應工具 `chk_missing_primary_rq_instrument`、教學實踐技能目標僅測滿意度 `chk_moe_satisfaction_alone`、商業受限題項未授權公開匯出 `chk_unauthorized_export_rights`）；建構第十一階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/instrument-protocol/initialize`：冪等恢復或承接 Stage 9 快照建立工具工作區（零重複輸入）。
  * `POST /api/projects/:projectId/instrument-protocol/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="pilot-validation"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage10-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 9）驗收測試回歸：全數維持 **100% PASS**。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage10/`）：
  * `stage10-compatibility-map.md`（相容映射）
  * `stage10-data-flow.md`（資料流向與端點說明）
  * `stage10-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage10-provider-status.md`（外部 Provider 與計分引擎狀態盤點）
  * `stage10-instrument-protocol-handoff-contract.md`（交接快照契約）
  * `stage10-test-results.md`（48 項驗收測試報告）
  * `stage10-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * **本輪第十階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U09-FULL：第九階段「路線審查、合規準備與研究倫理」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage09/spec-v3-4.0.md`（v3.4.0；56.3KB）。
- **核心實體與契約**：
  * `lib/route-review-compliance-contract.ts`：三路線獨立模擬審查實體（`ReviewerFinding`，包含期刊 PRE_STUDY 審查、國科會學門/方法/PI 審查、教育部教學/評量/師生審查）、官方規則重驗證模型（`OfficialRuleItem`）、合規矩陣（`ComplianceItem`，嚴格區分 CURRENT_STAGE_REQUIRED 與 LATER_STAGE_REQUIRED，晚期 IRB 不阻礙規劃基線）、共用研究倫理與 IRB 中心（`EthicsScopeAssessment` 涵蓋 15 類指標、`InstitutionalEthicsDecision` 嚴禁無文件捏造 IRB 案號、`EthicsRiskItem` 包含動暈眩物理監控與師生權力關係防護）、研究資料管理計畫（`DataManagementPlan`，去識別化密鑰獨立、TLS 1.3 傳輸、第三方 AI 限制與五年抹除銷毀）、預註冊計畫（`PreregistrationPlan`，狀態 DRAFT_READY，無真實網址嚴禁標為 REGISTERED）、修訂任務系統（`RevisionTask`）、不可變交接快照契約（`Stage09HandoffSnapshot`）。
  * `lib/route-review-compliance-service.ts`：承接第八階段 `RouteWorkspaceSnapshot` 零重複輸入建立審查工作區；審查邏輯檢查器（檢驗未解決 FATAL 審查意見 `FATAL_REVIEWER_FINDING_UNRESOLVED`、師生權力關係未緩解 `TEACHER_STUDENT_POWER_RISK_UNMITIGATED`、無真實文件宣稱 IRB 核准 `FABRICATED_IRB_APPROVAL_PROHIBITED`、無真實網址宣稱預註冊 `FABRICATED_PREREGISTRATION_PROHIBITED`）；建構第十階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/route-review/initialize`：冪等恢復或承接 Stage 8 快照建立路線審查工作區（零重複輸入）。
  * `POST /api/projects/:projectId/route-review/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="study-protocol"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage09-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4 至 Stage 8）驗收測試回歸：全數維持 **100% PASS**。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage09/`）：
  * `stage09-compatibility-map.md`（相容映射）
  * `stage09-data-flow.md`（資料流向與端點說明）
  * `stage09-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage09-provider-status.md`（外部 Provider 與審查引擎狀態盤點）
  * `stage09-route-review-handoff-contract.md`（交接快照契約）
  * `stage09-test-results.md`（48 項驗收測試報告）
  * `stage09-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * **本輪第九階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U08-FULL：第八階段「三路線研究與計畫工作室」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage08/spec-v3-4.0.md`（v3.4.0；58.2KB）。
- **核心實體與契約**：
  * `lib/route-studio-contract.ts`：三目標工作室架構（`JOURNAL_RESEARCH_PLANNING`、`NSTC_GENERAL_PROPOSAL`、`MOE_TPR_PROPOSAL`）、參與角色（`PRIMARY`、`SECONDARY`、`FUTURE`）、結構化段落 AST 與保護事實節點（`PLANNING_CALC_REF`、`CITATION_SOURCE_REF`）、國際期刊論文骨架（`JournalResearchPlan`、`ManuscriptBlueprint`，含 `resultsSlots` 嚴禁虛構數值）、國科會一般研究計畫書初稿（`NSTCProposalDraft`、`WorkPackageMatrix`，不強制三年，不編造團隊履歷）、教育部教學實踐計畫書初稿（`TeachingPracticeProposalDraft`、`CourseTeachingAssessmentMatrix`，技能評量失衡精確示警）、受控預算模型（`BudgetPlan`）、不可變交接快照契約（`RouteWorkspaceSnapshot`）。
  * `lib/budget-planning-engine.ts`：真實確定性受控預算計算引擎（v1.0.0），基於整數/小數乘積公式嚴格運算數量 $\times$ 單價 $\times$ 期間與專案管理費 ($120000+75500=195500$, 管理費 $19550$, 總額 $215050$)，支援缺失單價保留 null 標註缺項，防範多幣別未折算加總。
  * `lib/route-studio-service.ts`：承接第七階段 `DesignAnalysisPlanningSnapshot` 零重複輸入建立三路線工作區；草稿一致性檢查器（檢驗收案前虛構 Results `FABRICATED_RESULTS_PROHIBITED`、技能目標僅測滿意度 `OUTCOME_ASSESSMENT_MISALIGNMENT`、教學現場證據遺失 `LOCAL_EVIDENCE_UNKNOWN`）；建構第九階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/route-studio/initialize`：冪等恢復或承接 Stage 7 快照建立三路線工作區（零重複輸入）。
  * `POST /api/projects/:projectId/route-studio/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="ethics-review"`）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage08-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4、Stage 5、Stage 6、Stage 7）驗收測試回歸：全數維持 **100% PASS**。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage08/`）：
  * `stage08-compatibility-map.md`（相容映射）
  * `stage08-data-flow.md`（資料流向與端點）
  * `stage08-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage08-provider-status.md`（外部 Provider 與計算引擎狀態盤點）
  * `stage08-route-studio-handoff-contract.md`（交接快照契約）
  * `stage08-test-results.md`（48 項驗收測試報告）
  * `stage08-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * **本輪第八階段已完整交付並停止，等待使用者指示後續階段。**

## V3-U07-FULL：第七階段「研究設計與分析計畫」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage07/spec-v3-4.0.md`（v3.4.0；66.6KB）。
- **核心實體與契約**：
  * `lib/study-design-planning-contract.ts`：三目標設計論述（`JOURNAL_SCI_SSCI`、`NSTC_GENERAL`、`MOE_TPR`）、11 種研究設計類型（RCT、群集隨機、準實驗、質性、設計科學、技術基準等）、推論目標（`InferenceTarget`，涵蓋因果、關聯、預測與詮釋）、試驗架構（`StudyStructure`，抽樣/分配/觀察/分析單位分離，組別與時點）、樣本理據（`SampleJustification`）、測量需求（`DesignMeasurementRequirement`，方向對齊不偽造量表）、RQ—設計—資料—分析可追溯矩陣（`RqDesignDataAnalysisRow`）、分析實驗室規劃模式（`AnalysisPlanItem`，主要/次要/探索、缺失值與多重比較）、效度與偏誤風險評估（`DesignValidityRisk`）、不可變交接快照契約（`DesignAnalysisPlanningSnapshot`）。
  * `lib/planning-calculation-engine.ts`：真實確定性受控計算引擎（v1.0.0），基於 Lakens (2022) 與 Cohen (1988) 公式實現雙獨立組連續結果檢定力計算 ($d=0.50, \alpha=0.05, 1-\beta=0.80 \to n=64/\text{arm}, N=128, N_{\text{recruit}}=151$)，以及固定可用 $N$ 之可偵測效果情境計算（Detectable Effect Scenarios）。數值由真實演算法返回並標記 `SIMULATED_FOR_DESIGN`，非 AI 捏造。
  * `lib/study-design-planning-service.ts`：承接第六階段 `TheoryMechanismSnapshot` 零重複輸入建立工作區；邏輯檢查器（檢驗一班一組班級混淆 `ARM_SITE_CONFOUNDING`、延宕保留測量遺失 `RETENTION_WITHOUT_FOLLOWUP`、技能教學僅測滿意度 `COURSE_OUTCOME_ASSESSMENT_MISMATCH`）；建構第八階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/study-design/initialize`：冪等恢復或承接 Stage 6 快照建立研究設計工作區（零重複輸入）。
  * `POST /api/projects/:projectId/study-design/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="route-studio"`）。
- **前端介面與接收端升級**：
  * `components/StudyDesignStudioView.tsx`：完整研究設計與分析計畫工作區（三目標論述、方案比較選擇、試驗單位架構、受控規劃計算、測量指標規格、RQ 矩陣、分析實驗室規劃模式、偏誤控制、缺失導航、欄位加鎖、老麥一鍵協作）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage07-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前置階段（Stage 4、Stage 5、Stage 6）驗收測試回歸：全數維持 **100% PASS**。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage07/`）：
  * `stage07-compatibility-map.md`（相容映射）
  * `stage07-data-flow.md`（資料流向與端點）
  * `stage07-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage07-provider-status.md`（外部 Provider 與計算能力狀態盤點）
  * `stage07-study-design-handoff-contract.md`（交接快照契約）
  * `stage07-test-results.md`（48 項驗收測試報告）
  * `stage07-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * **本輪第七階段已完整交付並停止，等待使用者指示後續階段。**



## V3-U06-FULL：第六階段「理論與機制」建置完成（2026-09-06 UTC）
- **規格基準**：`docs/stage06/spec-v3-4.0.md`（v3.4.0；54.8KB）。
- **核心實體與契約**：
  * `lib/theory-mechanism-v3-contract.ts`：三目標模型（`JOURNAL_SCI_SSCI`、`NSTC_GENERAL`、`MOE_TPR`）、8 種建模取徑（`THEORY_TESTING`、`TEACHING_LOGIC_MODEL`、`CONCEPTUAL_FRAMEWORK` 等）、候選理論池、構念字典（`ConstructDefinition`）、Typed 關係（`HYPOTHESIZED_CAUSAL`、`MEDIATION_CANDIDATE` 等）、研究命題（`H1`、`P1`、`GQ1`，具備否證方向）、競爭解釋（霍桑效應、注意力分散）、`ModelToDesignRequirement` 矩陣、不可變交接快照契約（`TheoryMechanismSnapshot`）。
  * `lib/theory-mechanism-v3-service.ts`：承接第五階段 `GapEvidenceSnapshot` 與理論需求提示零重複輸入建立工作區；邏輯檢查器（檢測懸空構念引用 `DANGLING_RELATION_REFERENCE`、因果 DAG 循環依賴 `DAG_CYCLE_UNRESOLVED`、教學實踐僅採滿意度 `SUPERFICIAL_ASSESSMENT_MISALIGNMENT`）；建構第七階段交接快照。
- **後端 API 路由**：
  * `POST /api/projects/:projectId/theory-mechanism/initialize`：冪等恢復或承接 Stage 5 快照建立理論工作區（零重複輸入）。
  * `POST /api/projects/:projectId/theory-mechanism/complete`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`（`nextStageId="study-design"`）。
- **前端介面與接收端升級**：
  * `components/TheoryMechanismStudioView.tsx`：完整理論與機制規劃工作區（三目標論述、理論比較與選擇、構念字典、關係模型與機制詮釋、命題假設、研究設計需求矩陣、缺失導航、欄位加鎖、老麥一鍵協作）。
- **全套驗收與回歸測試**：
  * `scripts/verify-stage06-full-48-items.ts`：48 項標準驗收測試套件（**48/48 PASS，100% 成功**）。
  * 前五階段契約與整合測試回歸：全數維持 100% 通過。
  * 全專案 TypeScript 編譯檢查：`npx tsc --noEmit` **0 errors (exit code 0)**。
- **交付文件**（完整收錄於 `docs/stage06/`）：
  * `stage06-compatibility-map.md`（相容映射）
  * `stage06-data-flow.md`（資料流向）
  * `stage06-field-assist-lock-coverage.md`（欄位協作與鎖定覆蓋）
  * `stage06-provider-status.md`（外部 Provider 狀態盤點）
  * `stage06-theory-mechanism-handoff-contract.md`（交接快照契約）
  * `stage06-test-results.md`（48 項驗收測試報告）
  * `stage06-deploy-rollback.md`（部署與回滾說明）
- **所在環境與停止邊界**：
  * 本地安全開發容器環境（`/home/node/dev/repo`）；未進行任何正式資料庫遷移或 Zeabur 部署。
  * **本輪第六階段已完整交付並停止，等待使用者指示後續階段。**
