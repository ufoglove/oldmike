# ProviderAndSourceImpactPolicy：外部供應商、文獻與官方規則維護政策

## 1. 外部 Provider 能力與錯誤分流
- **分級狀態**：`UNCONFIGURED` $\to$ `CONFIGURED` $\to$ `HEALTH_REACHABLE` $\to$ `OPERATION_AUTHORIZED` $\to$ `REAL_OP_VERIFIED`。
  * Health check 通過不等於具備全文翻譯或收費檢索權限。
- **DeepL 錯誤分類標準**（遵循官方最佳實踐）：
  * `429 Too Many Requests`：請求節流，啟動指數退避（Backoff with Jitter）。
  * `456 Quota Exceeded`：配額用盡，**立即停止計費請求**，保存工作進度並通知管理員。嚴禁自動換用其他付費引擎或自動提高額度。
  * `500/503 Service Unavailable`：暫時服務中斷，依 Retry-After 進行有限重試。
- **非等價降級限制**：若無等價且獲授權之備援 Provider，系統保留局部草稿並標示缺失，不可默認改用未經審核之替代模型。

## 2. 文獻中心與 Zotero 變更影響
- **文獻中心唯一性**：文獻中心為唯一學術來源庫，Consensus 等整合沿用既有 adapter，不重搜全網。
- **Zotero 更新比對**：
  * 當來源更新時標記 `SOURCE_UPDATE_AVAILABLE`。
  * 區分「純 Metadata 變更（如頁碼更正）」與「結論/主張變更（Claim-relevant）」。
  * 結論變更僅標記相關草稿段落為 `REVALIDATION_REQUIRED`，**嚴禁靜默覆寫已核准或已送出之歷史版本**。
- **斷線與撤權嚴格區分**：
  * **暫時斷線**：保留本地已安全儲存之合法副本，不刪除成果。
  * **明確撤權**：立即限制後續讀取與匯出，嚴禁用本機快取（Cache）繞過撤權限制。

## 3. 官方徵件與法規時效維護
- **時效檢查政策**：
  * 針對本案適用之目標、年度與機構維護優先清單，避免爬取無關期刊。
  * 區分 `SOURCE_UNAVAILABLE`、`NOT_ANNOUNCED`、`SUPERSEDED` 與 `CONFLICTING`。
  * 嚴禁用他校徵件截止日冒充本校；日期無具體時刻時保留不確定性，不假定為 23:59。
- **阻擋動作分級**：
  * 未確認官方格式時，阻擋最終送件打包，但允許研究者起草。
  * 倫理審查（IRB）過期時，阻擋新增受試者收集，但不刪除歷史資料。
