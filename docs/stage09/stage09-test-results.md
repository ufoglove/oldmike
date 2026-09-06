# V3-U09-FULL 48 項驗收測試報告 (48-Item Acceptance Test Report)

**工程識別：V3-U09-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage09-full-48-items.ts`
**執行結果**：**48 / 48 PASS（100% 成功通過）**

---

### A. 承接、目標與審查（T01–T08）
- **T01** [PASS] (INTEGRATION, FIXTURE) 第八階段有效 snapshot 初始化本工作區，RQ、初稿、預算參照完整保留
- **T02** [PASS] (UNIT, FIXTURE) 三目標共用研究核心資料，但審查邏輯彼此獨立不換標題回退
- **T03** [PASS] (UNIT, MOCK) 重複點擊、刷新及重啟重開同一工作區，版本與 ID 穩定不重建
- **T04** [PASS] (UNIT, FIXTURE) 未知 schema 回傳可修復錯誤，跨專案存取被拒絕
- **T05** [PASS] (INTEGRATION, FIXTURE) JOURNAL、NSTC、MOE_TPR 完整通過驗證，無模板不回退
- **T06** [PASS] (UNIT, FIXTURE) JOURNAL 採 PRE_STUDY_JOURNAL_REVIEW，未收案前絕不生成假 Results
- **T07** [PASS] (UNIT, FIXTURE) NSTC 包含科學問題、方法可行性、主持人三重視角審查
- **T08** [PASS] (UNIT, FIXTURE) MOE 審查自動啟動教師與學生權力關係專屬檢查 (TEACHER_STUDENT_POWER_RISK)

### B. 官方規則與合規（T09–T16）
- **T09** [PASS] (UNIT, FIXTURE) 官方規則讀取失敗時標記 SOURCE_UNAVAILABLE，不當成尚未公告
- **T10** [PASS] (UNIT, FIXTURE) 舊年度規則標記 VERIFIED_PREVIOUS_YEAR，不冒充當年度正式規則
- **T11** [PASS] (UNIT, FIXTURE) 合規矩陣清楚區分 CURRENT_STAGE_REQUIRED 與 LATER_STAGE_REQUIRED
- **T12** [PASS] (UNIT, FIXTURE) 晚期 IRB 核准列為 SUBMISSION_ONLY，不阻礙當前階段規劃基線
- **T13** [PASS] (UNIT, FIXTURE) MOE 缺本人課程基線時標記 PENDING/UNKNOWN，不偽造及格或成績
- **T14** [PASS] (UNIT, FIXTURE) 技能教學問題評量對齊課堂目標，規準客觀性列為合規項
- **T15** [PASS] (UNIT, FIXTURE) NSTC 經費與工作包對齊，避免同案同一項目重複申請
- **T16** [PASS] (UNIT, FIXTURE) 合規項目包含明確責任角色 (Owner) 與驗證時間戳

### C. 研究倫理與 IRB 中心（T17–T24）
- **T17** [PASS] (UNIT, FIXTURE) 共用 Ethics Scope Screening 涵蓋 15 類指標，輸出 REVIEW_LIKELY_REQUIRED
- **T18** [PASS] (UNIT, FIXTURE) 穿戴式 VR 裝置與即時眼動生理紀錄被正確識別為應審查項目
- **T19** [PASS] (UNIT, FIXTURE) 網站絕不自行宣布正式 Approved 或 Exempt，僅提供評估建議
- **T20** [PASS] (UNIT, FIXTURE) 在缺乏真實核准文件時，嚴禁生成假 IRB 核准字號
- **T21** [PASS] (UNIT, FIXTURE) 假宣稱 IRB APPROVED 被檢查器精確阻擋 (FABRICATED_IRB_APPROVAL_PROHIBITED)
- **T22** [PASS] (UNIT, FIXTURE) 師生權力關係未緩解時精確觸發 FATAL 錯誤阻擋交接
- **T23** [PASS] (UNIT, FIXTURE) 倫理風險登錄包含動暈眩物理風險與監控計畫
- **T24** [PASS] (UNIT, FIXTURE) 學生知情同意收集與成績獨立封存建立於緩解策略中

### D. 資料管理與預註冊（T25–T32）
- **T25** [PASS] (UNIT, FIXTURE) DMP 去識別化策略設定為 CODED_DE_IDENTIFIED，密鑰獨立存儲
- **T26** [PASS] (UNIT, FIXTURE) DMP 資料傳輸協定採用 TLS 1.3，外部 AI 嚴格匿名傳輸
- **T27** [PASS] (UNIT, FIXTURE) 第三方 AI 使用限制明確禁止公開模型訓練並關閉資料保留
- **T28** [PASS] (UNIT, FIXTURE) 資料保存年限依法設定為 5 年，包含銷毀抹除計畫
- **T29** [PASS] (UNIT, FIXTURE) 預註冊計畫對齊 Stage 7 分析計畫，狀態標示為 DRAFT_READY
- **T30** [PASS] (UNIT, FIXTURE) 缺乏真實註冊網址時標記 REGISTERED 被檢查器阻擋 (FABRICATED_PREREGISTRATION_PROHIBITED)
- **T31** [PASS] (UNIT, FIXTURE) 內部 Analysis Plan 加鎖不冒充外部正式註冊
- **T32** [PASS] (UNIT, FIXTURE) 非期刊路線之預註冊設定為 NOT_APPLICABLE，不強套所有專案

### E. 修訂任務、Assist 與鎖定（T33–T40）
- **T33** [PASS] (UNIT, FIXTURE) 未解決之 Reviewer 意見自動轉換為修訂任務 (RevisionTask)
- **T34** [PASS] (UNIT, FIXTURE) 修訂任務精確指定影響之工作區、章節與責任角色
- **T35** [PASS] (UNIT, FIXTURE) FILL_EMPTY 不改既有內容，IMPROVE_UNLOCKED 跳過鎖定內容
- **T36** [PASS] (UNIT, FIXTURE) AI 自動鎖定標記 AUTOMATION_POLICY_LOCKED_DRAFT，不冒充人工核准
- **T37** [PASS] (UNIT, FIXTURE) 未解決之 FATAL 意見阻擋交接 (FATAL_REVIEWER_FINDING_UNRESOLVED)
- **T38** [PASS] (UNIT, FIXTURE) 上游版本變更時受影響審查項目標記 REVALIDATION_REQUIRED
- **T39** [PASS] (UNIT, MOCK) Zotero 維持版本對應，文獻增強任務能直達既有文獻中心
- **T40** [PASS] (UNIT, FIXTURE) 所有寫入嚴格驗證 ACL 與 revision，防止惡意指令注入

### F. 缺失、燈號與交接（T41–T48）
- **T41** [PASS] (UNIT, FIXTURE) 缺失導航直達對應章節與欄位，保存返回後由後端重驗解除
- **T42** [PASS] (UNIT, FIXTURE) 次要成果與選填項目不錯阻主要路線交接
- **T43** [PASS] (UNIT, FIXTURE) 燈號狀態文字與圖示並存，不單純依賴顏色區分
- **T44** [PASS] (UNIT, FIXTURE) 本階段完成標記為 PLANNING_REVIEW_COMPLETE，絕不宣稱正式 SUBMITTED
- **T45** [PASS] (INTEGRATION, FIXTURE) Stage09HandoffSnapshot 具備真實 schema、合規比率與倫理審查結論
- **T46** [PASS] (UNIT, FIXTURE) 重複完成只建立一次 handoff，導航故障可重開同一接收頁
- **T47** [PASS] (INTEGRATION, FIXTURE) 下一階段指向新版第十階段（研究工具、量表與 Study Protocol）
- **T48** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前八階段契約全數暢通
