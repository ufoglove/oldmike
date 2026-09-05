import * as ins from "../lib/research-instrument-repository.ts";

const WS = "ws_87ebfc96-f5e3-4bc2-bfd9-6e9399f4f999";
const PJ = "research-project-c6ebe4e0f9";
const OWNER = "44c25ec5-f380-4c56-925a-d1398426176a";
const tenant = { userId: OWNER, workspaceId: WS, projectId: PJ, role: "owner" };
const LINKS = {
  hpt: "pil_8a2ee1fe-afb1-4cc8-b251-265696c5d490",
  sagat: "pil_ec90a3b9-1585-4de4-80ac-61f4329e91b2",
  customRq1: "pil_1dfae645-1d45-48dc-891b-2c4203eac3ba",
};
// 10 維計分（0-100）。AI_PROPOSED：由老麥依既有證據鏈初擬，供 Joseph 複核後才具決定性。
const scores = {
  hpt: { construct_fit: 92, population_fit: 80, context_fit: 70, reliability_evidence: 75, validity_evidence: 78, sensitivity: 60, administration: 90, language_cultural: 95, permission_cost: 95, analysis_compatibility: 85 },
  sagat: { construct_fit: 40, population_fit: 75, context_fit: 85, reliability_evidence: 85, validity_evidence: 82, sensitivity: 80, administration: 55, language_cultural: 45, permission_cost: 30, analysis_compatibility: 80 },
  customRq1: { construct_fit: 95, population_fit: 88, context_fit: 95, reliability_evidence: 25, validity_evidence: 25, sensitivity: 55, administration: 55, language_cultural: 98, permission_cost: 100, analysis_compatibility: 80 },
};
try {
  const cmp = await ins.compareCandidates(tenant, {
    userId: OWNER,
    scores: [
      { linkId: LINKS.hpt, scores: scores.hpt },
      { linkId: LINKS.sagat, scores: scores.sagat },
      { linkId: LINKS.customRq1, scores: scores.customRq1 },
    ],
  });
  console.log("COMPARE_OK");
  for (const r of cmp.ranked) console.log(`RANK ${r.rank} ${r.recommendation} total=${r.total} link=${r.linkId}`);
  const proto = await ins.generateProtocolDraft(tenant, { userId: OWNER });
  console.log("PROTOCOL_DRAFT", JSON.stringify(proto));
} catch (e) {
  console.log("ERR", e && e.message ? e.message : String(e));
  process.exitCode = 1;
}
