# V3-U10-FULL 48 項驗收測試報告 (48-Item Acceptance Test Report)

**工程識別：V3-U10-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage10-full-48-items.ts`
**執行結果**：**48 / 48 PASS（100% 成功通過）**

---

### A. 交接、目標與研究狀態（T01–T08）
- **T01** [PASS] (INTEGRATION, FIXTURE) 有效 Stage09HandoffSnapshot 開啟同一 Project，RQ、設計、倫理待辦完整繼承
- **T02** [PASS] (UNIT, FIXTURE) 第九階段完成不自動使專案通過倫理或 Pilot 執行 Gate，保留待審狀態
- **T03** [PASS] (UNIT, FIXTURE) 跨專案存取與未知 schema 安全拒絕並提供正確錯誤
- **T04** [PASS] (UNIT, MOCK) 重複初始化、刷新斷線重開仍為同一工作區，版本與 ID 穩定
- **T05** [PASS] (UNIT, FIXTURE) adapter 保留舊 blocks_action 與 nullable 來源，不擅自升級 PASS
- **T06** [PASS] (INTEGRATION, FIXTURE) 三 Goal 從 UI、validator、API 到 snapshot 一致，MOE 不回退為期刊
- **T07** [PASS] (UNIT, FIXTURE) 同 Project 計畫與期刊共用工具 reference，不同文件不互相覆蓋
- **T08** [PASS] (UNIT, FIXTURE) 既有研究文件整理不回填事前 Protocol，無 IRB 核准仍可草稿規劃

### B. 需求、來源、證據與工具身份（T09–T16）
- **T09** [PASS] (UNIT, FIXTURE) 主要 RQ 缺工具或資料路徑會產生精確缺失阻擋交接
- **T10** [PASS] (UNIT, FIXTURE) 質性、技術或感測元件不強制心理量表信度，支援感測日誌規格
- **T11** [PASS] (UNIT, FIXTURE) 標準工具可多專案引用，私有材料/權利/註記嚴格隔離
- **T12** [PASS] (UNIT, FIXTURE) 不把 DOI 誤當單一工具鍵，原版與短版版本分開維護
- **T13** [PASS] (UNIT, MOCK) Consensus 等現有 API 在授權 scope 執行，無憑證不回假全文
- **T14** [PASS] (UNIT, FIXTURE) 來源未報告之性質標為未知，他人樣本信效度不寫成本專案結果
- **T15** [PASS] (UNIT, FIXTURE) 他人樣本信度不成為本研究結果，不以單一 alpha 宣稱工具完全有效
- **T16** [PASS] (UNIT, MOCK) Zotero library/item/version 對應正確，斷線不刪合法本地引用

### C. 權利、調適與原創工具（T17–T24）
- **T17** [PASS] (UNIT, FIXTURE) 受限完整題項不能被未授權公開匯出，違反時觸發 FATAL 阻擋
- **T18** [PASS] (UNIT, FIXTURE) 正確作用域許可允許指定操作，超出用途阻擋
- **T19** [PASS] (UNIT, FIXTURE) 調適流程保留原版對照與修改點，機器翻譯不標記 Validated Translation
- **T20** [PASS] (UNIT, FIXTURE) 認知訪談留作後續任務，不產生先有 Pilot 結果才能規劃 Pilot 的循環
- **T21** [PASS] (UNIT, FIXTURE) 原創問卷/測驗標示 NEWLY_DEVELOPED_DRAFT，留存研發理由
- **T22** [PASS] (UNIT, FIXTURE) 不適用反向題不強加，題目狀態與跳題拒答明確區分
- **T23** [PASS] (UNIT, FIXTURE) Rubric 具備可觀察 criteria 與層級錨點，評分者一致性列為計畫
- **T24** [PASS] (UNIT, FIXTURE) 未知授權狀態保留 REQUEST_PENDING，不以高內部分數抵銷

### D. 材料、計分與資料規格（T25–T32）
- **T25** [PASS] (UNIT, FIXTURE) Sensor 與設備未知參數保留候選，不偽造實測或訊號品質
- **T26** [PASS] (UNIT, FIXTURE) 教學介入與評量可連結，只測滿意度不能自動回答技能提升 RQ (FATAL)
- **T27** [PASS] (UNIT, FIXTURE) 實驗/比較條件及忠實度記錄為 planned，不填 actual
- **T28** [PASS] (UNIT, FIXTURE) 活動時程 Schedule of Activities 清楚界定基線、介入與延宕測量時點
- **T29** [PASS] (UNIT, SYNTHETIC_INSTRUMENT_TEST) 原創 scoring fixture [1,2,5] 第二欄反向得到 [1,4,5]、sum=10、mean=3.333，標記 SYNTHETIC_INSTRUMENT_TEST
- **T30** [PASS] (UNIT, SYNTHETIC_INSTRUMENT_TEST) 99 missing 先解碼為 null，不產生 6-99=-93 錯誤，有效題數滿門檻正常加總 (sum=6, mean=3)
- **T31** [PASS] (UNIT, SYNTHETIC_INSTRUMENT_TEST) 缺項過多低於最低作答要求時總分輸出 null 並發出警告，不擅自補 0 或平均值
- **T32** [PASS] (UNIT, FIXTURE) DataCapture 欄位與分析要求對應，PII 隔離與單位保留，不生成假資料

### E. Protocol、倫理、Assist與回寫（T33–T40）
- **T33** [PASS] (UNIT, FIXTURE) Protocol 引用實際已採用 source versions，規劃方法不改為已執行
- **T34** [PASS] (UNIT, FIXTURE) SPIRIT 適用性依研究類型適配，防動暈安全機制寫入標準程序
- **T35** [PASS] (UNIT, FIXTURE) 新增感測資料時對齊第九階段倫理範疇，不改寫機構原始決定
- **T36** [PASS] (UNIT, FIXTURE) 自述倫理不升級為官方驗證，真實文件只覆蓋相符版本
- **T37** [PASS] (UNIT, FIXTURE) 改 Primary Outcome 時建立 ChangeProposal 回上游，不原地覆寫
- **T38** [PASS] (UNIT, FIXTURE) 每欄、題項、工具與 Protocol 可使用適當 Assist，數值不由模型自由猜測
- **T39** [PASS] (UNIT, FIXTURE) FILL_EMPTY 不改既有內容，IMPROVE_UNLOCKED 遵守鎖，FILL_AND_LOCK 記 automation 草稿
- **T40** [PASS] (UNIT, FIXTURE) AI 執行中人工修改或鎖定，遲到輸出存為候選，重試不重複扣費

### F. 導航、Gate、交接與回歸（T41–T48）
- **T41** [PASS] (UNIT, FIXTURE) 受限題項按 ACL 隔離，惡意外部內容不執行任意 shell 或代碼
- **T42** [PASS] (UNIT, FIXTURE) Issue 連結直達正確 Project 與欄位，修改後保存返回由後端重驗解除
- **T43** [PASS] (UNIT, FIXTURE) 首頁狀態與 StageActionBar 反映真實規劃狀態，圖示與文字並存
- **T44** [PASS] (UNIT, FIXTURE) 晚期認知訪談、信效度實證不誤阻擋本輪工具規劃基線完成
- **T45** [PASS] (UNIT, FIXTURE) 重複完成只建立一次 baseline/snapshot/outbox，導航故障可重開同一接收頁
- **T46** [PASS] (INTEGRATION, FIXTURE) InstrumentProtocolSnapshot 具有效 JSON Schema、版本 refs 與 Pilot 待驗證清單
- **T47** [PASS] (INTEGRATION, FIXTURE) 下一階段指向新版第十一階段（Pilot／工具預試與 Protocol 驗證）
- **T48** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前九階段契約全數暢通
