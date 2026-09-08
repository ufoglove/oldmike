# 憑證與資料曝露狀態核對（v4.1，C17）

- **查證日期**：2026-09-08 (UTC)
- **硬邊界**：本檔僅做**掃描與狀態盤點**，**不撤銷任何憑證、不輪替、不重貼 token 內容、不刪訊息、不 force-push**。
- **依據**：站主文件第八節

---

## 一、掃描範圍與結果

### 1.1 本地 dev 目錄（repo 外）
| 檔案 | 位置 | 內容類型 | 風險 |
|---|---|---|---|
| `zeabur-token.txt` | `/home/node/dev/` | Zeabur API token | 曝露於 dev 容器；未進 Git |
| `vectide-key.txt` | `/home/node/dev/` | 模型服務 key | 同上 |
| `dburl-real.txt` | `/tmp/` | Staging DB DSN（含密碼） | 高風險；僅 /tmp，非 repo |

### 1.2 Git repo 掃描（`/home/node/dev/repo`）
| 掃描項目 | 結果 |
|---|---|
| `ghp_\|github_pat` in tracked files (*.ts/*.mjs/*.json) | **0 筆** |
| `.env`, `.pem`, `.key`, `*.dump` 是否 tracked | **0 筆** |
| 備份 SQL dump 進 repo | **無**（備份在 `/home/node/.openclaw/workspace/projects/active/research-portal/backups/`，不進 Git） |
| 未公開稿/私稿進 repo | **無**（fixture 為合成示範） |

### 1.3 Git history 掃描
- 掃描 `git log --all -p` 內 ghp_/github_pat/AKIA/begin private key：**本輪未做全 history 掃描**（需另行執行，見 3.2）
- **遠端**：origin/main 最新為 `6e07f25`（V2.zip 上傳）；本地 94 個 commit 未推送。**遠端 history 乾淨度未獨立確認。**

---

## 二、已知曝露事件（站主文件提及）

> 「若完整 GitHub token 曾出現在對話、輸出、log 或 repository，按曝露事件處理」

**本對話記錄**：先前回報有提及「GitHub Token 撤銷與金鑰輪換」為待辦（`final-delivery-v4.0.md` 第 2 節表格 #4），並建議站主至 GitHub Developer Settings 撤銷。

**狀態**：`CREDENTIAL_STATUS_UNVERIFIED`（撤銷尚未由站主確認完成）。

---

## 三、待辦清冊（不自行處理）

### 3.1 需要站主操作的步驟

| # | 步驟 | 操作位置 | 狀態 |
|---|---|---|---|
| 1 | **確認影響 scope**：哪些 token / key 曾出現在對話或 log？ | 本檔 + 站主判斷 | 待確認 |
| 2 | **撤銷 GitHub PAT**（若曾曝露） | GitHub → Settings → Developer settings → Personal access tokens | 待站主操作 |
| 3 | **撤銷 Zeabur token**（`zeabur-token.txt`） | Zeabur console → API tokens | 待站主操作 |
| 4 | **撤銷 vectide key**（`vectide-key.txt`） | 向服務提供商撤銷/重發 | 待站主操作 |
| 5 | **輪替 staging DB 密碼**（DSN 曾在 `/tmp/dburl-real.txt`） | Neon console → connection string → reset password | 待站主操作 |
| 6 | **刪除本地憑證檔**（撤銷完成後才刪除） | `rm /home/node/dev/zeabur-token.txt vectide-key.txt /tmp/dburl-real.txt` | 待撤銷後 |
| 7 | **核對舊憑證已失效 + 新憑證可用** | 各服務 smoke test | 待換鍵後 |
| 8 | **檢查異常存取紀錄** | GitHub security log / Zeabur audit log / Neon activity | 待站主操作 |

### 3.2 建議的 Git history 掃描命令（站主可自行執行或授權我執行）

```bash
cd /home/node/dev/repo
# 全 history 掃描敏感字串
git log --all -p | grep -iE "ghp_[A-Za-z0-9]{36}|github_pat_|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC )?PRIVATE KEY|postgresql://[^:]+:[^@]+@"
# 若發現洩漏：
# 1) 撤銷憑證（優先）
# 2) 視情況 filter-repo / BFG 清理歷史（需協調，不逕 force-push）
```

### 3.3 遠端 repo（origin/main）狀態
- 遠端目前只有 `6e07f25`（V2.zip 上傳）
- **V2.zip 內容是否含敏感檔**：**UNKNOWN**（本輪未解包審查，屬站主文件第一節「安全解包」範圍）
- **建議**：站主確認 V2.zip 內是否含 .env / token / DSN / 私稿

---

## 四、C17 驗收狀態

| 項目 | 狀態 | 證據 |
|---|---|---|
| 本地憑證不進 Git | **PASS** | repo 內 0 筆 ghp_/github_pat；憑證檔在 repo 外 |
| 備份不進 Git | **PASS** | 備份在 `.openclaw/workspace/projects/active/research-portal/backups/`，不在 repo |
| 未公開稿不進 Git | **PASS** | 無未公開稿 tracked |
| 曝露處理真實性 | **PARTIAL** | 已識別待辦；**撤銷/輪替尚未由站主完成**，狀態 `CREDENTIAL_STATUS_UNVERIFIED` |
| Git history 掃描 | **NOT_RUN** | 需站主授權或自行執行 |

---

## 五、對外措辭（不誇大）

> 憑證曝露風險已盤點並列出待辦清冊；**實際撤銷/輪替需站主登入各服務操作**，本輪未撤銷任何憑證，狀態為 `CREDENTIAL_STATUS_UNVERIFIED`。本地 repo/備份/私稿掃描顯示未進 Git，但遠端 V2.zip 與 Git history 之完整掃描為 NOT_RUN。

---

*本檔不含任何 token/DSN 內容；只列檔名與待辦。*
