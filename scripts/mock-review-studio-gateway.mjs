import http from "node:http";
import { createHash } from "node:crypto";

const port = Number(process.env.M03_GATEWAY_PORT || 0);
if (!Number.isInteger(port) || port < 1024 || port > 65535) process.exit(2);
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}` : JSON.stringify(value);
const hash = (value) => createHash("sha256").update(canonical(value), "utf8").digest("hex");

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") { response.writeHead(404).end(); return; }
  let raw = ""; request.setEncoding("utf8"); request.on("data", (chunk) => { raw += chunk; if (raw.length > 200_000) request.destroy(); });
  request.on("end", () => {
    try {
      const outer = JSON.parse(raw); const user = outer.messages?.findLast?.((item) => item?.role === "user")?.content; const payload = JSON.parse(user); const first = payload.paragraphs[0];
      const findings = payload.cycle === 0 ? [{ findingId: "finding-browser-method-0001", lens: "METHOD", severity: "P1", paragraphId: first.paragraphId, startOffset: first.source.indexOf("method"), endOffset: first.source.indexOf("method") + 6, sourceSpanHash: hash("method"), suggestedRevision: "study", rationale: "方法稱呼需與實際設計一致。", risk: "設計可能被誤解。", uncertainty: "需由研究者確認。", action: "核對設計後決定是否採用。" }] : [];
      const content = JSON.stringify({ contractVersion: "review-studio/1.0.0", status: "SUCCESS", cycle: payload.cycle, qualityDelta: payload.cycle === 0 ? 8 : 2, lenses: payload.lenses, findings, uncertainties: payload.cycle === 0 ? ["未取得研究設計附件。"] : [] });
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); response.end(JSON.stringify({ object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }));
    } catch { response.writeHead(400, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: "INVALID_FIXTURE_REQUEST" })); }
  });
});
server.listen(port, "127.0.0.1"); for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
