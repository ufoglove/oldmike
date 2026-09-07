# KnownIssues：待觀測事項與真人確認待辦

## 1. 待觀測事項 (Pending Observation Items)
1. `PENDING_OBSERVATION_7D_WINDOW`：
   - **現狀**：當前僅能取得 24 小時之真實營運事件。
   - **處置**：維持現況，不捏造 7 天趨勢。後續將隨日常使用累積事件，定期滾動更新。
2. `INSUFFICIENT_OBSERVATION_TASK_RESUME`：
   - **現狀**：觀察期間無任務異常中斷，中斷恢復指標樣本數為 0。
   - **處置**：指標數值標記為 `null` (N/A)，狀態標記為 `INSUFFICIENT_OBSERVATION`。

## 2. 真人確認與科研延續事項 (Remaining Research Actions)
1. `PENDING_FINAL_ACCEPTANCE`：
   - **事項**：首件真實產物（研究計畫草稿）待有權研究者進行最終學術審閱與滿意度確認。
   - **處置**：本輪結束後保留於專案待辦中，不以 AI 自評強制閉環。
2. `CONTINUE_RESEARCH_ON_USER_CADENCE`：
   - **事項**：後續之研究進度、正式送件、計畫結案、論文投稿等，完全依使用者自身節奏進行。
   - **處置**：R04 營運維護交接完成後立即停止，系統不自動建立 R05 或任何新的必經工程階段。
