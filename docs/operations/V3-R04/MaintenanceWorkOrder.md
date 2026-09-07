# MaintenanceWorkOrder：本次維護工作單與權限分層

## 1. 權限分層原則
嚴格區分五種維護權限模式，落實最小授權：
1. `SCOPED_OPERATIONAL_READ`：僅讀取系統運維 metadata、指標聚合、日誌狀態。嚴禁讀取私稿正文、未脫敏訪談或 Identity Vault。
2. `PROJECT_QUALITY_CHECK`：受限檢查指定授權專案之完整性與引用鏈。
3. `ISOLATED_REGRESSION`：在隔離測試沙盒中執行合成 fixture 回歸。
4. `ISOLATED_REPAIR`：在 staging/測試分支針對最小重現案例進行隔離修補。
5. `APPROVED_PRODUCTION_CHANGE`：需由真人持有明確核准書始得執行生產變更。

## 2. 本次工作單實例記錄
```json
{
  "workOrderId": "mwo_v3_r04_initial",
  "owner": "operator_lead",
  "scope": "SCOPED_OPERATIONAL_READ",
  "allowedProjectDocumentRefs": ["proj_real_first"],
  "windowStartUtc": "2026-09-06T11:24:59.000Z",
  "windowEndUtc": "2026-09-07T11:24:59.000Z",
  "allowedProviderOperations": [
    "DEEPL_READ",
    "CONSENSUS_SEARCH",
    "ZOTERO_READ"
  ],
  "maxExpenseCapUsd": 0.0,
  "scheduleState": "DRAFT_DISABLED",
  "validUntil": "2026-09-14T11:24:59.000Z",
  "isRevoked": false
}
```

## 3. 操作邊界約束
- **自動允許**：讀取營運指標、比對官方規則時效、檢查快照雜湊、在隔離環境執行回歸測試。
- **嚴格禁止**：
  * 禁止修改或覆寫原始研究資料（Raw Data）與事實記錄（Result Facts）。
  * 禁止代簽、代勾選研究者驗收或強制解除鎖定（User Lock）。
  * 禁止未經授權自動增加付費 Provider 呼叫或提高費用上限。
  * 禁止未經使用者最終確認執行投稿（Submission）、付款或對外發布。
