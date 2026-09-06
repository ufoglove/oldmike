# V3-U15-FULL 60 項驗收測試報告 (60-Item Acceptance Test Report)

**工程識別：V3-U15-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage15-full-60-items.ts`
**執行結果**：**60 / 60 PASS（100% 成功通過）**

---

### A. 相容與來源（T01–T10）
- **T01** [PASS] (INTEGRATION, FIXTURE) U14 接收頁升級後同 Project／snapshot 存在，不新增重複 Project
- **T02** [PASS] (UNIT, FIXTURE) 正確使用 ANALYSIS_RESULTS_READY_FOR_MANUSCRIPT 與 release scope
- **T03** [PASS] (UNIT, FIXTURE) snapshot 跨 workspace 或巢狀 Fact 未授權時後端拒絕存取
- **T04** [PASS] (UNIT, FIXTURE) hash 或 source revision 不符時生成 stale Issue，不默用 latest
- **T05** [PASS] (UNIT, FIXTURE) formalWritingAllowed 控制正式結果起草，無資料時嚴禁生成假結果
- **T06** [PASS] (UNIT, FIXTURE) PARTIALLY_RELEASED 僅其有效 Fact 可引用，未釋出者不變 0 或文字結果
- **T07** [PASS] (UNIT, FIXTURE) NOT_ESTIMABLE/NOT_TESTED 有實際處置時如實表達，不補造估計值
- **T08** [PASS] (UNIT, FIXTURE) U14 未有人員核准之 Interpretation 維持 candidate，不自動升級為已核准
- **T09** [PASS] (INTEGRATION, FIXTURE) 三 Goal 通過 DB、API、cache 與 handoff，MOE 不退回期刊預設模板
- **T10** [PASS] (UNIT, FIXTURE) NSTC/MOE 衍生稿共用研究來源但不覆蓋原申請書、主目標或混算進度

### B. 目標、範圍與一鍵任務（T11–T20）
- **T11** [PASS] (UNIT, FIXTURE) 質性/技術稿不強制 H1、CFA 或所有 IMRaD 小節
- **T12** [PASS] (UNIT, FIXTURE) 同資料多稿形成 Overlap 風險及處置，不自動判抄襲也不忽略重複
- **T13** [PASS] (UNIT, FIXTURE) 主要不顯著結果被省略時觸發阻擋，要求必報結果歸位
- **T14** [PASS] (UNIT, FIXTURE) Guided/Co-writing/Evidence-to-draft 均能實際編輯存檔而非僅輸出聊天文字
- **T15** [PASS] (UNIT, FIXTURE) 一次授權逐章 job 連續執行，遇來源缺項保存部分成果並集中列出
- **T16** [PASS] (UNIT, MOCK) 重複啟動相同工作單不重複建立任務，可從 checkpoint 恢復
- **T17** [PASS] (UNIT, FIXTURE) 取消任務或撤銷用途後，遲到輸出不覆寫/復活稿件
- **T18** [PASS] (UNIT, FIXTURE) 成本超限或外部服務不允許時停止呼叫並保留本地草稿
- **T19** [PASS] (UNIT, FIXTURE) Fact-only 數值欄位不能透過通用 patch 或 AI 文字端點改寫
- **T20** [PASS] (UNIT, FIXTURE) 新增未知 Fact 標籤、token 遺失或錯連結果時候選不能直接採用

### C. 科學內容與 Fact（T21–T30）
- **T21** [PASS] (UNIT, FIXTURE) planned N、enrolled N、analysis N 分母不同時正確引用，不誤報統一 N
- **T22** [PASS] (UNIT, FIXTURE) p 比較符號、adjustment、CI 類型格式化後保持，嚴禁輸出 p=0 或 p=0.000
- **T23** [PASS] (UNIT, FIXTURE) 需要新百分比或結果合併而無來源 Fact 時建立需求，模型不心算入稿
- **T24** [PASS] (UNIT, FIXTURE) Protocol 為計畫但實際執行有異時忠實反映，Methods 不得虛構隨機或盲化
- **T25** [PASS] (UNIT, FIXTURE) 原研究量表信度與本樣本測得值分開，他人 alpha 不冒充本樣本結果
- **T26** [PASS] (UNIT, FIXTURE) 新探索性解釋可明確放 Discussion，不能回填為原先預註冊假設
- **T27** [PASS] (UNIT, FIXTURE) Discussion 出現未在 Results 登錄之幽靈數據被檢查器精確阻擋
- **T28** [PASS] (UNIT, FIXTURE) 未顯著不寫成等效，較弱識別下的因果推論標註邊界警告
- **T29** [PASS] (UNIT, FIXTURE) Abstract 與正文的 N、方向、主要 outcome、限制一致對齊
- **T30** [PASS] (UNIT, FIXTURE) 真實負面或混合結果之透明報告可以交審，不因假設未成立卡住

### D. 文獻、引用與特殊內容（T31–T40）
- **T31** [PASS] (UNIT, FIXTURE) 外部 Claim 引用存在且支持內容，建立 ClaimEvidenceLink 結構化對照
- **T32** [PASS] (UNIT, FIXTURE) Abstract-only 或片段不能標已讀全文，AI 處理與人工閱讀分開
- **T33** [PASS] (UNIT, FIXTURE) 同研究多平台或預印本/正式版不重複計為獨立支持
- **T34** [PASS] (UNIT, FIXTURE) EvidenceNeed 從段落跳文獻中心後能保存並返回同 Project/manuscript/claim
- **T35** [PASS] (UNIT, MOCK) Consensus 失敗或缺憑證如實標示，不傳 Raw 或敏感稿段作搜尋 query
- **T36** [PASS] (UNIT, MOCK) Zotero 暫時斷線保留合法本地 Citation，不存在 item 不虛造 DOI
- **T37** [PASS] (UNIT, FIXTURE) library + item key + version 追蹤完整，更新有 diff 不覆寫已鎖定引用
- **T38** [PASS] (UNIT, FIXTURE) 作者同年 a/b 消歧、群組引文及數字引用重排由整稿 context 正確渲染
- **T39** [PASS] (UNIT, FIXTURE) Citation 在表註或附錄仍進正式書目，閱讀清單不自動全部列 References
- **T40** [PASS] (UNIT, FIXTURE) 質性引文不在准用 quote index 或權限被撤時禁止插入，AI 不能創作引言

### E. 鎖定、過期與實際文件（T41–T50）
- **T41** [PASS] (UNIT, FIXTURE) AI 模型稿維持 train/val/test 與版本定義，不把驗證集改稱外部測試
- **T42** [PASS] (UNIT, FIXTURE) 已有作者稿匯入保留原檔，未知數值維持未驗證不自動視為正式 Fact
- **T43** [PASS] (UNIT, FIXTURE) 欄位、段落與章節鎖同時對手動、autosave、AI、同步生效
- **T44** [PASS] (UNIT, FIXTURE) 整段替換/刪子節點/改 active pointer 不能繞過鎖
- **T45** [PASS] (UNIT, FIXTURE) AI 進行中有人編輯或鎖定，回應只存舊 revision 候選不覆蓋
- **T46** [PASS] (UNIT, FIXTURE) 新 Result 版本使對應正文與表圖標 STALE，不偷偷換值
- **T47** [PASS] (UNIT, FIXTURE) 更換期刊只改 WritingProfile 與格式待辦，不能改研究來源或結果
- **T48** [PASS] (UNIT, SYNTHETIC_WRITING_TEST) 整稿預覽與實際 Markdown/JSON 匯出存在，hash 與來源 manifest 相符
- **T49** [PASS] (UNIT, SYNTHETIC_WRITING_TEST) 匯出重新解析後 Fact、符號、引用順序與表圖 crossrefs 完全一致
- **T50** [PASS] (UNIT, FIXTURE) 無 Word Live Fields 能力時只標 STATIC_CITATION_EXPORT，不冒充可刷新欄位

### F. 完成與無斷層交接（T51–T60）
- **T51** [PASS] (UNIT, FIXTURE) 惡意 HTML/SVG/LaTeX 連結無法執行或讀取任意資料，安全渲染
- **T52** [PASS] (UNIT, FIXTURE) 匯出或 AI audit 不包含 Raw、IdentityVault、受限全文或 API keys
- **T53** [PASS] (UNIT, FIXTURE) 缺失直達正確稿件欄位且補完返回，只點連結不能關閉 Issue
- **T54** [PASS] (UNIT, FIXTURE) AI 自動 Lock 儲存不冒充人工核准或正式科學審查
- **T55** [PASS] (UNIT, FIXTURE) ReadyForReview 不要求下一階段 Reviewer 先完成，無循環 Gate
- **T56** [PASS] (UNIT, FIXTURE) 部分稿件交接帶 review_scope 與 missing matrix，不亮完整綠燈
- **T57** [PASS] (INTEGRATION, FIXTURE) ManuscriptWritingSnapshot 具 schema、manifest、Fact/Citation 引用與 U16 consumer
- **T58** [PASS] (UNIT, FIXTURE) 完成交易提交成功但導航失敗可重開同 snapshot，不重跑生成
- **T59** [PASS] (INTEGRATION, FIXTURE) 下一階段指向新版第十六階段（老麥科學內容審查、Reviewer #2與逐項修訂）
- **T60** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前十四階段契約全數暢通
