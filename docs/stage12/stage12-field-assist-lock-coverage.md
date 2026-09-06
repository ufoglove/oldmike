# V3-U12-FULL 欄位協作、Assist 與鎖定覆蓋盤點 (Assist & Lock Coverage)

**工程識別：V3-U12-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、欄位政策與協作覆蓋 (FieldPolicy & Assist Coverage)

| 工作區區塊 / 欄位集合 | 欄位型態 | 支援 Assist 模式 | 鎖定保護層級 | 違規防護機制 |
|---|---|---|---|---|
| **Formal Execution Gate** (`gateStatus`, `activeBlockers`) | 放行閘門 | `AUDIT_PREREQUISITES`, `CHECK_ETHICS_APPROVAL` | 系統層級 (Gate Lock) | 未獲正式機構倫理批件前，嚴禁放行人體試驗 (T02, T03) |
| **Execution Authorization** (`status`, `authorizedDateRange`) | 授權憑證 | `VERIFY_CREDENTIALS`, `AUDIT_SCOPE` | 嚴格鎖定 (Authorization Lock) | 僅能授權使用已核定之 Protocol 與 Instrument 版本 (T02) |
| **Identity Mapping Vault** (`encryptedRealIdentityHash`) | 身分金庫 | `SECURE_ENCRYPT`, `AUDIT_ACCESS` | 最高安全隔離 (Vault Lock) | 真實身分絕不上傳至 LLM 或分析 Dataset，研究頁面僅用虛擬代碼 (T05, T28, T37) |
| **Enrollment & Study Units** (`pseudonymousId`, `enrollmentStatus`) | 受試者單元 | `RECORD_ENROLLMENT`, `AUDIT_WITHDRAWAL` | 記錄層級 (Unit Lock) | 目標規劃 N=151 嚴格區別於實際入組 N=4，退出原因代碼完整追蹤 (T06, T26) |
| **Consent Records** (`signedAt`, `sourceFileRef`) | 知情同意 | `VERIFY_SIGNATURE_DOC` | 嚴格鎖定 (Consent Lock) | 缺乏真實簽名時間或檔案參照時，嚴禁標記 CONSENTED (T04, T27) |
| **Study Sessions & Fidelity** (`sessionType`, `fidelityStatus`) | 試驗執行 | `LOG_SESSION`, `AUDIT_DOSE`, `CHECK_BREAK` | 階段層級 (Session Lock) | 40 分鐘體驗強制落實滿 20 分鐘中斷休息 10 分鐘防動暈規範 (T09, T10) |
| **Protocol Deviations** (`category`, `correctiveAction`) | 偏差日誌 | `LOG_DEVIATION`, `SUGGEST_CORRECTION` | 條目層級 (Deviation Lock) | 校準延遲等事件完整登錄，嚴禁因不影響假說而私自刪除 (T11) |
| **Safety Events** (`eventType`, `actionTaken`) | 不良反應 | `LOG_SAFETY_EVENT`, `MONITOR_RESOLUTION` | 條目層級 (Safety Lock) | VR 動暈眩處置全程追蹤至症狀完全緩解，通報需求透明 (T13) |
| **Raw Data Records** (`rawStringValue`, `checksumSha256`) | 原始資料層 | `COMPUTE_CHECKSUM`, `FLAG_QUALITY` | 不可變保護 (Immutable Raw Lock) | Append-only 儲存與 SHA-256 簽章，AI 與手動編輯嚴禁覆寫原值 (T17, T18, T21, T22) |
| **Hardware & AI Provenance** (`samplingRateHz`, `seed`) | 脈絡追蹤 | `VERIFY_FIRMWARE`, `AUDIT_AI_CONFIG` | 系統層級 (Provenance Lock) | 記錄 Vive 採樣率 90Hz、同步 2.1ms、固定種子，模型切換發出警告 (T12, T19, T20) |
| **Study Operations Dashboard** (`operationsMetrics`) | 營運儀表板 | `AUDIT_OPERATIONS_QA` | 唯讀儀表板 (Dashboard Lock) | 僅呈現研究收案與執行進度，絕不等於研究結果 (T25, T43, T44) |
