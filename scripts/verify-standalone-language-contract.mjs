import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseStandaloneTransformBody,
  buildStandaloneGlossary,
  runStandaloneAcademicLanguage,
} from "../lib/standalone-academic-language.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

// 靜態契約（不需 DB）：route 不需 projectId、僅登入、不 import repository（不寫專案表）
const [routeFile, uiFile, guidedFile, contractFile] = await Promise.all([
  read("app/api/standalone/academic-language/route.ts"),
  read("components/StandaloneLanguageTool.tsx"),
  read("components/GuidedResearchCenter.tsx"),
  read("lib/standalone-academic-language.ts"),
]);
assert.match(routeFile, /requireAuthenticatedUser/);
assert.doesNotMatch(routeFile, /resolveResearchTenant/);
assert.doesNotMatch(routeFile, /research-documents|research_documents|language_work_orders|translation_segments/);
assert.doesNotMatch(routeFile, /research-academic-language-repository|academic-language-repository/);
assert.match(routeFile, /STANDALONE_TRANSFORM/);
assert.doesNotMatch(uiFile, /OpenClaw|Codex|OpenAI|ChatGPT|Anthropic|Claude|Gemini|DeepSeek|gpt-[a-z0-9.-]+/i);
assert.match(uiFile, /AI_PROPOSED/);
assert.match(uiFile, /paper 文獻/);
assert.match(guidedFile, /standalone-language/);
assert.match(guidedFile, /StandaloneLanguageTool/);
assert.match(guidedFile, /獨立工具/);

// contract：獨立 body 解析（不需 DB）
const parsed = parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "主要結果為 1.50。", modeProfile: "AUTO" });
assert.equal(parsed.operation, "STANDALONE_TRANSFORM");
assert.equal(parsed.scope, "PARAGRAPH");
assert.equal(parsed.title, "獨立翻譯草稿");
let contractReject = false;
try { parseStandaloneTransformBody({ operation: "SCRATCH_TRANSFORM" }); } catch { contractReject = true; }
assert.equal(contractReject, true, "非 STANDALONE_TRANSFORM 應被拒絕");
let glossaryReject = false;
try { parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "a\n\nb", modeProfile: "AUTO" }); } catch { glossaryReject = true; }
assert.equal(glossaryReject, true, "PARAGRAPH scope 多段應被拒絕");
const glossary = buildStandaloneGlossary({ fixedTerms: "教學實踐研究 => Teaching Practice Research" });
assert.equal(glossary.entries.length, 1);
const none = buildStandaloneGlossary({});
assert.equal(none, null);

// provider 成功路徑：起 mock gateway（不需 DB；無 OPENCLAW env 時以 mock 模擬）
const runs = [];
const pass = (name) => { runs.push(name); console.log(`${name}=PASS`); };
const fail = (name, error) => { runs.push(name); console.log(`${name}=FAIL (${String(error).slice(0, 220)})`); };

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on("error", reject);
  });
}
function waitForListen(port, child) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const socket = net.connect({ port, host: "127.0.0.1" });
      socket.on("connect", () => { socket.destroy(); clearInterval(timer); resolve(); });
      socket.on("error", () => { socket.destroy(); if (Date.now() - started > 8000) { clearInterval(timer); reject(new Error("mock gateway 未啟動")); } });
    }, 150);
    child.on("exit", (code) => { clearInterval(timer); if (code && code !== 0) reject(new Error(`mock gateway exit ${code}`)); });
  });
}

let gatewayProcess = null;
let failFirstGatewayProcess = null;
let deepLMockProcess = null;
let languageToolMockProcess = null;
function spawnGateway(failFirst) {
  return new Promise(async (resolve, reject) => {
    const port = await freePort();
    const child = spawn(process.execPath, ["scripts/mock-academic-language-gateway.mjs"], { cwd: root, env: { ...process.env, M02_GATEWAY_PORT: String(port), ...(failFirst ? { M02_GATEWAY_FAIL_FIRST: "1" } : {}) }, stdio: ["ignore", "pipe", "pipe"] });
    await waitForListen(port, child);
    resolve({ port, child });
  });
}
try {
  const first = await spawnGateway(false);
  gatewayProcess = first.child;
  const gatewayPort = first.port;
  const originalBaseUrl = process.env.OPENCLAW_BASE_URL;
  const originalToken = process.env.OPENCLAW_GATEWAY_TOKEN;
  process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${gatewayPort}`;
  process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
  try {
    const result = await runStandaloneAcademicLanguage({ userId: "standalone-e2e-user", body: parsed });
    assert.equal(result.persistence, "NONE");
    assert.equal(result.humanGate, "NOT_APPLICABLE");
    assert.equal(result.mode, "STANDALONE_AI_PROPOSED");
    assert.ok(result.paragraphs.length >= 1);
    assert.ok(result.sourceHash.length === 64);
    pass("STANDALONE_TRANSFORM_PROVIDER_PATH");
  } finally {
    if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = originalToken
  }
  // 自動重試：第一次回應形狀不符契約 → 第二次成功
  try {
    const failFirst = await spawnGateway(true);
    failFirstGatewayProcess = failFirst.child;
    process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${failFirst.port}`;
    process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
    const retried = await runStandaloneAcademicLanguage({ userId: "standalone-e2e-retry-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "主要結果為 1.50。", modeProfile: "AUTO" }) });
    assert.ok(retried.paragraphs.length >= 1, "重試後應成功產出段落");
    pass("STANDALONE_TRANSFORM_AUTO_RETRY");
  } catch (e) {
    fail("STANDALONE_TRANSFORM_AUTO_RETRY", e);
  } finally {
    if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = originalToken
  }
  // ===== GRAMMAR_CHECK（階段 1 文法檢查診斷）=====
  // 1) parse 接受 GRAMMAR_CHECK（預設老麥 AI）
  try {
    const gc = parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "GRAMMAR_CHECK", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "This is an test of the system.", modeProfile: "AUTO" });
    assert.equal(gc.task, "GRAMMAR_CHECK");
    assert.equal(gc.engine, "OLD_MIKE");
    pass("STANDALONE_GRAMMAR_CHECK_PARSE");
  } catch (e) { fail("STANDALONE_GRAMMAR_CHECK_PARSE", e); }

  // 2) provider 路徑成功（mock gateway；保全數字/引文）
  try {
    process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${gatewayPort}`;
    process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
    const gcResult = await runStandaloneAcademicLanguage({ userId: "standalone-grammar-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "GRAMMAR_CHECK", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "This is an test of 128 participants [1].", modeProfile: "AUTO" }) });
    assert.equal(gcResult.task, "GRAMMAR_CHECK");
    assert.equal(gcResult.engine, "OLD_MIKE");
    assert.equal(gcResult.persistence, "NONE");
    assert.ok(gcResult.paragraphs.length >= 1);
    assert.ok(gcResult.paragraphs[0].revised.includes("128"), "數字應保留");
    assert.ok(gcResult.paragraphs[0].revised.includes("[1]"), "引文應保留");
    pass("STANDALONE_GRAMMAR_CHECK_PROVIDER");
  } catch (e) { fail("STANDALONE_GRAMMAR_CHECK_PROVIDER", e); }
  finally {
    if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = originalToken
  }

  // 3) GRAMMAR_CHECK 不支援 DeepL → 明確拒絕
  try {
    await assert.rejects(
      runStandaloneAcademicLanguage({ userId: "standalone-grammar-deepl-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "GRAMMAR_CHECK", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "This is an test.", modeProfile: "AUTO", engine: "DEEPL" }) }),
      /deepl_task_not_supported/,
    );
    pass("STANDALONE_GRAMMAR_CHECK_DEEPL_REJECT");
  } catch (e) { fail("STANDALONE_GRAMMAR_CHECK_DEEPL_REJECT", e); }

  // ===== 混合文法：LanguageTool 機械層（階段 2）=====
  // 1) LT 可用：GRAMMAR_CHECK 回傳 mechanical.issues（含 offset/replacements）
  try {
    const ltPort = await freePort();
    languageToolMockProcess = spawn(process.execPath, ["scripts/mock-languagetool.mjs"], { cwd: root, env: { ...process.env, M02_GATEWAY_PORT: String(ltPort) }, stdio: ["ignore", "pipe", "pipe"] });
    await waitForListen(ltPort, languageToolMockProcess);
    process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${gatewayPort}`;
    process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
    const origLt = process.env.LT_BASE_URL;
    process.env.LT_BASE_URL = `http://127.0.0.1:${ltPort}`;
    const hybrid = await runStandaloneAcademicLanguage({ userId: "standalone-hybrid-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "GRAMMAR_CHECK", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "This is an test of 128 participants [1].", modeProfile: "AUTO" }) });
    assert.equal(hybrid.mechanical?.engine, "LANGUAGETOOL");
    assert.equal(hybrid.mechanical?.available, true);
    assert.ok(hybrid.mechanical && hybrid.mechanical.issues.length >= 1, "LT mock 應回報 an→a 問題");
    const issue = hybrid.mechanical.issues[0];
    assert.equal(issue.paragraphIndex, 0);
    assert.ok(issue.replacements.includes("a"), "應含建議替換 a");
    assert.equal(hybrid.mechanical.degradedParagraphs.length, 0);
    pass("STANDALONE_GRAMMAR_LT_AVAILABLE");
    if (origLt === undefined) delete process.env.LT_BASE_URL; else process.env.LT_BASE_URL = origLt;
  } catch (e) { fail("STANDALONE_GRAMMAR_LT_AVAILABLE", e); }
  finally {
    delete process.env.LT_BASE_URL;
    if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
  }

  // 2) LT 未設定：降級可用（available=false + note），AI 診斷照常
  try {
    process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${gatewayPort}`;
    process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
    const solo = await runStandaloneAcademicLanguage({ userId: "standalone-lt-missing-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "GRAMMAR_CHECK", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "This is an test of the system.", modeProfile: "AUTO" }) });
    assert.equal(solo.mechanical?.available, false);
    assert.ok(solo.note.includes("LanguageTool"), "note 應說明機械層未設定");
    assert.ok(solo.paragraphs.length >= 1);
    pass("STANDALONE_GRAMMAR_LT_UNAVAILABLE_DEGRADE");
  } catch (e) { fail("STANDALONE_GRAMMAR_LT_UNAVAILABLE_DEGRADE", e); }
  finally {
    if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
  }

  // ===== DeepL 引擎（B）：契約測試 =====
  // 1) engine 解析：預設 OLD_MIKE；DEEPL 合法；非法值拒絕
  try {
    const def = parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "a", modeProfile: "AUTO" });
    assert.equal(def.engine, "OLD_MIKE");
    const dl = parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "a", modeProfile: "AUTO", engine: "DEEPL" });
    assert.equal(dl.engine, "DEEPL");
    let rejected = false;
    try { parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_ZH_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "a", modeProfile: "AUTO", engine: "BOGUS" }); } catch { rejected = true; }
    assert.equal(rejected, true, "非法 engine 應被拒絕");
    pass("STANDALONE_PARSE_ENGINE");
  } catch (e) { fail("STANDALONE_PARSE_ENGINE", e); }

  // 2) DeepL 成功路徑（mock）：engine=DEEPL，輸出標記 + 段落保全
  try {
    const dlPort = await freePort();
    deepLMockProcess = spawn(process.execPath, ["scripts/mock-deepl-gateway.mjs"], { cwd: root, env: { ...process.env, M02_GATEWAY_PORT: String(dlPort) }, stdio: ["ignore", "pipe", "pipe"] });
    await waitForListen(dlPort, deepLMockProcess);
    const origBase = process.env.OPENCLAW_BASE_URL;
    const origToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    const origDlBase = process.env.DEEPL_BASE_URL;
    const origDlKey = process.env.DEEPL_API_KEY;
    process.env.DEEPL_BASE_URL = `http://127.0.0.1:${dlPort}`;
    process.env.DEEPL_API_KEY = "test-deepl-free-key-0123456789:fx";
    const dlResult = await runStandaloneAcademicLanguage({ userId: "standalone-deepl-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_EN_ZH_TW", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "The quasi-experimental study included 128 participants at a single construction site.", modeProfile: "AUTO", engine: "DEEPL" }) });
    assert.equal(dlResult.engine, "DEEPL");
    assert.ok(dlResult.paragraphs[0].revised.startsWith("[MOCK-DEEPL]"), "應由 DeepL mock 產出");
    assert.ok(dlResult.paragraphs[0].revised.includes("128"), "數字應保留");
    assert.ok(dlResult.uncertainties.some((item) => item.includes("DeepL")), "應含第三方引擎提示");
    pass("STANDALONE_DEEPL_SUCCESS");
    if (origBase === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = origBase;
    if (origToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = originalToken
    if (origDlBase === undefined) delete process.env.DEEPL_BASE_URL; else process.env.DEEPL_BASE_URL = origDlBase;
    if (origDlKey === undefined) delete process.env.DEEPL_API_KEY; else process.env.DEEPL_API_KEY = origDlKey
  } catch (e) {
    fail("STANDALONE_DEEPL_SUCCESS", e);
    delete process.env.DEEPL_BASE_URL;
    delete process.env.DEEPL_API_KEY;
  }

  // 3) 術語表 + engine=DEEPL → 自動改用老麥 AI（Free 不支援術語表）
  try {
    process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${gatewayPort}`;
    process.env.OPENCLAW_GATEWAY_TOKEN = "test-token-0123456789abcdef";
    const glResult = await runStandaloneAcademicLanguage({ userId: "standalone-deepl-glossary-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "TRANSLATE_EN_ZH_TW", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "The experiment included 128 participants.", modeProfile: "AUTO", engine: "DEEPL", terms: { fixedTerms: "unrelated term => X" } }) });
    assert.equal(glResult.engine, "OLD_MIKE", "術語表應自動改用老麥 AI");
    assert.ok(glResult.note.includes("術語表"), "note 應說明原因");
    pass("STANDALONE_DEEPL_GLOSSARY_FALLBACK");
  } catch (e) { fail("STANDALONE_DEEPL_GLOSSARY_FALLBACK", e); }
  finally {
    if (originalBaseUrl === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = originalBaseUrl;
    if (originalToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = originalToken
  }

  // 4) EDIT_ACADEMIC_EN 不支援 DeepL → 明確拒絕
  try {
    process.env.DEEPL_API_KEY = "test-deepl-free-key-0123456789:fx";
    await assert.rejects(
      runStandaloneAcademicLanguage({ userId: "standalone-deepl-edit-user", body: parseStandaloneTransformBody({ operation: "STANDALONE_TRANSFORM", task: "EDIT_ACADEMIC_EN", scope: "PARAGRAPH", tonePreset: "JOURNAL_FORMAL", sourceText: "The results were significant.", modeProfile: "AUTO", engine: "DEEPL" }) }),
      /deepl_task_not_supported/,
    );
    pass("STANDALONE_DEEPL_EDIT_REJECTED");
  } catch (e) { fail("STANDALONE_DEEPL_EDIT_REJECTED", e); }
  finally {
    delete process.env.DEEPL_API_KEY;
  }
} catch (e) {
  fail("STANDALONE_TRANSFORM_PROVIDER_PATH", e);
} finally {
  if (gatewayProcess && !gatewayProcess.killed) gatewayProcess.kill("SIGTERM");
  if (failFirstGatewayProcess && !failFirstGatewayProcess.killed) failFirstGatewayProcess.kill("SIGTERM");
  if (deepLMockProcess && !deepLMockProcess.killed) deepLMockProcess.kill("SIGTERM");
  if (languageToolMockProcess && !languageToolMockProcess.killed) languageToolMockProcess.kill("SIGTERM");
}

const failed = runs.filter((name) => name.endsWith("=FAIL"));
console.log(`STANDALONE_LANGUAGE_CONTRACT_SUMMARY ${runs.length}/1 PASS`);
process.exit(failed.length ? 1 : 0);
