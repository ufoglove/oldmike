# V3-U17-FULL 60 項驗收測試報告（60-Item Acceptance Test Report）

**工程識別：V3-U17-FULL｜日期：2026-09-06｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage17-full-60-items.ts`（60 項，誠實分級）
**補充**：`scripts/verify-stage17-stage18-consumer-contract.ts`（U18 consumer，45 項）
**執行結果**：**60 / 60 PASS＋4 NOT_RUN（如實列明）＋ U18 consumer 45 / 45 PASS**

### A. 承接與上游 Gate（T01–T10）
- **T01** [PASS] (INTEGRATION, FIXTURE) 有效 U16 快照初始化及重開固定版本
- **T02** [PASS] (UNIT, FIXTURE) 上游 Gate mapping（SCIENTIFIC_REVISION_READY_FOR_LANGUAGE 不要求固定 v1/v2）
- **T03** [PASS] (UNIT, FIXTURE) 部分稿僅審准用範圍，不產生全稿核准
- **T04** [PASS] (UNIT, FIXTURE) 來源 hash 不符生成 stale Issue 不默換 latest
- **T05** [PASS] (INTEGRATION, FIXTURE) 三 Goal 對應語言任務（期刊譯英/國科會教學同語校正）
- **T06** [PASS] (UNIT, FIXTURE) 跨 Project 巢狀來源拒絕
- **T07** [PASS] (UNIT, FIXTURE) 同 Project 多 Manuscript 切換不覆蓋
- **T08** [PASS] (UNIT, FIXTURE) schema 未支援顯示明確錯誤
- **T09** [PASS] (UNIT, FIXTURE) 質性/技術稿不強制 TAM/H1/SEM
- **T10** [PASS] (UNIT, FIXTURE) 必審來源無法讀取標 NOT_ASSESSED/BLOCKED

### B. 語言範圍與工作單（T11–T20）
- **T11** [PASS] (UNIT, FIXTURE) Language Work Order 建立（task/source/target/scope/budget）
- **T12** [PASS] (UNIT, FIXTURE) full/partial 分開，partial 不自動升整稿
- **T13** [PASS] (UNIT, FIXTURE) 語言准用 scope refs 帶入
- **T14** [PASS] (UNIT, FIXTURE) scope 外章節被擋（LANGUAGE_SCOPE_NOT_AUTHORIZED）
- **T15** [PASS] (UNIT, FIXTURE) UTF-8 bytes 計量（不以中文字數當 bytes）
- **T16** [PASS] (UNIT, FIXTURE) 分段保留 section/paragraph 錨點
- **T17** [PASS] (UNIT, FIXTURE) 超長段落標記不直接送翻譯
- **T18** [PASS] (UNIT, FIXTURE) 語言保留原文鎖，不解鎖科學定稿
- **T19** [PASS] (UNIT, FIXTURE) 所有回寫需後端 scope 檢查
- **T20** [PASS] (UNIT, FIXTURE) 未經科學審查維持 LANGUAGE_ONLY/IMPORTED_UNVERIFIED

### C. 保真與語義（T21–T30）
- **T21** [PASS] (UNIT, FIXTURE) 數值/方向變化被 FATAL 阻擋
- **T22** [PASS] (UNIT, FIXTURE) 分母 N 變化被 FATAL 阻擋
- **T23** [PASS] (UNIT, FIXTURE) 未顯著改顯著被 FATAL 阻擋
- **T24** [PASS] (UNIT, FIXTURE) may→proved 因果強化被 FATAL 阻擋
- **T25** [PASS] (UNIT, FIXTURE) 時點遺失被標記
- **T26** [PASS] (UNIT, FIXTURE) 探索性分類遺失被標記
- **T27** [PASS] (UNIT, FIXTURE) 規劃 N 改已招募 N 不能 PASS
- **T28** [PASS] (UNIT, FIXTURE) 回譯/第二引擎僅輔助不等於真人驗證
- **T29** [PASS] (UNIT, FIXTURE) 源內容有科學疑慮回 U16（ScientificMeaningChangeRequest）
- **T30** [PASS] (UNIT, FIXTURE) 數值相同但兩組互換不能 PASS（GROUP_SWAPPED）

### D. 術語與 Provider（T31–T40）
- **T31** [PASS] (UNIT, FIXTURE) 鎖定術語一致性檢查
- **T32** [PASS] (UNIT, FIXTURE) 術語不符被標記
- **T33** [PASS] (UNIT, FIXTURE) TM 只重用已核准有效對照
- **T34** [PASS] (UNIT, FIXTURE) DeepL Translate 與 Write 分開
- **T35** [PASS] (UNIT, FIXTURE) 無 Live key 回報 NOT_CONFIGURED/BLOCKED，不假裝接通
- **T36** [PASS] (UNIT, FIXTURE) LanguageTool 公共免費端點不作自動批次後備
- **T37** [PASS] (UNIT, FIXTURE) Google/Azure 備援僅在符合 scope/region/費用時使用
- **T38** [PASS] (UNIT, FIXTURE) API key 只在 server
- **T39** [PASS] (UNIT, FIXTURE) 不默轉簡體，未支援明示
- **T40** [PASS] (UNIT, FIXTURE) provider capability manifest 完整列出

### E. QA、採用與鎖定（T41–T50）
- **T41** [PASS] (UNIT, SYNTHETIC_LANGUAGE_TEST) 數值 QA 通過時可採用
- **T42** [PASS] (UNIT, SYNTHETIC_LANGUAGE_TEST) citation QA 通過
- **T43** [PASS] (UNIT, SYNTHETIC_LANGUAGE_TEST) 術語 QA 通過
- **T44** [PASS] (UNIT, SYNTHETIC_LANGUAGE_TEST) 語義 QA 通過
- **T45** [PASS] (UNIT, SYNTHETIC_LANGUAGE_TEST) FATAL 保真問題使快照 BLOCKED（不被語言修飾掩蓋）
- **T46** [PASS] (UNIT, FIXTURE) 採用前後端重驗保真（FIDELITY_FATAL_ISSUE 阻擋）
- **T47** [PASS] (UNIT, FIXTURE) target 鎖不能被批次覆寫
- **T48** [PASS] (UNIT, FIXTURE) 遲到結果不覆蓋修改/取消/鎖定
- **T49** [PASS] (UNIT, SYNTHETIC_LANGUAGE_TEST) Important 語義裁決與完整釋出留真人
- **T50** [PASS] (UNIT, FIXTURE) 一次授權連續處理普通工作，不每段確認

### F. 交接與無斷層（T51–T60）
- **T51** [PASS] (UNIT, FIXTURE) 缺失直達正確稿件/頁籤/段落/provider/上游
- **T52** [PASS] (UNIT, FIXTURE) 補完提供「保存並返回翻譯與學術潤稿」
- **T53** [PASS] (INTEGRATION, FIXTURE) LanguageQualitySnapshot 具 schema/manifest/U18 consumer test
- **T54** [PASS] (UNIT, FIXTURE) 完成交易導航失敗可重開同 snapshot
- **T55** [PASS] (UNIT, FIXTURE) ReadyForLanguage 不要求 U18/送件/全作者同意先完成
- **T56** [PASS] (UNIT, FIXTURE) 只完成局部不點亮整稿完成
- **T57** [PASS] (INTEGRATION, FIXTURE) U18 未建置有真實接收頁
- **T58** [PASS] (UNIT, FIXTURE) 接收頁 reEntryPoint 回 U17 不循環
- **T59** [PASS] (UNIT, FIXTURE) 語言版就緒≠正式送件/期刊接受
- **T60** [PASS] (INTEGRATION, FIXTURE) 完成本階段回歸（前十六階段契約全數暢通）

### NOT_RUN（如實列明，非通過）
- **N1** Live DeepL Translate/Write 實測 — 無 Live key（DEEPL_API_KEY 未配置）→ NOT_CONFIGURED；本地規則保真檢查已實作。
- **N2** Live LanguageTool 批次 — 自架 LT_BASE_URL 未配置；公共免費端點不作自動化批次後備。
- **N3** DOCX/PDF/LaTeX round-trip 匯出 — 本輪提供 JSON/manifest/markdown 真實匯出；其餘格式 UNSUPPORTED。
- **N4** UI 深度整合（LanguageQualityCenter 表單、一鍵主按鈕）— 本輪完成契約/服務/API；UI 整合為後續輪次。

### 環境與誠實標記
- 全部測試於本地安全開發容器（`/home/node/dev/repo`），環境：FIXTURE／SYNTHETIC_LANGUAGE_TEST。
- fixture 通過不代表真實稿件已翻譯或潤稿完成。
- `npx tsc --noEmit`：0 errors；回歸：U16（60/60）、U15（60/60）、U14（60/60）、U13（48/48）。
