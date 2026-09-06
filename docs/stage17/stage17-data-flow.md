# V3-U17-FULL 第十七階段「翻譯、學術潤稿、術語一致性與語言品質」交付說明（完整規格版 R2）

**規格基準**：`docs/stage17/spec-v3-4.0.md`（682 行完整版，SHA-256 `77025dc7efbcf60433e92f9fc787cb524be923a44daf5792d573d105a466d4c8`）
**接收**：第十六階段 `ScientificReviewSnapshot`（上游 Gate：`SCIENTIFIC_REVISION_READY_FOR_LANGUAGE`；`USE_BLOCKED`／`SOURCE_STALE` 阻擋語言處理）
**交付**：`LanguageQualitySnapshot` → 第十八階段「目標期刊／計畫最終合規、送件文件與成果包」（`final-compliance`）

## 完整規格補強（R2，相較 R1 摘要版）
| 規格節 | 實作 |
|---|---|
| §9 SemanticUnit | 6 種 ProtectionKind（HARD_LITERAL／REFERENCE_BOUND／SEMANTIC_BOUND／AUTHOR_STYLE_LOCK／NO_EXTERNAL／NO_DERIVATIVE）；subject/outcome/group/timepoint/negation/certainty/causal ceiling/qualifiers |
| §10 ProtectedSpanManifest + Token Codec | opaque nonce 包覆受保護 span、schema allowlist、source/target occurrences；opaque token ≠ 匿名化（外傳另需授權） |
| §6 Provider verification tiering | DOCUMENTED／ACCOUNT_ENABLED／CONNECTION_TESTED／CONTRACT_TESTED／LIVE_VERIFIED；6 provider 快照；DeepL Write 與 Translate 分開 |
| §7 DeepL 核對 | Translate v2（context/glossary）、Write correct/rephrase 同語言、API Pro 條件、10 KiB body 限制以 UTF-8 bytes 計量 |
| §16 EditIntensity | CONSERVATIVE／BALANCED／SUBSTANTIVE_LANGUAGE_EDIT，依章節風險（Methods/Results 預設 Conservative） |
| §23 BudgetPlanner | estimated/reserved/reported/reconciled、PROVIDER_OUTCOME_UNKNOWN（timeout 可能已計費）、rate snapshot |
| §30 language release state | DRAFT…USE_BLOCKED；PARTIAL_LANGUAGE_RELEASE 不自動升 full；formalComplianceAllowed + complianceAllowedScopeRefs |
| §31 18 個錯誤碼 | HANDOFF_SCHEMA_UNSUPPORTED…HANDOFF_SAVE_FAILED 收錄於契約 |

## 驗收證據（實際執行）
- `scripts/verify-stage17-full-60-items.ts`：**66 PASS**（60 原始 + 6 新增完整規格情境：tiering、Write 分離、budget、protected span codec、NO_DERIVATIVE、opaque token），4 NOT_RUN 誠實列明（Live DeepL、Live LanguageTool、DOCX/PDF/LaTeX round-trip、UI 整合）。
- `scripts/verify-stage17-stage18-consumer-contract.ts`：**72/72 PASS**（含 SemanticUnit、ProtectedSpan/codec、BudgetPlanner、tiering、release state）。
- `npx tsc --noEmit`：0 errors；回歸：U16（60/60）、U15（60/60）、U14（60/60）、U13（48/48）。

## 誠實標記
- DeepL Translate/Write、LanguageTool 無 Live key 如實標 NOT_CONFIGURED（不假裝接通）；老麥語義模型 CONTRACT_TESTED（本地確定性規則）。
- opaque token 不是匿名化保證；外傳需另通過資料用途與保密檢查。
- 語言版就緒 ≠ 正式送件、全作者同意或期刊接受；fixture ≠ 真實稿件已翻譯。
- 未部署 Zeabur、未跑正式 DB migration；靜態 References 不冒充 Zotero Word 動態欄位。

## 回滾
全部為新增檔（`language-quality-v3/*`、`lib/language-quality-v3-*`、`scripts/verify-stage17*`、`docs/stage17/`）；未修改既有 `academic-language`／`deepl-client`／`languagetool-client`、未改既有資料表。回滾＝移除新檔即可。