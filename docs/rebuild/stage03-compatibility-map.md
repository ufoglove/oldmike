# Stage03 Compatibility Map (V3-U03-FULL, spec v3.4.0)

Anchor: `docs/stage03/spec-v3-4.0.md` (63.7KB). Prepared 2026-09-06.
Mapping is based on real repository inspection, NOT on "stage reported complete".

## 既有已符合（不重做）
| v3.4 要求 | 既有實作 | 狀態 |
|---|---|---|
| ResearchGoalRegistry 三目標 | lib/research-goal-registry.ts (JOURNAL_SCI_SSCI/NSTC_GENERAL/MOE_TPR) | ✅ 已有 |
| MOE_TPR 一鍵靈感可見 | one-click RESEARCH_GOALS 已含 MOE_TPR | ✅ 已有 (dcb95a5) |
| 首頁流程燈號/目標切換 | ResearchWorkflowLightPanel.tsx + ResearchPathRoadmap.tsx | ✅ 已有 (2b95437/366d17d) |
| 投稿導航 UI | SubmissionNavigatorStudio.tsx (395行, 7 tabs) | ✅ 已有(v2世代) |
| 導航 job 執行 | submission-navigator route POST→run→save→structured | ✅ 已有 |
| 7 大文獻 API | Consensus/S2/OpenAlex/Crossref/arXiv/Zotero/Ai4Scholar 全 LIVE adapter | ✅ 已有 |
| 能力矩陣/去重 | federated-literature-contract.ts (13×7, canonical dedup) | ✅ 已有 |
| 三路線引擎契約 | submission-navigation-engines-contract.ts | ✅ 已有(契約層) |
| 投稿指紋契約 | submission-fingerprint-contract.ts | ✅ 已有(契約層) |
| OfficialRuleSnapshot 契約 | submission-navigation-engines-contract.ts §OfficialRuleSnapshot | ✅ 已有(契約層) |
| 評分覆蓋(不放大100/未知非0) | computeMatchScore() | ✅ 已有(契約層) |
| 可重用 stage 承接 | stage-operation route/repo → stage_completion_snapshots | ✅ 已有 |

## 真實缺口（本規格核心增量，尚未落地）
| v3.4 § | 要求 | 目前缺 | 影響 |
|---|---|---|---|
| §6/§24/§28 | **從第二階段 TopicSelectionSnapshot 初始化導航** | 選題採納(adoptTopicLabDraft)不會自動建立 navigation context/讀取 scs_* 快照；navigator 目前靠手填 topicProfile | T01/T02/T06 未達標 |
| §24/§30 | **SubmissionNavigationSnapshot 真正持久化**(不可變、冪等、工程契約) | buildSubmissionNavigationSnapshot 只在契約層；無 route 將完整 navigation 決策寫入可重放快照 | 第四階段無法可靠接手(T36/T37/T48) |
| §23/§24 | **導航完成→提交 HANDOFF / blueprint 交接接收頁** | navigator runMatch 產出 output 但未經 stage-operation COMMIT 成 snapshot; blueprint 為既有 Studio(非新接收頁) | §7「完成導航前進藍圖」斷層 |
| §6 | **初始化冪等 + 防重複建立 NavigationContext** | 無 navigation/initialize route | T02 |
| A 批次 | 前兩階段→第三階段最小端到端 | 有 v2 navigator 但未綁 TopicSelectionSnapshot | 主流程斷層 |

## 誠實結論
v3.2/v3.3 建立了**契約層**與大量元件；v3.4 要求「從零建立投稿導航並承接」的**持久化資料鏈(TopicSnapshot→Fingerprint→Decision→SubmissionNavigationSnapshot→Blueprint handoff)尚未真正落地**。這是本輪批次 A–C 的核心工程。

## 建議
批次 A：新增 `navigation/initialize` route→由 stage_completion_snapshots 讀 topic snapshot→建 fingerprint；批次 C：`navigation/complete`→原子寫 SubmissionNavigationSnapshot＋stage completion＋handoff；批次 D：48 項驗收分類＋交付 8 文件。
