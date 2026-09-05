import React, { useState } from "react";

interface Home2TourProps { onClose: () => void; }

const STEPS = [
  { title: "1. 專案控制與狀態管理", desc: "頁面最上方隨時掌握目前專案、最新儲存時間與版本狀態，未存變更切換時系統會主動提醒。" },
  { title: "2. 主要行動與路徑建議", desc: "依據真實研究資料與里程碑，老麥為您推導當前最合理的下一步任務，不需茫然摸索。" },
  { title: "3. 意圖引導與功能搜尋", desc: "「今天想做什麼？」六大研究意圖直達目的地，亦可直接使用關鍵字搜尋全站能力模組。" },
  { title: "4. 六群完整地圖與成果摘要", desc: "探索、規劃、執行、分析、寫作至投稿，每項功能均清楚說明輸入、產出、限制與保存位置。" },
];

export default function Home2Tour({ onClose }: Home2TourProps) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="home2-tour-backdrop" role="presentation">
      <div className="home2-tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="home2-kicker" style={{ color: "var(--teal)" }}>
            新手導覽 ({idx + 1} / {STEPS.length})
          </span>
          <button type="button" onClick={onClose} style={{ border: 0, background: "transparent", color: "var(--faint)", cursor: "pointer", fontSize: 12 }}>
            跳過導覽
          </button>
        </div>

        <div style={{ minHeight: 120 }}>
          <h2 id="tour-title" style={{ font: '700 17px "Source Serif 4","Noto Sans TC",serif', color: "var(--ink)", margin: "0 0 8px" }}>{step.title}</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{step.desc}</p>
        </div>

        <div className="home2-dots" aria-hidden="true">
          {STEPS.map((_, i) => <i key={i} className={i === idx ? "on" : ""} />)}
        </div>

        <div className="home2-nav">
          <button type="button" disabled={idx === 0} onClick={() => setIdx(idx - 1)} style={{ opacity: idx === 0 ? 0.4 : 1 }}>上一步</button>
          <button type="button" className="solid" onClick={() => (isLast ? onClose() : setIdx(idx + 1))}>
            {isLast ? "完成導覽" : "下一步"}
          </button>
        </div>
      </div>
    </div>
  );
}
