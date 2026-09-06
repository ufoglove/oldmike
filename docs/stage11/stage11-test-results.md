# V3-U11-FULL 48 項驗收測試報告 (48-Item Acceptance Test Report)

**工程識別：V3-U11-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage11-full-48-items.ts`
**執行結果**：**48 / 48 PASS（100% 成功通過）**

---

### A. 承接、資料分層與放行（T01–T08）
- **T01** [PASS] (INTEGRATION, FIXTURE) 第十階段有效 snapshot 初始化本工作區，工具與 Protocol 參照完整繼承
- **T02** [PASS] (UNIT, FIXTURE) 資料分層嚴格界定，Synthetic、Internal Dry Run、Pilot 與 Formal 徹底隔離
- **T03** [PASS] (UNIT, MOCK) 重複點擊、刷新斷線重開仍為同一工作區，版本與 ID 穩定不重建
- **T04** [PASS] (UNIT, FIXTURE) 內部非人體預演 (INTERNAL_NON_HUMAN) 與人體預試 (HUMAN_PILOT) 權限明確分開
- **T05** [PASS] (UNIT, FIXTURE) 未有正式倫理批件時嚴禁放行 HUMAN_PILOT (UNAUTHORIZED_HUMAN_PILOT_PROHIBITED)
- **T06** [PASS] (UNIT, FIXTURE) planned_n 嚴格區隔於 actual_n，不自動把預計人數當成實際完成人數
- **T07** [PASS] (INTEGRATION, FIXTURE) 三目標適用性邏輯分立，MOE 重點防範課堂負擔與師生權力防護
- **T08** [PASS] (UNIT, FIXTURE) Pilot 階段決策不等於正式研究啟動，首頁不誤亮正式研究綠燈

### B. 五大預試模組與一致性計算（T09–T16）
- **T09** [PASS] (UNIT, PILOT_DIAGNOSTIC) 評分者間信度經由真實受控引擎確定性運算 ($Po=0.90, Pe=0.28, \kappa=0.861$, Acceptable=true)
- **T10** [PASS] (UNIT, PILOT_DIAGNOSTIC) 小型預試之信度指標嚴格標記為 PILOT_DIAGNOSTIC，絕不直接宣稱正式 Validated
- **T11** [PASS] (UNIT, FIXTURE) 認知訪談紀錄精確至題目級 (TLX_01)，記錄理解歧義與修改建議
- **T12** [PASS] (UNIT, FIXTURE) 認知訪談僅保存必要化匿名代碼 (P-01)，不記錄敏感個資
- **T13** [PASS] (UNIT, FIXTURE) 評分者信度不足 (Kappa < 0.70) 時發出 MAJOR_WARNING
- **T14** [PASS] (UNIT, FIXTURE) Rubric 校準歧異處登錄裁決規則，相差 1 級與 2 級之處理分立
- **T15** [PASS] (UNIT, MOCK) Consensus 等文獻中心保持聯通，文獻引用維持版本對應
- **T16** [PASS] (UNIT, MOCK) Zotero 斷線不刪本地合法 CitationSource，外部新版不覆蓋判定

### C. 技術預試、AI模組與演練（T17–T24）
- **T17** [PASS] (UNIT, SYNTHETIC_TEST) 技術預試記錄採樣頻率 (90Hz)、延遲 (38.5ms) 與丟包率 (0.2%)
- **T18** [PASS] (UNIT, SYNTHETIC_TEST) 時間同步精度記錄為毫秒級 (2.1ms)，感測漂移未檢出
- **T19** [PASS] (UNIT, FIXTURE) AI 研究系統驗證檢查固定種子、防洩漏與關閉第三方留存協議
- **T20** [PASS] (UNIT, FIXTURE) AI 模型若在預試後更新版本，標記 REVALIDATION_REQUIRED
- **T21** [PASS] (UNIT, FIXTURE) Protocol 流程乾跑分步驟記錄預計與實際耗時，驗證流程可行性
- **T22** [PASS] (UNIT, FIXTURE) 防動暈眩安全中斷流程被演練落實 (滿20m強制休息10m)
- **T23** [PASS] (UNIT, FIXTURE) 乾跑偏差詳細記錄於偏差日誌 (PilotProtocolDeviation)，提出校正
- **T24** [PASS] (UNIT, FIXTURE) 乾跑演練無重大不良事件 (adverseEventOccurred = false)

### D. 品質指標、修訂與倫理變更（T25–T32）
- **T25** [PASS] (UNIT, PILOT_DIAGNOSTIC) 品質儀表板指標標記 PILOT_DIAGNOSTIC，不生成假顯著結論
- **T26** [PASS] (UNIT, FIXTURE) Pilot 發現不等於研究假設成立或不成立，分類為 INSTRUMENT/PROTOCOL_OK
- **T27** [PASS] (UNIT, FIXTURE) 任何 Pilot 發現需修改時建立 PilotRevisionProposal，不直接覆寫原版
- **T28** [PASS] (UNIT, FIXTURE) 修訂若涉及知情同意或受試者負擔，自動觸發 ETHICS_AMENDMENT 評估
- **T29** [PASS] (UNIT, FIXTURE) 正式研究放行閘門不因 Pilot 完成就自動判定為 READY
- **T30** [PASS] (UNIT, FIXTURE) 缺乏正式倫理批件時標記 READY 觸發 FATAL (FORMAL_EXECUTION_ETHICS_PREREQUISITE_MISSING)
- **T31** [PASS] (UNIT, FIXTURE) 未解決之關鍵偏差列入正式執行待辦 (pendingPrerequisites)
- **T32** [PASS] (INTEGRATION, FIXTURE) NSTC 預試可作為真實先期工作 (Preliminary Work) 寫入計畫書

### E. Assist、鎖定與安全（T33–T40）
- **T33** [PASS] (UNIT, FIXTURE) FILL_EMPTY 不改既有內容，IMPROVE_UNLOCKED 遵守鎖
- **T34** [PASS] (UNIT, FIXTURE) AI 自動協作標記 AUTOMATION_POLICY，不冒充人工核准或實測
- **T35** [PASS] (UNIT, FIXTURE) AI 執行中人工加鎖，遲到輸出存為候選衝突
- **T36** [PASS] (UNIT, FIXTURE) 所有寫入嚴格驗證 ACL 與 revision，防止代碼注入
- **T37** [PASS] (UNIT, FIXTURE) 受限題項按 ACL 隔離，惡意外部內容不執行任意 shell
- **T38** [PASS] (UNIT, FIXTURE) 計算 worker 具備沙箱防護，不執行任意外部代碼
- **T39** [PASS] (UNIT, FIXTURE) 取消與重啟後正確恢復，遲到結果不復活專案
- **T40** [PASS] (UNIT, FIXTURE) 正式 Protocol 不能被本輪靜默改寫，變更需 proposal

### F. 缺失、燈號與交接（T41–T48）
- **T41** [PASS] (UNIT, FIXTURE) 缺失直達正確 Project、component、tab 與 field
- **T42** [PASS] (UNIT, FIXTURE) 補足後保存並返回原位置，後端重驗才解除缺項
- **T43** [PASS] (UNIT, FIXTURE) 首頁綠燈只代表 PILOT_VALIDATION_COMPLETE，不代表正式研究已可執行
- **T44** [PASS] (UNIT, FIXTURE) 重大放行矛盾阻擋前進，條件式基線可交接
- **T45** [PASS] (INTEGRATION, FIXTURE) PilotValidationSnapshot 具備真實 schema、Kappa 指標與執行限制
- **T46** [PASS] (UNIT, FIXTURE) 重複完成只建立一次 baseline/snapshot/outbox，導航故障可重開
- **T47** [PASS] (INTEGRATION, FIXTURE) 下一階段指向新版第十二階段（正式研究執行與資料蒐集）
- **T48** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前十階段契約全數暢通
