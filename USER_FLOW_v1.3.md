# User Flow v1.3

```text
登入
  → 智慧快速開始（領域／方向或無想法／成果路徑／可選限制）
  → Portal server → OpenClaw private Gateway
  → fresh horizon-scan → topic-innovation-lab → gap-novelty（候選新穎性仍為 provisional）
  → 候選比較／收藏／排除／重新推薦
  → 選定一題 → S0 Intake 草稿（AI_PROPOSED）
  → 逐欄接受、修改或重新產生
  → S0 preview（已知／未知／假設／風險）
  → 明確人工確認
  → 既有 project-init → projects/active/<project-id>/
  → Project ID 綁定的研究總覽與 Old Mike chat
```

沒有 Project ID 時，只有智慧建立、選題實驗室與初步前沿雷達可用。所有其它模組顯示需要正式 Project ID。任何上游錯誤、沒有來源或沒有 Gateway 連線，都必須停在可理解的錯誤／受阻狀態。
