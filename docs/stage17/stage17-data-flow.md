# V3-U17-FULL 第十七階段「翻譯、學術潤稿、術語一致性與語言品質」交付說明

**規格基準**：`docs/stage17/spec-v3-4.0.md`（依使用者 Telegram 訊息內文收錄，九節）
**接收**：第十六階段 `ScientificReviewSnapshot`（上游 Gate：`SCIENTIFIC_REVISION_READY_FOR_LANGUAGE`；`USE_BLOCKED`／`SOURCE_STALE` 阻擋語言處理）
**交付**：`LanguageQualitySnapshot` → 第十八階段「目標期刊／計畫最終合規、送件文件與成果包」（`final-compliance`）

## 新增檔案與能力
| 檔案 | 內容 |
|---|---|
| `lib/language-quality-v3-contract.ts` | LanguageWorkOrder、LanguageTask、LanguageSegment（UTF-8 bytes）、FidelityCheckKind（15 種，超越 token 數量）、FidelityIssue、TermBinding、ProviderCapability、LanguageQualitySnapshot、Stage18ReceiverState、17 個錯誤碼 |
| `lib/language-quality-v3-service.ts` | 承接 U16（零重複輸入）、scope 檢查（partial 不自動升整稿）、UTF-8 分段、**保真檢查**（數值/方向/分母/時點/否定/因果強度/確認探索/群組互換）、術語檢查、Provider capability manifest、QA 聚合、快照與 U18 receiver 建構 |
| API `language-quality-v3/*` | initialize／segments／check／adopt／complete／export／receiver（7 路由，ACL＋body/DB 讀取＋scope 強制＋FATAL 阻擋採用） |
| `scripts/verify-stage17-full-60-items.ts` | 60 項驗收（**60/60 PASS＋4 NOT_RUN**） |
| `scripts/verify-stage17-stage18-consumer-contract.ts` | U18 consumer contract（**45/45 PASS**） |

## 保真檢查重點（§5，超越 token 數量）
- 數值/方向變化（-913.1→+913.1）→ **FATAL**
- 分母 N 變化（N=6→N=60）→ **FATAL**
- 未顯著改顯著 → **FATAL**（NEGATION_CHANGED）
- may→proved 因果強化 → **FATAL**（CAUSAL_STRENGTH_CHANGED）
- 兩組數值互換（介入/對照 swap）→ **FATAL**（GROUP_SWAPPED）
- 時點遺失（T0/T1）→ 標記（TIMEPOINT_CHANGED）
- 探索性分類遺失 → 標記（CONFIRMATORY_OR_EXPLORATORY_CHANGED）

## Provider 誠實標示（§4）
- DeepL Translate／DeepL Write：**NOT_CONFIGURED**（無 Live key 如實標示，不假裝接通；Translate 與 Write 分開）
- 老麥語義模型：**MOCK**（本輪確定性規則）
- LanguageTool：**NOT_CONFIGURED**（自架；公共免費端點不作自動批次後備）
- Google／Azure fallback：**UNSUPPORTED**（未授權不啟用）
- API key 只在 server（`DEEPL_API_KEY`／`LT_BASE_URL` 環境變數）

## 誠實標記
- 語言版就緒≠正式送件、全作者同意或期刊接受。
- fixture 通過不代表真實稿件已翻譯；未經科學審查輸入維持 LANGUAGE_ONLY／IMPORTED_UNVERIFIED。
- 未部署 Zeabur、未跑正式 DB migration；DOCX/PDF/LaTeX/Live Fields 匯出 UNSUPPORTED。

## 回滾
全部為新增檔（`language-quality-v3/*`、`lib/language-quality-v3-*`、`scripts/verify-stage17*`、`docs/stage17/`）；未修改既有 `academic-language`／`deepl-client`／`languagetool-client` 模組、未改既有資料表。回滾＝移除新檔即可。
