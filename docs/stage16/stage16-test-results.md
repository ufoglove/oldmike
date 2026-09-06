# V3-U16-FULL 60 項驗收測試報告（60-Item Acceptance Test Report）

**工程識別：V3-U16-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage16-full-60-items.ts`（60 項，誠實分級）
**補充**：`scripts/verify-stage16-stage17-consumer-contract.ts`（U17 consumer，38 項）
**執行結果**：**60 / 60 PASS + 3 NOT_RUN（如實列明）＋ U17 consumer 38 / 38 PASS**

---

### A. 承接與上游 Gate（T01–T10）
- **T01** [PASS] (INTEGRATION, FIXTURE) U15 快照承接後同 Project／Manuscript／來源存在，不新增重複 Project
- **T02** [PASS] (UNIT, FIXTURE) 正確使用 MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW 與 review scope
- **T03** [PASS] (UNIT, FIXTURE) 快照跨 workspace 或巢狀來源未授權時後端拒絕
- **T04** [PASS] (UNIT, FIXTURE) hash 或 source revision 不符時生成 stale Issue，不默用 latest
- **T05** [PASS] (UNIT, FIXTURE) 規劃模式不得進入正式科學審查（FORMAL_WRITING_NOT_ALLOWED）
- **T06** [PASS] (UNIT, FIXTURE) PARTIALLY_RELEASED 僅審查已准用 scope 內結果
- **T07** [PASS] (UNIT, FIXTURE) NOT_ESTIMABLE／NOT_TESTED 有實際處置時如實表達，不補估計值
- **T08** [PASS] (UNIT, FIXTURE) U15 未有人員核准之 Interpretation 維持 candidate
- **T09** [PASS] (INTEGRATION, FIXTURE) 三 Goal 通過承接，MOE 不退回期刊預設模板
- **T10** [PASS] (UNIT, FIXTURE) NSTC/MOE 衍生稿共用來源但不覆蓋原申請書

### B. 審查範圍與工作單（T11–T20）
- **T11** [PASS] (UNIT, FIXTURE) Review Work Order 建立覆蓋章節與目標
- **T12** [PASS] (UNIT, FIXTURE) 完整稿／部分稿／規劃稿分開
- **T13** [PASS] (UNIT, FIXTURE) 多角色審查為模擬，不是真人獨立驗證
- **T14** [PASS] (UNIT, FIXTURE) Reviewer #1/#2/方法/統計/領域角色模型存在
- **T15** [PASS] (UNIT, FIXTURE) 每 Finding 保存被審版本與精確定位
- **T16** [PASS] (UNIT, FIXTURE) Finding 有依據、查證狀態、嚴重度、影響與修正選項
- **T17** [PASS] (UNIT, FIXTURE) Finding 有責任人、blocks_actions 與返回位置
- **T18** [PASS] (UNIT, FIXTURE) 機械 QA 涵蓋數值綁定／幽靈數據／p 值／誠實非顯著
- **T19** [PASS] (UNIT, FIXTURE) 語義風險與機械 QA 分開
- **T20** [PASS] (UNIT, FIXTURE) 審查預算上限存在

### C. Reviewer #2 挑戰與 Finding（T21–T30）
- **T21** [PASS] (UNIT, FIXTURE) Reviewer #2 提供證據與替代解釋
- **T22** [PASS] (UNIT, FIXTURE) Reviewer #2 提供最小修正路徑
- **T23** [PASS] (UNIT, FIXTURE) 不強迫湊缺點、不要求所有研究變大樣本 RCT
- **T24** [PASS] (UNIT, FIXTURE) 質性/技術稿不強制 H1、CFA 或所有 IMRaD 小節
- **T25** [PASS] (UNIT, FIXTURE) Finding 去重（同主題/同來源不重複計票）
- **T26** [PASS] (UNIT, FIXTURE) Abstract-only 不能標已讀全文
- **T27** [PASS] (UNIT, FIXTURE) 同研究多平台不重複計為獨立支持
- **T28** [PASS] (UNIT, FIXTURE) Finding 缺來源時標 NEEDS_SOURCE 而非錯誤/通過
- **T29** [PASS] (UNIT, FIXTURE) 所有 AI 審查標示 SIMULATED REVIEW
- **T30** [PASS] (UNIT, FIXTURE) 真實方法缺陷不能靠改寫掩蓋（未隨機不寫 RCT）

### D. 裁決、修訂與回覆（T31–T40）
- **T31** [PASS] (UNIT, FIXTURE) 作者可有據不同意，不要求全部接受
- **T32** [PASS] (UNIT, FIXTURE) Suggested Rewrite 只能成為候選
- **T33** [PASS] (UNIT, FIXTURE) 低風險未鎖定修正可連續採用，重要變更留真人
- **T34** [PASS] (UNIT, FIXTURE) Author Response Matrix 建立（內部）
- **T35** [PASS] (UNIT, FIXTURE) 重審決策：無 blocker 且未達上限 → 可通過
- **T36** [PASS] (UNIT, FIXTURE) 達重審上限保留未解問題，不強制 PASS
- **T37** [PASS] (UNIT, FIXTURE) AI 進行中有人編輯或鎖定，遲到輸出只存候選
- **T38** [PASS] (UNIT, FIXTURE) 取消任務或撤用途後，遲到輸出不覆寫
- **T39** [PASS] (UNIT, FIXTURE) 數值疑慮回 U14 建立 AnalysisReviewRequest
- **T40** [PASS] (UNIT, FIXTURE) 新結果由 U14 驗證 release 後採納，不直接改舊快照

### E. 約束、鎖定與匯出（T41–T50）
- **T41** [PASS] (UNIT, FIXTURE) Meaning Constraints 保護數值/N/方向/時點/假設/因果邊界
- **T42** [PASS] (UNIT, FIXTURE) 保護值保留時約束成立
- **T43** [PASS] (UNIT, FIXTURE) 保護值改變時約束違反且不得放行
- **T44** [PASS] (UNIT, FIXTURE) 未執行 sensitivity 不能寫成已處理偏誤
- **T45** [PASS] (UNIT, FIXTURE) AI 自動 Lock 儲存不冒充人工核准
- **T46** [PASS] (UNIT, FIXTURE) 新 Result 版本使相關段落標 STALE，不偷偷換值
- **T47** [PASS] (UNIT, SYNTHETIC_REVIEW_TEST) 匯出真實存在 bytes 與 manifest（JSON/findings/約束/QA/markdown）
- **T48** [PASS] (UNIT, FIXTURE) 未支援格式如實標 UNSUPPORTED 而非假下載
- **T49** [PASS] (UNIT, FIXTURE) 無 Word Live Fields 能力時如實標示
- **T50** [PASS] (UNIT, FIXTURE) 匯出/AI audit 不包含 Raw、IdentityVault、API keys

### F. 交接與無斷層（T51–T60）
- **T51** [PASS] (UNIT, FIXTURE) 缺失直達正確稿件/章節/段落/上游來源
- **T52** [PASS] (UNIT, FIXTURE) 補完提供「保存並返回科學審查」，後端重驗
- **T53** [PASS] (INTEGRATION, FIXTURE) ScientificReviewSnapshot 具 schema、manifest、signoff、U17 consumer test
- **T54** [PASS] (UNIT, FIXTURE) 完成交易提交成功但導航失敗可重開同 snapshot
- **T55** [PASS] (UNIT, FIXTURE) ReadyForReview 不要求下一階段 Reviewer/語言/投稿核准先完成
- **T56** [PASS] (UNIT, FIXTURE) 部分稿件交接帶 review_scope 與 missing matrix
- **T57** [PASS] (INTEGRATION, FIXTURE) 第十七階段未建置有真實接收頁，可返回，不跳空白
- **T58** [PASS] (UNIT, FIXTURE) 接收頁 reEntryPoint 回 U16 不循環
- **T59** [PASS] (UNIT, FIXTURE) 綠燈只表示內部科學審查完成，不代表期刊接受
- **T60** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前十五階段契約全數暢通

### NOT_RUN（如實列明，非通過）
- **N1** ScientificReviewCenter UI 深度整合（Finding 表格、重審流程、一鍵主按鈕）— 本輪完成契約/服務/API；UI 整合為後續輪次。
- **N2** LLM 生成式 Reviewer 意見（非確定性）— 本輪 Reviewer #2 為確定性規則引擎；接 OpenClaw LLM 之 live adapter 未實作。
- **N3** DOCX/PDF/LaTeX 匯出 round-trip — 本輪提供 JSON/manifest/markdown 真實匯出；其餘格式 UNSUPPORTED。

### 環境與誠實標記
- 全部測試於本地安全開發容器（`/home/node/dev/repo`）執行，環境：FIXTURE／SYNTHETIC_REVIEW_TEST。
- fixture 通過不代表真實稿件審查已完成；所有 AI 審查均標 SIMULATED REVIEW。
- `npx tsc --noEmit`：0 errors。
- 回歸：Stage 13（48/48）、Stage 14（60/60）、Stage 15（60/60）全數 PASS。
