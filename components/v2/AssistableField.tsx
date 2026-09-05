"use client";

import styles from "./OldMikeResearchOSV2.module.css";

type AssistableFieldProps = {
  fieldId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onAssist: () => void;
  onUndo: () => void;
  canUndo: boolean;
  drawerOpen: boolean;
};

export default function AssistableField({ fieldId, label, value, onChange, onAssist, onUndo, canUndo, drawerOpen }: AssistableFieldProps) {
  const inputId = `v2-field-${fieldId}`;
  return (
    <section className={styles.assistableField} data-field={fieldId}>
      <div className={styles.fieldHeader}>
        <label htmlFor={inputId}>{label}</label>
        <div className={styles.fieldActions}>
          {canUndo && <button type="button" onClick={onUndo} className={styles.textButton}>復原</button>}
          <button type="button" onClick={onAssist} className={styles.assistButton} aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="v2-suggestion-drawer">
            <span aria-hidden="true">✦</span> 老麥
          </button>
        </div>
      </div>
      <textarea id={inputId} value={value} onChange={(event) => onChange(event.target.value)} rows={fieldId === "problemContext" ? 5 : 3} />
      <div className={styles.fieldFooter}><span>可編輯草稿</span><span>{value.length} 字</span></div>
    </section>
  );
}
