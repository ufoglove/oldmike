# DOCX/PDF Fixture 渲染與 QA 報告（v4.1，C10/C11）

- **查證日期**：2026-09-08 (UTC)
- **產出位置**：`tmp-v41-fixture/`
- **Renderer**：python-docx 1.2.0（OOXML DOCX）＋ reportlab 5.0.1（PDF）
- **字型**：Noto Sans CJK TC（Google 開源，運行時載入，不隨交付包分發）
- **對應腳本**：`scripts/render-fixtures-v41.py`、manifest：`tmp-v41-fixture/render-manifest-v41.json`
- **數值來源**：與 `verify-stat-engine-reference.mjs` 同一組 scipy-validated 參考值（Welch t=−11.934, p=0.0017；ANCOVA β1=−945.213, p=0.0723）

## 一、6 份 fixture 檔案

| 檔案 | 格式 | bytes | sha256（前16碼） |
|---|---|---|---|
| fixture_JOURNAL_EN.docx | OOXML | 37327 | 8a22fdb2a7000ac3 |
| fixture_JOURNAL_EN.pdf | PDF 1.4 | 12733 | 5332750b3eb49b4b |
| fixture_NSTC_TC.docx | OOXML | 37572 | 464cc455618b262e |
| fixture_NSTC_TC.pdf | PDF 1.4 | 39138 | db64fd29610bc251 |
| fixture_MOE_TC.docx | OOXML | 37532 | ea946823363526fc |
| fixture_MOE_TC.pdf | PDF 1.4 | 38284 | 897f7bbe52b5050a |

**Magic bytes 驗證**：DOCX = `504b0304`（ZIP/OOXML，非改名 Markdown）；PDF = `25504446`（%PDF）。全部正確。

## 二、自動 QA 結果（C11）

### PDF（pypdf 抽取文字核對）
| 項目 | JOURNAL_EN | NSTC_TC | MOE_TC |
|---|---|---|---|
| 頁數 | 1 | 1 | 1 |
| 核心數值（−11.934, −945.21, 0.0017, 0.0723） | PASS | PASS | PASS |
| 章節（Abstract/Introduction/Results/References） | PASS | — | — |
| 繁體中文（研究/參考文獻/合成示範） | — | PASS | PASS |
| 特殊符號（α/β/η²/信賴區間） | — | PASS | PASS |
| 免責聲明（合成示範/FIXTURE） | PASS | PASS | PASS |

### DOCX（python-docx 重開核對）
| 項目 | JOURNAL_EN | NSTC_TC | MOE_TC |
|---|---|---|---|
| 段落數 | 14 | 12 | 12 |
| 表格數（可編輯，非圖片） | 1 | 1 | 1 |
| 核心數值 + 章節 | PASS | PASS | PASS |
| 免責聲明 | PASS | PASS | PASS |

### 減號（U+2212 vs ASCII '-'）
PDF 文字抽取會將 U+2212 (−) 與 ASCII `-` 呈現不一致（pypdf 抽取特性，非渲染錯誤）。兩種字元在文件中都正確顯示，QA 腳本以 `normalize("−"→"-")` 對照。

## 三、限制（誠實標示）

1. **人工視覺驗收 NOT_RUN**：未實際以 Word/PDF reader 開啟檢查跨頁表格、頁碼、行號、匿名 metadata 等版面。自動文字抽取通過不等於版面無誤。**若需 100% 保真，需站主人工開啟檢查。**
2. **跨頁表格**：~~未測試~~ → **本輪已補測**（見下方「跨頁表格」節，全 PASS）
3. **動態引用**：本輪產生**靜態引用**（Reference 文字），**非** Zotero Word 動態欄位；不冒稱。
4. **匿名版本**：本 fixture 明示為合成示範，無作者資訊可外洩；正式匿名化需在真實稿件流程另測。
5. **字型**：Noto Sans CJK TC 於容器內臨時下載使用；未打包進 fixture 檔案，未散布字型檔。
6. **Python venv**：`/tmp/calcenv` 為隔離測試環境（scipy 1.18.1、statsmodels 0.15.0、python-docx 1.2.0、reportlab 5.0.1、pypdf），**非 production 依賴**。

### 跨頁表格（本輪補測，2026-09-08）
- `scripts/verify-c11-cross-page-table.py`：60 列長表 fixture（`tmp-v41-fixture/fixture_crosstab_TC.pdf`，2 頁）
- 驗證：表格實際跨頁（pages=2）、表頭每頁重複（repeatRows=1，2/2 頁命中）、首列 P-001 與末列 P-060 完整無裁切、免責聲明在場 → **全 PASS**
- 限制：人工視覺驗收與匿名版本仍 NOT_RUN

| C 項 | 狀態 | 證據 |
|---|---|---|
| C10：三目標各有可重開 DOCX 與 PDF，非改副檔名 | **PASS** | 6 份檔案 magic 正確；python-docx/pypdf 可重開並讀出正確內容 |
| C11：公式、繁體、數值、引用、跨頁表與匿名版本保真 | **PASS（自動 QA 範圍）** | 文字抽取核對通過；跨頁表已補測全 PASS；匿名版/人工視覺仍 NOT_RUN |

---

*本輪僅證明 renderer 鏈路可用與合成範例之自動 QA 通過；**未部署 production**、**未上傳**、**未產生真實研究文件**。*
