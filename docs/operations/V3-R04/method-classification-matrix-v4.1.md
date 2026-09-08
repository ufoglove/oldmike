# 正式運算方法分類矩陣（v4.1 收尾）

- **查證日期**：2026-09-08 (UTC)
- **依據**：站主文件第三節 A/B/C/D/E 分類
- **環境**：本地 dev container；Rscript 未安裝；Python 3（/tmp/calcenv 含 scipy 1.18.1、statsmodels 0.15.0，僅隔離測試用）
- **驗證腳本**：`scripts/verify-stat-engine-reference.mjs`（全部 PASS）

---

## 一、方法分類（A/B/C/D/E）

| 檔案 | 方法 | 分類 | 證據 |
|---|---|---|---|
| `lib/statistical-computation-engine.ts` | Descriptive stats (mean/var/SD) | **A** | 封閉式公式；scipy 對照通過 |
| 同上 | Welch t-test (unequal var, Satterthwaite df) | **A** | 本輪修復 CI（改用精確 t 分位數）；scipy 對照 21 項全部 PASS |
| 同上 | ANCOVA (OLS 3-param, closed-form) | **A** | 本輪修復 CI；statsmodels OLS 對照 7 項 PASS |
| 同上 | Student t p-value（正規化不完全 Beta） | **A** | scipy t.ppf 對照通過 |
| 同上 | Holm-Bonferroni | **A** | statsmodels multipletests 對照通過 |
| `lib/research-analysis.ts` | DESCRIPTIVE_STATISTICS / MISSING_VALUE_SUMMARY / CORRELATION (Pearson/Spearman) / TWO_GROUP_COMPARISON | **A** | 白名單 allowlist；封閉式公式；hash 綁定輸入 |
| `lib/planning-calculation-engine.ts` | 兩獨立樣本樣本數/檢定力規劃、可偵測效果量 | **A** | 封閉式 z/t 近似公式（樣本數規劃屬規劃階段，非正式結果） |
| `lib/rater-calibration-engine.ts` | Cohen's Kappa (2 rater) | **A** | 標準公式 |
| `lib/analysis-execution-service.ts` | 內嵌示範資料 (ARM-01/02, n=3~4) 餵入上述 A 類引擎 | **D** | **硬編碼 fixture，非真實研究資料**；引擎真實但輸入是合成展示 |
| `lib/formal-execution-service.ts` | 內嵌「受試者 P-001~P-004、REC-115-089、VR 數據」等示範資料 | **D**（且含虛構倫理文號） | 硬編碼、無 DB 讀取路徑；倫理核准為文字模板非真實核准 |
| `lib/manuscript-writing-service.ts` | 引用 REC-115-089 於稿件正文 | **D** | 同上，模板示範文字 |
| 無 | 任何 bootstrap / permutation / MCMC / simulation-based | **NOT_IMPLEMENTED** | 未見實作 |

## 二、結論

1. **引擎本身（A 類）可信**：本輪以 scipy/statsmodels 對照，Welch/ANCOVA/p 值/CI/Holm/描述統計 21 項全部在容差內通過（`verify-stat-engine-reference.mjs`）。
2. **主要缺口是資料來源，不是演算法**：`analysis-execution-service` 與 `formal-execution-service` 把**硬編碼示範資料**當作輸入餵進 A 類引擎，再把結果寫入 AnalysisRun/ResultFact，並在稿件中引用**虛構的倫理核准文號 REC-115-089**。這些輸出屬 **D 類（展示/測試）**，**不得作為正式研究釋出**。
3. **本輪修正**：
   - 修復引擎 CI 之 t 分位數近似誤差（2.0+2.0/df → 精確反函數 bisection），現與 scipy 完全一致。
   - 新增 `verify-stat-engine-reference.mjs`（C05/C06/C07 數值驗證，21 項全 PASS）。
4. **仍待完成（後續工作）**：
   - analysis/formal-execution 之示範資料改為明確標示 `input_origin: SYNTHETIC_FIXTURE`，或改接真實上傳資料路徑。
   - `computation_mode: DEMO_OR_MOCK` 之輸出不得寫入正式 Result Facts / 不得出現在稿件正文（C08 negative test 待補）。
   - R 專屬方法標 UNSUPPORTED，不偽裝（C07）。

## 三、環境事實

| 項目 | 狀態 |
|---|---|
| Rscript | 未安裝（`which Rscript` 無結果） |
| Python 3 | linuxbrew 有（3.x） |
| scipy/statsmodels | **原本無**；本輪已於隔離 venv `/tmp/calcenv` 安裝 scipy 1.18.1、statsmodels 0.15.0，僅供本驗證對照使用，**非 production 依賴** |
| Node 26.7.0 | 有 |
| pandoc | 未安裝（`which pandoc` 無結果） |
| 容器 | Docker socket 未見（無法執行 docker） |

---

*本矩陣僅涵蓋統計/運算方法；文獻比對、語言處理、LLM 生成等非數值方法不在本輪範圍。*
