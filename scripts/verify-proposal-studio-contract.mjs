import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROPOSAL_SOURCE_REVIEW_WINDOW_DAYS,
  PROPOSAL_STUDIO_CONTRACT_VERSION,
  assertProposalPromotable,
  buildProposalMarkdown,
  parseProposalDraft,
  parseProposalStudioRequest,
  proposalModes,
  proposalStudioHash,
  proposalValidationSummary,
  sourceFreshnessClass,
} from "../lib/proposal-studio-contract.ts";
import { TASK_GATEWAY_CONTRACT_VERSION, parseTaskEnvelope } from "../lib/task-gateway-contract.ts";
import { runProposalGuidance } from "../lib/proposal-studio-guidance.ts";
import { buildSyntheticProposal } from "./proposal-studio-test-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const read = (relative) => readFile(path.join(root, relative), "utf8");
const [suiteText, schemaText, route, repository, guidanceSource, component, migrationManifest, skillRegistry] = await Promise.all([read("contracts/proposal-studio.fixture-suite.json"), read("contracts/proposal-studio.schema.json"), read("app/api/projects/[projectId]/proposal-studio/route.ts"), read("lib/proposal-studio-repository.ts"), read("lib/proposal-studio-guidance.ts"), read("components/ProposalStudio.tsx"), read("database/migration-manifest.json"), read("contracts/skill-registry.json")]);
const suite = JSON.parse(suiteText); const reviewNow = new Date(suite.reviewNow); assert.equal(suite.contractVersion, PROPOSAL_STUDIO_CONTRACT_VERSION); assert.equal(suite.fixtureAuthority, "SYNTHETIC_LOCAL_ONLY_NOT_OFFICIAL_NOT_FOR_SUBMISSION"); assert.equal(suite.scenarios.length, 6); assert.deepEqual(proposalModes, ["NSTC_RESEARCH", "MOE_TEACHING_PRACTICE"]); assert.equal(PROPOSAL_SOURCE_REVIEW_WINDOW_DAYS, 180);

for (const scenario of suite.scenarios) {
  const proposal = parseProposalDraft(buildSyntheticProposal(scenario)); const summary = proposalValidationSummary(proposal, reviewNow);
  assert.equal(proposal.mode, scenario.mode); assert.equal(proposal.requirements.length, 12); assert.equal(proposal.officialSource.humanVerified, scenario.humanVerified); assert.equal(proposal.budget.totalTwd, 3000); assert.equal(proposal.budget.items[0].workPackageId, proposal.workPackages[0].workPackageId);
  if (scenario.name.endsWith("COMPLETE")) { assert.equal(summary.sourceFreshness, "CURRENT"); assert.equal(summary.factualPass, 12); assert.equal(assertProposalPromotable(proposal, reviewNow), true); }
  if (scenario.name.endsWith("UNKNOWN")) { assert.equal(summary.factualUnknown, 12); assert.throws(() => assertProposalPromotable(proposal, reviewNow), /official_source_human_verification_required|proposal_requirements_unresolved/); }
  if (scenario.name.endsWith("STALE")) { assert.equal(summary.sourceFreshness, "STALE"); assert.throws(() => assertProposalPromotable(proposal, reviewNow), /official_source_freshness_required/); }
  const markdown = buildProposalMarkdown(`${scenario.name} preview`, proposal); assert.match(markdown, /本預覽僅供人工核對，不代表線上送件/); assert.doesNotMatch(markdown, /acceptance probability|guaranteed funding/i);
}

const completeScenario = suite.scenarios.find((item) => item.name === "NSTC_COMPLETE"); const complete = buildSyntheticProposal(completeScenario);
assert.throws(() => parseProposalDraft({ ...complete, extra: true }), /invalid_proposal_shape/);
assert.throws(() => parseProposalDraft({ ...complete, officialSource: { ...complete.officialSource, authorityClass: "MOE_OFFICIAL" } }), /source_mode_authority_mismatch/);
assert.throws(() => parseProposalDraft({ ...complete, requirements: complete.requirements.slice(1) }), /requirements_matrix_incomplete/);
assert.throws(() => parseProposalDraft({ ...complete, officialSource: { ...complete.officialSource, humanVerified: false } }), /unverified_source_cannot_decide_fact/);
assert.throws(() => parseProposalDraft({ ...complete, budget: { ...complete.budget, items: [{ ...complete.budget.items[0], subtotalTwd: 3001 }] } }), /budget_arithmetic_mismatch/);
assert.throws(() => parseProposalDraft({ ...complete, budget: { ...complete.budget, items: [{ ...complete.budget.items[0], workPackageId: "wp-missing" }] } }), /budget_work_package_not_found/);
assert.throws(() => parseProposalDraft({ ...complete, milestones: [{ ...complete.milestones[0], workPackageId: "wp-missing" }] }), /milestone_work_package_not_found/);
assert.equal(sourceFreshnessClass(parseProposalDraft(complete).officialSource, reviewNow), "CURRENT");
assert.equal(sourceFreshnessClass({ ...parseProposalDraft(complete).officialSource, retrievedAt: "2026-08-23T23:59:59.000Z" }, reviewNow), "CURRENT", "date-only UI must tolerate same UTC calendar day");
assert.equal(sourceFreshnessClass({ ...parseProposalDraft(complete).officialSource, retrievedAt: "2026-08-24T00:00:00.000Z" }, reviewNow), "UNKNOWN", "a later calendar day must fail closed");

const save = parseProposalStudioRequest({ operation: "SAVE_PROPOSAL_VERSION", idempotencyKey: "m05-save:contract-0001", logicalId: "m05-nstc-proposal-main", expectedVersion: 0, title: "Synthetic NSTC proposal", sourceDocumentVersionId: null, sourceContentHash: null, proposal: complete }); assert.equal(save.operation, "SAVE_PROPOSAL_VERSION");
assert.throws(() => parseProposalStudioRequest({ ...save, expectedVersion: -1 }), /invalid_expected_version/); assert.throws(() => parseProposalStudioRequest({ ...save, extra: true }), /invalid_save_proposal_shape/);
const task = parseTaskEnvelope({ contractVersion: TASK_GATEWAY_CONTRACT_VERSION, actionId: "m05-proposal-guidance", taskId: "m05-task-contract-0001", tenantId: "tenant-contract-0001", projectId: "project-contract-0001", operation: "PROPOSAL_GUIDANCE", idempotencyKey: "m05-guidance:contract-0001", createdAt: reviewNow.toISOString(), payload: { kind: "PROPOSAL_GUIDANCE", proposalHash: proposalStudioHash(complete), mode: "NSTC_RESEARCH", focus: "BUDGET_JUSTIFICATION", modeProfile: "AUTO" }, skillIds: ["research-grants"], toolIds: [], continuation: null }, new Set(["research-grants"])); assert.equal(task.operation, "PROPOSAL_GUIDANCE");
assert.throws(() => parseTaskEnvelope({ ...task, skillIds: ["unregistered-skill"] }, new Set(["research-grants"])), /skill_not_allowlisted/);
const localGuidance = await runProposalGuidance({ tenantId: "workspace-contract-0001", projectId: "project-contract-0001", userId: "user-contract-0001", idempotencyKey: "m05-guidance:contract-0001", proposalHash: proposalStudioHash(complete), mode: "NSTC_RESEARCH", focus: "BUDGET_JUSTIFICATION", modeProfile: "AUTO", now: reviewNow }, { OLD_MIKE_PROPOSAL_GUIDANCE_MODE: "LOCAL_FIXTURE", TEST_FIXTURE: "1" }); assert.equal(localGuidance.guidance.label, "老麥建議・尚未驗證"); assert.equal(localGuidance.guidance.factualAuthority, "NONE"); assert.equal(localGuidance.guidance.formalRecordMutation, false); assert.equal(localGuidance.receipt.dataEgress, "NONE");
await assert.rejects(() => runProposalGuidance({ tenantId: "workspace-contract-0001", projectId: "project-contract-0001", userId: "user-contract-0001", idempotencyKey: "m05-guidance:disabled-0001", proposalHash: proposalStudioHash(complete), mode: "NSTC_RESEARCH", focus: "STRUCTURE", modeProfile: "AUTO", now: reviewNow }, {}), /proposal_guidance_disabled/);

for (const source of [route, repository]) { assert.match(source, /resolveResearchTenant|workspace_id=\$1/); assert.match(source, /projectId|project_id/); }
assert.match(route, /requireAuthenticatedUser/); assert.match(route, /originAllowed\(request\)/); assert.match(route, /guardSensitiveAuthRateLimit/); assert.match(route, /Cache-Control.*no-store/);
assert.match(repository, /pg_advisory_xact_lock/); assert.match(repository, /supersedes_version_id/); assert.match(repository, /DOCUMENT_RELEASE/); assert.match(repository, /RESEARCH_PLAN/); assert.match(repository, /M05_PROPOSAL_VERSION_SAVED/); assert.match(repository, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
assert.match(guidanceSource, /research-grants/); assert.match(guidanceSource, /LOCAL_FIXTURE/); assert.match(guidanceSource, /factualAuthority: "NONE"/); assert.doesNotMatch(guidanceSource, /fetch\(|https?:\/\//);
assert.match(component, /臺灣計畫書工作室/); assert.match(component, /NSTC 研究計畫/); assert.match(component, /教育部教學實踐研究計畫/); assert.match(component, /老麥建議・尚未驗證/); assert.match(component, /DOCUMENT_RELEASE/); assert.match(component, /本機預覽（不送件）/); assert.doesNotMatch(component, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini|Better Auth|acceptance probability/i);
assert.doesNotMatch(route, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini/i); assert.doesNotMatch(migrationManifest, /0008|proposal_studio|m05/i, "M05 must reuse existing research workflow tables");
const schema = JSON.parse(schemaText); assert.equal(schema.additionalProperties, false); assert.deepEqual(schema.properties.mode.enum, ["NSTC_RESEARCH", "MOE_TEACHING_PRACTICE"]); assert.equal(schema.properties.requirements.minItems, 12);
const registry = JSON.parse(skillRegistry); const skill = registry.skills.find((item) => item.id === "research-grants"); assert.deepEqual({ license: skill.license, version: skill.version, dataEgress: skill.dataEgress, toolPolicy: skill.toolPolicy }, { license: "MIT", version: "1.1", dataEgress: "NONE_BY_DEFAULT", toolPolicy: "PORTAL_FACTS_ONLY" });

console.log("M05_CONTRACT_CATEGORY_4_SOURCE_FACTUAL_HEURISTIC=PASS");
console.log("M05_CONTRACT_CATEGORY_5_NSTC_FIXTURES=PASS_COMPLETE_UNKNOWN_STALE");
console.log("M05_CONTRACT_CATEGORY_6_MOE_FIXTURES=PASS_COMPLETE_UNKNOWN_STALE");
console.log("M05_CONTRACT_CATEGORY_7_BUDGET_ARITHMETIC_LINKAGE=PASS");
console.log("M05_CONTRACT_CATEGORY_8_HUMAN_GATE_EXACT_HASH_STATIC=PASS");
console.log("M05_CONTRACT_CATEGORY_9_PROVIDER_SECRET_BRANDING=PASS");
console.log("MIGRATION_REQUIRED=NO");
