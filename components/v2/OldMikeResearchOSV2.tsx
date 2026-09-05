"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icons";
import { S0_FIELDS, type S0FieldName } from "@/lib/s0-fields";
import {
  V2_CAPABILITIES,
  V2_GLOBAL_NAV,
  V2_PROJECT_STAGES,
  buildV2PrototypeWorkspace,
  createFactBoundGuidance,
  type V2DirectionCard,
  type V2PrototypeWorkspace,
  type V2StageId,
  type V2SuggestionOption,
} from "@/lib/v2/prototype-contract";
import AssistableField from "./AssistableField";
import SuggestionDrawer from "./SuggestionDrawer";
import styles from "./OldMikeResearchOSV2.module.css";

type IntakeMode = "DIRECTION" | "DRAFT" | "PROPOSAL";

function iconForNavigation(id: (typeof V2_GLOBAL_NAV)[number]["id"]) {
  return ({ HOME: "grid", PROJECTS: "folder", LITERATURE: "book", QUICK_TOOLS: "spark", SETTINGS: "shield" } as const)[id];
}

function suggestionOptions(field: S0FieldName, label: string, currentValue: string): V2SuggestionOption[] {
  const base = currentValue.trim() || `${label}仍待研究者補充`;
  if (field === "workingTitle") {
    return [
      { strategy: "EVIDENCE_FIRST", text: `${base}：現況證據、關鍵機制與可驗證差異`, rationale: "題目先界定可觀察構念與驗證範圍。", boundary: "UNVERIFIED" },
      { strategy: "BALANCED_RECOMMENDED", text: `${base}的作用機制與情境成效：一項可審查的混合方法研究`, rationale: "同時交代構念、情境與研究設計。", boundary: "ASSUMPTION" },
      { strategy: "FRONTIER_INNOVATION", text: `${base}的邊界條件與反直覺效果：跨階段比較研究`, rationale: "提出前沿問題，但不預設新穎性已被證實。", boundary: "UNVERIFIED" },
    ];
  }
  if (field === "domain") {
    return [
      { strategy: "EVIDENCE_FIRST", text: "教育科技（暫定分類；待依研究問題與文獻範圍核對）", rationale: "採用較窄、可檢索的分類。", boundary: "MISSING_DATA" },
      { strategy: "BALANCED_RECOMMENDED", text: "教育科技 × 高等教育（暫定跨域分類）", rationale: "兼顧研究主題與實際場域。", boundary: "ASSUMPTION" },
      { strategy: "FRONTIER_INNOVATION", text: "人機協作 × 學習科學（前瞻分類；尚待證據確認）", rationale: "提供跨域視角，不宣稱分類已定案。", boundary: "UNVERIFIED" },
    ];
  }
  if (field === "outputTrack") {
    return [
      { strategy: "EVIDENCE_FIRST", text: "實證研究論文（期刊層級與格式待查證）", rationale: "先以可驗證成果為路徑，不猜期刊規則。", boundary: "MISSING_DATA" },
      { strategy: "BALANCED_RECOMMENDED", text: "完整期刊論文＋可重現附錄（暫定）", rationale: "兼顧主文、證據與方法透明度。", boundary: "ASSUMPTION" },
      { strategy: "FRONTIER_INNOVATION", text: "跨域研究論文＋方法／資料產品（條件式方案）", rationale: "提供高影響路徑，但須先確認資料與授權。", boundary: "UNVERIFIED" },
    ];
  }
  return [
    { strategy: "EVIDENCE_FIRST", text: `${base}。先區分已知資料、待驗證主張與可反駁條件，再補上對應證據來源。`, rationale: "避免把假設或趨勢印象寫成既有結果。", boundary: "UNVERIFIED" },
    { strategy: "BALANCED_RECOMMENDED", text: `${base}。本段同時說明研究問題、作用機制、可行方法與目前未知事項，保留後續人工確認空間。`, rationale: "兼顧論證清楚、可執行性與審查可讀性。", boundary: "ASSUMPTION" },
    { strategy: "FRONTIER_INNOVATION", text: `${base}。從邊界條件、反直覺結果或跨域機制提出前沿方向，並明列需要哪些新證據才能成立。`, rationale: "保留原創性，同時避免把前瞻推估冒充既有證據。", boundary: "UNVERIFIED" },
  ];
}

function DirectionCard({ card, selected, onSelect }: { card: V2DirectionCard; selected: boolean; onSelect: () => void }) {
  return (
    <article className={`${styles.directionCard} ${selected ? styles.selectedCard : ""}`} data-testid={`v2-direction-${card.lane}`}>
      <div className={styles.cardTopline}><span>{card.label}</span>{card.recommended && <strong>推薦</strong>}</div>
      <h3>{card.workingTitle}</h3>
      <dl><div><dt>研究問題</dt><dd>{card.researchQuestion}</dd></div><div><dt>方法輪廓</dt><dd>{card.methodSketch}</dd></div><div><dt>可行性邊界</dt><dd>{card.feasibilityRisk}</dd></div></dl>
      <button type="button" onClick={onSelect} aria-pressed={selected}>{selected ? "目前比較中" : "比較此方向"}</button>
    </article>
  );
}

export default function OldMikeResearchOSV2({ displayName = "林教授" }: { displayName?: string }) {
  const initialDisplayName = displayName.trim() || "使用者";
  const [localDisplayName, setLocalDisplayName] = useState(initialDisplayName);
  const safeDisplayName = localDisplayName.trim() || "使用者";
  const [activeNav, setActiveNav] = useState<(typeof V2_GLOBAL_NAV)[number]["id"]>("HOME");
  const [activeStage, setActiveStage] = useState<V2StageId>("DISCOVER");
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("DIRECTION");
  const [direction, setDirection] = useState("大學教師採用生成式工具的教學決策與學習成效");
  const [workspace, setWorkspace] = useState<V2PrototypeWorkspace | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState("");
  const [draft, setDraft] = useState<V2PrototypeWorkspace["s0Draft"] | null>(null);
  const [drawerField, setDrawerField] = useState<S0FieldName | null>(null);
  const [undo, setUndo] = useState<Partial<Record<S0FieldName, string>>>({});
  const [announcement, setAnnouncement] = useState("等待輸入研究方向");
  const [dockOpen, setDockOpen] = useState(true);
  const [mobileOldMikeOpen, setMobileOldMikeOpen] = useState(false);
  const mobileOldMikeTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileOldMikeSheetRef = useRef<HTMLElement>(null);

  const activeField = drawerField ? S0_FIELDS.find((field) => field.name === drawerField) : null;
  const drawerOptions = useMemo(() => activeField && draft ? suggestionOptions(activeField.name, activeField.label, draft[activeField.name]) : [], [activeField, draft]);
  const factGuidance = useMemo(() => createFactBoundGuidance("sample", "樣本數與抽樣框尚未提供"), []);

  const closeDrawer = useCallback(() => setDrawerField(null), []);

  useEffect(() => {
    if (!mobileOldMikeOpen) return;
    const sheet = mobileOldMikeSheetRef.current;
    const focusable = () => Array.from(sheet?.querySelectorAll<HTMLElement>("button, [href], textarea, input, select, [tabindex]:not([tabindex='-1'])") ?? []).filter((element) => !element.hasAttribute("disabled"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOldMikeOpen(false);
        mobileOldMikeTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOldMikeOpen]);

  function generateWorkspace() {
    const next = buildV2PrototypeWorkspace(direction);
    setWorkspace(next);
    setSelectedDirectionId(next.recommendedDirectionId);
    setDraft(next.s0Draft);
    setActiveStage("BLUEPRINT");
    setUndo({});
    setAnnouncement("已產生三個研究方向，平衡方案已推薦，完整十三欄 S0 草稿可編輯。");
  }

  function updateField(field: S0FieldName, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function applySuggestion(option: V2SuggestionOption) {
    if (!drawerField || !draft) return;
    const field = drawerField;
    setUndo((current) => ({ ...current, [field]: draft[field] }));
    updateField(field, option.text);
    setAnnouncement(`已將老麥建議套用到${S0_FIELDS.find((item) => item.name === field)?.label ?? "欄位"}，可立即復原。`);
    closeDrawer();
  }

  function undoField(field: S0FieldName) {
    const previous = undo[field];
    if (previous === undefined) return;
    updateField(field, previous);
    setUndo((current) => { const next = { ...current }; delete next[field]; return next; });
    setAnnouncement(`已復原${S0_FIELDS.find((item) => item.name === field)?.label ?? "欄位"}。`);
  }

  return (
    <div className={styles.shell} data-testid="v2-shell" data-generation-effects={workspace?.generationEffectCount ?? 0} data-formal-writes={workspace?.formalWriteCount ?? 0}>
      <a className={styles.skipLink} href="#v2-main">跳到主要內容</a>
      <aside className={styles.desktopNav} aria-label="全站導覽">
        <div className={styles.brand}><span>麥</span><div><strong>老麥</strong><small>Research OS · V2 原型</small></div></div>
        <nav>{V2_GLOBAL_NAV.map((item) => <button type="button" key={item.id} className={activeNav === item.id ? styles.activeNav : ""} onClick={() => setActiveNav(item.id)} aria-label={`${item.zhLabel} · ${item.label}`}><Icon name={iconForNavigation(item.id)} size={19} /><span>{item.zhLabel}<small>{item.label}</small></span></button>)}</nav>
        <div className={styles.identity}><span aria-hidden="true">{Array.from(safeDisplayName)[0]}</span><div><strong>{safeDisplayName}</strong><small>個人研究工作區</small></div></div>
      </aside>

      <main id="v2-main" className={styles.main}>
        <header className={styles.topbar}><div><p>本機互動原型 · 不會寫入正式資料</p><h1>{activeNav === "HOME" ? "研究起點" : V2_GLOBAL_NAV.find((item) => item.id === activeNav)?.zhLabel}</h1></div><button type="button" className={styles.dockToggle} onClick={() => setDockOpen((value) => !value)} aria-expanded={dockOpen} aria-controls="v2-old-mike-dock"><span aria-hidden="true">✦</span> 老麥</button></header>

        {activeNav === "SETTINGS" && <section className={styles.settingsDemo} aria-labelledby="v2-display-name-title"><div><p className={styles.eyebrow}>本機設定示範</p><h2 id="v2-display-name-title">自訂顯示名稱</h2><p>只改變這次原型畫面，不寫入瀏覽器儲存、帳號身份或正式資料。</p></div><label>導覽列顯示名稱<input value={localDisplayName} onChange={(event) => { setLocalDisplayName(event.target.value.slice(0, 40)); setAnnouncement("本機顯示名稱已更新；授權身份沒有改變。"); }} maxLength={40} /></label></section>}

        <section className={styles.hero} aria-labelledby="v2-home-question">
          <div className={styles.heroCopy}><p className={styles.eyebrow}>從一個念頭開始</p><h2 id="v2-home-question">今天想研究什麼？</h2><p>輸入一個關鍵字或方向。老麥先整理三條可比較路徑，再完成一份可審查的推薦研究藍圖。</p></div>
          <div className={styles.modeTabs} role="group" aria-label="研究起點類型">
            <button type="button" aria-pressed={intakeMode === "DIRECTION"} onClick={() => setIntakeMode("DIRECTION")}>關鍵字／方向</button>
            <button type="button" aria-pressed={intakeMode === "DRAFT"} onClick={() => setIntakeMode("DRAFT")}>匯入既有草稿</button>
            <button type="button" aria-pressed={intakeMode === "PROPOSAL"} onClick={() => setIntakeMode("PROPOSAL")}>NSTC／MOE 計畫</button>
          </div>
          {intakeMode === "DIRECTION" ? <label className={styles.directionInput}>研究方向<textarea value={direction} onChange={(event) => setDirection(event.target.value)} maxLength={240} rows={3} placeholder="例如：大學教師如何把新科技轉化為可驗證的教學成效？" /></label> : <div className={styles.prototypeNotice}><strong>{intakeMode === "DRAFT" ? "草稿匯入" : "國家計畫"}</strong><p>此 Alpha 只呈現資訊架構。正式檔案解析與年度規則需要獨立資料權限，不在本機原型中假裝啟用。</p></div>}
          <details className={styles.advanced}><summary>進階條件（選填）</summary><div><label>研究場域<input placeholder="尚未確定也可以" /></label><label>預期成果<select defaultValue="SSCI"><option>SSCI 期刊</option><option>SCI 期刊</option><option>NSTC 計畫</option><option>MOE 計畫</option></select></label><label>現有資料<input placeholder="不確定時留白" /></label></div></details>
          <button type="button" className={styles.primaryAction} onClick={generateWorkspace} disabled={intakeMode !== "DIRECTION" || !direction.trim()} data-testid="v2-generate"><span>產生三個研究方向</span><small>一次完成推薦草稿，不逐欄打斷</small></button>
          <p className={styles.liveStatus} role="status" aria-live="polite" data-testid="v2-live-status">{announcement}</p>
        </section>

        <section className={styles.stageRail} aria-label="專案六階段">
          {V2_PROJECT_STAGES.map((stage, index) => <button type="button" key={stage.id} className={activeStage === stage.id ? styles.activeStage : ""} onClick={() => setActiveStage(stage.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage.label}</strong><small>{stage.english}</small></button>)}
        </section>

        {workspace ? <>
          <section className={styles.artifactCanvas} aria-labelledby="v2-directions-title">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Discover · 三個方向</p><h2 id="v2-directions-title">同一題目，三種可反駁的研究路徑</h2></div><p>推薦完整草稿 + 2 個替代方向 · 切換卡片不會觸發第二次產生</p></div>
            <div className={styles.directionGrid}>{workspace.directions.map((card) => <DirectionCard key={card.id} card={card} selected={selectedDirectionId === card.id} onSelect={() => { setSelectedDirectionId(card.id); setAnnouncement(`已切換比較${card.label}，推薦 S0 草稿與產生次數均未改變。`); }} />)}</div>
          </section>

          <section className={styles.evidenceForecast} aria-labelledby="v2-evidence-forecast-title">
            <div><p className={styles.eyebrow}>Evidence boundary</p><h2 id="v2-evidence-forecast-title">當前證據與未來推估分開呈現</h2><p className={styles.currentEvidence}><strong>目前觀察：</strong>尚未執行正式文獻檢索；不能宣稱熱門、新穎或有效。</p></div>
            <div className={styles.forecastGrid}>{[
              ["1–3 年", "近期驗證", "低", "可取得資料不足"],
              ["4–6 年", "方法擴充", "低", "核心機制未被支持"],
              ["7–10 年", "跨場域影響", "極低", "制度或技術條件改變"],
            ].map(([window, title, confidence, invalidation]) => <article key={window}><span>{window}</span><h3>{title}</h3><p>假設：研究場域與資料治理可持續。</p><dl><div><dt>信心</dt><dd>{confidence}</dd></div><div><dt>失效條件</dt><dd>{invalidation}</dd></div></dl></article>)}</div>
          </section>

          {draft && <section className={styles.blueprint} aria-labelledby="v2-blueprint-title">
            <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Blueprint · 推薦草稿</p><h2 id="v2-blueprint-title">完整 13 欄 S0，可逐欄編輯</h2></div><div className={styles.draftStatus}><span>13 / 13</span><small>可審查草稿</small></div></div>
            <div className={styles.fieldStack}>{S0_FIELDS.map((field) => <AssistableField key={field.name} fieldId={field.name} label={field.label} value={draft[field.name]} onChange={(value) => updateField(field.name, value)} onAssist={() => setDrawerField(field.name)} onUndo={() => undoField(field.name)} canUndo={undo[field.name] !== undefined} drawerOpen={drawerField === field.name} />)}</div>
            <section className={styles.humanGate}><div><span aria-hidden="true">✓</span><div><p className={styles.eyebrow}>Human Gate · 整份草稿</p><h3>只在正式建立或鎖定前，由研究者作一次最終確認</h3><p>欄位建議不是逐欄核准；此原型只編輯本機草稿，不會保存、投稿、公開或寫入正式研究資料。</p></div></div><button type="button" disabled>確認整份草稿後建立正式專案</button></section>
          </section>}
        </> : <section className={styles.emptyCanvas}><span aria-hidden="true">01</span><div><h2>先從一個方向開始</h2><p>不需要填十三個空欄位。輸入一句話，老麥會先替你建立可比較、可追問、可人工確認的研究起點。</p></div></section>}

        <section className={styles.capabilityMap} aria-labelledby="v2-capabilities-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>完整研究能力</p><h2 id="v2-capabilities-title">12 項能力，收斂在六個工作階段</h2></div><p>尚未接上正式權限的能力清楚標示，不做假啟用。</p></div><div className={styles.capabilityGrid}>{V2_PROJECT_STAGES.map((stage) => <section key={stage.id}><header><span>{stage.label}</span><small>{stage.english}</small></header>{V2_CAPABILITIES.filter((item) => item.stage === stage.id).map((item) => <div key={item.id}><strong>{item.label}</strong><ul>{item.tasks.map((task) => <li key={task}>{task}</li>)}</ul><small className={item.state === "PROTOTYPE" ? styles.prototypeState : styles.designState}>{item.state === "PROTOTYPE" ? "本機原型" : "設計中 · 未啟用"}</small></div>)}</section>)}</div></section>
      </main>

      <aside id="v2-old-mike-dock" className={`${styles.oldMikeDock} ${dockOpen ? styles.dockOpen : styles.dockClosed}`} aria-label="老麥研究協作欄">
        <header><div><span aria-hidden="true">✦</span><div><strong>老麥</strong><small>你的研究協作者</small></div></div><button type="button" onClick={() => setDockOpen(false)} aria-label="收合老麥協作欄">×</button></header>
        <section><p className={styles.eyebrow}>當前建議</p><h2>先把未知事項變成可驗證步驟</h2><p>我會保留你的原始方向，將主張、假設與待查證事項分開。</p></section>
        <section><p className={styles.eyebrow}>事實型欄位示例</p><h3>樣本數：不猜數字</h3><ul>{factGuidance.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.guidance}</span></li>)}</ul></section>
        <button type="button" className={styles.dockAction} onClick={() => { if (draft) setDrawerField("problemContext"); else setAnnouncement("請先產生研究方向，再開啟欄位協助。"); }}>協助整理問題背景</button>
      </aside>

      <nav className={styles.mobileNav} aria-label="手機版主要導覽"><button type="button" onClick={() => setActiveNav("HOME")}><Icon name="grid" /><span>首頁</span></button><button type="button" onClick={() => setActiveNav("PROJECTS")}><Icon name="folder" /><span>專案</span></button><button ref={mobileOldMikeTriggerRef} type="button" onClick={() => setMobileOldMikeOpen(true)} aria-haspopup="dialog" aria-expanded={mobileOldMikeOpen} aria-controls="v2-mobile-old-mike-sheet"><span aria-hidden="true">✦</span><span>老麥</span></button><button type="button" onClick={() => setActiveNav("SETTINGS")}><Icon name="menu" /><span>更多</span></button></nav>

      {mobileOldMikeOpen && <div className={styles.mobileSheetBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) { setMobileOldMikeOpen(false); mobileOldMikeTriggerRef.current?.focus(); } }}><section ref={mobileOldMikeSheetRef} id="v2-mobile-old-mike-sheet" className={styles.mobileOldMikeSheet} role="dialog" aria-modal="true" aria-labelledby="v2-mobile-old-mike-title"><header><div><p className={styles.eyebrow}>老麥協作</p><h2 id="v2-mobile-old-mike-title">下一個研究動作</h2></div><button type="button" onClick={() => { setMobileOldMikeOpen(false); mobileOldMikeTriggerRef.current?.focus(); }} aria-label="關閉老麥協作面板">×</button></header><p>先確認問題背景中的已知、假設與待查證事項，再進入整份草稿的最終 Human Gate。</p><button type="button" onClick={() => { setMobileOldMikeOpen(false); if (draft) setDrawerField("problemContext"); }}>協助整理問題背景</button></section></div>}

      <SuggestionDrawer open={Boolean(drawerField)} fieldLabel={activeField?.label ?? "研究欄位"} options={drawerOptions} onApply={applySuggestion} onClose={closeDrawer} />
    </div>
  );
}
