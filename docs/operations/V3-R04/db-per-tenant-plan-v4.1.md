# 獨立 DB-per-tenant 方案比較（v4.1，僅文件，不建資源）

- **查證日期**：2026-09-08 (UTC)
- **依據**：站主文件第六節。原需求：「每位使用者皆是獨立資料庫互不干擾」。
- **硬邊界**：本檔僅做**方案比較與遷移規劃**，**不建立任何雲端資源、不搬 production 資料、不切換生產路由**。
- **成本資訊狀態**：Neon 定價/配額/區域可用性屬時效性資訊，本檔**標記 UNKNOWN**，待站主查閱官方頁面（https://neon.com/use-cases/database-per-tenant 與 https://neon.com/pricing）確認後填入。

---

## 一、現況精確盤點

| 項目 | 現況 | 證據 |
|---|---|---|
| 架構 | Shared-table + `workspace_id` 邏輯隔離 | `lib/tenant-repository.ts`、`lib/tenant-model.ts` |
| 是否啟用 RLS | **未確認**（程式有 workspace filter，但無 RLS 政策程式碼證據） | 需讀 migration SQL |
| Tenant 路由 | 由 server `resolveResearchTenant` 依 membership 決定，拒絕 client 傳入 DSN | `lib/request-auth.ts` |
| UI 標示 | 標示「獨立資料庫」，但實為邏輯隔離 | 站主文件指出，**不一致** |
| fixture tenant 測試 | **未執行**（兩 tenant 兩 DB 之隔離驗證 C13/C14 待做） | — |
| 雲端平台 | Neon（現有 staging） | `final-delivery-v4.0.md` |

**結論**：現況**未滿足**原「獨立 DB」需求。UI 標示與實際架構不一致，需站主裁決。

---

## 二、user / workspace / tenant 關係確認

| 問題 | 現況答案 | 依據 |
|---|---|---|
| 一個 user 幾個 workspace? | 預設一個；可多個（模型允許） | `tenant-model.ts` 需再讀確認 |
| 一個 workspace 幾個 user? | 協作未實作；預設 1 對 1 | 同上 |
| 隔離單位 | `workspace_id`（不是 `user_id`） | `tenant-repository.ts` |
| 原需求解讀 | 「每位使用者」→ 應為 **tenant-per-user**；多 workspace 場景**未明確** | 站主文件 6.1 |

**需站主確認**：多 workspace / 協作情境是否在需求範圍？若否，可採「user↔tenant 1對1」簡化。

---

## 三、方案 A：同 Postgres instance 內 database-per-tenant

### 架構
每 tenant 一個 database + 專屬 least-privilege role。同一台 Postgres 伺服器（Neon 專案或 self-host）。

### 邊界
- **資料庫邊界**：分離（每 tenant 連不同 DB，無法跨查詢）
- **運算邊界**：共用（同一 instance CPU/RAM）
- **管理員邊界**：共用（superuser 可跨 DB）
- **備份/PITR 邊界**：可能共用（視平台）
- **連線池**：需 per-tenant 清理，不可重用憑證

### 成本
- Neon：**UNKNOWN**，需查官網確認專案/DB 配額與定價
- Self-host：無新增雲端費用，但需管理 backup/patching

### 優點
- 較簡單；不改變 Neon 專案結構
- 單一 Postgres 版本、單一運維流程

### 缺點
- **不是**硬資源邊界：Noisy neighbor / CPU 爭用仍可能
- 管理員權限跨 DB，需靠審計與流程控制
- 備份恢復通常 instance-level，單 tenant 復原需另做

---

## 四、方案 B：每 tenant 一個 Neon project

### 架構
每 tenant 建獨立 Neon project（每 project 有獨立 DB、branch、compute endpoint）。

### 邊界
- **資料庫邊界**：完全分離（不同 project、不同 DSN）
- **運算邊界**：可分離（不同 compute endpoint，可獨立 scale-to-zero）
- **管理員邊界**：Neon org 管理員仍可跨 project；需 Neon API 權限分層
- **備份/PITR 邊界**：完全分離（每 project 獨立 branch/restore）
- **連線池**：自然分離

### 成本
- **UNKNOWN**：Neon 定價以 compute hours + storage 計，project 數量可能有限制；**本檔不杜撰金額**。
- Neon 有免費方案，但 project 數可能有限；正式使用量需查閱 https://neon.com/pricing 與 https://neon.com/use-cases/database-per-tenant

### 優點
- 最接近「每人一個獨立 DB」需求
- Neon 原生支援 DB-per-tenant 模式
- 每 tenant 可獨立 scale / restore / 分版

### 缺點
- Neon org 需管理多 project；API 呼叫與配額需監控
- 費用結構複雜（compute hours + storage + 可能的 project 數上限）
- 若 tenant 數增長，管理成本線性上升

---

## 五、兩方案比較總表

| 維度 | A：同 instance DB-per-tenant | B：Neon project-per-tenant |
|---|---|---|
| 資料隔離 | DB-level（強） | DB-level + project 邊界（最強） |
| 運算隔離 | 共用 | 可獨立 |
| 管理員邊界 | 共用 superuser | Neon org 管理員（需分層） |
| 備份/PITR | instance-level | project-level（獨立） |
| 連線池 | 需手動 per-tenant | 自然分離 |
| 成本 | 無新增雲端費用（self-host）或 Neon DB 配額 | UNKNOWN（需查） |
| 管理複雜度 | 中 | 中高 |
| 符合原需求程度 | 部分（DB 分離但運算/管理共用） | 最接近（每 tenant 完整獨立 project） |
| 需要站主授權 | 建 DB + roles | 建 Neon projects + API 權限 |

**兩方案都不是**「每人一台獨佔實體主機」。原 shared-table **不能**改稱方案 A。

---

## 六、遷移方案（若站主核准推進）

### 6.1 來源/目標清冊
- **來源**：現 Neon staging DB（361 tables, `backup.log` 2026-09-08 `DONE (failed=0)`）
- **目標**：方案 A 或 B 之 tenant-specific DB

### 6.2 copy-backfill-validation 步驟
1. **凍結寫入**（維護窗口）或使用 logical replication 做 CDC
2. **Schema 版本**：確認 0035 已套用；目標 DB 以同版本 schema 建構
3. **Copy**：依 tenant 分組匯出，載入目標 tenant DB
4. **Backfill**：非 tenant-scoped 之共用資料（如公開書目）保留在 shared DB 或複製到每 tenant
5. **Validation**：
   - Row counts per table per tenant
   - 關鍵欄位 hash（如 project_id, locked_content_sha256）
   - Foreign keys / references 完整性
   - Unique constraints
   - 歷史版本/鎖/ACL 保留
   - Files / vector / cache / TM / jobs / downloads 之 tenant scope 檢查

### 6.3 writer 切換
- 維護窗口 + DNS/env var 切換，或 feature flag + 漸進
- 舊 DB 保持可回溯（不刪除）直到驗證成功 + 站主批准

### 6.4 rollback 與單租戶復原
- **程式 rollback**：Git revert + image digest 回退
- **DB rollback**：從備份還原至指定時間點（需 PITR）
- **單租戶復原**：只還原該 tenant 之 DB（方案 B 可 Neon project-level restore；方案 A 需 per-tenant dump 策略）
- **不覆蓋新研究資料**：回滾前確認無新寫入，否則 merge

### 6.5 驗收標準（C13/C14）
- 兩 fixture tenant 在**不同 DB**，各用受限 role
- Cross-tenant query → 拒絕
- 撤權後舊 token 立即失效
- files/vector/cache/TM/jobs/download 之 tenant scope 全部檢查
- 連線池 cache key 包含 tenant+DB+role+credential 版本

---

## 七、成本假設（2026-09-08 已查證官方頁面）

**查證來源**：https://neon.com/pricing 與 https://neon.com/use-cases/database-per-tenant（2026-09-08 UTC 取得）

### Neon 計費模型（官方）
- **三方案**：Free（$0，永久，非試用）／Launch（用量計價）／Scale（用量計價）
- **方案以 organization 為單位**；一帳號可屬多 org
- **CU（Compute Unit）**：約 4 GB RAM + CPU + SSD；計價以 **CU-hour**（compute size × 執行時數）
- **Scale-to-zero**：閒置自動停機，停機期間 **0 CU-hour**；Free 方案 always-on
- **計量單位**：CU-hour、GB-month（storage）、branch-month（額外分支）
- 付費方案無月最低消費；發票 < $0.50 不收
- 官方明確支援 **database-per-tenant** 模式：每 customer 獨立 Neon project，API 自動化 provisioning，單一工程師可管理數千 tenant，支援 per-tenant 獨立 rollback

### 對方案 B 的意義
| 項目 | 官方資訊 | 對本站估計 |
|---|---|---|
| Free 方案 | $0，project 數有上限（官方頁面未列具體數字，需登入 console 確認） | 適合 fixture 驗證（C13/C14），**可能不適合正式多租戶** |
| Launch/Scale | 用量計價、無月費 | 費用隨 tenant 數 × compute hours 線性/分佈成長；低用量 tenant 因 scale-to-zero 成本可低 |
| project 數上限 | **需登入 console 確認**（方案別而定） | 站主需以現有 org 方案查閱 |
| region | 需確認現有 staging 所在區域 | 不影響本檔規劃 |

**結論**：Neon 官方**支援** database-per-tenant（方案 B），計費為用量制且 scale-to-zero 可壓低低用量成本。**實際月費仍取決於站主 org 方案與 tenant 用量**，本檔仍不杜撰具體金額；建議站主以 console 之現有方案頁確認 project 配額後再裁決方案 A/B。

---

## 八、需要站主裁決之事項

| # | 決策 | 選項 |
|---|---|---|
| 1 | 隔離單位 | user-per-tenant（1:1） vs workspace-per-tenant（多 workspace 場景） |
| 2 | 方案 A or B | 視成本與管理複雜度取捨 |
| 3 | UI 標示 | 維持「獨立 DB」但補充現況，或先降為「邏輯隔離」待真遷移 |
| 4 | 遷移時機 | 立即 / 下個 sprint / 待更多 tenant 訊號 |
| 5 | fixture 測試授權 | 允許在**隔離 dev 環境**建兩 tenant 兩 DB 做 C13/C14（不觸 production、不新增雲端費用） |

## 九、後續工作（本輪不做，待授權）

- [ ] 讀 migration SQL 確認 RLS 政策（若有）之 USING/WITH CHECK/role/BYPASSRLS
- [ ] 在**隔離 dev 環境**建兩 fixture tenant 兩 DB，驗證路由/權限/連線池（C13/C14）
- [ ] 若站主查完 Neon 成本後核准方案 B，再設計 Neon API 自動 provisioning 流程
- [ ] 正式遷移（另取授權）

---

*本檔僅規劃。**未建立任何資源、未搬任何資料、未切換任何路由**。*
