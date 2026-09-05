import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSIST_ACTIONS,
  ASSIST_REGISTRY,
  OLD_MIKE_ASSIST_CONTRACT_VERSION,
  parseOldMikeAssistRequest,
  parseOldMikeAssistResponse,
  parseOldMikeAssistGroupValue,
  serializeOldMikeAssistGroup,
} from "../lib/old-mike-assist-contract.ts";
import {
  applyAssistPreview,
  cancelAssistPreview,
  createAssistDraftState,
  undoAssistPreview,
} from "../lib/old-mike-assist-state.ts";
import { executeOldMikeAssist } from "../lib/old-mike-assist-server.ts";

const expectedSurfaces = [
  "S0_RESEARCH_TEXT", "M01_TOPIC_CONDITIONS", "M02_TERMINOLOGY", "M03_JOURNAL_PROFILE",
  "M04_TARGET_JOURNAL", "M04_COVER_BODY", "M05_BILINGUAL", "M05_RATIONALE", "M05_METHODS",
  "M05_MODE_SPECIFIC", "M05_EXECUTION", "M05_BUDGET_RISKS", "RESEARCH_DESIGN",
  "RESEARCH_CLAIM", "RESEARCH_DOCUMENT",
];
assert.deepEqual(Object.keys(ASSIST_REGISTRY).sort(), expectedSurfaces.sort());
assert.deepEqual(ASSIST_ACTIONS, ["SUGGEST", "COMPLETE", "REWRITE", "TRANSLATE", "ALIGN_BILINGUAL", "CRITIQUE"]);

const base = {
  contractVersion: OLD_MIKE_ASSIST_CONTRACT_VERSION,
  idempotencyKey: "assist:fixture:00000001",
  surface: "M03_JOURNAL_PROFILE",
  targetId: "journalProfile",
  action: "SUGGEST",
  currentValue: "審慎期刊語境",
  currentHash: "7bcd055a02c85d68cf607e9eb471cc453647317c06d6e1f155e3322fd2545185",
  selection: null,
  modeProfile: "AUTO",
};
assert.equal(parseOldMikeAssistRequest(base, "PROJECT").ok, true);
for (const denied of [
  { ...base, action: "RUN_TOOL" },
  { ...base, surface: "AUTH_PASSWORD" },
  { ...base, targetId: "sourceUrl" },
  { ...base, arbitraryPrompt: "do anything" },
  { ...base, currentHash: "not-a-hash" },
]) assert.equal(parseOldMikeAssistRequest(denied, "PROJECT").ok, false);
assert.equal(parseOldMikeAssistRequest({ ...base, surface: "S0_RESEARCH_TEXT", targetId: "problemContext" }, "PRE_PROJECT").ok, true);
const rationaleFields = ASSIST_REGISTRY.M05_RATIONALE.groupFields["m05-rationale"];
const rationaleValue = serializeOldMikeAssistGroup(Object.fromEntries(rationaleFields.map((field) => [field, `${field} draft`])), rationaleFields);
assert.equal(parseOldMikeAssistRequest({ ...base, surface: "M05_RATIONALE", targetId: undefined, groupId: "m05-rationale", currentValue: rationaleValue }, "PROJECT").ok, true);
assert.equal(parseOldMikeAssistGroupValue(rationaleValue, rationaleFields)?.literatureGap, "literatureGap draft");
assert.equal(parseOldMikeAssistRequest({ ...base, surface: "M05_RATIONALE", targetId: undefined, groupId: "m05-rationale", currentValue: JSON.stringify({ problem: "only one field" }) }, "PROJECT").ok, false);

const response = parseOldMikeAssistResponse(JSON.stringify({
  completionClass: "COMPLETED",
  suggestions: [{ id: "suggestion-1", text: "更清楚的審稿語境", changeSummary: "聚焦期刊範圍", status: "AI_PROPOSED" }],
}), { originalHash: base.currentHash, contextHash: "a".repeat(64) });
assert.equal(response.ok, true);
assert.equal(response.ok && response.value.canApply, true);
assert.equal(response.ok && response.value.suggestions[0].status, "AI_PROPOSED");
assert.equal(response.ok && response.value.receipt.formalWrites, 0);
assert.equal(response.ok && response.value.receipt.retryCount, 0);

for (const invalid of [
  { completionClass: "COMPLETED", suggestions: [{ id: "x", text: "ok", changeSummary: "x", status: "VERIFIED" }] },
  { completionClass: "UNKNOWN", suggestions: [] },
  { completionClass: "COMPLETED", suggestions: [{ id: "x", text: "ok", changeSummary: "x", status: "AI_PROPOSED", provider: "leak" }] },
]) assert.equal(parseOldMikeAssistResponse(JSON.stringify(invalid), { originalHash: base.currentHash, contextHash: "a".repeat(64) }).ok, false);

const initial = createAssistDraftState("原稿", base.currentHash);
const preview = { text: "建議稿", originalHash: base.currentHash };
const applied = applyAssistPreview(initial, preview, base.currentHash);
assert.equal(applied.currentValue, "建議稿");
assert.equal(applied.provenance, "AI_PROPOSED");
assert.equal(undoAssistPreview(applied).currentValue, "原稿");
assert.equal(cancelAssistPreview(initial).currentValue, "原稿");
assert.throws(() => applyAssistPreview(initial, preview, "b".repeat(64)), /assist_preview_stale/);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoute = readFileSync(path.join(root, "app/api/projects/[projectId]/assist/route.ts"), "utf8");
const preProjectRoute = readFileSync(path.join(root, "app/api/assist/field/route.ts"), "utf8");
const hook = readFileSync(path.join(root, "hooks/useOldMikeAssist.ts"), "utf8");
const control = readFileSync(path.join(root, "components/OldMikeAssistControl.tsx"), "utf8");
assert.match(projectRoute, /requireAuthenticatedUser\(\)/u);
assert.match(projectRoute, /loadAuthorizedProjectTaskContext\(authenticated\.session\.user\.id, projectId\)/u);
assert.match(projectRoute, /parseOldMikeAssistRequest\(body, "PROJECT"\)/u);
assert.doesNotMatch(projectRoute, /\b(?:INSERT|UPDATE|DELETE|query\s*\(|save[A-Z]|create[A-Z])\b/u);
assert.match(preProjectRoute, /parseOldMikeAssistRequest\(required\.body, "PRE_PROJECT"\)/u);
assert.equal((hook.match(/\bfetch\s*\(/gu) || []).length, 1, "one request site only");
assert.match(hook, /new AbortController\(\)/u);
assert.match(hook, /建議未完成；未自動重送/u);
assert.match(hook, /內容已變更，這組建議已過期/u);
assert.doesNotMatch(hook, /localStorage|sessionStorage/u);
assert.match(control, /aria-haspopup="dialog"/u);
assert.match(control, /aria-expanded=\{assist\.open\}/u);
assert.match(control, /role="status" aria-live="polite"/u);
assert.match(control, /role="alert"/u);
assert.doesNotMatch(control, /<button[^>]*role="listitem"/u);

const previousFetch = globalThis.fetch;
const previousBase = process.env.OPENCLAW_BASE_URL;
const previousToken = process.env.OPENCLAW_GATEWAY_TOKEN;
const fixtureToken = "fixture-server-secret-token-000001";
let providerRequests = 0;
try {
  process.env.OPENCLAW_BASE_URL = "http://service-0123456789abcdef01234567";
  process.env.OPENCLAW_GATEWAY_TOKEN = fixtureToken;
  globalThis.fetch = async (url, init) => {
    providerRequests += 1;
    assert.equal(url, "http://service-0123456789abcdef01234567/v1/chat/completions");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "openclaw/default");
    assert.equal(body.stream, false);
    assert.equal(JSON.stringify(body).includes(fixtureToken), false, "server credential must not enter request body");
    assert.equal(body.messages.length, 2);
    const suggestionText = serializeOldMikeAssistGroup(Object.fromEntries(rationaleFields.map((field) => [field, `${field} reviewed draft`])), rationaleFields);
    const content = JSON.stringify({ completionClass: "COMPLETED", suggestions: [{ id: "m05-suggestion-0001", text: suggestionText, changeSummary: "依固定欄位整理研究價值", status: "AI_PROPOSED" }] });
    return new Response(JSON.stringify({ object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const m05Request = {
    ...base,
    surface: "M05_RATIONALE",
    targetId: undefined,
    groupId: "m05-rationale",
    currentValue: rationaleValue,
    currentHash: createHash("sha256").update(rationaleValue, "utf8").digest("hex"),
  };
  const parsedM05 = parseOldMikeAssistRequest(m05Request, "PROJECT");
  assert.equal(parsedM05.ok, true);
  const m05Result = await executeOldMikeAssist({ request: parsedM05.value, context: { authorized: true, bounded: true }, contextHash: "d".repeat(64), sessionKey: "assist:m05-fixture-session" });
  assert.equal(m05Result.kind, "success");
  assert.equal(m05Result.kind === "success" && m05Result.value.receipt.formalWrites, 0);
  assert.equal(providerRequests, 1, "M05 typed operation permits exactly one fixture request");
} finally {
  globalThis.fetch = previousFetch;
  if (previousBase === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = previousBase;
  if (previousToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = previousToken;
}

console.log("c2r3 unified assist contracts: PASS");
console.log("c2r3 m05 typed chat-completions fixture: PASS");
