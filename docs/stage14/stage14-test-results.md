# V3-U14-FULL 60 項驗收測試報告 (60-Item Acceptance Test Report)

**工程識別：V3-U14-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage14-full-60-items.ts`
**執行結果**：**60 / 60 PASS（100% 成功通過）**

---

### A. 交接、範圍與授權（T01–T10）
- **T01** [PASS] (INTEGRATION, FIXTURE) DataGovernanceSnapshot 解析並沿用 Project、RQ 與來源，不重建 Project
- **T02** [PASS] (UNIT, FIXTURE) 正確映射新版 ANALYSIS_DATASET_LOCKED_AND_HANDOFF_READY，不因缺舊 Gate 卡住
- **T03** [PASS] (INTEGRATION, FIXTURE) JOURNAL、NSTC、MOE_TPR 三目標完整保留，MOE 不誤退回期刊
- **T04** [PASS] (UNIT, FIXTURE) PLANNING_ONLY 與 fixture 可操作但不能建立正式 ResultRelease 綠燈
- **T05** [PASS] (UNIT, FIXTURE) 巢狀 source 跨 Project 或撤權時拒絕運算，worker 遵循 ACL
- **T06** [PASS] (UNIT, FIXTURE) Dataset hash 不符時出現 Issue 且不得默認更換 latest 檔案
- **T07** [PASS] (UNIT, FIXTURE) 已授權正式分析 scope 依計畫啟動，普通收集中資料不擅自中期分析
- **T08** [PASS] (UNIT, FIXTURE) Required RQ 清單完整保留，AI 不能因不顯著把 Primary 降為 Optional
- **T09** [PASS] (UNIT, FIXTURE) 修改主要模型需建立 ChangeProposal，錯誤修正與新探索保留分類
- **T10** [PASS] (UNIT, SYNTHETIC_ANALYSIS_TEST) 手算基準 fixture: [1,2,3,4,5] 驗證 mean=3.0, sample variance (ddof=1) = 2.5

### B. 計畫與真實計算（T11–T20）
- **T11** [PASS] (UNIT, SYNTHETIC_ANALYSIS_TEST) 獨立雙樣本 Welch t 檢定計算自由度、95% CI 與 Cohen's d (p < .01, isSignificant=true)
- **T12** [PASS] (UNIT, FIXTURE) 配對分析依研究 ID 精確配對，打亂列順序不影響正確差值配對結果
- **T13** [PASS] (UNIT, SYNTHETIC_ANALYSIS_TEST) ANCOVA 模型控制 T0 基線後精確估計介入處理效應 (Beta1 < 0, R2 > 0.95)
- **T14** [PASS] (UNIT, SYNTHETIC_ANALYSIS_TEST) 全 missing 或常數無變異時拋出清晰不可估計錯誤，不回傳假 p 或假 0
- **T15** [PASS] (UNIT, FIXTURE) typed spec 含惡意 formula 或 eval 時被安全阻擋，無 shell 權限
- **T16** [PASS] (UNIT, FIXTURE) 無 compute 或未支援方法顯示 UNSUPPORTED，不產生模型文字冒充計算
- **T17** [PASS] (UNIT, FIXTURE) 相同固定輸入與 engine 重跑在數值容差內完全重現
- **T18** [PASS] (UNIT, FIXTURE) 所有 Run 可查，重複點擊不建立重複 run 或重複收費
- **T19** [PASS] (UNIT, FIXTURE) Dataset 含合法 missing 及 deferred task 可進本輪，不要求 U13 先跑 MI
- **T20** [PASS] (UNIT, FIXTURE) 多重補值 adapter 逐份執行並正確 pool 不確定性，拒絕平均插補資料

### C. 缺失、相依與推論（T21–T30）
- **T21** [PASS] (UNIT, FIXTURE) 同人多時點與班級 cluster 不以所有 row 當獨立 N，實際分析單位分離
- **T22** [PASS] (UNIT, FIXTURE) 同人 pre/post 不被當獨立樣本，組別 × 時間交互作用有相應估計
- **T23** [PASS] (UNIT, FIXTURE) 少 cluster 班級與組別混淆產生限制，系統不宣稱已消除偏差
- **T24** [PASS] (UNIT, FIXTURE) 中介不具時序或識別依據時，嚴禁輸出因果機制已證實
- **T25** [PASS] (UNIT, FIXTURE) 不適用量表之研究不被強制跑 alpha/CFA，高 alpha 不標作效度證明
- **T26** [PASS] (UNIT, SYNTHETIC_ANALYSIS_TEST) multiplicity family 納入多重比較校正，Holm-Bonferroni step-down 精確運算 ([0.02, 0.04])
- **T27** [PASS] (UNIT, FIXTURE) non-significant 主要結果仍如實通過方法 QA，不視為研究失敗或擅改假設
- **T28** [PASS] (UNIT, FIXTURE) null 與極小 p 格式正確，不輸出 p=0 或將 NaN 變 0
- **T29** [PASS] (UNIT, FIXTURE) 未執行或不可估計分析之原因完整保存，不用缺失占位符假稱支持
- **T30** [PASS] (UNIT, FIXTURE) 敏感度與主分析不一致時顯示差異，不只釋出有利版本或暗換 primary

### D. 質性、AI與專屬領域（T31–T40）
- **T31** [PASS] (UNIT, FIXTURE) 質性工作區保存 source locator -> code -> finding 鏈，引文真實核對
- **T32** [PASS] (UNIT, FIXTURE) AI 提出之主題標記為候選，不冒充人工讀完、人工編碼或飽和結論
- **T33** [PASS] (UNIT, FIXTURE) reflexive TA 不被強制 kappa Gate，質性研究保有適用之研究立場
- **T34** [PASS] (UNIT, FIXTURE) Joint Display 保留量化與質性衝突，不自動抹平成一致
- **T35** [PASS] (UNIT, FIXTURE) AI 切分 train/val/test 各 fit scope 可驗，scaler 不全資料或 test fit
- **T36** [PASS] (UNIT, FIXTURE) 同人同文件 chunks 不得跨 split，test 嚴禁微調 prompt 或超參數
- **T37** [PASS] (UNIT, FIXTURE) 保存 LLM judge、prompt、corpus 與延遲，AI 評分不冒充人工 gold label
- **T38** [PASS] (UNIT, FIXTURE) AI 多 seed 與失敗 run 均保留，相同 test scope 之指標與混淆矩陣匹配
- **T39** [PASS] (UNIT, FIXTURE) 感測點與工件批次與獨立單位分開，時間與改善百分比基期可驗證
- **T40** [PASS] (INTEGRATION, FIXTURE) MOE_TPR 班級與學習成效保留，滿意度不改寫為技能表現，無權成績不進分析

### E. Fact、表圖與老麥/Lock（T41–T50）
- **T41** [PASS] (UNIT, FIXTURE) ResultFact 僅由受控 engine 或驗證匯入寫入，AI 或通用 PATCH 改數值被拒絕
- **T42** [PASS] (UNIT, FIXTURE) 每表格 cell 與圖的 estimate/error bar 可追溯，禁止手動輸入不一致數值
- **T43** [PASS] (UNIT, FIXTURE) 修改圖表顏色與外觀不改 result hash，修改科學 contrast 需新 Spec/Run
- **T44** [PASS] (UNIT, FIXTURE) Figures 與表格產生真實檔案，SVG 清理與資料驅動渲染引擎 (DATA_DRIVEN_SVG_RENDERER_V1)
- **T45** [PASS] (UNIT, FIXTURE) Result 更新新版本，引用舊 Fact 的圖表標 OUTDATED，不靜默改已核准稿段
- **T46** [PASS] (UNIT, FIXTURE) Assist 可補分析規格與解說，不能把缺失資料或未知 p 自動填滿
- **T47** [PASS] (UNIT, FIXTURE) AI 執行中人工改字或鎖定，遲到輸出存為候選衝突不覆蓋
- **T48** [PASS] (UNIT, FIXTURE) 已鎖定欄位不能經整區替換或刪子列繞過，解鎖新版本保留原版
- **T49** [PASS] (UNIT, MOCK) Evidence 缺失直達文獻中心原 RQ/spec 位置，原始研究資料不送入搜尋
- **T50** [PASS] (UNIT, MOCK) Zotero 斷線仍保留合法本地引用，遠端版本更新需重驗來源

### F. 品質、釋出與無斷層交接（T51–T60）
- **T51** [PASS] (UNIT, FIXTURE) COMPUTED 與 VALIDATED/RELEASED 分離，模型未收斂不得正式釋出
- **T52** [PASS] (UNIT, FIXTURE) 有效 non-significant 結果可正式 release，CRITICAL 瑕疵不以總分掩蓋
- **T53** [PASS] (UNIT, FIXTURE) 部分 scope 釋出只允許引用其 Fact，未完成主要 scope 顯示黃燈限制
- **T54** [PASS] (UNIT, FIXTURE) 分析負責人簽核是真實角色操作，AI 不能冒充統計師簽章
- **T55** [PASS] (UNIT, FIXTURE) 匯出不帶 PII、Identity mapping 或受限語料，API 重新檢查授權
- **T56** [PASS] (UNIT, FIXTURE) 服務重啟與中斷可查 checkpoint，取消後不自動 release，資料集 hash 不變
- **T57** [PASS] (INTEGRATION, FIXTURE) AnalysisResultsSnapshot 具有效 schema、固定來源、ResultFact 與表圖
- **T58** [PASS] (UNIT, FIXTURE) 保存成功但導航失敗可重開同 snapshot，重複完成不重跑模型或重複交接
- **T59** [PASS] (INTEGRATION, FIXTURE) 下一階段指向新版第十五階段（研究結果整合與證據驅動全文寫作）
- **T60** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前十三階段契約全數暢通
