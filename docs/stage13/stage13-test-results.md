# V3-U13-FULL 48 項驗收測試報告 (48-Item Acceptance Test Report)

**工程識別：V3-U13-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage13-full-48-items.ts`
**執行結果**：**48 / 48 PASS（100% 成功通過）**

---

### A. 交接與 scope（T01–T08）
- **T01** [PASS] (INTEGRATION, FIXTURE) 接收 FormalExecutionSnapshot，原筆記與 Issue 不遺失，不重建 Project
- **T02** [PASS] (UNIT, FIXTURE) 上游無舊 Raw Lock Gate 仍可 source freeze，不因此卡死或補造假核准
- **T03** [PASS] (INTEGRATION, FIXTURE) 三 Goal 與發表/資助共存，快照與工作區不互相污染
- **T04** [PASS] (UNIT, FIXTURE) 無真實 data 時可規劃與 fixture 測試，正式研究燈號保持未完成
- **T05** [PASS] (UNIT, FIXTURE) 收集中 QA 與已批准固定波次 scope 分開，不擅自放行未規劃中期分析
- **T06** [PASS] (UNIT, FIXTURE) Raw data hash mismatch 或檔案缺失觸發 Quarantine 與補足導航
- **T07** [PASS] (UNIT, FIXTURE) 固定 scope 後晚到資料只生成新候選 manifest，不改已鎖定版本
- **T08** [PASS] (UNIT, FIXTURE) Pilot、synthetic、dry run 與 formal 不混成正式 N 或 dataset

### B. 字典、規則與計分（T09–T16）
- **T09** [PASS] (UNIT, SYNTHETIC_GOVERNANCE_TEST) ID 字串前導零 (0012) 與小數點 locale 在 round-trip 後完整不失真
- **T10** [PASS] (UNIT, FIXTURE) 同名欄位來自不同工具版本不自動合併，未知 mapping 保留 Issue
- **T11** [PASS] (UNIT, SYNTHETIC_GOVERNANCE_TEST) 99 缺失碼優先攔截為 missing (null)，不產生 6-99=-93 錯誤；有效數值反向正確 (56)
- **T12** [PASS] (UNIT, SYNTHETIC_GOVERNANCE_TEST) 已反向欄位重跑不重複套轉換，rule 與 lineage 邊緣精確可追溯
- **T13** [PASS] (UNIT, FIXTURE) 未核准或衝突之更正紀錄不自動採用，合法更正僅作用於新 Clean 版
- **T14** [PASS] (UNIT, FIXTURE) 事件多列與真正重送精確區分，不任意刪除重複資料或私自改 N
- **T15** [PASS] (UNIT, FIXTURE) Join 造成 many-to-many 與 unit 倍增時拒絕直接合併並發出警示
- **T16** [PASS] (UNIT, FIXTURE) 計分缺規則或零分母不猜測數值、不用任意 eval，標記未支援

### C. 缺失、納入與研究類型（T17–T24）
- **T17** [PASS] (UNIT, FIXTURE) 有效 0、不適用、拒答、設備故障保留不同缺失語義 (MissingReasonCode)
- **T18** [PASS] (UNIT, FIXTURE) 缺失資料不自動平均補值或 LOCF，合法 missing 不被強制填滿才能 release
- **T19** [PASS] (UNIT, FIXTURE) 多重補值與模型依賴處理保留 deferred obligation，第十四階段契約可讀
- **T20** [PASS] (UNIT, FIXTURE) 極端值先標記 FLAGGED_RETAINED，排除需 named analysis 與理由，Raw 仍在
- **T21** [PASS] (UNIT, FIXTURE) 同人多時點與缺 T2 不刪 baseline，不全域套用 complete-case
- **T22** [PASS] (UNIT, FIXTURE) 教育研究 (MOE_TPR) 嚴格隔離未同意研究之學生紀錄，流出時觸發 FATAL 阻擋
- **T23** [PASS] (UNIT, FIXTURE) 環境檢出限與 kW/kWh 具備正確時間與物理單位語義，不自動補 0
- **T24** [PASS] (UNIT, FIXTURE) 質性語料保存原語句與校閱狀態，不改寫成好看引文、不偽造 themes

### D. 權限、AI 資料與可重現性（T25–T32）
- **T25** [PASS] (UNIT, FIXTURE) 跨專案存取隔離，未授權者無法讀取 Raw 或 signed export
- **T26** [PASS] (UNIT, FIXTURE) Identity Vault 直接識別資訊完全隔離，絕不進普通 AI 或分析匯出
- **T27** [PASS] (UNIT, FIXTURE) Consent 撤回時派生 release 受限且標記重新評估，不以 immutable 拒絕處置
- **T28** [PASS] (UNIT, FIXTURE) AI 切分防洩漏：全資料 Fit Scaler 觸發 FATAL (DATA_LEAKAGE_PREPROCESSING_FIT_VIOLATION)
- **T29** [PASS] (UNIT, FIXTURE) 同人/同文件/重疊感測視窗跨 split 風險被識別標記，不自行重切
- **T30** [PASS] (UNIT, SYNTHETIC_GOVERNANCE_TEST) 相同固定 source 與規則重跑 logical content hash 一致
- **T31** [PASS] (UNIT, FIXTURE) 大檔分塊與失敗中斷可恢復，無半份輸出被當成完整 release
- **T32** [PASS] (UNIT, FIXTURE) 任意程式注入與公式注入被嚴格限制，工具不寫 Raw 或讀未授權資產

### E. 老麥、鎖定與導航（T33–T40）
- **T33** [PASS] (UNIT, FIXTURE) FILL_EMPTY 只補設定草稿，不補造研究 missing 值；computed 由引擎寫
- **T34** [PASS] (UNIT, FIXTURE) 一次授權 approved 規則可連續處理，需人工 cohort 決策集中提示
- **T35** [PASS] (UNIT, FIXTURE) 手動/autosave/AI/job 均尊重 rule 與 dataset lock，換 pointer 不能繞過
- **T36** [PASS] (UNIT, FIXTURE) AI 執行中 source 或 rule 被修改，遲到結果存為原 snapshot 候選
- **T37** [PASS] (UNIT, FIXTURE) 缺失按鈕直達正確 instrument/mapping/query 欄，保存返回後重驗才解除
- **T38** [PASS] (UNIT, MOCK) 修改清理方法需文獻時導向原中心，Consensus 不含敏感 Raw
- **T39** [PASS] (UNIT, FIXTURE) UI 切換專案、多 tab 版本衝突不混資料，不復活已回收專案
- **T40** [PASS] (UNIT, FIXTURE) provider unavailable 時保留本地規則與 pipeline，不假稱 AI 已查證

### F. Release、匯出與下一階段（T41–T48）
- **T41** [PASS] (UNIT, FIXTURE) 選定 analysis scope 關鍵用途不符不能以高品質總分抵銷
- **T42** [PASS] (UNIT, FIXTURE) Analysis Release 具備明確核准角色，自動鎖定不冒充人工核准
- **T43** [PASS] (UNIT, FIXTURE) LOCKED_FOR_ANALYSIS 後不能直接修改，新 revision 保留舊版
- **T44** [PASS] (UNIT, FIXTURE) 真實 export 檔案存在、有 manifest 與 hash，受限欄位依法阻擋
- **T45** [PASS] (UNIT, FIXTURE) 完成只來自 dataset release，不因文獻 sync 或模型顯著影響燈號
- **T46** [PASS] (INTEGRATION, FIXTURE) DataGovernanceSnapshot JSON Schema 及 U14 consumer 驗證指定 hash 與 recipe
- **T47** [PASS] (UNIT, FIXTURE) 重複完成只建立一次 baseline/snapshot/outbox，導航故障可重開同一接收頁
- **T48** [PASS] (INTEGRATION, FIXTURE) 下一階段指向新版第十四階段（分析實驗室 Execution Mode、結果與圖表）
