# V3-U12-FULL 前後階段資料流向與生命週期 (Data Flow & Lifecycle)

**工程識別：V3-U12-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、主流程與資料流向 (Stage 11 -> Stage 12 -> Stage 13)

```text
[Stage 11: Pilot／工具預試與 Protocol 驗證]
  PilotValidationSnapshot (不可變快照，含預試指標、流程演練偏差、Kappa 信度與正式研究放行狀態)
         │
         ▼
[Stage 12: 正式研究執行與資料蒐集工作區]
  1. Intake & Formal Execution Gate:
     ├─ 檢查 FormalStudyReadiness 與機構倫理核准函 (REC-115-089)
     └─ 發布 ExecutionAuthorization (未獲核准嚴禁放行人體試驗)
  2. Identity Vault Separation & Enrollment:
     ├─ IdentityMappingVault: 受試者真實身分隔離於獨立金庫，工作區僅用虛擬代碼 (P-001)
     ├─ 篩檢與知情同意: 納入標準逐項檢查，知情同意必須綁定實體簽署檔案參照
     └─ 教育研究情境: 師生權力關係防護 (成績登錄封存前教師不得查閱名冊)
  3. Session Execution & Protocol Fidelity:
     ├─ 試驗 Session: T0 基線測量、VR 介入單元、T1 立即後測、T2 延宕測量
     ├─ 介入忠實度: 40 分鐘體驗強制落實滿 20 分鐘中斷休息 10 分鐘防動暈規範
     ├─ 偏差日誌: 校準延遲等事件完整登錄 (ProtocolDeviation)，不私自刪除
     └─ 不良事件管理: VR 動暈眩處置日誌，監控至症狀完全緩解
  4. Immutable Raw Data Layer & Provenance:
     ├─ 原始數據以 Append-only 形式保存，附加 SHA-256 數位簽章 (RawDataRecord)
     ├─ AI、資料清理與手動編輯嚴禁覆寫 Raw Data，修正留存 DataCorrectionRecord
     └─ 記錄 Vive Pro Eye 採樣率 (90Hz)、同步精度 (2.1ms)、AI 模型與 Prompt 版本
  5. Operations Dashboard & QA:
     └─ 即時彙整收案人數 (N=4)、目標人數 (N=151)、Session 數與原始資料筆數
         │
         ▼
  FormalExecutionSnapshot (不可變交接快照，含收案統計、Raw Data 數位簽章與安全事件紀錄)
         │
         ▼
[Stage 13: 資料治理、清理與 Analysis Dataset (data-governance)]
  ├─ 原始資料不可變校驗與去識別化資料集建置
  ├─ 缺失值模式診斷、極端值辨識與清理審查
  └─ 衍生指標計算與分析資料集 (Analysis Dataset) 封存
```

## 二、端點與 API 互動流向

1. **工作區初始化**：`POST /api/projects/:projectId/formal-execution/initialize`
   - 驗證 `PilotValidationSnapshot` 權限與版本。
   - 冪等恢復或承接快照建立 `FormalExecutionWorkspace`。
2. **工作區完成與交接**：`POST /api/projects/:projectId/formal-execution/complete`
   - 執行 `runFormalExecutionGateCheck`（阻擋未獲倫理授權、虛假簽署、模型未受控切換等重大違規）。
   - 原子寫入 `FormalExecutionSnapshot`，並將狀態更新為交接至 `data-governance`。
