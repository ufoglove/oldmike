"use client";

import { useEffect, useRef } from "react";
import type { V2SuggestionOption } from "@/lib/v2/prototype-contract";
import styles from "./OldMikeResearchOSV2.module.css";

type SuggestionDrawerProps = {
  open: boolean;
  fieldLabel: string;
  options: V2SuggestionOption[];
  onApply: (option: V2SuggestionOption) => void;
  onClose: () => void;
};

const strategyLabels: Record<V2SuggestionOption["strategy"], string> = {
  EVIDENCE_FIRST: "證據優先",
  BALANCED_RECOMMENDED: "平衡推薦",
  FRONTIER_INNOVATION: "前沿創新",
};

export default function SuggestionDrawer({ open, fieldLabel, options, onApply, onClose }: SuggestionDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], textarea, input, select, [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); returnTarget?.focus(); };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} id="v2-suggestion-drawer" className={styles.suggestionDrawer} role="dialog" aria-modal="true" aria-labelledby="v2-suggestion-title" aria-describedby="v2-suggestion-boundary">
        <header className={styles.drawerHeader}>
          <div><p className={styles.eyebrow}>老麥協助</p><h2 id="v2-suggestion-title">調整「{fieldLabel}」</h2></div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="關閉老麥建議">×</button>
        </header>
        <p id="v2-suggestion-boundary" className={styles.boundaryNote}>以下是可審查的文字策略，不是已驗證事實。套用前請確認證據、數字與引用。</p>
        <ul className={styles.suggestionList}>
          {options.map((option, index) => (
            <li key={option.strategy} className={styles.suggestionItem}>
              <div className={styles.suggestionMeta}><span>{strategyLabels[option.strategy]}</span>{index === 1 && <strong>推薦</strong>}<small>{option.boundary === "ASSUMPTION" ? "假設" : option.boundary === "MISSING_DATA" ? "缺少資料" : "尚未驗證"}</small></div>
              <p>{option.text}</p>
              <small className={styles.rationale}>{option.rationale}</small>
              <button type="button" onClick={() => onApply(option)}>套用此版本</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
