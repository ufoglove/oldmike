# V3-U16-FULL 第十六階段「老麥科學內容審查、Reviewer #2壓力測試與逐項修訂」交付說明

## 1. 本輪任務與終點
- **規格基準**：`docs/stage16/spec-v3-4.0.md`（依使用者 Telegram 訊息內文收錄）。
- **接收**：第十五階段 `ManuscriptWritingSnapshot`（上游 Gate：`MANUSCRIPT_SCIENTIFIC_DRAFT_READY_FOR_REVIEW`；規劃模式 `WRITING_SCOPE_AND_SOURCES_READY` 阻擋正式審查）。
- **交付**：`ScientificReviewSnapshot` → 第十七階段「翻譯與學術潤稿」（`translation-polish`）。
- **停止邊界**：不重跑統計、不改 Raw／Result Facts、不重建完整翻譯、最終格式、正式投稿或外部審稿回覆。

## 2. 新增檔案與能力
| 檔案 | 內容 |
|---|---|
| `lib/scientific-review-v3-contract.ts` | ReviewWorkOrder、ScientificFinding（含 basis／替代解釋／最小修正路徑／查證狀態／去重）、RevisionProposal、ReReviewDecision、MeaningConstraint、UpstreamReviewRequest、ScientificReviewSnapshot、Stage17ReceiverState |
| `lib/scientific-review-v3-service.ts` | 承接 U15（零重複輸入）、機械 QA、Reviewer #2 建設性挑戰（確定性、證據+替代解釋+最小路徑、不強迫大樣本 RCT）、Finding 去重、Author Response Matrix、重審決策（達上限保留未解，不強制 PASS）、Meaning Constraints 檢查、快照與 U17 receiver 建構 |
| `app/api/projects/[id]/scientific-review-v3/initialize` | 冪等初始化（body 或 DB 讀 U15 快照）＋ ACL＋規劃模式阻擋 |
| `app/api/projects/[id]/scientific-review-v3/reviewer2` | Reviewer #2 挑戰生成（SIMULATED）＋去重＋約束 |
| `app/api/projects/[id]/scientific-review-v3/findings` | Finding／修訂／上游回送薄驗證層 |
| `app/api/projects/[id]/scientific-review-v3/respond` | 作者裁決＋回覆（可有據不同意；ACCEPTED_RISK 不能解除虛構/無權/過期） |
| `app/api/projects/[id]/scientific-review-v3/re-review` | 重審裁決（CLOSED_WITH_UNRESOLVED） |
| `app/api/projects/[id]/scientific-review-v3/complete` | 機械 QA＋Response Matrix＋重審＋Meaning Constraints 檢查＋快照建構＋持久化（stage_id=`scientific-review`）＋U17 receiver |
| `app/api/projects/[id]/scientific-review-v3/export` | 真實匯出（json／findings-manifest／meaning-constraints／qa-report／markdown），其餘 UNSUPPORTED |
| `app/api/projects/[id]/scientific-review-v3/receiver` | U17 可重開接收頁（不空白、不循環 Gate） |
| `scripts/verify-stage16-full-60-items.ts` | 60 項驗收（60/60 PASS＋3 NOT_RUN） |
| `scripts/verify-stage16-stage17-consumer-contract.ts` | U17 consumer contract（38/38 PASS） |

## 3. 資料流
```
ManuscriptWritingSnapshot (stage_completion_snapshots, stage_id='results-writing')
  → POST …/scientific-review-v3/initialize（ACL + planning gate）
  → POST …/scientific-review-v3/reviewer2（SIMULATED challenges, de-dup, constraints）
  → POST …/findings / respond / re-review（裁決、修訂、回送、重審）
  → POST …/complete（mechanical QA + Response Matrix + meaning constraints + snapshot）
  → ScientificReviewSnapshot（stage_completion_snapshots, stage_id='scientific-review', nextStageId='translation-polish'）
  → GET …/receiver（U17 fallback，可重開返回）
  → GET …/export（json/manifest/constraints/qa/markdown）
```

## 4. 誠實標記
- 所有 AI 審查輸出標 `SIMULATED REVIEW`；多角色為多角度模擬，非真人獨立驗證。
- Reviewer #2 本輪為**確定性規則引擎**；接 OpenClaw LLM 之 live adapter 為 NOT_RUN。
- DOCX/PDF/LaTeX/Live Fields 匯出 UNSUPPORTED（如實標示）。
- UI 深度整合（ScientificReviewCenter 表單、重審流程、主按鈕）為後續輪次（NOT_RUN）。
- 未部署 Zeabur、未跑正式 DB migration；正式部署另取授權。

## 5. 回滾
- 本輪新增檔案全為獨立新檔（`scientific-review-v3/*`、`lib/scientific-review-v3-*`、`scripts/verify-stage16*`），未修改既有 `scientific-review` 模組或既有資料表；回滾＝移除上述新檔即可，不影響前十五階段。
