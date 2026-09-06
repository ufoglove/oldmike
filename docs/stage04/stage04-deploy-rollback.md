# V3-U04-FULL 部署、環境與回滾說明 (Deployment & Rollback Runbook)

**工程識別：V3-U04-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、目前所在環境

- **工作目錄**：`/home/node/dev/repo`
- **環境層級**：本地開發與安全測試環境（Local Container Sandbox）
- **Node.js 版本**：v26.7.0
- **資料庫狀態**：延用現行 PostgreSQL 結構；本輪 `BlueprintPlanningSnapshot` 保存於既有 `stage_completion_snapshots` 表，**無需執行任何破壞性 DDL migration**。
- **正式環境**：未經使用者明確指示前，**不得執行任何正式 Zeabur 部署或資料庫變更**。

## 二、變更檔案清單

### 1. 核心契約與服務
- `lib/blueprint-planning-contract.ts`：三目標模型、Objective–RQ 矩陣、WorkPackage、DAG、EvidenceNeed、FieldEnvelope、不可變交接快照契約。
- `lib/blueprint-builder-service.ts`：承接 Stage 3 快照建立工作區、三目標邏輯檢查器（DAG循環依賴、教學實踐技能與評量一致性檢測）、快照建構器。
- `lib/submission-navigation-engines-contract.ts`：擴充指紋傳遞欄位以利下游藍圖無縫承接。

### 2. API 路由
- `app/api/projects/[projectId]/blueprint/initialize/route.ts`：讀取 Stage 3 快照建立或恢復藍圖工作區（冪等、零重複輸入）。
- `app/api/projects/[projectId]/blueprint/complete/route.ts`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`。

### 3. UI 與接收端整合
- `components/ResearchBlueprintStudioView.tsx`：完整研究藍圖規劃工作區（三目標視圖、矩陣、DAG、缺失導航、欄位加鎖、老麥一鍵協作）。
- `components/HandoffReceiverView.tsx`：第三階段接收頁無縫升級，提供「開啟研究藍圖工作區」展開入口。

### 4. 契約測試與驗收
- `scripts/verify-stage04-batch-b-contracts.ts`：批次 B 核心契約測試（28/28 PASS）。
- `scripts/verify-stage04-full-48-items.ts`：48 項標準驗收測試套件（48/48 PASS，100% 成功）。

---

## 三、回滾路徑 (Rollback Plan)

若後續需回滾至本階段建置前狀態：
1. **Git 回滾**：
   ```bash
   git checkout -- lib/submission-navigation-engines-contract.ts components/HandoffReceiverView.tsx
   rm -f lib/blueprint-planning-contract.ts lib/blueprint-builder-service.ts
   rm -f app/api/projects/[projectId]/blueprint/initialize/route.ts
   rm -f app/api/projects/[projectId]/blueprint/complete/route.ts
   rm -f components/ResearchBlueprintStudioView.tsx
   rm -f scripts/verify-stage04-*.ts
   rm -rf docs/stage04
   ```
2. **資料庫層級**：因無新增或變更資料表結構，無需執行回滾 migration。
