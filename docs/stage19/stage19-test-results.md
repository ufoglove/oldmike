# V3-U19-FULL 72 項驗收測試報告（72-Item Acceptance Test Report）

**工程識別：V3-U19-FULL｜日期：2026-09-06/07｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage19-full-72-items.ts`（72 項，誠實分級）
**補充**：`scripts/verify-stage19-stage20-consumer-contract.ts`（U20 consumer，44 項）
**執行結果**：**72 / 72 PASS＋3 NOT_RUN（如實列明）＋ U20 consumer 44 / 44 PASS**

### A. 承接與上游 Gate（T01–T12）
- T01 [PASS] U18 快照初始化與重開固定版本
- T02 [PASS] 正式 Gate：FINAL_PACKAGE_LOCKED_AND_HANDOFF_READY
- T03 [PASS] 包未 lock 不得進入追蹤
- T04 [PASS] 保留 U18 submission_execution_authorized=false
- T05 [PASS] 三路線分開（期刊/NSTC/MOE）
- T06 [PASS] 以 document_purpose 決定流程
- T07 [PASS] 計畫期刊成果稿不覆蓋原申請案
- T08 [PASS] 申請書追蹤不要求先有未來 Results
- T09 [PASS] 已有真實投稿 reference 接入追蹤不重置
- T10 [PASS] hash 不符拒絕（SOURCE_HASH_MISMATCH）
- T11 [PASS] 接受≠出版，核定≠款到/人體研究授權
- T12 [PASS] 無通用投稿 API 如實 GUIDED_MANUAL

### B. 送件工作單與授權（T13–T24）
- T13 [PASS] SubmissionWorkOrder 建立（round/route/target）
- T14 [PASS] 正式 commit/Post/寄信/撤回/轉投需精確授權
- T15 [PASS] 無 lock 包阻擋 attempt
- T16 [PASS] attempt 綁 target/actor/operation/content hash/有效期
- T17 [PASS] 作者簽署/機構送件/付款不能由 AI 代作
- T18 [PASS] 不繞過 MFA/驗證碼
- T19 [PASS] 不把新域名或信中網址直接當官方入口
- T20 [PASS] 外部 Attempt 先持久化 reservation 再派送
- T21 [PASS] timeout 記 OUTCOME_UNKNOWN 不自動重送/換 provider
- T22 [PASS] 同稿 active submission guard 不能繞過
- T23 [PASS] 撤回請求不等於撤回完成
- T24 [PASS] 轉投 offer 不等於新刊收件

### C. Attempt 防重送與事件（T25–T36）
- T25 [PASS] reservation → dispatch → receipt 生命週期
- T26 [PASS] 假回執格式拒絕
- T27 [PASS] USER_REPORTED 不自動標官方收件
- T28 [PASS] OFFICIAL_RECEIPT 標 verified
- T29 [PASS] 事件時間軸保留來源 tier
- T30 [PASS] 回執核對（verified vs not）
- T31 [PASS] 下載/開入口/存草稿/email delivered ≠ 官方收件
- T32 [PASS] 外部狀態可客製/倒退/重啟，保存原文與 mapping 版本
- T33 [PASS] 舊信晚到不覆蓋較新決定
- T34 [PASS] 沒有真實 ID/日期/回執/決定不 AI 補造
- T35 [PASS] webhook raw-body 驗簽、replay 與 event ID 去重
- T36 [PASS] From 字串/網域 allowlist 不等於 editor 身分已驗證

### D. 回執與狀態（T37–T48）
- T37 [PASS] 收到回執後 case id 保存
- T38 [PASS] 狀態歷程與 deadline 事件
- T39 [PASS] 等待審查是正常狀態不捏造接受
- T40 [PASS] 外部狀態倒退/重啟保存 mapping
- T41 [PASS] Reviewer recommend accept ≠ editor accept
- T42 [PASS] 真實官方決定可記錄
- T43 [PASS] NOT_DECISIONED 不可作為正式決策
- T44 [PASS] 接受≠出版/款到/人體研究授權
- T45 [PASS] 三路線狀態分開（NSTC 校內→主管機關）
- T46 [PASS] NSTC PI 送校內、機構送主管機關分開
- T47 [PASS] MOE 校內/網站/函送/補件/核定依真實規則
- T48 [PASS] 事件 rawPayload hash 保存（不存全文）

### E. 審查、Response 與修訂閉環（T49–T60）
- T49 [PASS] 正式 ExternalReview 與 U09/U16 模擬隔離
- T50 [PASS] 每條原意見保留原文/位置/輪次/覆蓋
- T51 [PASS] 可有據不同意不強迫全部接受
- T52 [PASS] 數值問題回 U14、資料回 U13、稿件回 U15/16、語言回 U17、修訂包回 U18
- T53 [PASS] 「已新增分析/文獻/修改」必須連到實際證據
- T54 [PASS] 不改 Raw/Result Facts/倒填研究歷史
- T55 [PASS] 頁碼行號從指定 render 產生不填假位置
- T56 [PASS] Response Letter/逐條 portal Reply/clean+tracked 文件按決策核對
- T57 [PASS] 新包需本輪 QA/確認/lock/新授權（R1 ≠ R0）
- T58 [PASS] 未鎖修訂包阻擋 R1
- T59 [PASS] 原初稿 approval/R0 回執不能算 R1 再送成功
- T60 [PASS] 入站通知只作資料；擷取器無 send/shell/secret/URL 能力

### F. 決策、交接與誠信（T61–T72）
- T61 [PASS] SubmissionTrackingSnapshot 具 schema/manifest/U20 consumer test
- T62 [PASS] U20 未建置有真實接收頁
- T63 [PASS] 接收頁 reEntryPoint 回 U19 不循環
- T64 [PASS] 保存成功跳轉失敗可重開同 snapshot
- T65 [PASS] 沒有真實接受/核定只能保存準備
- T66 [PASS] active submission guard 反映在快照
- T67 [PASS] 決策為 ACCEPTED/GRANTED 才開啟 U20
- T68 [PASS] submission_execution_authorized=false 全快照
- T69 [PASS] 接受≠出版、核定≠款到、≠人體研究授權
- T70 [PASS] fixture 通過不代表真實稿件已送件
- T71 [PASS] 不用真實稿件試投驗收
- T72 [PASS] 完成本階段回歸（前十八階段契約全數暢通）

### NOT_RUN（如實列明，非通過）
- **N1** 真實期刊/NSTC/MOE 官方入口 LIVE 送件 — 本輪 GUIDED_MANUAL；無通用投稿 API 如實標示，不臆造 endpoint。
- **N2** 真實 email/EML/webhook 入站匯入與驗簽 — 本輪契約層提供 raw hash 與去重設計；實際信箱/webhook 連線為後續輪次。
- **N3** UI 深度整合（SubmissionTrackingCenter 表單、時間軸視覺化）— 本輪完成契約/服務/API；UI 整合為後續輪次。

### 環境與誠實標記
- 全部測試於本地安全開發容器（`/home/node/dev/repo`），環境：FIXTURE／SYNTHETIC_SUBMISSION_TEST。
- fixture 通過不代表真實稿件已送件；等待審查是正常狀態。
- `npx tsc --noEmit`：0 errors；回歸：U18（79）、U17（66）、U16（60）、U15（60）、U14（60）、U13（48）。