# V3-U08-FULL 48 項驗收測試報告 (48-Item Acceptance Test Report)

**工程識別：V3-U08-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage08-full-48-items.ts`
**執行結果**：**48 / 48 PASS（100% 成功通過）**

---

### A. 承接、目標與隔離（T01–T08）
- **T01** [PASS] (INTEGRATION, FIXTURE) 第七階段有效 snapshot 初始化本工作區，RQ、計算限制、來源完整保留
- **T02** [PASS] (UNIT, FIXTURE) 第七階段完整/條件式 Gate 均按正確方式接收，暫定參數不自動變已確認事實
- **T03** [PASS] (UNIT, MOCK) 重複點擊、刷新及重啟重開同一 work order，不重建 Project
- **T04** [PASS] (UNIT, FIXTURE) 過期/不支援 schema 或撤權來源均被攔截並提供修復入口
- **T05** [PASS] (INTEGRATION, FIXTURE) JOURNAL、NSTC、MOE_TPR 完整通過驗證，無模板不回退
- **T06** [PASS] (UNIT, FIXTURE) NSTC 主要初稿＋期刊次要規劃可並存，切 Tab 不改 Goal
- **T07** [PASS] (UNIT, FIXTURE) 看過資料後建稿保留真實 temporal status，不回填事前假設
- **T08** [PASS] (UNIT, FIXTURE) 舊工作室相容接入與新 V3 stage 分清，不把舊版第八階段當入口

### B. 三路線專業功能（T09–T16）
- **T09** [PASS] (UNIT, FIXTURE) 無正式結果的期刊專案可完成規劃與背景/方法，Results 保持 slot 不虛構假數據
- **T10** [PASS] (UNIT, FIXTURE) 期刊未定時可用領域群規劃，近期文章不被標成期刊強制要求
- **T11** [PASS] (UNIT, FIXTURE) NSTC 讀取一般計畫與實際型別、年限，不擅自套新進或固定三年
- **T12** [PASS] (UNIT, FIXTURE) NSTC 主持人履歷未知時保留缺項，不從老麥角色補造虛構教授履歷
- **T13** [PASS] (UNIT, FIXTURE) MOE 缺本人課程資料保留 UNKNOWN 且可局部起草，不標正式合格
- **T14** [PASS] (UNIT, FIXTURE) MOE 一般文獻不能當本班基線，無真實訪談不生成數值
- **T15** [PASS] (UNIT, FIXTURE) MOE 技能 RQ 只有滿意度評量時偵測對齊問題並直達課程矩陣
- **T16** [PASS] (UNIT, FIXTURE) 兩類資助工作包/費用重疊提出比對與揭露需求，不自動多投

### C. 模板、時間與預算（T17–T24）
- **T17** [PASS] (UNIT, FIXTURE) 官方來源失敗顯示 FETCH_FAILED，不當成尚未公告
- **T18** [PASS] (UNIT, FIXTURE) 頁數/字數/附件/經費規則依適用來源版本映射
- **T19** [PASS] (UNIT, SIMULATED_FOR_PLANNING) 固定 mock 單價與數量經真實 budget engine 計算符合預期 ($120000+75500=195500$, 管理費 $19550$, 總額 $215050$)
- **T20** [PASS] (UNIT, SIMULATED_FOR_PLANNING) 缺單價保留 null/0、顯示部分總額與缺項，不謊報計算完成
- **T21** [PASS] (UNIT, FIXTURE) 第七階段計畫 N 與參數限制直接引用，不得錯用樣本單位或手填結果
- **T22** [PASS] (UNIT, FIXTURE) 工作包修改影響來源設計時建立 ChangeProposal，不在計畫書私改 RQ
- **T23** [PASS] (UNIT, FIXTURE) 申請前或執行前的倫理要求按 due_event 顯示，不全部延到核定後
- **T24** [PASS] (UNIT, FIXTURE) 未定正式日期使用相對時間或假設，不生成假學期或 18 週通用課程

### D. Evidence、引用與保護（T25–T32）
- **T25** [PASS] (UNIT, FIXTURE) 補理論/方法/Gap 證據走既有中心並帶 studio/section，能保存返回
- **T26** [PASS] (UNIT, MOCK) Consensus 等來源缺 credential 時 LIVE 標 BLOCKED，本地引用仍可用
- **T27** [PASS] (UNIT, FIXTURE) API 摘要/片段/全文與人工閱讀分開，同篇多來源不重算獨立支持
- **T28** [PASS] (UNIT, FIXTURE) CitationSource 與 Zotero library/item/version 對應正確不混用
- **T29** [PASS] (UNIT, MOCK) Zotero 斷線不刪合法本地引用，外部新版不直接覆蓋已鎖定解釋
- **T30** [PASS] (UNIT, FIXTURE) 外部文獻、本人課程證據、規劃計算分型，無 source 不自動補 DOI
- **T31** [PASS] (UNIT, FIXTURE) 含私人筆記、學生 PII 或其他專案全文之 SourcePack 被拒絕
- **T32** [PASS] (UNIT, FIXTURE) Result/sample/budget/citation protected reference 變更時阻止自動採用

### E. 一鍵協作、版本與可靠性（T33–T40）
- **T33** [PASS] (UNIT, FIXTURE) FILL_EMPTY 只補允許空白，每欄均有適用 Assist，結果欄不自由生成
- **T34** [PASS] (UNIT, FIXTURE) IMPROVE_UNLOCKED 不覆蓋鎖定及人工核准內容
- **T35** [PASS] (UNIT, FIXTURE) FILL_AND_LOCK 經授權可自動鎖定，但 actor 是 automation 且標待審
- **T36** [PASS] (UNIT, FIXTURE) AI 處理中人工修改或鎖定，遲到輸出存為候選不能覆蓋
- **T37** [PASS] (UNIT, FIXTURE) LLM 或 API 逾時/429/worker 重啟後可恢復，不重複扣費
- **T38** [PASS] (UNIT, FIXTURE) 已達 budget hard cap 停止付費任務，不自動切換新付費 provider
- **T39** [PASS] (UNIT, FIXTURE) 修改共享上游只讓真受影響段落標 OUTDATED，原 baseline 完整保留
- **T40** [PASS] (UNIT, FIXTURE) 來源包含 prompt injection 或惡意 URL 時不取得任意權限，驗證 revision

### F. 完成、匯出與下一步（T41–T48）
- **T41** [PASS] (UNIT, FIXTURE) 當前必要內容未完成顯示具體缺項，導航直達且保存返回
- **T42** [PASS] (UNIT, FIXTURE) 次要工作室、選填與正式簽署等晚期需求不錯阻主要初稿交接
- **T43** [PASS] (UNIT, FIXTURE) 儲存或加鎖不自動亮綠燈，完整初稿與條件式初稿、人工 review 分開
- **T44** [PASS] (UNIT, FIXTURE) 真實 Markdown/JSON 匯出存在、可重開，內容與 citation/source 一致
- **T45** [PASS] (INTEGRATION, FIXTURE) RouteWorkspaceSnapshot 具 JSON Schema、來源版本、預算與 next_actions
- **T46** [PASS] (UNIT, FIXTURE) 重複完成只建立一次 baseline/handoff，導航故障可重開同一接收頁
- **T47** [PASS] (INTEGRATION, FIXTURE) 第九階段（路線審查與倫理）接收契約完整，包含 nextActions 分流
- **T48** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸驗收，前七階段契約全數暢通
