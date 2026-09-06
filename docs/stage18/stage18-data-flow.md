# V3-U18-FULL 第十八階段「目標期刊／計畫最終合規、送件文件與成果包」交付說明

**規格基準**：`docs/stage18/spec-v3-4.0.md`（依使用者 Telegram 訊息內文八節收錄）
**接收**：第十七階段 `LanguageQualitySnapshot`（上游 Gate：`LANGUAGE_EDITION_READY_FOR_FINAL_COMPLIANCE`；`USE_BLOCKED`／`SOURCE_STALE` 阻擋合規）
**交付**：`FinalSubmissionPackageSnapshot` → 第十九階段「正式送件與審查追蹤」（`submission-tracking`）

## 新增檔案與能力
| 檔案 | 內容 |
|---|---|
| `lib/final-submission-v3-contract.ts` | SubmissionRoute、JournalProfile／NstcProfile／MoeTprProfile、OfficialRuleSnapshot、PackageDocument、ApprovalSubjectManifest、AuthorApprovalRecord、PackageReadiness、FinalSubmissionPackageSnapshot、Stage19ReceiverState、17 個錯誤碼 |
| `lib/final-submission-v3-service.ts` | 承接 U17（零重複輸入）、三路線 profile、scope gate（partial 僅預檢）、規則快照（來源/hash，不填未查證 APC/截止日）、衍生文件 + renderer gate（DOCX/PDF/LaTeX 如實 UNSUPPORTED）、匿名化 QA（metadata/註解/修訂，不只刪第一頁姓名）、References QA、ApprovalSubjectManifest（hash 不含 approval 事件，避免循環）、approve digest、freeze→confirm→lock、FinalSubmissionPackageSnapshot + Stage 19 receiver |
| API `final-submission-v3/*` | initialize／check／approve／freeze／lock／complete／export／receiver（8 路由，ACL＋body/DB 讀取＋scope 強制＋freeze/approval/lock 循環） |
| `scripts/verify-stage18-full-66-items.ts` | **66 項驗收（66/66 PASS＋3 NOT_RUN）** |
| `scripts/verify-stage18-stage19-consumer-contract.ts` | U19 consumer contract（**44/44 PASS**） |

## 關鍵誠信機制
- **ApprovalSubjectManifest**：先 render/QA/freeze 建立不含 approval 事件的 hash，再收確認，最後鎖包（避免 hash 循環）。
- **核准綁定 digest**：文稿/附件/作者/聲明改動後舊核准不得沿用新 bytes。
- **通訊作者轉述 ≠ 每位作者親自點擊**；CRediT 不決定作者資格；COI 空白不自動填「無」。
- **submission_execution_authorized=false 恆定**；READY_FOR_AUTHOR_SUBMISSION／READY_FOR_INSTITUTIONAL_REVIEW／SUBMISSION 均不等於 SUBMITTED 或官方核准。
- **匿名化**：掃 metadata、註解、修訂、表圖、附件，不只刪第一頁姓名。
- **規則**：官方規則保存來源/條文/年度/版本/hash；來源讀不到不是尚未公告；不填未查證 APC/索引/截止日。

## 誠實標記
- DOCX/PDF/LaTeX renderer 未具備時如實標 UNSUPPORTED，不以 Markdown 冒稱可送件。
- 靜態 References 不冒充 Zotero Word 動態欄位。
- 未部署 Zeabur、未跑正式 DB migration；fixture ≠ 真實稿件已合規或已送件。
- 本輪不自動登入、遠端填表、寄信、付 APC、上傳 repository、代簽或真正送件。

## 回滾
全部為新增檔（`final-submission-v3/*`、`lib/final-submission-v3-*`、`scripts/verify-stage18*`、`docs/stage18/`）；未修改既有 `journal-submission`／`route-review-compliance`／`proposal-studio`／`application-package` 模組、未改既有資料表。回滾＝移除新檔即可。