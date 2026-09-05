import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASSIST_REGISTRY } from "../lib/old-mike-assist-contract.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const guided = read("components/GuidedResearchCenter.tsx");
const topic = read("components/TopicLabFrontierRadar.tsx");
const topicService = read("lib/topic-lab-service.ts");
const topicRepository = read("lib/topic-lab-repository.ts");
const preProjectTopicRoute = read("app/api/assist/topic-lab/route.ts");
const projectTopicRoute = read("app/api/projects/[projectId]/topic-lab/route.ts");
const dashboard = read("components/Dashboard.tsx");
const appPage = read("app/page.tsx");

assert.match(appPage, /GuidedResearchCenter/u);
assert.doesNotMatch(appPage, /Dashboard/u);
assert.match(guided, /<TopicLabFrontierRadar projectId=\{currentProject\?\.projectId\}/u);
assert.doesNotMatch(guided, /function renderTopicLab|function renderRadar/u);
assert.match(preProjectTopicRoute, /executeTopicLabAnalysis/u);
assert.match(projectTopicRoute, /executeTopicLabAnalysis/u);
assert.match(preProjectTopicRoute, /persistence: "NONE"/u);
assert.match(topic, /尚未建立 Project，不會持久化任何候選/u);
assert.match(topic, /採用並一鍵建立可審查 S0 草稿/u);
assert.match(topicRepository, /TOPIC_LAB_DOCUMENT_TYPE = "RESEARCH_PLAN"/u);
assert.match(topicRepository, /TOPIC_LAB_STAGE_DETAIL = "M01_TOPIC_LAB_ANALYSIS"/u);
assert.match(topicRepository, /INSERT INTO research_documents/u);
assert.match(topicRepository, /sourceStatus: "UNVERIFIED"/u);
assert.match(topicRepository, /DOCUMENT_RELEASE/u);
assert.match(topicRepository, /artifact_type='topic_lab_candidate'/u);
assert.match(topicRepository, /pg_advisory_xact_lock/u);
assert.doesNotMatch(`${topicService}\n${topicRepository}\n${preProjectTopicRoute}\n${projectTopicRoute}`, /0007|topic_lab_runs|topic_lab_human_gates|topic_lab_promotions/u);
assert.ok(dashboard.includes("S0 Intake"), "historical dashboard remains present as an unreferenced legacy component");

const surfacesByMilestone = {
  M01: ["M01_TOPIC_CONDITIONS"],
  M02: ["M02_TERMINOLOGY"],
  M03: ["M03_JOURNAL_PROFILE"],
  M04: ["M04_TARGET_JOURNAL", "M04_COVER_BODY"],
  M05: ["M05_BILINGUAL", "M05_RATIONALE", "M05_METHODS", "M05_MODE_SPECIFIC", "M05_EXECUTION", "M05_BUDGET_RISKS"],
};
for (const [milestone, surfaces] of Object.entries(surfacesByMilestone)) {
  for (const surface of surfaces) {
    const contract = ASSIST_REGISTRY[surface];
    assert(contract, `${milestone} ${surface} must be registered`);
    assert.equal(contract.scope, "PROJECT");
    assert.equal(contract.operation.startsWith("ASSIST_"), true);
  }
}

const componentContracts = [
  ["components/TopicLabFrontierRadar.tsx", ["M01_TOPIC_CONDITIONS", "建立選題與前沿雷達版本"]],
  ["components/AcademicLanguageStudio.tsx", ["M02_TERMINOLOGY", "新增術語庫版本"]],
  ["components/ReviewStudio.tsx", ["M03_JOURNAL_PROFILE", "建立唯讀審稿版本"]],
  ["components/JournalSubmissionStudio.tsx", ["M04_TARGET_JOURNAL", "M04_COVER_BODY", "建立投稿核對版本"]],
  ["components/ProposalStudio.tsx", ["M05_BILINGUAL", "M05_RATIONALE", "M05_METHODS", "M05_MODE_SPECIFIC", "M05_EXECUTION", "M05_BUDGET_RISKS", "新增計畫書版本（不覆寫）"]],
];
for (const [relative, tokens] of componentContracts) {
  const source = read(relative);
  for (const token of tokens) assert.ok(source.includes(token), `${relative} missing ${token}`);
}
assert.equal(ASSIST_REGISTRY.M01_TOPIC_CONDITIONS.label, "協助整理研究條件");

for (const denied of ["AUTH", "ADMIN", "PASSWORD", "PROFILE", "MODEL_MODE", "CHAT_COMPOSER", "sourceUrl", "candidateHash", "approvalRationale"]) {
  assert.equal(Object.hasOwn(ASSIST_REGISTRY, denied), false);
}

console.log("C2R3_FUNCTIONAL_INVENTORY=PASS");
console.log("C2R3_TOPIC_LAB_SINGLE_UI_SHARED_SERVICE=PASS");
console.log("C2R3_TOPIC_LAB_SCHEMA_0006_NO_0007=PASS");
console.log("C2R3_M01_M05_VISIBLE_CTA_ROUTE_PROVIDER_TENANT_WRITE_BOUNDARY=PASS");
