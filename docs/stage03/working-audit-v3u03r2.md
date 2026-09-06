# V3-U03-R2 開工盤點（2026-09-06，規格基準 docs/stage03/spec-v3-3.3.0.md）

## 核心發現：三目標缺單一來源（規格 §2/§4 確認為真實缺口）
| 位置 | 現有 enum | 問題 |
|---|---|---|
| lib/research-config.ts `outputTrackIds` | NSTC, MOE, SCI, SSCI | 舊四軌；MOE≠MOE_TPR 語意；SCI/SSCI 分離但缺「JOURNAL_SCI_SSCI」合併目標 |
| lib/one-click-inspiration-contract.ts `RESEARCH_GOALS` | AUTO, JOURNAL, SSCI, NSTC, THREE_YEAR | **缺 MOE_TPR**；JOURNAL/SSCI 語意與三目標不合；THREE_YEAR 是時程非目標 |
| components/OneClickInspiration.tsx (前端手寫) | AUTO/JOURNAL/SSCI/NSTC/THREE_YEAR | **第二份獨立陣列**（違反 §2 單一來源） |
| lib/submission-fingerprint-contract.ts `FUNDING_INTENTS` | NSTC_GENERAL, MOE_TPR, NONE, UNDECIDED | ✅ 已有正確 funding 軸（V3-U03-R1） |
| lib/submission-navigation-engines-contract.ts | NSTC_GENERAL / MOE_TPR / JOURNAL | ✅ 已有三路線引擎契約（V3-U03-R1） |

## 可重用（不重建）
- Stage-02 共用層：StageActionBar / RequirementIssuePanel / FieldAssist / FieldLock / stage-operation route + repo / generic-stage-adapter
- V3-U03-R1：三路線契約（Journal/NSTC/MOE TPR candidate）、SubmissionFingerprintVersion、SubmissionNavigationSnapshot、OfficialRuleSnapshot、7 大文獻 API adapter（Consensus/S2/OpenAlex/Crossref/arXiv/Zotero/Ai4Scholar 全 LIVE）、能力矩陣、Profile 六軸、DailyDigest 政策、雷達三分類
- AgentJob (0031)、home overview (V3-HOME-02)
- submission-navigator v1/v2 + journal-submission + 舊 outputTracks UI（需遷移至三目標）

## 各批次缺口初判
| 批次 | 範圍 | 主要缺口 |
|---|---|---|
| A | 三目標修復及遷移 | ResearchGoalRegistry 不存在；多處 enum/前端陣列需收斂；GoalContext 契約需新建；舊值(raw_legacy_value)遷移 |
| B | 首頁流程圖與 Readiness | 首頁 renderOverview 有 ResearchPathOverview，但缺「三路線 workflow 亮燈圖」、8 狀態燈號、雙視圖 |
| C | 全站 Assist/Orchestrator/投稿導航 | Orchestrator 不存在（需在 AgentJob 上擴充）；Assist coverage 表需建立；三模板 prompt |
| D | 三路線端到端 + 40 項驗收 | 需 UI 走查環境（prod projects 表仍空→需受控測試專案） |

## 約束
- 不重建已正確 Stage-02/U01/U03-R1；舊資料保留 raw_legacy_value；不批次改鎖定專案
- 綠色完成燈只由後端有效 completion snapshot 決定
- 未建置模組列 capability gap，不造假
- 正式 migration/部署/費用需個別授權
