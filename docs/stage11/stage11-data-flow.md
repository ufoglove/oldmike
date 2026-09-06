# V3-U11-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U11-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 10 -> Stage 11 -> Stage 12)

```text
[Stage 10: 研究工具、量表、材料與 Study Protocol]
  InstrumentProtocolSnapshot (不可變快照，含工具版本、計分規格、Protocol 草稿與 Pilot 驗證清單)
         │
         ▼
[Stage 11: Pilot／工具預試與 Protocol 驗證工作區]
  1. Intake & Data Tiering (承接快照，零重複輸入，劃分 SYNTHETIC, DRY_RUN, PRETEST, PILOT, FORMAL)
  2. Pilot Readiness & Permission Gate:
     ├─ 內部非人體流程乾跑 (INTERNAL_NON_HUMAN: ALLOWED)
     └─ 人體預試 (HUMAN_PILOT: PENDING_INSTITUTIONAL_CONFIRMATION，未獲批件嚴禁放行)
  3. Multi-modal Validation Runs:
     ├─ 認知訪談 (Cognitive Interview): 澄清 NASA-TLX 心智需求指導語 (INSTRUCTION_CLARIFIED)
     ├─ 評分者一致性 (Rater Calibration): 受控引擎計算 Cohen's Kappa = 0.861 (Po=0.90)
     ├─ 技術預試 (Technical Pilot): VR 眼動延遲 38.5ms (<50ms)、丟包率 0.2%、時間同步 2.1ms
     └─ Protocol 乾跑 (Protocol Dry Run): 94 分鐘全流程可行性演練，落實防動暈中斷 (20m+10m)
  4. Pilot Data Quality Dashboard & Revision Pipeline:
     ├─ 品質指標全面標記 PILOT_DIAGNOSTIC，嚴禁將預試效應當成正式研究假設結果
     └─ 修訂提案 (PilotRevisionProposal): 採用新版不覆寫舊版，涉及受試負擔標記倫理變更
  5. Formal Study Readiness Assessment (缺乏正式 IRB 批件時標記 CONDITIONALLY_READY，不自動通關)
         │
         ▼
  PilotValidationSnapshot (不可變交接快照，含 Kappa 信度、通訊延遲、偏差紀錄與正式執行放行狀態)
         │
         ▼
[Stage 12: 正式研究執行與資料蒐集 (formal-execution)]
  ├─ 正式人體試驗收案與排程執行
  ├─ 正式受試者資料庫建置 (FORMAL_RESEARCH_DATA)
  └─ 試驗偏差即時監控與中期資料審核
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/pilot-validation/initialize`
   - 驗證 `InstrumentProtocolSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `PilotValidationWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/pilot-validation/complete`
   - 執行 `runPilotValidationGateCheck`（阻擋 `UNAUTHORIZED_HUMAN_PILOT_PROHIBITED`、`FORMAL_EXECUTION_ETHICS_PREREQUISITE_MISSING` 等重大違規）。
   - 原子寫入 `PilotValidationSnapshot`，並將狀態更新為交接至 `formal-execution`。
