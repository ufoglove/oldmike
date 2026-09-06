# V3-U16-FULL 第十六階段「老麥科學內容審查、Reviewer #2壓力測試與逐項修訂」交付說明（完整規格版）

**規格基準**：`docs/stage16/spec-v3-4.0.md`（760 行完整版，SHA-256 `29157b043f28a74e777ed4d6ad17800f15ad0c1c610c20343e721d2e0c4583c9`）
**接收**：第十五階段 `ManuscriptWritingSnapshot`（上游 Gate：`MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW`；規劃模式阻擋正式審查）
**交付**：`ScientificReviewSnapshot` → 第十七階段「翻譯、學術潤稿、術語一致性與語言品質」（`translation-polish`）

## 新增／擴充檔案
| 檔案 | 內容 |
|---|---|
| `lib/scientific-review-v3-contract.ts` | ReviewWorkOrder、ReviewCoverageMatrix、ReviewCapabilityManifest、9 角色庫型別（§8）、ScientificFinding 完整欄位（§18：basis/source_excerpt/evidence_for/against/rationale/coverage_limit/adjudicated_by/disposition）、FindingDisposition（§19）、MeaningConstraint、UpstreamReviewRequest、ScientificReviewPackage（§31）、LanguagePolishingHandoffPackage（§31）、ScientificReviewSnapshot（含 scientificReleaseState／fullManuscriptLanguageAllowed／languageAllowedScopeRefs）、Stage17ReceiverState、20 個規格錯誤碼（§32） |
| `lib/scientific-review-v3-service.ts` | 承接 U15、機械 QA、Reviewer #2 建設性挑戰（REVIEWER_2_CHALLENGER，含替代解釋＋最小修正路徑）、Finding 去重、Author Response Matrix、重審（CLOSED_WITH_UNRESOLVED 不強制 PASS）、Meaning Constraints 檢查、**9 角色庫 + enabledRolesForArticleType**、**ReviewCoverageMatrix builder**、**ReviewCapabilityManifest builder（如實標 UNSUPPORTED）**、**ScientificReviewPackage + LanguagePolishingHandoffPackage builders**、快照（含 release state）與 U17 receiver |
| API `scientific-review-v3/*` | initialize／reviewer2／findings／respond／re-review／complete／export／receiver（8 路由，ACL＋body/DB 讀取＋規劃阻擋） |
| `scripts/verify-stage16-full-60-items.ts` | 60 項驗收（60/60 PASS＋3 NOT_RUN） |
| `scripts/verify-stage16-stage17-consumer-contract.ts` | U17 consumer contract（**61/61 PASS**，含完整規格擴充斷言） |

## 完整規格補強（相較簡版）
1. **ReviewCoverageMatrix**（§5）：每章節/主張/結果/方法/引用/表圖/倫理，required/applicable/source_available/review_method/checked_version/role/status（CHECKED_NO_ISSUE_FOUND…NOT_APPLICABLE）；未審標 NOT_ASSESSED，不產生假綠勾（T10）。
2. **9 角色庫**（§8）：EDITOR_TRIAGE…REVIEWER_2_CHALLENGER，各角色有 task/mustNot/requiredSources/outputSchema/minimumCapability/enabledForArticleTypes；按文章類型啟用（MOE 教學稿啟用 PRACTICE_APPLICATION_REVIEWER）。
3. **ReviewCapabilityManifest**（§7）：RULE_EXECUTED／SUGGESTION_ONLY／NEEDS_SPECIALIST／UNSUPPORTED；Zotero、citeproc、LLM 生成式審查如實標 UNSUPPORTED。
4. **Finding 完整欄位**（§18）：category（12 類）、finding_origin、source_excerpt、evidence_for/against、coverage_limit、disposition、adjudicated_by、status 等。
5. **ScientificReviewPackage + LanguagePolishingHandoffPackage**（§31）：共用 refs，不複製 Raw。
6. **scientificReleaseState**（§30）：DRAFT_REVIEW…USE_BLOCKED；fullManuscriptLanguageAllowed + languageAllowedScopeRefs 精確 scope。
7. **20 個錯誤碼**（§32）對應清單已收錄於契約。

## 誠實標記
- 所有 AI 審查輸出標 **SIMULATED REVIEW**；多角色為多角度模擬，非真人獨立驗證；不用「7 位 AI 專家一致」冒充 7 名真人。
- Reviewer #2 為**確定性規則引擎**（REVIEWER_2_CHALLENGER），LLM live adapter 標 UNSUPPORTED。
- 未部署 Zeabur、未跑正式 DB migration；DOCX/PDF/LaTeX/Live Fields 匯出 UNSUPPORTED。
- 綠燈＝內部科學審查完成（INTERNAL_SCIENTIFIC_REVIEW_COMPLETE），非期刊接受、非全作者投稿同意。

## 回滾
全部為新增檔（`scientific-review-v3/*`、`lib/scientific-review-v3-*`、`scripts/verify-stage16*`、`docs/stage16/`）；未修改既有 `scientific-review` 模組、未改既有資料表。回滾＝移除新檔即可。
