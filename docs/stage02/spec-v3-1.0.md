# 老麥科研網站 V3｜新版第二階段完整整合建置提示詞
## 前沿雷達 × 一鍵靈感 × 選題實驗室
## 共用「下一階段、缺失導航、老麥一鍵補全與內容鎖定」

規格版本：3.1.0  
任務代號：V3-U02-R1  
整理日期：2026-09-05  
執行對象：OpenClaw 建站工程代理及經授權的開發工具。

> 這是實際網站工程任務，不是請你直接替研究者想題目，也不是新建老麥人設或單一研究 Skill。請盤點現有程式、重用可靠元件、增量修改並測試。第一階段已由使用者回報完成，但目前架構、資料與連線仍須實際查驗。

### 本文件的地位

本文件是新版第二階段的完整整合替代版，納入先前第二階段、首頁專案控制、首頁功能導覽，以及本次新增的共用操作要求。執行本輪時不必同時貼入數份互相重疊的舊提示詞。

- 新版第一階段的底座、資料與安全約束繼續沿用。
- 本文件取代舊版 V3-U02 中與本輪重疊的功能規格；不覆寫研究資料或任意修改其他階段的專業規則。
- 這不是早期舊版「第二階段：研究藍圖」。新版第二階段仍然是探索、靈感與選題。
- 建置批次、研究階段與某次AI任務是三種不同概念；不得混用進度或完成狀態。
- 本次網站實作完成，不等於使用者的真實研究、倫理、統計或投稿已完成。

## 1. 本階段目標、範圍與完成畫面

打通一條可實際操作的流程：

**選擇／讀取專案 → 研究焦點 → 前沿雷達 → 一鍵靈感 → 選題比較 → 補足必要缺項 → 保存選定版本 → 鎖定交接快照 → 前進投稿導航。**

同時建立全站共用的操作層：

1. 每階段都有醒目的下一步按鈕與真實完成清單。
2. 缺項逐條說明，直接導航到正確專案、模組、頁籤及欄位。
3. 每個項目都有符合其性質的老麥協助：解說、起草、補全、查證、優化或準備清單。
4. 可一鍵自動填入允許的草稿欄位，也可批次鎖定指定版本；不逐欄要求重複確認。
5. 已鎖定內容不被手動保存、AI、同步或背景任務靜默覆寫。
6. 所有文獻仍集中於既有文獻與證據中心，保持CitationSource及Zotero對應。
7. 首頁保留專案儲存／讀取、頂部未完成專案清單、研究路徑及底部回收功能。

### 範圍界線

本次完整實作三個探索模組及上述共用操作層。對**目前已存在的研究階段頁面**，以共用外框／adapter導入下一步、缺失導航及欄位協助，不重新開發它們的研究引擎。尚未建置的階段只登錄其用途、狀態及交接契約，不建立假頁面或假功能。

新增的共用元件必須成為後續階段的接入標準。不要以「之後再做」略過現有頁面的接入，也不要因為本需求一次重寫IRB、統計、全文或投稿模組。

本輪不新增：完整投稿匹配引擎、研究藍圖引擎、IRB流程、統計執行、全文生成、付費翻譯整合、政府／期刊自動送件、新Telegram推播或不明Skills安裝。已有且可靠的功能保留。

---

## 2. 架構盤點、相容與安全修改

先找 repository 中實際的 PROJECT_STATE.md；若不在預期位置，搜尋真正位置，找不到就由目前程式建立盤點，不假裝已讀。

逐項確認：

- 真正網站repository、目前分支、未提交修改、前後端框架、ORM、資料庫與部署環境。
- ResearchProject、ProjectMembership、Project Context、專案保存／讀取／回收／復原。
- ModuleRegistry／StageDefinition、ProjectStageState、功能說明、意圖入口與首頁下一步。
- LiteratureItem、ProjectLiteratureLink、EvidenceNote、CitationSource、Zotero Library／Collection綁定。
- ArtifactVersion、欄位或段落鎖定、Approval、Diff、AuditEvent。
- AgentJob、queue／worker、checkpoint、重試、取消、冪等、配額。
- 既有前沿雷達、一鍵靈感、選題實驗室、Gap模組與投稿導航。
- 老麥服務adapter、既有學術資料源、目前有效權限及真實API能力。

建立「需求 → 已有能力 → 實際缺口 → 最小修改 → 測試」對照，並列出所有已建置頁面的共用操作層接入情況。

保留舊Project ID、題目、稿件、原始研究資料、來源及版本；不清庫、不重置登入、不任意替換技術棧。新增欄位採相容migration與明確回填。舊資料缺失鎖定狀態時預設未鎖定，不推測人工核准；舊有明確核准／鎖定不可被降級抹除。

先在隔離開發／測試環境實作。正式migration、正式部署、破壞性修改、新訂閱或額外支出另需授權。保護未提交程式修改、資料庫、持久檔案與secret；不把備份或密鑰寫入Git。

只能回報實際重現的問題與實際修復結果，不宣稱已診斷未檢視的網站故障。

---

## 3. 首頁、功能解說與共用頁面框架

沿用首頁研究工作台，不再建立一個新首頁系統。

### 頁面頂部

```text
未完成專案：[搜尋並選擇專案 ▼] [讀取] [儲存] [新增]
目前專案：真實名稱  ｜儲存狀態｜最後成功儲存
[搜尋功能或問題] [功能導覽] [使用說明]
目前階段／完整路徑／一個下一步
```

未完成清單包含草稿、進行、暫停與需修訂；排除無權限、回收、封存或真正已結案者。切換前處理未儲存變更：儲存後切換、放棄本地變更、取消；保存失敗不能切換。

每項功能提供：一句用途、需要的輸入、已帶入的資料、操作步驟、主要產出、保存位置、下一站及重要限制。功能卡、搜尋、側欄、說明及老麥解說共用同一ModuleRegistry，不各自硬編。

意圖入口沿用：找研究靈感、查文獻與找缺口、準備研究計畫、分析研究資料、撰寫或修訂論文、翻譯與學術潤稿。獨立翻譯／自稿修訂不強制先走完整科研路線，也不使正式研究階段自動完成。

### 每個研究階段的共用外框

- 上方：當前專案、階段名稱、一句用途、來源版本、已完成／適用必要項目。
- 中間：專業工作區、欄位老麥協助、缺失定位、版本與來源。
- 下方：StageActionBar，始終有清楚的主要動作及下一站名稱。
- 可展開：階段清單、警告、選填項目、歷史完成快照。

首頁Next Best Action與StageActionBar必須讀取同一後端StageReadiness結果，不能一處說完成、另一處說缺項。

### 首頁最下方

保留紅色危險操作區與「刪除本專案（移至回收筒）」；須確認真實專案名稱、可復原、不刪其他專案／共用文獻／Zotero原件。不得把刪除按鈕加入下一步操作列。

---

## 4. 共用階段完成引擎：條件、狀態與進度

建立或擴充 StageReadinessService，規則由伺服器端評估，不由AI的一段文字決定。

### 狀態分開儲存

| 軸線 | 表示什麼 | 不代表什麼 |
|---|---|---|
| module_delivery | 模組已建置、未建置、維護或外部設定待補 | 研究已完成 |
| project_stage | 本專案未開始、進行、可交接、完成或需重驗 | 人工核准或正式授權 |
| artifact_review | 草稿、機器檢查、人工審閱、需修訂 | 是否鎖定 |
| execution_permission | 可閱讀／起草／執行，或缺授權 | 所有欄位內容正確 |
| content_lock | 指定欄位或版本不可被覆寫 | 新穎性、倫理或研究結論被證實 |

### 每一必要項目的定義

Requirement至少包括：穩定requirement_id、stage_id、說明、適用條件、required／optional、評估器、依賴來源版本、最低輸入／證據／審閱需求、阻擋動作、缺失導航及可用AI協助類型。

狀態可映射：MISSING、IN_PROGRESS、SATISFIED、PENDING_USER、PENDING_EXTERNAL、STALE、CONFLICT、NOT_APPLICABLE。不能只用「欄位非空」判斷SATISFIED；佔位符、未被允許的假設、缺來源、過期或矛盾內容按規則判斷。

NOT_APPLICABLE必須有明確條件、理由或有權限者的裁決；不能為提高完成率自動略過必要項。一般warning不應被偽裝成阻擋，但已定義的安全、權限與研究誠信阻擋不可被總分抵銷。

所有**適用的必要項目**完成且沒有阻擋時，才能正式「完成本階段」。選填項可未填，但須可見；選擇稍後處理不等於填完或完成研究驗證。

### 完成規則必須與階段目的相符

早期選題要求的是可交接的研究構想，不應要求先取得IRB、完整數據或最終分析。初步Gap可明確標示為「待驗證的Gap假說」，不能冒充已證實缺口。正式實驗、結果或投稿階段則按其真正必要的證據與授權判斷。

專案研究進度以workflow_version、適用必要階段及有效完成快照計算。建站批次、開啟頁面、儲存、AI產生草稿、勾選UI或機器測試通過，都不自動提高研究完成率。草稿欄位完整度、來源覆蓋率、內容鎖定數與研究進度分別顯示。

Funding Route與Publication Route可並存；流程依依賴圖與實際專案分支，不以pageIndex+1推算。直接輸入構想可略過雷達；合理選題不強制跑滿10題或每篇連上Zotero。

---

## 5. 每階段醒目「下一步／前進下一階段」按鈕

建立共用 StageActionBar。所有已建置階段頁接入，後續新增頁面未接入不得通過模組驗收。

主要按鈕使用高對比樣式、完整中文及下一站名稱；圖示不可取代文字。不要只在使用說明裡放一個下一步連結。

| 真實狀態 | 主要按鈕 | 操作 |
|---|---|---|
| 必要項目完成、已保存、無阻擋 | **完成本階段，前進「下一階段名稱」 →** | 重新驗證、提交完成快照並導航 |
| 有必要缺失 | **尚缺N項，前往補足** | 展開缺項總覽並定位第一項；次要按鈕為老麥一鍵補全 |
| 有未儲存變更 | **儲存並檢查下一步** | 保存成功後重新檢查；失敗留在原頁 |
| 老麥任務執行中 | **查看老麥處理進度** | 看局部成果、可取消，不重啟同一任務 |
| 內容／來源需重驗 | **重新檢查受影響項目** | 顯示依賴變更及修正入口 |
| 缺人工資料／外部授權 | **查看待補資料／前往授權處理** | 解釋原因；AI可準備清單但不能代填批准 |
| 下一模組尚未建置 | **保存本階段並查看下一階段說明** | 保存交接快照，顯示HANDOFF_READY，不跳假頁 |
| 已完成且來源未變 | **繼續「下一階段名稱」 →** | 重用原快照，不重複生成 |
| 最後階段已完成 | **查看成果／辦理專案結案** | 依既有結案規則，不虛構下一階段 |

不可只有禁用按鈕而無說明與修復路徑。若缺失時保留「前進」字樣作次要不可執行狀態，旁邊必須有可操作的缺失入口。

本階段頁面依實際入口可顯示：

- 前沿雷達 → 將選定機會帶入一鍵靈感。
- 一鍵靈感 → 將選定候選帶入選題實驗室。
- 選題實驗室 → 採用此題，完成選題並前進投稿導航。
- 單次一鍵任務中間步驟可自動完成，不要求使用者逐頁點擊。

### 提交與導航必須可靠

點擊下一步前先處理未保存內容，後端重新驗證project權限、輸入版本、必要條件、來源版本及下一站可用性。在同一可控提交單元中保存completion snapshot、handoff reference與transition record；外部網路工作不可塞進長資料庫transaction。

使用idempotency key與樂觀鎖：重複點擊、重試、多分頁、最後一刻來源變更時，不得產生雙重完成快照或用舊版過關。若資料已保存但前端導航失敗，顯示「交接已保存，重新開啟下一階段」，重用同一handoff，不重新付費或重新生成。

完成時鎖定的是**本次交接快照**，不是永久禁止修改研究。之後修改建立新工作版本，並使受影響下游標示NEEDS_REVALIDATION；保留歷史已完成快照。

---

## 6. 缺失總覽與精確導航：補完能回原流程

建立共用 RequirementIssuePanel／IssueNavigator。每個問題至少保存：

- issue_id、requirement_id、project_id、stage_id、entity_id、field_ref、source_revision。
- 缺什麼、為何需要、影響哪個下一步／哪個RQ、目前值或狀態。
- issue_type：EMPTY、INVALID、SOURCE_MISSING、CONFLICT、STALE、LOCKED_CONFLICT、PENDING_USER、PENDING_EXTERNAL、PERMISSION、MODULE_UNAVAILABLE等。
- severity、blocks_transition、處理者、可用AI動作、需要使用者提供什麼。
- destination_route_id、section_id、tab_id、anchor／field_ref、return_context_id。

缺失卡顯示：

```text
缺失：尚未說明研究對象
原因：下一階段需要判斷題目適用範圍
[前往研究對象欄位] [老麥建議適合對象]
提示：建議對象不代表已取得該群體或招募許可。
```

```text
缺失：初步Gap缺少可追溯來源
[前往文獻與證據中心] [老麥協助搜尋支持與反證]
```

```text
需重驗：鎖定的Gap與新增相近研究可能衝突
[查看新文獻與差異] [老麥提出修訂候選]
不得自動解鎖或覆寫原Gap。
```

導航後必須保留workspace、project、idea、版本與返回位置；必要時開啟對應tab、展開收合區、捲動並聚焦具體欄位，而非只回首頁或模組入口。具體輸入錯誤在頁首摘要及欄位旁使用一致文字。[S1]

問題存在動態列表時使用穩定item_id，不使用會變動的第3列索引。route由白名單registry解析；AI不能任意填外部URL、javascript或不受控returnTo。

修正後由後端重新檢查來源規則；單純點過連結、開啟文獻或AI說「完成」不會自動清除缺失。頁面提供「保存並返回原階段」，返回後刷新原readiness及定位；保留其他未完成內容與滾動狀態。

外部頁面需要人工操作時，使用核實的官方入口並說明目的；沒有成功回執不自動標示已處理。缺權限時顯示可請求授權或聯繫管理者的站內方式，不洩漏其他專案敏感內容。

---

## 7. 所有項目都有老麥協助，但動作按資料性質限制

建立共用 FieldAssist／SectionAssist／StageAssist，不能只在首頁放一個聊天框就宣稱所有欄位已支援AI。

### 三層操作

- **欄位層**：老麥一鍵協助、說明用途、提出候選、依來源補全、優化、找依據、檢查、查看差異、鎖定／解鎖。
- **區塊層**：補全本區未填欄位、優化本區未鎖定草稿、建立替代方案、檢查一致性、鎖定本區。
- **階段層**：老麥一鍵完成本階段可自動處理項目、檢查缺失、生成修復計畫、套用並保存、按授權自動鎖定、重新驗證下一步。

UI預設只突出「老麥一鍵協助」及鎖定控制，其餘放展開選單；不能把每欄變成十多個按鈕。每個動作說明會讀取哪些資料、修改哪個範圍及是否有外部費用。

### 欄位分級

| 欄位類型 | 老麥可以做 | 不可以做 |
|---|---|---|
| 創作／規劃草稿 | 起草題目、研究問題、初步Gap、方法方向、比較、風險與摘要 | 把規劃寫成已完成研究或已驗證事實 |
| 來源支持欄位 | 讀取授權來源，擷取有來源位置的候選值，說明支持／反證與限制 | 不經查證補造DOI、作者、全文、引用或最新官方規定 |
| 使用者／場域事實 | 從已提供資料帶入、找矛盾、提出需要確認的清單 | 編造教授職稱、設備、合作場域、實際樣本、經費或授權 |
| 程式計量／正式結果 | 解釋程式輸出、導向原計算或分析模組、提出重查任務 | 手改trend count、p-value、Result Fact、Raw Data、checksum |
| 簽名／同意／核准／送件回執 | 解釋需求、準備草稿、協助讀取真實文件後提出待確認欄位 | 代造本人同意、作者批准、IRB核准、計畫核定或送件成功 |
| 來源型、唯讀、鎖定內容 | 解釋、比較、指出缺失、提出新候選、導航到來源 | 在本頁任意覆寫唯讀紀錄、解鎖或抹除歷史 |

因此「所有項目有AI協助」不是「所有值均可自由生成」。不可自動填入的項目仍提供清楚協助與缺失導航，不只灰掉功能。

每欄必須有具專業脈絡的生成策略。例如方法方向需讀RQ、對象與資源，研究缺口需讀相近文獻及反證，不能所有欄位都使用「幫我寫得專業」的一句通用prompt。

---

## 8. 一鍵自動補全、優化與批次套用

提供三種可理解的模式：

1. **補全空白**：預設模式。只處理允許的空白或缺失草稿，保留所有既有內容與鎖定值。
2. **優化未鎖定內容**：使用者明確選擇後，為未鎖定內容提出patch或新候選；優化不等於重跑所有外部搜尋。
3. **補全並鎖定**：使用者一次指定範圍、可外傳內容與預算後，對已通過適用檢查的允許草稿套用並鎖定；無法通過者留下缺失及跳過原因。

可另設「本階段自動協作」偏好，但默認不自動跨入下一階段、更不自動對外送件。若使用者明確選擇「補全後繼續至已建置的下一階段」，仍需後端gate通過；不可強制把blocked改ready。

批次處理：

```text
保存輸入快照及來源版本
→ 後端檢查project權限、欄位政策、鎖定與預算
→ 按欄位依賴建立可執行計畫
→ 重用資料／授權查證／產生候選
→ Schema與業務規則驗證
→ Evidence、矛盾及專業一致性檢查
→ 僅套用仍符合版本條件的patch
→ 保存新版本與逐項處理結果
→ 按明確授權鎖定通過的草稿
→ 重新計算缺失與下一步
```

每項回傳 APPLIED、SUGGESTION_READY、SKIPPED_LOCKED、NEEDS_USER_INPUT、NEEDS_EVIDENCE、PENDING_EXTERNAL、CONFLICT、FAILED 或 CANCELLED。部分成功可繼續，不能整頁清空；顯示已補全幾項、跳過幾項及原因。

一般低風險草稿可一次授權後自動套用，不逐段彈窗。涉及改寫既有人工內容時必須保留原版與diff；來源不符、重大科學意義改動或外部授權不足時保留候選，不靜默套用。

補全程序不能無限循環搜尋或重寫；依賴圖必須無循環，有執行步數、工具呼叫及費用上限。遇到互相矛盾的鎖定欄位時提出一個需要裁決的問題，不一直用不同措辭重試。

外部服務無憑證時仍提供本地草稿與說明；不要自動安裝或訂閱另一供應商。數值、文獻與已知事實缺證據時保留null或明確假設，不用漂亮內容掩蓋未知。

---

## 9. 鎖定、版本與審查是不同動作

鎖定功能必須同時出現在欄位、區塊、所選題目與交接快照。

### 使用者可操作

- 鎖定本欄位／本區塊／所選題目。
- 查看鎖定來源版本、鎖定人、時間、依據及是否仍為草稿。
- 解鎖並編輯新工作版本。
- 保留原鎖定內容，要求老麥提出替代候選。
- 對可處理的低風險草稿使用「補全並鎖定」。

鎖定採value／artifact revision reference，不另複製一份失去來源的文字。至少保存lock_id、scope、field_refs、artifact_revision、source_manifest、locked_by、locked_at、lock_origin、authorization_reference及lock_revision。

`lock_origin`區分USER與AUTOMATION_POLICY。AI自動鎖定的畫面須顯示「AI草稿已鎖定／待人工審閱」，不能改成「研究者已核准」。解鎖不刪除先前的不可變版本；涉及正式核准文件仍走既有修訂或amendment流程。

### 強制技術保護

1. 所有寫入路徑都檢查鎖：手動儲存、autosave、AI patch、同步、批次匯入、背景任務及adapter。不能只在前端disabled。
2. AI開始後使用者鎖定或編輯內容，完成時須再次檢查base_revision與lock_revision；失效的輸出只保留候選，不能覆寫。
3. 鎖定欄位不能被「重新生成整區」間接替換，也不能藉生成新版本後自動切active pointer繞過鎖。
4. 相同值需要補充來源時，Evidence link的變更也需版本化；不能改來源引用而保持「原鎖定科學主張仍然有效」的假象。
5. 上游改變時不自动解鎖：標示LOCKED_SOURCE_STALE，列出受影響項目及diff，阻止依賴它的正式交接，允許查看和提出修訂。
6. 創作欄位中的合理預期可鎖成草稿，但鎖定不會提高evidence_status；真實事實未確認不能以自動鎖定通過正式事實驗證。
7. 不強迫使用者把10個候選及所有選填欄位都鎖定，才准採用一題；完成時鎖定實際交接所需的必要輸出即可。
8. 一般可編輯欄位可合法解鎖；Raw Data、Result Fact、官方回執等來源型資料只能按原模組政策處理，不能提供通用「解鎖即可改數字」。

本輪不新增供網站管理者隨意改寫已鎖定研究事實的後門。

---

## 10. 新版第二階段的入口與研究焦點

三種入口保留：

- 看前沿：先瀏覽研究機會。
- 給我靈感：從關鍵字自動完成搜尋、候選與推薦。
- 我有想法：直接分析既有構想，不被迫點完雷達。

最少輸入可為研究領域、關鍵字，或使用者明確選擇「依我的研究背景推薦」。可用背景不足時，提供領域候選與選擇入口，不無限追問或杜撰專長。

可編輯的領域預設：AI跨領域、AI教育、AR／VR／XR教育與職安、數位科技於環境工程與職安、新興數位科技；智慧製造、陶瓷、CNC與研磨是可選延伸，不能每次強行混入。

帶入ResearcherProfile中的已知專長、既有題目、文獻、資料、設備、場域、偏好及限制。以下分開呈現：

- 已提供的事實。
- 老麥提出的假設／可選方案。
- 尚待使用者確認的可取得資源。

研究時間與預算是規劃限制，不是保證期刊接受或研究完成期限。產出路線可選期刊研究、國科會一般研究計畫、教育部教學實踐或尚未決定；只保存目標意向，本階段不冒充正式選刊／學門或資格判定。

本頁每個欄位套用FieldAssist及鎖定。研究焦點或排除條件鎖定後，一鍵跨域發想不得靜默擴大範圍；想超出時建立替代scope候選。

---

## 11. 共用檢索、文獻中心與Zotero

所有模組只使用第一階段共用文獻服務。來源按已授權能力選用：

- OpenAlex：書目搜尋及可用的篩選、分組計數。[S6]
- Semantic Scholar：相近研究、引用與參考文獻探索；推薦結果不是完整領域樣本。[S8]
- Crossref／出版社：DOI、書目與出版日期核對；書目存在不代表已讀全文。[S7]
- Zotero指定Collection：個人既有文獻與研究延伸；個人收藏不當作全球計量樣本。[S5]
- Consensus、arXiv或其他已合法連線來源：按適用領域輔助搜尋，標示預印本及取得範圍。

不得杜撰API、認證方式、欄位、配額、費率或已完成的搜尋。每個來源依其實際能力轉換查詢語法，不把同一Boolean字串盲目送所有API。

SearchSnapshot保存project、scope_version、來源、精確query、篩選、文件類型、時間範圍、date_basis、date_precision、searched_at、reported_total、retrieved_count、pagination_complete、included_ids與限制。局部擷取不標成完整檢索；聚合計數不等於已閱讀相同數量文獻。

所有正式Evidence與引用先建立既有Canonical Literature Record、ProjectLiteratureLink、EvidenceNote及CitationSource，不在雷達／選題另存一份孤立書目。搜尋命中不自動全部塞進核心文獻或Zotero。

分開記錄：metadata_status、access_status、reading_status、claim_support、publication_version_status、zotero_link_status。AI讀到摘要只能標摘要分析，不標全文已審閱。來源更新、勘誤、撤稿或版本差異如無法核對須明示；不同資料庫命中數不是獨立研究數。

同授權工作區可按穩定ID去重；跨工作區不得因DOI相同洩露私人附件、註記或用途。預印本與正式版保留各自記錄及版本關係。

Zotero沿用Web API v3及已授權的Library／Collection範圍；外部身份為library_type＋library_id＋item_key，內部引用以citation_source_id穩定關聯。[S5]

本輪不新建全庫雙向同步。既有「加入Zotero」若已明確獲寫入授權可重用；否則顯示待設定。沒有Zotero item key不阻止本地引用或選題。遠端更新不能覆寫專案鎖定的主張；先建立Metadata／Evidence差異待處理。

所有「查看依據」「補充文獻」「處理反證」都導航到同一文獻中心並能返回原欄位。

---

## 12. 前沿雷達：實際訊號與老麥推論分開

頁籤：目前熱門、未來新興、我的追蹤。預設「我的前沿」，依專案焦點；可擴展領域探索，不宣稱已掃描全球所有研究。

卡片包括：方向、問題、訊號類型、來源範圍、比較期間、實際計量或資料不足、代表文獻、Gap線索、專業適配、反證與風險、判斷理由、信心限制及最後成功更新。

按鈕：查看證據、老麥解說、一鍵延伸研究機會、加入追蹤、鎖定本次機會版本、送入一鍵靈感、帶入選題實驗室。可以選一個或多個機會；不要求鎖住所有雷達卡片。

### 趨勢計算規則

1. 預設可用近三年研究版圖，並比較相鄰等長期間，例如兩個365天窗口；凍結任務as_of時間，日期動態計算，不寫死年份。
2. 使用同一來源、query版本、文件類型、日期口徑。不同來源不能不經去重相加為全球總量。
3. publication／posted、DOI created、metadata update及retrieved日期分開；更新舊文獻不等於新發表。[S7]
4. 日期精度不足就改用可支持的窗口或標示限制；不以未完年度對完整年度，不把索引延遲直接當衰退。
5. 基期大於設定最低門檻且口徑可比時，由程式計算growth_pct = 100 × (current_count - previous_count) / previous_count。
6. 基期0或過低時比例null，顯示兩期數量與低基期提示，不給無限成長或自動最高分。
7. 分頁截斷、限流、搜尋樣本不足或無聚合數據時，不生成假曲線。可完成文字機會判斷，但揭露PARTIAL／CONCEPT_ONLY。
8. 模型不能寫入trend計量值。MetricRecord保存原數值、口徑、公式版本、日期、去重規則與品質標記。
9. 引用總數不是引用增速；無歷史快照不算加速度。文獻量少不等於新穎，量多也不代表值得的缺口消失。
10. 未來新興使用「可觀察訊號＋推論＋可失敗條件」，不給確定預測。

雷達階段完成：當前scope已保存、選定機會或直接構想有來源／假設標記、必要查詢限制已記錄，可交給下一模組。不要求所有來源全部連通。

---

## 13. 一鍵靈感：可自動產生、逐欄輔助並保護已選方向

輸入可來自雷達、Project關鍵字、已有構想、老麥對話摘要或專案文獻；保存input snapshot。

一次授權可完成：讀背景 → 查詢計畫 → 授權檢索 → 保存來源 → 機會整理 → 候選產生 → 初步比較 → 推薦摘要 → 保存新草稿。

預設10題：5核心延伸、3跨域拓展、2前沿探索；數量與比例可配置。不同題目必須有不同研究問題、貢獻或可行路徑，不只是換字。實際只有少量合理題目時保留實際數量與原因，不為湊數編造文獻。

每題至少有：

- 中文／英文題目、30秒重點、問題與重要性。
- 初步RQ、Gap假說及其支持／反證／未驗證狀態。
- 相近研究與初步Contribution Delta。
- 主要貢獻、理論或概念框架（適用才提出）、方法方向。
- 研究對象、場域、資料需求、主要結果指標。
- 最低可行研究與進階版、已知資源、待確認資源。
- 專業適配、風險、替代方案、研究時間／成本假設。
- 初步成果路線、來源ID、assumptions、unknowns。

每個欄位都有FieldAssist。例如「老麥補研究問題」「根據文獻重寫Gap」「降低開發難度」「提出可測量結果」「檢查與方法是否一致」。選擇優化單題不能改掉其他已鎖定候選。

卡片提供：查看詳細、老麥一鍵補全本題、提出替代版本、查看來源、鎖定本題、加入比較、保留／排除。排除只改推薦顯示狀態，保留紀錄，不刪來源。

不能假設使用者已擁有設備、可招募學生或有足額經費。來源不可用時可生成CONCEPT_ONLY草稿，使用待驗證狀態，不能標成已完成最新文獻查核。

一鍵靈感的必要完成條件是已有至少一個可比較且資料狀態明確的候選、保存版本及選取對象；不是固定10題全填滿全鎖定。

---

## 14. 選題實驗室：比較、初步查證與採用

支援多題比較、直接輸入既有構想與重開保存題目。同頁比較2–4題是UI預設；只有一題時仍可評估，不強制再造其他候選。

比較問題、初步Gap、相近研究差異、RQ／方法方向、資料與場域、最低可行研究、風險、證據狀態及路線。對Top候選在剩餘預算內加深相近研究搜尋，不無限制逐題全文分析。

老麥動作包括：補齊本題、增加可檢驗貢獻、減少不必要技術、提出簡化方法、找最強反對理由、找相近研究與反證、保留鎖定內容重做其他欄位。

不因換人群、科技或地點就判定高新穎；也不自動淘汰有價值的複現、外部驗證、測量或教學改善研究。相似度是研究面向比較，不是抄襲百分比。

### 評分

沿用獨立內部Topic Fit：問題重要性20、初步新增貢獻20、RQ／方法可回答性20、執行可行性20、研究者適配10、成果延伸10。每面向0–5評等，後端依rubric算分。

每項有理由、evidence_ids、assumptions、missing_information、rubric_version。未知保留null；缺項顯示已評得分／已評權重及coverage，不將部分分數重標完整100分。

適配分數與證據信心分開；模型自信不代表完整檢索。正式資格、資料權限或安全限制另外標示，不能用高分抵銷。不得把fit當接受率、通過率或科學品質保證。

評分解釋可請老麥協助，正式總分由程式計算、不可自由手填。手動評分需角色與理由；不能讓AI直接設人工核准或變更rubric來抬分。

### 推薦

Top 3角色：最佳平衡、現有資源較易落地、前沿拓展。不能保證最快發表或通過；不足三個合適題目只給實際數量。顯示每題最有力反對理由、重大待查條件及改善方向。

本階段只產生初步新穎性判斷與後續深度Gap任務，不重建正式Gap實驗室。

---

## 15. 第二階段必要清單與投稿導航交接

為各實際入口建立適用requirements；不要把網站建置清單當使用者填寫清單。

### 選題交接最小必要項

1. 有效Project及已保存研究焦點／已選背景。
2. 有明確選定的topic版本，不是只有推薦排序。
3. 題目、核心問題、初步RQ、預期貢獻均可讀且互相一致。
4. Gap有明確「線索／假說／範圍內支持」標記；有引用的主張均能追溯；沒有來源就明示未驗證。
5. 研究對象、方法方向、所需資料及最低可行研究已提出；資源可取得性未知時有具體待確認項，不能假裝已取得。
6. 所有已知限制、反證與主要風險已保存；不存在以虛構事實掩蓋的核心衝突。
7. 初步路線已選或明示「投稿導航協助決定」。不要求先知道最終期刊或學門。
8. 本階段required missing／source conflict已按適用規則處理；非阻擋的待查資訊一併交接。
9. 使用者按採用或已有明確限定的自動選取授權；自動選取不標成人工核准。
10. 最終輸出成功保存，來源版本未衝突，completion／handoff snapshot已鎖定。

純構想模式可完成「初步選題交接」，但target capability限定為draft planning；不能宣稱正式新穎性驗證完成。若專案明確要求先完成live文獻支持，該要求是必要項，未取得就阻擋該路徑，不擅自降級。

### TopicSelectionSnapshot

至少保存project_id、topic_id／version、選取原因、source_run_ids、標題、concept_abstract、問題、RQ、初步Gap、方法、對象／場域、結果指標、貢獻、minimum_viable_study、資源、assumptions、unknowns、risks、source_snapshot_ids、literature_ids、citation_source_ids、評分版本、Evidence狀態、路線意向、selected_by、selection_method、selected_at及來源manifest。

附上`handoff_limitations`、`downstream_open_requirements`及`lock_manifest`。鎖定的早期限制需在下一階段顯示，不因進入新頁消失。

投稿導航存在時用adapter接收snapshot，不重問資料。下一階段可修改衍生草稿，但不能覆蓋原選題快照。不存在時保存HANDOFF_READY及下一階段說明，主按鈕可重開交接，不跳空白頁。

低風險自動採用依使用者policy可建立AUTO_SELECTED草稿與預覽，但不假造HUMAN_APPROVED，不自動對外投稿。預設由研究者一次點擊「採用此題並前進投稿導航」，不逐欄確認。

---

## 16. 共用資料契約：重用模型，不機械新增大量資料表

以下是邏輯契約，可擴充現有artifact、registry、typed JSON及必要索引；實際名稱按目前ORM。

### 通用操作層

- StageDefinition／RequirementDefinition：用途、路由、適用規則、必要項、輸出、下一階段解析。
- FieldDefinition／FieldPolicy：穩定field_ref、值型別、資料性質、AI動作、來源要求、鎖定與確認政策。
- StageReadinessSnapshot／RequirementIssue：評估版本、缺失、阻擋原因與導航。
- FieldLock／SectionLock：指定值與來源版本，不覆寫既有lock模型。
- AssistPlan／AssistPatch／AssistApplyResult：目標範圍、提案、基底版本、Evidence、鎖定檢查及逐項結果。
- StageCompletionSnapshot／StageTransitionRecord：不可變交接、版本及冪等識別。
- ModuleIntegrationStatus：每個現有模組接入共用操作層的真實程度。

### 探索與選題

沿用／擴充ExplorationScope、SearchSnapshot、MetricRecord、RadarOpportunity、ResearchIdeaVersion、TopicEvaluation、TopicSelectionSnapshot及RecommendationSchedule。

模型、任務與連結均含workspace／project scope。AI不能自由指定任意資料表或JSON path寫入；後端依FieldPolicy解析allowlist。列表型欄位以穩定entity_id索引，不以畫面排序索引。

### RequirementIssue格式示意

```json
{
  "issue_id": "ISSUE_EXAMPLE_ONLY",
  "project_id": "PROJECT_EXAMPLE_ONLY",
  "stage_id": "topic_lab",
  "requirement_id": "selected_idea.rq",
  "entity_id": "IDEA_EXAMPLE_ONLY",
  "field_ref": "research_question",
  "status": "MISSING",
  "blocks_transition": true,
  "message": "尚未寫出可回答的主要研究問題",
  "expected_revision": "VERSION_EXAMPLE_ONLY",
  "destination": {
    "route_id": "topic_lab_detail",
    "tab_id": "research_question",
    "anchor": "primary-rq"
  },
  "assist_actions": ["EXPLAIN", "DRAFT_FROM_CONTEXT"],
  "requires_user_fact": false,
  "return_context_id": "RETURN_EXAMPLE_ONLY"
}
```

示意ID不得灌入正式資料。

### AI寫入提案

只包含允許的field_ref、base_revision、expected_lock_revision、proposed_value、source_refs、assumptions、checks及change_reason；人工核准、正式source verification、IRB、送件或機密欄位不在模型可寫allowlist。

來源ID不但要存在，還須確實屬於當前授權專案／來源工作區。收到結構正確JSON也不代表可直接套用，必須經服務端政策、Evidence與版本檢查。

---

## 17. 共用API、回寫安全與所有階段的接入標準

沿用現有route風格，不因以下能力列表重寫全站API。

必要能力：取得stage readiness、啟動本階段檢查、讀取缺失、解析缺失導航、欄位／區塊／階段assist、套用patch、鎖定／解鎖、讀取版本diff、完成並交接、恢復handoff、取得功能說明及現有job事件。

所有操作：server-side membership／role、schema validation、optimistic concurrency、idempotency與AuditEvent。前端隱藏不是安全控制。來源、鎖定、權限與project回收狀態在**執行時與提交時**都要確認。

### 已建置與未建置階段

1. 盤點所有已存在stage頁及其編輯器欄位、衍生輸出、來源唯讀欄位、按鈕和必填規則。
2. 以StageWorkspaceShell＋FieldAssistBoundary或等價adapter包裝，不複製stage內部數據。
3. 每個registry項目標記完整接入／部分接入／需要adapter／未建置及缺項。
4. 當前stage2全部可編輯欄位必須完整接入；其他已建置階段亦須有可用的下一步、真實缺失與對應AI協助。不能只在標題列裝一個假的「一鍵完成」。
5. 未建置模組显示用途、交接狀態與建置待辦，不以假運算／假AI回應通過驗收。
6. 後續每階段提示詞／工程任務繼承本契約；沒有next-step、issue link、assist policy或lock contract者不能標完整。

建立module-field coverage報告：總項目數、可生成、來源查證、來源唯讀、需人工、已鎖定及尚未接入數。若工作量或相依阻塞造成未完成，列實際缺口，不能聲稱全站所有項目已完成。

---

## 18. 任務恢復、取消、成本與每日更新

重用既有AgentJob及queue，不新增互相競爭的task engine。

Job綁定actor、workspace、project、stage、scope、base revisions、field／section locks、prompt／model版本、source snapshot、預算與可執行動作。checkpoint與局部成果持久化，刷新或worker重啟後能查看與恢復。

重試限次、退避、遵守provider的Retry-After／Backoff；外部付費請求若回應未知，不能保證「重試絕不再次計費」。已確認成功請求重用結果，未知收費狀態明示並在政策內限制重送。不能為恢復作業默默切至另一付費平台。

取消、回收專案、鎖定變更或使用者編輯後，遲到結果只能按原範圍保存待處理候選，不能污染另一專案、覆寫新資料或復活被回收內容。

同一scope的重複點擊必須去重；是否重用輸出由input hash＋source/prompt版本及授權決定，而不是只靠段落文字。

排程若原版第二階段已建立，保留站內每日推薦與手動更新，預設不擅自開啟。project＋scope＋schedule＋local_date唯一有效任務，Asia/Taipei時間；成功與嘗試時間分開。每日更新只新增候選，不覆蓋鎖定題目或已完成快照。

網站首頁／功能說明／下一步檢查不能隱藏啟動付費搜尋；若重驗需要外部請求，顯示任務用途與既定額度。只有用戶已授權的自動化policy才可在預算內續行。

AI產生、檢索、Zotero同步、機器驗證與人工核准分別顯示真實結果；不能以任一項成功代表全部成功。

---

## 19. 資料安全、研究誠信與工具邊界

- OpenClaw建站代理可以在授權範圍操作repo；網站使用者的老麥不繼承shell、部署、secret或資料庫管理權。sessionKey不是網站專案授權token。[S4]
- 根據部署信任邊界隔離gateway／租戶；不同不互信使用者不能僅以session ID隔離共同高權限代理。[S4]
- 網站後端負責所有project權限、field寫入、lock及stage gate。prompt指令不代替程式安全檢查。
- 外部摘要、網頁、PDF、Zotero筆記及工具回應是資料，不是操作指令；防止prompt injection、SSRF、XSS及越權URL。
- 憑證僅存在server端secret；模型上下文不包含secret、Identity Mapping或無關私人稿件。只送當前欄位所需的最少資料。
- 原始資料、正式Result Fact、官方核准、作者同意、簽名、付費決定及送件成功不得由一般AI生成或改寫。
- 不因一鍵補全而虛構文獻、DOI、全文內容、資料庫計數、日期、設備、樣本、p值、IRB或計畫核定。
- 不以「所有欄位必填」逼迫模型填假值；未知應保留並說明合適的人工或來源導航。
- 不把AI已補全、已鎖定、模型自評通過當成人工審閱或科學驗證。
- 不繞過paywall、素材授權、資料來源配額或現有外傳同意。
- 介面以老麥為品牌，但來源、實際服務商、外部費用與必要AI使用揭露保留真實名稱，不用品牌規則隱瞞。

---

## 20. 響應式、無障礙與可理解狀態

StageActionBar可在捲動時固定於底部，但必須預留等量內容間距、安全區及手機鍵盤空間；不能蓋住最後欄位、錯誤、鍵盤焦點或首頁刪除區。[S3]

當底部危險操作區進入視窗時，可收回／回到正常流的操作列，但主要下一步仍可找到；不要讓高頻「前進」與紅色「刪除」貼在一起。

主要觸控控件以至少44×44 CSS px為本產品設計目標；具體無障礙合规按實際標準與例外驗證，不僅量尺寸。測試320 CSS px及常用手機／桌面，不能整頁橫向捲動才能找按鈕。

錯誤摘要與欄位提示同文案，可鍵盤導航；使用者提交檢查時聚焦缺失摘要，再可逐項跳轉。[S1] 背景任務更新不突然搶焦點。動態保存、補全數量及錯誤提供合適的可辨識狀態訊息，避免每個串流token都讓讀屏重複播報。[S2]

鎖定、完成、缺失不能只靠紅綠色；搭配文字、圖示與可展開原因。按鈕文案說明動作與目的地，例如「前往文獻中心補充Gap」，而不是所有按鈕都叫「處理」。

新手導覽可跳過、關閉、重看；完成導覽不更新研究進度。老麥說明读取同一registry與即時狀態，不猜不存在的按鈕或功能。

---

## 21. 版本過期、鎖定失效與回復

上游改動不直接刪掉或改寫下游。建立dependency graph及Impact Assessment，例如：

- Scope改變 → 來源快照、雷達、候選及推薦需重驗。
- 新增高度相近研究 → 受影響Gap／Contribution Delta需重驗。
- 使用者修正資料取得條件 → 可行性／最低可行研究及排序需重驗。
- Selected Idea內容改變 → 舊handoff保持，新version與下一階段標示待更新。
- 欄位鎖定／解鎖改變 → 執行中assist按最新lock_revision判斷是否可套用。

已完成快照是歷史有效事實，不原地篡改；目前工作狀態可變NEEDS_REVALIDATION，首頁進度按現行必要條件重新計算並說明變更。

回復某版只建立新的活動工作版本或version pointer操作及審查紀錄；不能復原過期permission、重新發送外部任務或回到不存在的source。介面提供「查看舊版」「比較差異」「採用為新草稿」而非不留紀錄地回填。

每次套用、鎖定、解鎖、檢查、完成、導航交接、來源更新與恢復均有actor、timestamp、reason、相關版本及project audit。

---

## 22. 四個實作批次與停止規則

### 批次A：盤點與共用操作契約

完成現有頁／欄位coverage盤點、StageReadiness、FieldPolicy、缺失深連結、鎖定與版本保護、必要相容migration。先用現有表單實测一個「補全→鎖定→發現缺失→導航補足→返回」閉環。

### 批次B：首頁整合與三模組完整功能

保留HOME-01／HOME-02：專案保存讀取、未完成清單、研究路徑、功能說明、近期成果及回收。完成共用檢索、雷達計量、候選生成、選題比較、欄位協助與Evidence引用。

### 批次C：批次自動化、所有已建置階段接入與交接

實作一鍵補全／優化／補全並鎖定、單項失敗恢復、缺項處理閉環、全部現有stage的通用adapter及coverage報告。建立選定快照與投稿導航adapter，沒有下一頁时顯示交接說明而不造假。

### 批次D：整合、安全、衝突、恢復與可用性驗收

執行適用lint、typecheck、unit、integration、E2E、production build及手動鍵盤／手機檢查。真實來源與無憑證降級均測試。遺留項如實列出，不以刪測試、關權限或關鎖定換取通過。

不因本文件詳盡而另開新框架或一次重做所有下游專業引擎。各批都屬本輪第二階段，完成後停止，等待新版第三階段指令。

---

## 23. 驗收案例（44項）

全部範例資料必須隔離並標示SYNTHETIC_TEST_ONLY，不進正式文獻計數、研究成果或用量紀錄。依實際研究類型列適用項；不適用需理由，沒執行不算通過。

| ID | 場景 | 必須驗證 |
|---|---|---|
| T01 | 首頁保存／讀取 | 修改專案後保存、刷新及重新登入，可讀回同一後端內容與版本；失敗時保留本地內容。 |
| T02 | 未完成選單與隔離 | 草稿／進行／暫停／需修訂正確列出；排除未授權／回收／封存／結案；A切B後遲到資料不混用。 |
| T03 | 首頁功能導覽 | 六種意圖、說明、下一步、文獻摘要及近期成果使用同一registry與真實資料；不啟動隱藏付費工作。 |
| T04 | 回收與復原 | 底部回收確認正確專案，不刪共用文獻或Zotero；遲到job不復活專案；復原不自動重啟任務。 |
| T05 | 直接構想入口 | 已有題目可直接進選題實驗室；無外部來源時可形成標示清楚的概念草稿，不冒充live查證。 |
| T06 | 三模組一鍵流程 | 從背景／關鍵字至候選與推薦可在一次授權內連續執行，不逐段彈窗；真實來源與限制皆可查。 |
| T07 | 趨勢計數 | 測試資料基期100、本期120同口徑時得20%；基期0／低基期按規則null與警告；未知不填0。 |
| T08 | 時間與來源口徑 | 舊文章metadata更新不算新出版；日期精度、來源、query版本或期間不可比時不產生偽成長。 |
| T09 | 搜尋不完整 | 分頁不足、來源限流或只有推薦樣本時顯示PARTIAL；聚合數量不冒充已閱讀數量。 |
| T10 | 版本與跨庫去重 | 預印本／正式版保留書目與work-family；無法跨庫去重不相加成全球總量，不洩漏私人附件。 |
| T11 | AI不得改計量 | 模型輸出的無來源count／百分比不能寫入MetricRecord；無數據不能生成趨勢曲線。 |
| T12 | 候選品質與數量 | 重複措辭候選被提示；不足10個合理題目保留實際數量；單題可比較評估不硬造新題。 |
| T13 | 證據與評分 | 未知rating保留null；fit與coverage分開；摘要不標全文已讀；查不到不標全球首創。 |
| T14 | 單欄位協助 | 題目／RQ／Gap／方法／風險每欄可用正確context起草或補全，來源型項目提供查證而非自由生成。 |
| T15 | 批次補空白 | 一鍵補全只改允許的空白欄位，保留人工內容、鎖定值及其他候選，不重建全專案。 |
| T16 | 優化未鎖定 | 使用者授權後可批次優化未鎖定內容，保留原版、diff與使用者修正，不誤改readonly來源。 |
| T17 | 自動鎖定 | 補全並鎖定只鎖通過適用檢查的範圍，記錄AUTOMATION_POLICY；人工審閱仍為未審閱。 |
| T18 | 後端強制鎖 | 直接呼叫API、autosave、匯入或sync嘗試覆寫鎖定欄位均被攔截；不是只有UI禁用。 |
| T19 | 執行中鎖定 | AI運行時使用者鎖定／編輯，遲到patch進候選或CONFLICT，不覆寫新版本。 |
| T20 | 解鎖與舊版 | 解鎖後以新工作版本編輯，舊鎖定內容可回溯；不能藉新active pointer靜默繞過鎖。 |
| T21 | 來源過期 | 鎖定Gap與新研究矛盾時標LOCKED_SOURCE_STALE並導航差異，不自動解鎖或抹除反證。 |
| T22 | 保護正式事實 | 要求AI填樣本結果、p值、IRB號或簽名時，提供來源／人工導航，不造假或設已核准。 |
| T23 | 缺項總覽 | 必要RQ缺失時顯示原因及清楚按鈕，不能僅灰掉前進或只報請完善內容。 |
| T24 | 精確導航 | 點缺失進正確project/entity/tab並展開、聚焦field；返回原階段保留其他草稿與上下文。 |
| T25 | 缺失解除驗證 | 只點連結不清除問題；保存有效資料後後端重驗才更新SATISFIED及Next按鈕。 |
| T26 | 鎖定缺項處理 | 鎖定內容無效時可看差異／解鎖新版本，AI不能為補完缺項直接改原文。 |
| T27 | 必要與選填 | 全部適用必要項通過才完成；選填空白不阻擋；NOT_APPLICABLE有理由，不能隨意跳必要項。 |
| T28 | 不要求過多前置 | 初步選題不要求IRB／完整統計；概念模式誠實交接，但有明確live證據要求時不得暗自降級。 |
| T29 | 醒目前進 | 三模組及全部已接入階段有StageActionBar，完成時顯示帶下一站名稱的可執行按鈕。 |
| T30 | 最後一刻重驗 | 按下一步時修改來源／版本使條件失效，後端拒絕舊readiness並返回缺失，不繞過。 |
| T31 | 重複前進 | 雙擊、網路重試及多分頁不重複建立completion／handoff；已有快照可重開下一站。 |
| T32 | 導航失敗 | 後端交接保存成功但路由失敗時顯示重開，不重新跑AI、不再收費。 |
| T33 | 未建置目的地 | 下一模組不存在時保存HANDOFF_READY，顯示說明與待建置，不能跳404或空白頁。 |
| T34 | 研究與建站進度 | 開頁、鎖定草稿、AI說完成及測試通過均不自動標研究、倫理、分析或投稿已完成。 |
| T35 | 分支與自主工具 | Funding／Publication可並存，下一站按workflow決定；獨立翻譯不被全部研究關卡鎖死。 |
| T36 | AI局部失敗 | 批次中一欄失敗保留其他成功草稿，逐項顯示錯誤、跳過與恢復，不整頁空白。 |
| T37 | 取消與重啟 | 取消／worker重啟可恢復真實job狀態；取消或回收後的輸出不能套用或跨專案。 |
| T38 | 成本邊界 | 超額停新外部呼叫；未知收費請求明示，不保證零重複收費也不擅換付費provider。 |
| T39 | Zotero關係 | 只讀已授權Collection；未同步新文獻可本地引用；同步不覆寫鎖定主張或發起未授權寫入。 |
| T40 | 外部注入與越權 | 惡意摘要／來源ID／AI patch path／return URL不得讀secret、執行shell、跨專案取資料或改權限。 |
| T41 | 所有項目coverage | 產出現有stage／field覆蓋報告，逐類列可生成／查證／人工／唯讀，未接入不能標全站完成。 |
| T42 | 可存取操作 | 手機、320px重排、鍵盤、缺失聚焦、讀屏狀態、黏性操作列不遮欄位或刪除區均實測。 |
| T43 | 排程與鎖定 | 每日更新預設不擅開，去重與last_success正確；新推薦不改已鎖定scope、題目及完成快照。 |
| T44 | 既有回歸與誠實交付 | V3底座、首頁兩追加及既有下游模組不回歸；LIVE／MOCK／NOT_RUN／BLOCKED各自列實際結果。 |

每個測試報告保存命令／案例、環境、輸入、期望、實際、證據路徑與結果。模擬測試與真實API整合分開，不把mock success當live success。視覺與易用性另以實際研究者試走「補題目→鎖定→補證據→前進」流程，未執行不得宣稱使用者一定理解。

---

## 24. 最終完成定義、交付文件與下一階段

建立或更新repository中的（路徑依實際結構）：

- `docs/rebuild/phase-02-integrated-scope-and-reuse.md`
- `docs/rebuild/shared-stage-actions-and-readiness.md`
- `docs/rebuild/field-assist-lock-policy.md`
- `docs/rebuild/phase-02-data-contracts.md`
- `docs/rebuild/phase-02-search-and-metrics.md`
- `docs/rebuild/module-field-coverage.md`
- `docs/rebuild/requirements-traceability.md`
- `docs/rebuild/phase-02-test-report.md`
- `docs/rebuild/deployment-and-rollback.md`
- `docs/rebuild/PROJECT_STATE.md`

模組驗收分別記錄，不合併成虛假100%：

- V3_U02_EXPLORATION_WORKFLOW_VERIFIED：三模組與選題交接已實測。
- V3_SHARED_STAGE_NAVIGATION_VERIFIED：已列範圍的下一步、缺失導航及返回可用。
- V3_SHARED_FIELD_ASSIST_AND_LOCK_VERIFIED：AI欄位政策、批次、鎖定、衝突及版本保護已實測。
- V3_U02_LIVE_SCHOLAR_SEARCH_VERIFIED：列出真正測通的來源；無憑證不能通過。
- V3_U02_TREND_METRICS_VERIFIED：真實可比口徑與計算已驗證，只有概念草稿不算。
- V3_HOME_CONTROLS_AND_GUIDE_REGRESSION_PASSED：首頁既有四控制及功能導覽回歸通過。

專案狀態另存：REQUIREMENTS_SATISFIED、STAGE_HANDOFF_READY、TOPIC_SELECTION_HANDOFF_READY等實際映射；它們不是正式科學新穎性或投稿批准。

交付必須說明：實際盤點、修改檔案、migration、API與資料鏈、共用元件接入範圍、AI填入／不能填入規則、鎖定與解鎖流程、來源與趨勢口徑、44項真實驗收結果、LIVE／MOCK／BLOCKED整合、所在環境、未完成項目及可回復方法。

### 最重要的端到端驗收

使用者建立／讀取專案，輸入領域，請老麥一鍵產生候選；鎖定重要內容後補齊其他欄位；頁面指出需要查證的來源，按導航到文獻中心補足並返回；後端確認適用必要項完成，使用者點醒目的下一階段按鈕，選定題目、Evidence、待查條件及鎖定版本一起交給投稿導航。任何一步失敗，原內容、鎖定及專案隔離仍正確。

**完成本輪新版第二階段後停止。下一階段才優化「投稿導航：國際期刊＋國科會一般研究計畫＋教育部教學實踐」。下一階段必須直接沿用本輪的StageActionBar、RequirementIssuePanel、FieldAssist、Lock及Handoff契約，不重新發明。**

## 25. 官方技術與設計查證起點

查閱日期：2026-09-05。以下支持API與設計邊界；欄位規格、流程與預設數量是本專案方案，不是官方科研標準，更不代表網站已實作成功。執行時仍按實際版本、帳號及授權核對。

- [S1] GOV.UK Error summary：錯誤總覽、欄位提示及直接定位。`https://design-system.service.gov.uk/components/error-summary/`
- [S2] W3C WCAG 2.2 Status Messages：狀態更新應可被輔助技術辨識。`https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html`
- [S3] W3C Focus Not Obscured (Minimum)：固定浮層不應遮住聚焦控件。`https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html`
- [S4] OpenClaw Security：Gateway信任邊界、sessionKey及prompt injection限制。`https://docs.openclaw.ai/gateway/security`
- [S5] Zotero Web API v3 Basics：Web／Local API、Library／Collection／Item、版本與授權。`https://www.zotero.org/support/dev/web_api/v3/basics`
- [S6] OpenAlex Group：篩選與分組計數，注意群組及作品數含義。`https://developers.openalex.org/guides/grouping`
- [S7] Crossref REST API Filters：出版、建立、更新與索引日期區別。`https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/`
- [S8] Semantic Scholar API Overview／Recommendations：Academic Graph與相近論文推薦的用途；檢索摘要不代表完整領域搜尋。`https://www.semanticscholar.org/product/api`、`https://api.semanticscholar.org/api-docs/recommendations`
