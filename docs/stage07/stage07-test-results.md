# V3-U07-FULL 48 項驗收測試報告 (48-Item Acceptance Test Report)

**工程識別：V3-U07-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage07-full-48-items.ts`
**執行結果**：**48 / 48 PASS（100% 成功通過）**

---

### A. 承接與目標（T01–T08）
- **T01** [PASS] (INTEGRATION, FIXTURE) 第六階段 TheoryMechanismSnapshot 初始化同一專案，RQ、模型、設計需求完整保留
- **T02** [PASS] (UNIT, FIXTURE) ADOPT_WITH_DECLARED_ASSUMPTIONS 支援條件式規劃，不擅自升級理論已驗證
- **T03** [PASS] (UNIT, FIXTURE) RETURN_FOR_GAP_OR_SCOPE_REVISION 保留工作並提供返回入口
- **T04** [PASS] (UNIT, MOCK) 未知 schema 回傳可修復錯誤，重開與雙擊不重複建立工作區
- **T05** [PASS] (INTEGRATION, FIXTURE) JOURNAL、NSTC、MOE_TPR 完整通過驗證，無模板不回退
- **T06** [PASS] (UNIT, FIXTURE) 資助與期刊成果並存，切換 Tab 不改主要 Goal 與共用設計
- **T07** [PASS] (UNIT, FIXTURE) 僅使用已採用版本，pending 提案不冒充有效模型
- **T08** [PASS] (INTEGRATION, FIXTURE) 第六階段接收頁筆記升級後仍可讀，缺上游交接提供正確導航

### B. 設計品質與研究適用性（T09–T16）
- **T09** [PASS] (UNIT, FIXTURE) 探索性與技術設計支援適用路徑，不強套 H1/RCT 或一般量化 Power
- **T10** [PASS] (UNIT, FIXTURE) 抽樣、分配、觀察與分析單位明確分離，不混淆單一 N
- **T11** [PASS] (UNIT, FIXTURE) 一班一組班級混淆時精確觸發 ARM_SITE_CONFOUNDING 檢查
- **T12** [PASS] (UNIT, FIXTURE) 中介候選標記檢定假說，不宣稱因果中介已成立
- **T13** [PASS] (UNIT, FIXTURE) 保留 RQ 缺延宕測量時點觸發 RETENTION_WITHOUT_FOLLOWUP (FATAL)
- **T14** [PASS] (UNIT, FIXTURE) 未知場域設備保存 PROPOSED，不自動變成確定資源
- **T15** [PASS] (UNIT, FIXTURE) 教學目標為技能卻只測滿意度觸發 COURSE_OUTCOME_ASSESSMENT_MISMATCH
- **T16** [PASS] (UNIT, FIXTURE) 正當修訂保留時間與理由，不把後見調整改為事前註冊

### C. 規劃計算與分析計畫（T17–T24）
- **T17** [PASS] (UNIT, SIMULATED_FOR_DESIGN) 簡單樣本計算真實運作且結果符合理論公式 ($n=64/\text{arm}, N=128, \text{recruitment}=151$)
- **T18** [PASS] (UNIT, FIXTURE) 缺文獻效果量時支援標記 ASSUMPTION_BASED 的情境規劃
- **T19** [PASS] (UNIT, SIMULATED_FOR_DESIGN) 固定可用 N 支援可偵測最小效應量 (Detectable Effect) 情境計算
- **T20** [PASS] (UNIT, SIMULATED_FOR_DESIGN) 每組需樣數、總樣本、向上取整與流失調整明確分離
- **T21** [PASS] (UNIT, SIMULATED_FOR_DESIGN) 非法參數回傳 CALCULATION_FAILED，AI 不得自由補算數值
- **T22** [PASS] (UNIT, SIMULATED_FOR_DESIGN) 設計模擬標記 SIMULATED_FOR_DESIGN，不寫入正式 Raw Data 或 Result Facts
- **T23** [PASS] (UNIT, FIXTURE) 舊計算保留並具備唯一 calculationId，新計算不覆蓋舊值
- **T24** [PASS] (UNIT, FIXTURE) 固定資料或技術研究支援合理 SampleJustification，不強制普通 Power

### D. 矩陣、來源與方法（T25–T32）
- **T25** [PASS] (UNIT, FIXTURE) 核心 RQ 可追溯推論目標、設計、構念、時點與分析方法
- **T26** [PASS] (UNIT, FIXTURE) Primary 與 Secondary 分析角色明確區分，缺失值策略登錄
- **T27** [PASS] (UNIT, FIXTURE) 資料切分防護資料洩漏，Pipeline 規劃合規
- **T28** [PASS] (UNIT, FIXTURE) 效果量類型與量尺明確標記為 COHENS_D
- **T29** [PASS] (INTEGRATION, FIXTURE) 補方法 Evidence 直達原文獻中心，帶入必要 context
- **T30** [PASS] (UNIT, FIXTURE) API 處理與人工閱讀分開，同研究多來源不增加獨立支持票數
- **T31** [PASS] (UNIT, MOCK) Zotero 維持版本化對應，離線仍保存合法本地引用
- **T32** [PASS] (UNIT, FIXTURE) CONSORT 2025 候選規範依研究類型適配，不盲目套用

### E. Assist、鎖定與安全（T33–T40）
- **T33** [PASS] (UNIT, FIXTURE) 欄位、矩陣列、StudyArm、時點皆具備 FieldPolicy 與 Assist
- **T34** [PASS] (UNIT, FIXTURE) FILL_EMPTY 不改既有內容，IMPROVE_UNLOCKED 跳過鎖定
- **T35** [PASS] (UNIT, FIXTURE) AI 執行中加鎖，遲到輸出存為候選不覆蓋
- **T36** [PASS] (UNIT, FIXTURE) 刪組別或改時點不繞過鎖定與引用檢查
- **T37** [PASS] (INTEGRATION, FIXTURE) 跨 Project 存取隔離，未授權請求被拒絕
- **T38** [PASS] (UNIT, FIXTURE) 計算 worker 具備沙箱防護，不執行任意 AI 程式碼
- **T39** [PASS] (UNIT, FIXTURE) 取消與重啟後正確恢復，遲到結果不復活已回收專案
- **T40** [PASS] (UNIT, FIXTURE) 正式 Protocol 不能被本輪靜默改寫，變更需 proposal

### F. 缺失、亮燈與交接（T41–T48）
- **T41** [PASS] (UNIT, FIXTURE) 缺失直達正確 Project、component、tab 與 field
- **T42** [PASS] (UNIT, FIXTURE) 補足後保存並返回原位置，後端重驗才解除缺項
- **T43** [PASS] (UNIT, FIXTURE) 規劃基線不要求先有 IRB 核准或真實 Results，晚期待辦帶 due_phase
- **T44** [PASS] (UNIT, FIXTURE) 重大設計矛盾阻擋前進，可解釋參數條件式保存
- **T45** [PASS] (INTEGRATION, FIXTURE) DesignAnalysisPlanningSnapshot 具備實際 schema、計算限制與 late tasks
- **T46** [PASS] (UNIT, FIXTURE) 完成保存成功但導航失敗可重開原 handoff，不重複扣費
- **T47** [PASS] (INTEGRATION, FIXTURE) 第八階段（三路線工作室）接收契約完整，包含 routeWorkspaceIntents
- **T48** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前六階段契約全數暢通
