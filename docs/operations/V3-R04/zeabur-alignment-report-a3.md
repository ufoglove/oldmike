# A-3 Zeabur 部署對齊調查報告

- 查證日期：2026-09-08 (UTC) | 查證方式：唯讀 HTTP probe + 本地 release-identity 雜湊核對
- 目標網址：`https://research.josephbb0105.com`
- 本地 repo：`/home/node/dev/repo`，commit `7d76bb4`（branch `main`）

---

## 1. 核心結論（重大事實發現）

| 維度 | 線上部署 | 本地 repo | 對齊狀態 |
|---|---|---|---|
| **服務名稱** | `research-portal` | `old-mike-research-portal` | 實體一致 |
| **版本號** | `1.9.0` | `1.9.0` | 一致（STATUS.md 寫的 1.5.30 已過時） |
| **Release Identity Hash** | `2b7892e36eef30de49fb3986b174a0d49b774b8c242eaf9bb080edbc26a283f9` | `2b7892e36eef30de49fb3986b174a0d49b774b8c242eaf9bb080edbc26a283f9` | **完全吻合** |
| **Build ID** | `REBUILD-20260905` | `REBUILD-20260905` | 一致（commit cb2879f，2026-09-05） |
| **Postgres Schema 基準** | `0007` | `0007`（release-identity 聲明）/ 實體 DB 達 `0035` | 實體 DB 領先部署宣告 |
| **最新路由 `artifacts/request`** | 404（未上線） | 已實作（commit `992797b`） | **本地領先線上** |

**重大事實**：
1. **線上運行的不是舊的 v1.5.30，而是基於 `REBUILD-20260905`（2026-09-05）建置的 1.9.0 產物**。
2. 線上 `release-identity` 雜湊與本地 `release-identity.json` 的 canonical 雜湊**完全相符**。
3. 但本地 repo 包含了 2026-09-05 之後的一系列重要 commit：
   - `06764e7`：V3-U20-FULL-R2
   - `b1f7e16` / `fb56a97`：V3-R01-FULL（發布就緒）
   - `4034374` / `4b5d85d`：V3-R02-FULL（上線移交）
   - `2fc8806`：fix(routes)
   - `4204ba8`：V3-R03-FULL（真實專案導入）
   - `be1e9b0`：V3-R04-FULL（維護審查）
   - `992797b`：artifact-request/1.0.0 API
   - `7d76bb4`：A-1 + A-2 文件
4. **驗證 probe**：線上 `/api/projects/[id]/artifacts/request` 回傳 **404**，證實**線上部署尚未包含 V3-R03/R04 及 artifact-request 變更**。
5. 線上健康度：`/api/health` 正常（status=ok, mode=connected, version=1.9.0）；`/login` 200；`/api/projects` 401（正常阻擋未認證）。

---

## 2. 部署差異矩陣

| 模組 / 能力 | 線上實體 | 本地 repo | 差異說明 |
|---|---|---|---|
| Base framework | Next.js 16.3.1 | Next.js 16.3.1 | 同版本 |
| V3 U01～U19 | 已部署 | 已存在 | 一致 |
| V3 U20-FULL-R2 | ⚠️ 未部署（06764e7 後） | 已存在 | 本地領先 |
| V3-R01 / R02 | ⚠️ 未部署（b1f7e16, 4034374） | 已存在 | 本地領先 |
| V3-R03 / R04 | ⚠️ 未部署（4204ba8, be1e9b0） | 已存在 | 本地領先 |
| artifact-request API | ❌ 404 未部署 | 已實作 + E2E PASS | 本地領先 |
| 0035 DB migration | ✅ staging DB 已套用 | 已撰寫 | DB 先行於程式碼部署 |
| Capability Matrix / Registry | — | 已撰寫（7d76bb4） | 文件層 |

---

## 3. 對 v4.0 整合的影響

- **好消息**：本地 repo 就是線上部署的直接演進來源（不是完全脫節的另一份專案）。線上運行的正是 2026-09-05 的同一 repo 歷史。
- **注意點**：
  - 線上與本地之間有 **8 個未部署 commit**（含整個 V3-R 系列）。
  - 在執行 v4.0 的後續改動時，必須保護好這 8 個 commit 的成果，不可回退。
  - 正式部署（更新線上）依 SOUL.md 及 v4.0 規格第 1.6 條，需要您的明確授權。
