# MetricDefinitions：品質與營運指標定義

## 1. 三大維度嚴格分離
指標系統將「服務成功」、「內容正確」與「真人採用」徹底分開，禁止互相混淆：
- **服務成功**：系統正常回傳 HTTP 200 或寫入完成，僅代表技術通訊成功，不代表論文內容無誤。
- **內容正確**：數值、統計方向、引用來源與 Fact 保真，需經確定性驗證或科學審閱。
- **真人採用**：研究者本人針對實際成果 Hash 簽署認可，AI 自評或模擬點擊不可代替。

## 2. 核心指標矩陣
| 指標名稱 | 鍵值 (metricKey) | 分子 (Numerator) | 分母 (Denominator) | 零分母處置 | 狀態定義 |
|---|---|---|---|---|---|
| **保存可讀回完整性** | `save_readback_integrity` | 成功寫入且 readback 內容一致之修訂數 | 總嘗試儲存修訂數 | `null` (N/A) | 分母 > 0 且 比率 = 1.0 $\to$ OK |
| **任務終止恢復率** | `task_resume_success_rate` | 中斷後成功自 checkpoint 恢復之任務數 | 總中斷 work order 數 | `null` (N/A) | 無中斷事件標 `INSUFFICIENT_OBSERVATION` |
| **缺失導航有效性** | `missing_nav_resolution_rate` | 經由 deep link 抵達正確欄位並由後端解除之 Issue 數 | 總點擊處理之 Issue 數 | `null` (N/A) | 不以「曾點擊」計算，須後端驗證解除 |
| **匯出檔案可用性** | `export_file_validity_rate` | 能以原生工具完整解析重開之匯出檔案數 | 總匯出次數 | `null` (N/A) | 檔案解析失敗標 `DEGRADED` |
| **事實保真覆蓋率** | `fact_preservation_fidelity` | 通過 N/分母/方向/未顯著檢驗之產物數 | 總納檢產物數 | `null` (N/A) | 任何數值篡改標 `INCIDENT_OPEN` |
| **真人採用比率** | `human_adoption_rate` | 經有權研究者確認並綁定 Hash 之產物數 | 總交付成果數 | `null` (N/A) | 僅限真人確認，AI 自評不計入分子 |

## 3. 統計與聚合規範
- **零分母處置**：分母為 0 時計算值必須為 `null`（呈現為 N/A），嚴禁顯示為 100% 或 0%。
- **小樣本原則**：樣本量不足時，保留真實個案數與範圍，禁止虛構 p95、一週趨勢或百分比。
- **延遲到達事件**：遲到事件建立新版本 rollup，嚴禁直接篡改已發布之歷史快照數值。
- **Collector 異常**：當觀測收集器失效時，指標顯示為 `MONITORING_UNKNOWN`，禁止亮綠燈。
