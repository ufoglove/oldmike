# V3-U06-FULL 部署、環境與回滾說明 (Deployment & Rollback Runbook)

**工程識別：V3-U06-FULL｜日期：2026-09-06｜版本：v3.4.0**

## 一、目前所在環境

- **工作目錄**：`/home/node/dev/repo`
- **環境層級**：本地開發與安全測試容器環境（Local Container Sandbox）
- **Node.js 版本**：v26.7.0
- **資料庫狀態**：沿用現行 PostgreSQL 結構；本輪 `TheoryMechanismSnapshot` 保存於既有 `stage_completion_snapshots` 表，**無需執行任何破壞性 DDL migration**。
- **正式環境**：未經使用者明確指示前，**不得執行任何正式 Zeabur 部署或生產資料庫變更**。

## 二、變更檔案清單

### 1. 核心契約與評估服務
- `lib/theory-mechanism-v3-contract.ts`：三目標模型、8 種建模取徑、候選理論池、構念字典、Typed Relations、研究命題（H1/P1/GQ1）、競爭解釋、ModelToDesignRequirement 矩陣、不可變交接快照契約。
- `lib/theory-mechanism-v3-service.ts`：承接 Stage 5 快照建立工作區、Alignment 邏輯檢查器（檢測懸空引用、因果 DAG 循環依賴、教學實踐僅採滿意度）、建構第七階段交接快照。

### 2. API 路由
- `app/api/projects/[projectId]/theory-mechanism/initialize/route.ts`：讀取 Stage 5 快照建立或恢復理論工作區（冪等、零重複輸入）。
- `app/api/projects/[projectId]/theory-mechanism/complete/route.ts`：執行 Gate 檢查（阻擋 FATAL 錯誤）、建構基線並原子寫入 `stage_completion_snapshots`。

### 3. UI 視圖
- `components/TheoryMechanismStudioView.tsx`：完整理論與機制工作區（三目標論述、理論選擇、構念字典、關係模型、命題假設、研究設計需求矩陣、缺失導航、加鎖與老麥一鍵協作）。

### 4. 契約測試與驗收
- `scripts/verify-stage06-full-48-items.ts`：48 項標準驗收測試套件（48/48 PASS，100% 成功）。

---

## 三、回滾路徑 (Rollback Plan)

若後續需回滾至本階段建置前狀態：
1. **Git 回滾**：
   ```bash
   rm -f lib/theory-mechanism-v3-contract.ts lib/theory-mechanism-v3-service.ts
   rm -f app/api/projects/[projectId]/theory-mechanism/initialize/route.ts
   rm -f app/api/projects/[projectId]/theory-mechanism/complete/route.ts
   rm -f components/TheoryMechanismStudioView.tsx
   rm -f scripts/verify-stage06-*.ts
   rm -rf docs/stage06
   ```
2. **資料庫層級**：無任何 DDL 異動，無需執行任何資料庫回滾腳本。
