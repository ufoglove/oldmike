import { beta1Hash, isBeta1Hash } from "./canonical-hash.ts";

type JourneyLineageMaterial = {
  materialId: string;
  kind: string;
  title: string;
  content?: string;
  contentHash?: string;
};

export type V2Beta1JourneyLineageInput = {
  entryMode: "KEYWORD" | "CHAT_INSIGHT" | "PARTIAL_MATERIAL";
  outputTarget: "SCI" | "SSCI" | "NSTC" | "MOE";
  researchDirection: string;
  researchDomain: { selectionHash: string };
  materials: readonly JourneyLineageMaterial[];
  observationEffectLineageHash: string | null;
  selectedLane: "EVIDENCE_FIRST" | "BALANCED_RECOMMENDED" | "FRONTIER_INNOVATION";
};

function materialCommitment(material: JourneyLineageMaterial) {
  const contentHash = isBeta1Hash(material.contentHash) ? material.contentHash : typeof material.content === "string" ? beta1Hash(material.content) : null;
  if (!contentHash) throw new Error("beta1_journey_lineage_material_invalid");
  return { materialId: material.materialId, kind: material.kind, title: material.title, contentHash };
}

export function v2Beta1JourneyLineageBase(input: V2Beta1JourneyLineageInput) {
  if (!isBeta1Hash(input.researchDomain.selectionHash)) throw new Error("beta1_journey_lineage_domain_invalid");
  if (input.observationEffectLineageHash !== null && !isBeta1Hash(input.observationEffectLineageHash)) throw new Error("beta1_journey_lineage_observation_invalid");
  if (!["EVIDENCE_FIRST", "BALANCED_RECOMMENDED", "FRONTIER_INNOVATION"].includes(input.selectedLane)) throw new Error("beta1_journey_lineage_direction_invalid");
  return {
    entryMode: input.entryMode,
    outputTarget: input.outputTarget,
    researchDirection: input.researchDirection,
    researchDomainHash: input.researchDomain.selectionHash,
    materials: input.materials.map(materialCommitment),
    observationEffectLineageHash: input.observationEffectLineageHash,
    selectedLane: input.selectedLane,
  };
}

export function deriveV2Beta1JourneyInputBundleHash(input: V2Beta1JourneyLineageInput, selectedDirectionHash: string) {
  if (!isBeta1Hash(selectedDirectionHash)) throw new Error("beta1_journey_lineage_direction_invalid");
  return beta1Hash({ ...v2Beta1JourneyLineageBase(input), selectionPolicy: "FIXED_BALANCED_RECOMMENDED_1_7_18" });
}
