import type { V2Alpha7RevisionStrategy } from "../v2-alpha7/contracts.ts";

export type V2Alpha7R1SemanticRevisionFixture = {
  fixtureId: string;
  lens: string;
  source: string;
  semanticAnchors: readonly string[];
  outputs: Readonly<Record<V2Alpha7RevisionStrategy, { revision: string; reason: string; risk: string }>>;
};

export const V2_ALPHA7_R1_SEMANTIC_REVISION_FIXTURES: readonly V2Alpha7R1SemanticRevisionFixture[] = Object.freeze([
  {
    fixtureId: "editorial-contribution-alpha6",
    lens: "EDITORIAL_CONTRIBUTION",
    source: "This draft may explain how evidence boundaries shape teacher decisions across two documented stages [7].",
    semanticAnchors: ["evidence boundaries", "teacher", "decisions", "two documented stages", "may", "[7]"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "Across the two documented stages [7], evidence boundaries may shape how teachers make decisions.",
        reason: "Moves the documented stages before the cautious mechanism claim so the evidence boundary is visible at first reading.",
        risk: "The change foregrounds study staging and may understate the broader motivation if the following paragraph does not restore it.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "Evidence boundaries may shape teacher decisions across two documented stages [7].",
        reason: "Removes the self-referential opening and states the same provisional contribution in a concise journal-ready sentence.",
        risk: "The shorter sentence relies on adjacent text to identify the manuscript's larger problem.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Teacher decisions may be shaped by evidence boundaries across the two documented stages [7].",
        reason: "Changes the information focus and cadence while retaining the same tentative relationship and documented scope.",
        risk: "The passive construction shifts emphasis from the explanatory proposal to teacher decisions.",
      },
    },
  },
  {
    fixtureId: "theory-argument-alpha6",
    lens: "THEORY_ARGUMENT",
    source: "The framework treats evidence visibility, calibrated trust, and professional judgement as competing but connected explanations.",
    semanticAnchors: ["framework", "evidence visibility", "calibrated trust", "professional judgement", "competing", "connected"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "Within the framework, evidence visibility, calibrated trust, and professional judgement remain connected yet competing explanations.",
        reason: "Makes coexistence and competition explicit without implying that any mechanism has been verified.",
        risk: "The word remain presumes these constructs were introduced earlier and should be checked against the preceding section.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "Evidence visibility, calibrated trust, and professional judgement provide connected explanations in the framework, yet they also remain competing accounts.",
        reason: "Compresses the theoretical relation into one parallel construction suitable for a journal argument.",
        risk: "The concise structure does not specify how the explanations will later be distinguished empirically.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Evidence visibility, calibrated trust, and professional judgement are connected in the framework, but they offer competing explanations.",
        reason: "Uses a direct contrast to improve rhythm while preserving the framework's dual relation among the constructs.",
        risk: "The stronger sentence break implied by but may need a transition into the next theoretical claim.",
      },
    },
  },
  {
    fixtureId: "method-rigor-alpha6",
    lens: "METHOD_RIGOR",
    source: "The design and analysis contract remain subject to source-supported revision.",
    semanticAnchors: ["design", "analysis contract", "source", "revision"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "Source-supported revision remains necessary for the design and analysis contract.",
        reason: "Leads with the unresolved evidentiary requirement rather than presenting the contract as settled.",
        risk: "The sentence still does not enumerate which design and analysis decisions require evidence.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "The design and analysis contract still requires source-supported revision.",
        reason: "States the unresolved methodological status directly in a compact form.",
        risk: "Requires is slightly more directive in tone, although it does not strengthen the empirical claim.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Further revision grounded in the source is still needed to complete the design and analysis contract.",
        reason: "Recasts the nominal construction as an actionable scholarly sentence with a clearer flow.",
        risk: "Complete frames the contract as an intended endpoint and should match the surrounding workflow language.",
      },
    },
  },
  {
    fixtureId: "evidence-analysis-alpha6",
    lens: "EVIDENCE_ANALYSIS",
    source: "Planned results section: report participant flow, data quality, preregistered primary and secondary analyses, uncertainty intervals, robustness checks, null findings, and deviations only after verified result data are available.",
    semanticAnchors: ["participant flow", "data quality", "preregistered primary and secondary analyses", "uncertainty intervals", "robustness checks", "null findings", "deviations", "verified", "result data"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "Only after result data have been verified should the planned results section report participant flow, data quality, preregistered primary and secondary analyses, uncertainty intervals, robustness checks, null findings, and deviations.",
        reason: "Places the verification condition before every planned result element so no item can be read as an existing finding.",
        risk: "The front-loaded condition produces a long sentence that may later benefit from a structured reporting checklist.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "The results section should report participant flow, data quality, preregistered primary and secondary analyses, uncertainty intervals, robustness checks, null findings, and deviations only when verified result data are available.",
        reason: "Converts the planning label into a concise reporting rule while retaining the verification threshold and every required element.",
        risk: "The compact sentence does not specify the order in which the listed results will appear.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Once result data are verified, the results section can present participant flow and data quality, followed by preregistered primary and secondary analyses, uncertainty intervals, robustness checks, null findings, and deviations.",
        reason: "Creates a readable reporting sequence without presenting any planned result as observed.",
        risk: "The proposed sequence is rhetorical rather than an official journal requirement and remains subject to author review.",
      },
    },
  },
  {
    fixtureId: "clarity-ethics-alpha6",
    lens: "CLARITY_ETHICS_REPORTING",
    source: "Authorship roles, ethics approval/consent, data availability, funding, conflicts of interest, and Old Mike assistance disclosure all require author confirmation before submission.",
    semanticAnchors: ["authorship roles", "ethics approval", "consent", "data availability", "funding", "conflicts of interest", "Old Mike assistance", "author", "confirm", "submission"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "Before submission, the author must confirm authorship roles, ethics approval and consent, data availability, funding, conflicts of interest, and the disclosure of Old Mike assistance.",
        reason: "Places the author-confirmation boundary before the declaration list and preserves every unresolved item.",
        risk: "Must is appropriately procedural here but should not be mistaken for proof that any declaration has been completed.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "Author confirmation is required before submission for authorship roles, ethics approval and consent, data availability, funding, conflicts of interest, and Old Mike assistance disclosure.",
        reason: "Condenses the declaration requirement into a direct submission-readiness statement without implying approval.",
        risk: "The compressed list should be checked against the selected journal's current declaration headings.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Submission remains contingent on the author confirming authorship roles, ethics approval and consent, data availability, funding, conflicts of interest, and the disclosure of Old Mike assistance.",
        reason: "Turns the list into a clear scholarly workflow boundary while retaining all declaration categories.",
        risk: "Contingent is formal workflow language and should remain limited to the submission gate, not drafting.",
      },
    },
  },
  {
    fixtureId: "preservation-multisentence-corpus",
    lens: "METHOD_RIGOR",
    source: "The intervention may not reduce exposure above 12 mg for 36 workers [4]. Under $x=4$, the analysis does not establish a causal effect.",
    semanticAnchors: ["intervention", "may not", "exposure", "12 mg", "36 workers", "[4]", "$x=4$", "analysis", "does not", "causal"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "For 36 workers [4], the intervention may not reduce exposure above 12 mg. At $x=4$, the analysis does not support a causal interpretation.",
        reason: "Separates the bounded observation from the causal limitation while preserving both negative and tentative claims.",
        risk: "Causal interpretation is a rhetorical recast of causal effect and should be checked against the analysis plan.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "Among 36 workers [4], exposure above 12 mg may not be reduced by the intervention; at $x=4$, the analysis does not establish a causal effect.",
        reason: "Combines the sample-bound exposure statement and model limitation into a concise evidentiary sentence.",
        risk: "The passive construction shifts emphasis from the intervention to exposure.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Exposure above 12 mg may not decline with the intervention among the 36 workers [4]. The analysis at $x=4$ does not establish a causal effect.",
        reason: "Varies sentence structure and cadence while preserving the sample, threshold, formula, and causal caution.",
        risk: "Decline is a natural-language substitute for reduce and requires domain terminology review.",
      },
    },
  },
  {
    fixtureId: "pasted-default-supported",
    lens: "PASTED_MANUSCRIPT",
    source: "Evidence calibration may improve teacher decisions in two documented stages [7].",
    semanticAnchors: ["evidence calibration", "teacher", "decisions", "two documented stages", "may", "[7]"],
    outputs: {
      EVIDENCE_CALIBRATED: {
        revision: "Across two documented stages [7], evidence calibration may improve how teachers make decisions.",
        reason: "Foregrounds the documented scope before the tentative benefit claim.",
        risk: "The revised focus depends on adjacent text to define evidence calibration.",
      },
      JOURNAL_CONCISE_RECOMMENDED: {
        revision: "Evidence calibration may improve teacher decisions across two documented stages [7].",
        reason: "Condenses the same provisional claim into a journal-ready construction.",
        risk: "Decision-making is a nominal recast that should match the manuscript's terminology.",
      },
      NATURAL_SCHOLARLY: {
        revision: "Teachers may make better-informed decisions through evidence calibration across the two documented stages [7].",
        reason: "Uses an active scholarly voice while retaining the tentative relationship and documented scope.",
        risk: "Better-informed is a stylistic interpretation of improve and should be checked against author intent.",
      },
    },
  },
]);

export function findV2Alpha7R1SemanticRevisionFixture(lens: string, source: string) {
  return V2_ALPHA7_R1_SEMANTIC_REVISION_FIXTURES.find((fixture) => fixture.source === source && (fixture.lens === lens || fixture.lens === "PASTED_MANUSCRIPT")) ?? null;
}
