# Phase 03 Attachment Requirements Matrix (Batch B)

Spec: v3.2.0 (V3-U03-R1) — docs/stage03/spec-v3-3.2.0.md
Verified date: 2026-09-06 (UTC). Environment: local repo + isolated logic tests.

## A1 Attachment Disposition Traceability

| 附件要求 | 本輪實作元件 | 狀態 | 驗證項目 |
|---|---|---|---|
| 新增 AI 能源管理、環境資源管理等專業 | `lib/research-profile-contract.ts`（6 軸版本化 Profile，能源關鍵詞進 query + coverage） | ✅ 契約通過 | `profile_six_axes`, `profile_energy_not_just_label` |
| 雷達三類：熱門／前沿新穎／跨領域複合 | `lib/opportunity-category-contract.ts`（HOT_TOPIC, EMERGING_FRONTIER, CROSS_DOMAIN 三分類＋多標籤＋唯一 ID 去重；idea_expansion_class 5/3/2 分離） | ✅ 契約通過 | `category_enum_three`, `dedup_unique_total`, `expansion_class_separate` |
| 一鍵靈感只需方向與目標 | `lib/one-click-inspiration-contract.ts` + `components/OneClickInspiration.tsx`（researchFocus 可為空，目標預設 AUTO，未填讀 Profile） | ✅ 既存/相容 | `parseOneClickInspirationRequest` 已允許空方向 |
| 預設 10 題、5/3/2 配置、Top 3、100 分 | `lib/opportunity-category-contract.ts`（ideaExpansionClass 3 分支）；`components/OneClickInspiration.tsx` | ✅ 既存/相容 | 5 核心延伸 / 3 跨域 / 2 前沿配置；不足不湊題契約支援 |
| 四個結果區塊 | `components/OneClickInspiration.tsx`（判斷、候選、Top推薦、下一步） | ✅ 既存（4 區塊在位） | ResultData / Panel 1-4 |
| 選題實驗室取消「沒有靈感」區塊 | `components/TopicLabFrontierRadar.tsx`（已無獨立發想表單，僅保留輕量 chips 導引靈感） | ✅ 既存驗收 | 無獨立發想後端，不刪除歷史候選 |
| 每日期刊熱門與新興方向推薦 | `lib/daily-digest-contract.ts`（DailyDigestSchedulePolicy，預設 enabled: false，Asia/Taipei，冪等鍵含 localDate，預算守衛） | ✅ 契約通過 | `digest_default_disabled`, `digest_tz_asia_taipei`, `digest_budget_guard` |
| Ai4Scholar 多源檢索及 API | `lib/federated-literature-adapters.ts` | ⏸ unknown 標記 | 待帳號文件/key 授權 |
| Consensus API | `lib/federated-literature-adapters.ts`（`/v1/search` 2026-09-06 LIVE 裁決通過，top-20，SJR 不冒充 JCR） | ✅ LIVE 驗證 | `consensus_search_live_verified` |
| 修正資料路徑（禁止跳過投稿導航） | 縱向：TopicSelectionSnapshot → SubmissionNavigator → SubmissionNavigationSnapshot → 研究藍圖 | ⏳ 批次 C 落地 | 橫向文獻中心共用，不作為第二主流程 |
| 「查看完整研究藍圖」按鈕修正 | 未核准前為「查看研究構想詳情／藍圖預覽」，不得稱正式藍圖已核准 | ⏳ 批次 C 落地 | P06 / T19 驗收 |
| 所有項目一鍵協助、鎖定及下一步 | 接入既有 Field/Section/StageAssist 與後端 StageActionBar | ⏳ 批次 C 落地 | 沿用 Stage 02 共用層 |

## 契約測試結果

- `scripts/verify-stage03-batch-b-contracts.ts`：**31/31 PASS**（0 網路、0 DB、0 新費用）。
- `npx tsc --noEmit`：**0 錯誤**。
- Commit：`ac50b4f`。
