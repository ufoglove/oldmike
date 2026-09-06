# V3-U18-FULL 第十八階段「目標期刊／計畫最終合規、送件文件與成果包」交付說明（完整規格版 R2）

**規格基準**：`docs/stage18/spec-v3-4.0.md`（641 行完整版，SHA-256 `5d608c92285ed14efbf5390cbc53f35bc1403d6b6ea1d4049c6179548aab07f5`）
**接收**：第十七階段 `LanguageQualitySnapshot`（上游 Gate：`LANGUAGE_EDITION_READY_FOR_FINAL_COMPLIANCE`；`USE_BLOCKED`／`SOURCE_STALE` 阻擋合規）
**交付**：`FinalSubmissionPackageSnapshot` → 第十九階段「正式送件、狀態追蹤與審查往返」（`submission-tracking`）

## 完整規格補強（R2，相較 R1 摘要版）
| 規格節 | 實作 |
|---|---|
| §4 FinalPackageWorkOrder | target options（JOURNAL_INITIAL_SUBMISSION／NSTC_GENERAL_APPLICATION／MOE_TPR_APPLICATION／LOCAL_PREFLIGHT）；status（DRAFT→LOCKED_READY 狀態機） |
| §5 Official Rule Resolver | 7 態：VERIFIED_APPLICABLE／PREVIOUS_YEAR_REFERENCE／PENDING_OFFICIAL_ANNOUNCEMENT／SOURCE_UNAVAILABLE／CONFLICTING／UNVERIFIED／SUPERSEDED |
| §8 SubmissionFieldMap | journal/NSTC/MOE 各別欄位；author/PI 需 human declaration；初始 NOT_READY |
| §13 Visibility | REVIEWER_VISIBLE／EDITOR_ONLY／INSTITUTION_ONLY／AUTHORITY_SUBMISSION／INTERNAL_AUDIT／PUBLICATION_CANDIDATE |
| §28 Bundle 分流 | EXTERNAL_SUBMISSION_BUNDLE（reviewer-visible + title page editor-only）vs INTERNAL_COMPLIANCE_EVIDENCE_PACKAGE（internal-audit only） |
| §29 狀態機 | DRAFT…LOCKED_READY；PARTIAL_PREFLIGHT／BLOCKED／STALE／SUPERSEDED／WITHDRAWN_FROM_RELEASE |
| §30 ready_for_action | READY_FOR_AUTHOR_SUBMISSION（期刊）／READY_FOR_INSTITUTIONAL_REVIEW（NSTC/MOE 先校內審核）／PREFLIGHT_ONLY／DRAFT_PACKAGE_WITH_GAPS |
| §32 19 個錯誤碼 | HANDOFF_SCHEMA_UNSUPPORTED…HANDOFF_SAVE_FAILED 收錄於契約 |
| submissionStatus | NOT_SUBMITTED_BY_THIS_STAGE（恆定，U19 才處理送件執行） |

## 驗收證據（實際執行）
- `scripts/verify-stage18-full-66-items.ts`：**79 PASS**（66 原始 + 13 R2 完整規格情境：work order、rule resolver 7 態、field map、visibility/bundle 分流、狀態機、ready_for_action、submissionStatus），3 NOT_RUN 誠實列明。
- `scripts/verify-stage18-stage19-consumer-contract.ts`：**70/70 PASS**（含 workOrder、rule resolver、field map、bundles、state machine、ready_for_action 擴充斷言）。
- `npx tsc --noEmit`：0 errors；回歸：U17（66）、U16（60）、U15（60）、U14（60）、U13（48）。

## 誠實標記
- submission_execution_authorized=false 恆定；READY ≠ SUBMITTED、官方核准或期刊接受。
- DOCX/PDF/LaTeX renderer 未具備時如實標 UNSUPPORTED，不以 Markdown 冒稱可送件。
- ApprovalSubjectManifest hash 不含 approval 事件（無循環）；核准綁定具體文件 digest；通訊作者轉述 ≠ 每位作者親自點擊。
- 未部署 Zeabur、未跑正式 DB migration；fixture ≠ 真實稿件已合規或已送件。

## 回滾
全部為新增檔（`final-submission-v3/*`、`lib/final-submission-v3-*`、`scripts/verify-stage18*`、`docs/stage18/`）；未修改既有 `journal-submission`／`route-review-compliance`／`proposal-studio`／`application-package` 模組、未改既有資料表。回滾＝移除新檔即可。