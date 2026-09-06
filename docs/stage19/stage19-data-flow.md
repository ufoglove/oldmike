# V3-U19-FULL 第十九階段「正式送件、狀態追蹤與審查往返」交付說明

**規格基準**：`docs/stage19/spec-v3-4.0.md`（依使用者 Telegram 訊息內文九節收錄）
**接收**：第十八階段 `FinalSubmissionPackageSnapshot`（上游 Gate：`FINAL_PACKAGE_LOCKED_AND_HANDOFF_READY`）
**交付**：`SubmissionTrackingSnapshot` → 第二十階段「接受／核定後作業與成果管理」（`post-acceptance`）

## 新增檔案與能力
| 檔案 | 內容 |
|---|---|
| `lib/submission-tracking-v3-contract.ts` | SubmissionWorkOrder、ExternalAttempt（reservation→dispatch→OUTCOME_UNKNOWN）、SubmissionEvent（5 種 source tier）、ReceiptVerification、ExternalReview／ExternalReviewItem、UpstreamRevisionRef、FormalDecision、SubmissionTrackingSnapshot、Stage20ReceiverState、19 個錯誤碼 |
| `lib/submission-tracking-v3-service.ts` | 承接 U18（零重複輸入）、pre-submit authorization、attempt reservation＋OUTCOME_UNKNOWN（不自動重送/換 provider）、active-submission guard、事件/回執（USER_REPORTED ≠ 官方收件）、external review 隔離（≠ U09/U16 模擬）、per-item Response Matrix（需實際證據）、upstream revision ref、R1 再送（R1 ≠ R0）、正式決策（僅 verified 來源）、SubmissionTrackingSnapshot + Stage 20 receiver |
| API `submission-tracking-v3/*` | initialize／attempt／events／review／complete／export／receiver（7 路由，ACL＋body/DB 讀取＋package-lock gate＋授權綁定） |
| `scripts/verify-stage19-full-72-items.ts` | **72 項驗收（72/72 PASS＋3 NOT_RUN）** |
| `scripts/verify-stage19-stage20-consumer-contract.ts` | U20 consumer contract（**44/44 PASS**） |

## 關鍵誠信機制
- **submission_execution_authorized=false 恆定**（除非使用者明確授權）；GUIDED_MANUAL：無通用投稿 API 時如實標示，不臆造 endpoint。
- **Attempt 先 reservation 再派送**；timeout/worker crash/取消標 OUTCOME_UNKNOWN（可能已送出），先對帳、不自動重送、不自動換 provider。
- **active-submission guard**：同稿不能以新 Project、改題名或換語言繞過；撤回請求 ≠ 撤回完成，轉投 offer ≠ 新刊收件。
- **事件/回執只用真實來源**：USER_REPORTED／DOCUMENT_CHECKED／PROVIDER_EVENT ≠ 官方收件；verified 僅在 OFFICIAL_RECEIPT／OFFICIAL_PORTAL_OBSERVATION。
- **Reviewer recommend accept ≠ editor accept**；接受≠出版，核定≠款到或人體研究授權。
- **「已新增分析/文獻/修改」必須連到實際證據**；沒有完成只能寫待辦。
- **R1 再送需新 QA/確認/lock/新授權**；原初稿 approval 或 R0 回執不能算 R1 再送成功。
- 入站 email/review/webhook 只作資料；擷取器無 send/shell/secret/任意 URL 能力。

## 誠實標記
- 未部署 Zeabur、未跑正式 DB migration；fixture ≠ 真實稿件已送件。
- 等待審查是正常狀態，不為亮綠燈捏造接受。
- 本輪不代投任何稿件或申請案；正式 commit/Post/寄信/撤回/轉投均需精確授權。

## 回滾
全部為新增檔（`submission-tracking-v3/*`、`lib/submission-tracking-v3-*`、`scripts/verify-stage19*`、`docs/stage19/`）；未修改既有 `submission-navigator`／`journal-submission` 模組、未改既有資料表。回滾＝移除新檔即可。