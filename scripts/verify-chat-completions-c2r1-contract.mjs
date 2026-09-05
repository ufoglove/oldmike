import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

import { callOpenClaw } from "../lib/openclaw.ts";
import { resolveModelRoute } from "../lib/model-route-catalog.ts";

const secretCanary = "fixture-secret-c2r1-chat-completions";
const logicalDefaultAgentAlias = "openclaw/default";
const observations = [];

const server = createServer((request, response) => {
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; });
  request.on("end", () => {
    const body = JSON.parse(raw);
    observations.push({ method: request.method, url: request.url, authorization: request.headers.authorization, body });
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/v1/chat/completions");
    assert.equal(request.headers.authorization, `Bearer ${secretCanary}`);
    assert.deepEqual(Object.keys(body).sort(), ["messages", "model", "stream", "user"]);
    assert.equal(body.model, logicalDefaultAgentAlias);
    assert.equal(body.stream, false);
    assert.equal(body.user.startsWith("opaque-c2r1-"), true);
    assert.deepEqual(body.messages.map(({ role }) => role), ["system", "user"]);
    assert.equal(raw.includes(secretCanary), false);

    if (body.user.endsWith("malformed")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "chat.completion", choices: [] }));
      return;
    }
    if (body.user.endsWith("partial")) {
      response.writeHead(206, { "content-type": "application/json" });
      response.end(JSON.stringify({ object: "chat.completion", choices: [] }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content: "老麥固定測試回覆", harmlessAdditive: true }, finish_reason: "stop", harmlessAdditive: true }],
      harmlessAdditive: true,
    }));
  });
});

await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
const address = server.address();
assert.ok(address && typeof address === "object");
const previousBase = process.env.OPENCLAW_BASE_URL;
const previousToken = process.env.OPENCLAW_GATEWAY_TOKEN;
try {
  process.env.OPENCLAW_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.OPENCLAW_GATEWAY_TOKEN = secretCanary;
  const route = resolveModelRoute({ modeProfile: "AUTO", operation: "ACADEMIC_LANGUAGE" });
  const messages = [{ role: "system", content: "固定契約" }, { role: "user", content: "請整理" }];
  assert.deepEqual(await callOpenClaw(messages, "opaque-c2r1-success", "ACADEMIC_LANGUAGE", route), { kind: "success", content: "老麥固定測試回覆" });
  assert.deepEqual(await callOpenClaw(messages, "opaque-c2r1-malformed", "ACADEMIC_LANGUAGE", route), { kind: "upstream-error" });
  assert.deepEqual(await callOpenClaw(messages, "opaque-c2r1-partial", "ACADEMIC_LANGUAGE", route), { kind: "upstream-error" });

  const callsBeforeProjectChat = observations.length;
  const projectChatRoute = resolveModelRoute({ modeProfile: "AUTO", operation: "PROJECT_CHAT" });
  assert.deepEqual(await callOpenClaw(messages, "opaque-c2r1-project-chat", "ACADEMIC_LANGUAGE", projectChatRoute), { kind: "invalid-config" });
  assert.equal(observations.length, callsBeforeProjectChat, "project chat must not protocol-guess through the chat-completions helper");
} finally {
  if (previousBase === undefined) delete process.env.OPENCLAW_BASE_URL; else process.env.OPENCLAW_BASE_URL = previousBase;
  if (previousToken === undefined) delete process.env.OPENCLAW_GATEWAY_TOKEN; else process.env.OPENCLAW_GATEWAY_TOKEN = previousToken;
  await new Promise((resolve) => server.close(resolve));
}

assert.equal(observations.length, 3, "each submitted request must execute exactly once with no endpoint fallback or retry");
const source = await readFile(new URL("../lib/openclaw.ts", import.meta.url), "utf8");
assert.match(source, /\/v1\/chat\/completions/);
assert.doesNotMatch(source, /\/v1\/responses|\/tools\/invoke|OPENCLAW_MODEL/);

console.log("STRICT_CHAT_COMPLETIONS_C2R1_FIXTURE=PASS");
console.log("CHAT_COMPLETIONS_SUBMISSION_COUNT=3_NO_RETRY_NO_FALLBACK");
