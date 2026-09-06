# V3-U18-FULL 66 項驗收測試報告（66-Item Acceptance Test Report）

**工程識別：V3-U18-FULL｜日期：2026-09-06/07｜版本：v3.4.0**
**測試腳本**：`scripts/verify-stage18-full-66-items.ts`（66 項，誠實分級）
**補充**：`scripts/verify-stage18-stage19-consumer-contract.ts`（U19 consumer，44 項）
**執行結果**：**66 / 66 PASS＋3 NOT_RUN（如實列明）＋ U19 consumer 44 / 44 PASS**

### A. 承接與上游 Gate（T01–T11）
- T01 [PASS] 有效 U17 快照初始化與重開固定版本
- T02 [PASS] 正式 Gate：LANGUAGE_EDITION_READY_FOR_FINAL_COMPLIANCE
- T03 [PASS] 局部語言僅預檢，不自動變完整科學核准
- T04 [PASS] formal_compliance_allowed 與 compliance scope 帶入
- T05 [PASS] 三路線 profile 各自建立（JOURNAL/NSTC/MOE）
- T06 [PASS] MOE 不回退成期刊模板
- T07 [PASS] 來源 hash 固定性
- T08 [PASS] language release state USE_BLOCKED/SOURCE_STALE 不得進合規
- T09 [PASS] 計畫書不要求先有 Results（adapter）
- T10 [PASS] 原接收頁升級為工作區保留來源
- T11 [PASS] submission_execution_authorized 恆 false

### B. 三路線與規則（T12–T22）
- T12 [PASS] 期刊含主稿/Title Page/Cover Letter/Checklist
- T13 [PASS] NSTC 包不含期刊 Cover Letter
- T14 [PASS] MOE 包保留課程/評量/聲明/校內程序
- T15 [PASS] 規則保存來源/條文/年度/版本/hash
- T16 [PASS] 來源讀不到不是尚未公告；舊年度只作明標參考
- T17 [PASS] 不填未查證 APC/索引/截止日
- T18 [PASS] 三路線要求矩陣分開
- T19 [PASS] 適用執行前要求不循環阻擋起草
- T20 [PASS] 已需文件不能藉晚期待辦略過
- T21 [PASS] 官方規則來源 hash 可追溯
- T22 [PASS] 不跨幣別無來源加總

### C. 文件與格式（T23–T33）
- T23 [PASS] 候選文件先 render/QA/freeze 再核准
- T24 [PASS] 格式轉換建立新 edition，原稿與 Facts 不變
- T25 [PASS] Markdown 真實可用
- T26 [PASS] DOCX 無 renderer 標 UNSUPPORTED 不以 Markdown 冒稱送件
- T27 [PASS] PDF/LaTeX 缺 renderer 如實標示
- T28 [PASS] 數值/N/方向/時點/否定/限制/引用原意不因格式轉換改變
- T29 [PASS] 需科學變更回 U16、語言回 U17、預算/課程回 U08
- T30 [PASS] 文件有 filename/format/hash/bytes 欄位
- T31 [PASS] Reviewer-visible/editor-only/institution 資料分開
- T32 [PASS] 內部 Reviewer 報告/Raw/Identity Vault 不自動打包外傳
- T33 [PASS] AI 與圖像揭露按實際目標用途核對

### D. 匿名、聲明與核准（T34–T44）
- T34 [PASS] 匿名化掃 metadata/註解/修訂/表圖/附件，不只刪第一頁姓名
- T35 [PASS] 乾淨內容匿名化 QA 通過
- T36 [PASS] References 佔位被偵測
- T37 [PASS] 靜態 References 不冒充 Zotero Word 動態欄位
- T38 [PASS] CRediT 不決定作者資格；ORCID 格式不等於身份認證
- T39 [PASS] COI/funding/exclusive 空白不自動填「無」
- T40 [PASS] 核准綁定具體檔案 digest
- T41 [PASS] 通訊作者轉述不得冒充每位作者親自點擊
- T42 [PASS] 文稿/附件/作者/聲明改動後舊核准不得沿用新 bytes
- T43 [PASS] ApprovalSubjectManifest 不含 approval 事件（hash 無循環）
- T44 [PASS] 真人確認綁定固定檔案版本後才 Package Lock

### E. QA、Freeze/Lock 與匯出（T45–T55）
- T45 [PASS] freeze 缺內容回 DOCUMENT_HASH_MISMATCH
- T46 [PASS] render QA 缺 renderer 時 FAIL
- T47 [PASS] 快照需 lock 才能 READY
- T48 [PASS] QA 全過+lock → READY_FOR_AUTHOR_SUBMISSION
- T49 [PASS] NSTC 就緒種類為校內送件（非期刊送件）
- T50 [PASS] submission_execution_authorized=false 全快照
- T51 [PASS] 匯出真實存在（JSON/manifest/approval/QA/markdown）
- T52 [PASS] 未支援格式標 EXPORT_FORMAT_UNSUPPORTED
- T53 [PASS] 引用/公式/頁數/溢出做 render 與 round-trip QA
- T54 [PASS] 下載有 bytes/hash/manifest/download ACL
- T55 [PASS] 輸出失敗有重試入口，不生成假 URL

### F. 交接與誠信（T56–T66）
- T56 [PASS] FinalSubmissionPackageSnapshot 具 schema/manifest/U19 consumer test
- T57 [PASS] U19 未建置有真實接收頁
- T58 [PASS] 接收頁 reEntryPoint 回 U18 不循環
- T59 [PASS] 保存成功跳轉失敗可重開同 snapshot
- T60 [PASS] READY 不等於 SUBMITTED/官方核准
- T61 [PASS] 完整綠勾只表示指定成果包完成
- T62 [PASS] 局部語言完成不點亮全稿/送件
- T63 [PASS] fixture 通過不代表真實稿件已合規或已送件
- T64 [PASS] 完成交易原子保存（DB 不可用如實回報）
- T65 [PASS] 多 Project ACL 與 hash 衝突拒絕
- T66 [PASS] 完成本階段回歸（前十七階段契約全數暢通）

### NOT_RUN（如實列明，非通過）
- **N1** 真實 DOCX/PDF/LaTeX renderer round-trip — 本輪無可靠 renderer；如實標 UNSUPPORTED，不以 Markdown 冒稱可送件。
- **N2** 目標期刊/NSTC/MOE 官方規則即時重驗 — 規則來源依官方文件核對後填入；本輪保留待官方來源（如實標註）。
- **N3** UI 深度整合（FinalComplianceCenter 表單、一鍵主按鈕）— 本輪完成契約/服務/API；UI 整合為後續輪次。

### 環境與誠實標記
- 全部測試於本地安全開發容器（`/home/node/dev/repo`），環境：FIXTURE／SYNTHETIC_PACKAGE_TEST。
- fixture 通過不代表真實稿件已合規或已送件。
- `npx tsc --noEmit`：0 errors；回歸：U17（66/60+6）、U16（60）、U15（60）、U14（60）、U13（48）。