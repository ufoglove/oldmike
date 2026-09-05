import type { V2Alpha6LanguageOption, V2Alpha6LanguageTask } from "../v2-alpha6/contracts.ts";

export type V2Alpha6R1SemanticFixture = {
  fixtureId: string;
  domain: string;
  task: V2Alpha6LanguageTask;
  source: string;
  semanticAnchors: readonly string[];
  outputs: Readonly<Record<V2Alpha6LanguageOption["strategy"], { revision: string; reason: string; risk: string }>>;
};

export const V2_ALPHA6_R1_SEMANTIC_FIXTURES: readonly V2Alpha6R1SemanticFixture[] = Object.freeze([
  {
    fixtureId: "ai-education-zh-en",
    domain: "AI應用於教育",
    task: "ZH_TW_TO_EN",
    source: "在 6 週課程中，AI 回饋可能改善 42 名學習者的修訂歷程 [12]，但尚未證明學習成效提高。",
    semanticAnchors: ["AI", "42", "learn", "may", "not"],
    outputs: {
      FAITHFUL: {
        revision: "During the 6-week course, AI feedback may improve the revision process of 42 learners [12], but improved learning outcomes have not yet been demonstrated.",
        reason: "逐句轉譯研究期間、參與者、修訂歷程與未證成的結果界線。",
        risk: "保留接近原文的資訊次序，英語節奏較為直接。",
      },
      PRECISE_JOURNAL_FORMAL: {
        revision: "Across the 6-week course, 42 learners received AI feedback that may support revision [12]; however, the evidence does not establish improved learning outcomes.",
        reason: "把研究情境與證據限制分成清楚的期刊式論證單位。",
        risk: "support revision 比原文語氣精煉，仍需作者確認是否符合介入設計。",
      },
      NATURAL_SCHOLARLY: {
        revision: "AI feedback may have helped 42 learners revise their work during the 6-week course [12]. The available evidence, however, does not show that learning outcomes improved.",
        reason: "改用兩句呈現可能的歷程作用與尚未證成的學習結果，提升閱讀節奏。",
        risk: "句子拆分改變了修辭節奏，但未改變因果與不確定性。",
      },
    },
  },
  {
    fixtureId: "occupational-safety-en-zh",
    domain: "AI應用於職業安全與教育訓練",
    task: "EN_TO_ZH_TW",
    source: "PPE training did not reduce exposure above 12 mg in the synthetic observation [4]; it may still improve procedural recall.",
    semanticAnchors: ["PPE", "12 mg", "暴露", "程序", "記憶", "未", "可能"],
    outputs: {
      FAITHFUL: {
        revision: "在這項合成觀察中，PPE 訓練未降低高於 12 mg 的暴露量 [4]；但仍可能改善程序記憶。",
        reason: "忠實轉譯否定結果、暴露閾值與程序記憶的可能效果。",
        risk: "保留英文原句的分號結構，中文節奏較為正式。",
      },
      PRECISE_JOURNAL_FORMAL: {
        revision: "合成觀察結果顯示，PPE 訓練並未降低超過 12 mg 的暴露量 [4]，但可能有助於保留程序記憶。",
        reason: "先交代觀察結果，再以轉折限定訓練可能影響的認知面向。",
        risk: "「有助於」仍是可能性陳述，不應被解讀為已證實效果。",
      },
      NATURAL_SCHOLARLY: {
        revision: "PPE 訓練在合成觀察中未能降低高於 12 mg 的暴露量 [4]。不過，它仍可能改善受訓者對程序的記憶。",
        reason: "拆分暴露結果與程序記憶推論，使臺灣繁體中文更自然易讀。",
        risk: "補出受訓者作為語意主體，沒有增加樣本或效果事實。",
      },
    },
  },
  {
    fixtureId: "environment-academic-edit",
    domain: "AI應用於環境工程與環境資源管理",
    task: "ACADEMIC_EN_EDIT",
    source: "The recycled-water model may explain 18% of the variance [7], but the present sample does not establish causal effects.",
    semanticAnchors: ["recycled-water model", "18%", "variance", "causal", "may", "not"],
    outputs: {
      FAITHFUL: {
        revision: "The recycled-water model may account for 18% of the variance [7], although the current sample does not establish a causal effect.",
        reason: "以 account for 與 although 修整句法，同時保留可能性與非因果結論。",
        risk: "改為單數 causal effect，作者應確認是否符合原分析單位。",
      },
      PRECISE_JOURNAL_FORMAL: {
        revision: "The recycled-water model may account for 18% of the observed variance [7]; however, the available sample does not support a causal interpretation.",
        reason: "區分模型解釋量與因果解釋限制，使證據強度更精確。",
        risk: "observed variance 強調資料範圍，需確認與統計模型用語一致。",
      },
      NATURAL_SCHOLARLY: {
        revision: "Although the recycled-water model may explain 18% of the variance [7], this sample does not justify a causal interpretation.",
        reason: "以前置讓步句連結解釋量與因果限制，減少機械式轉折。",
        risk: "句法重組較大，作者仍需確認 justify 的語域。",
      },
    },
  },
  {
    fixtureId: "energy-natural-multiparagraph",
    domain: "AI應用於能源管理",
    task: "NATURAL_SCHOLARLY_STYLE",
    source: "The microgrid may reduce peak demand by 15% [9], although the estimate remains unverified.\n\nUnder $x=4$, the simulation did not include battery degradation.",
    semanticAnchors: ["microgrid", "15%", "verified", "$x=4$", "battery degradation", "not"],
    outputs: {
      FAITHFUL: {
        revision: "The microgrid may lower peak demand by 15% [9], although this estimate remains unverified.\n\nAt $x=4$, the simulation did not account for battery degradation.",
        reason: "小幅調整動詞與介系詞，保留兩段結構、估計不確定性與模擬缺口。",
        risk: "account for 比 include 更具分析語氣，需確認模型設定。",
      },
      PRECISE_JOURNAL_FORMAL: {
        revision: "The microgrid may reduce peak demand by 15% [9]; this estimate, however, remains unverified.\n\nThe simulation at $x=4$ did not model battery degradation.",
        reason: "將效果估計與驗證狀態明確分開，並精簡第二段的模型限制。",
        risk: "model battery degradation 假定原文的 include 指模型納入，作者應核對。",
      },
      NATURAL_SCHOLARLY: {
        revision: "Peak demand may fall by 15% when the microgrid is used [9], but the estimate has not been verified.\n\nBattery degradation was not represented in the simulation at $x=4$.",
        reason: "改變資訊起點與句型節奏，讓作者聲音更自然，同時保留限制。",
        risk: "被動句改變了敘述焦點，但沒有改變模擬範圍。",
      },
    },
  },
  {
    fixtureId: "xr-zh-en",
    domain: "VR/AR/XR跨領域應用",
    task: "ZH_TW_TO_EN",
    source: "XR 訓練在 120 ms 延遲下可能無法維持操作準確度 [3]，目前證據尚未支持跨場域推論。",
    semanticAnchors: ["XR", "120 ms", "operational accuracy", "setting", "may", "not"],
    outputs: {
      FAITHFUL: {
        revision: "XR training may not maintain operational accuracy under a 120 ms delay [3], and the current evidence does not support cross-setting inference.",
        reason: "忠實轉譯延遲條件、可能失效與跨場域推論限制。",
        risk: "operational accuracy 需由領域專家確認是否為既定術語。",
      },
      PRECISE_JOURNAL_FORMAL: {
        revision: "Under a 120 ms delay, XR training may fail to preserve operational accuracy [3]; the available evidence does not support generalization across settings.",
        reason: "以前置延遲條件界定結果，再明確限制外部推論。",
        risk: "generalization 是正式統計語彙，需確認研究設計可否使用。",
      },
      NATURAL_SCHOLARLY: {
        revision: "A 120 ms delay may prevent XR training from sustaining operational accuracy [3]. Current evidence does not justify extending this inference to other settings.",
        reason: "拆分可能的操作失效與跨場域限制，提升英語可讀性。",
        risk: "改以延遲為句子主詞，修辭焦點與原文不同。",
      },
    },
  },
  {
    fixtureId: "ai-cross-domain-en-zh",
    domain: "AI跨領域應用",
    task: "EN_TO_ZH_TW",
    source: "AI-assisted screening could identify candidate patterns in 36 records [5], but it cannot confirm clinical validity.",
    semanticAnchors: ["AI", "36", "候選模式", "臨床效度", "不能"],
    outputs: {
      FAITHFUL: {
        revision: "AI 輔助篩檢可能從 36 筆紀錄中辨識候選模式 [5]，但不能確認臨床效度。",
        reason: "忠實轉譯辨識可能性與不能確認臨床效度的界線。",
        risk: "「篩檢」需與實際工具用途及監管語境核對。",
      },
      PRECISE_JOURNAL_FORMAL: {
        revision: "AI 輔助篩檢可望辨識 36 筆紀錄中的候選模式 [5]；然而，這項分析不能證實其臨床效度。",
        reason: "區分模式辨識能力與臨床驗證不足，強化期刊論證邊界。",
        risk: "「證實」只出現在否定句中，不應被誤讀為已完成驗證。",
      },
      NATURAL_SCHOLARLY: {
        revision: "從 36 筆紀錄來看，AI 輔助篩檢可能找出候選模式 [5]，卻不能據此確認臨床效度。",
        reason: "改以資料範圍起句，讓臺灣繁體中文更自然並保留否定限制。",
        risk: "語序變動較大，作者仍需確認「據此」的指涉範圍。",
      },
    },
  },
]);

export function findV2Alpha6R1SemanticFixture(task: V2Alpha6LanguageTask, source: string) {
  return V2_ALPHA6_R1_SEMANTIC_FIXTURES.find((fixture) => fixture.task === task && fixture.source === source) ?? null;
}
