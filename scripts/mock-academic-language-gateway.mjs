import http from "node:http";

const port = Number(process.env.M02_GATEWAY_PORT || 0);
if (!Number.isInteger(port) || port < 1024 || port > 65535) process.exit(2);

let gatewayAttempts = 0;

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") { response.writeHead(404).end(); return; }
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; if (raw.length > 200_000) request.destroy(); });
  request.on("end", () => {
    try {
      const outer = JSON.parse(raw);
      const user = outer.messages?.findLast?.((item) => item?.role === "user")?.content;
      const payload = JSON.parse(user);
      const paragraphs = payload.paragraphs.map(({ index, source }) => ({
        index,
        source,
        revised: source === "教學實踐研究納入 42 participants [1]，劑量為 5 mg。$x=1$" ? "Teaching Practice Research included 42 participants [1] at a dose of 5 mg. $x=1$" : source,
        changes: [{ kind: payload.task === "TRANSLATE_ZH_EN" ? "TRANSLATION" : "CLARITY", original: source, revised: source === "教學實踐研究納入 42 participants [1]，劑量為 5 mg。$x=1$" ? "Teaching Practice Research included 42 participants [1] at a dose of 5 mg. $x=1$" : source, reason: "依專案術語與期刊語氣進行可追溯調整。" }],
      }));
      // FAIL_FIRST：第一次回應形狀不符契約（段落多出額外鍵），第二次起正常 → 驗證自動重試。
      if (process.env.M02_GATEWAY_FAIL_FIRST === "1") {
        gatewayAttempts += 1;
        if (gatewayAttempts === 1) {
          const bad = JSON.stringify({ contractVersion: "academic-language/1.1.0", status: "SUCCESS", task: payload.task, tonePreset: payload.tonePreset, paragraphs: paragraphs.map((item) => ({ ...item, extraKey: true })), uncertainties: [] });
          response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          response.end(JSON.stringify({ object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: bad }, finish_reason: "stop" }] }));
          return;
        }
      }
      const content = JSON.stringify({ contractVersion: "academic-language/1.1.0", status: "SUCCESS", task: payload.task, tonePreset: payload.tonePreset, paragraphs, uncertainties: ["研究者仍需確認專業語境與作者原意。"] });
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }));
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: "INVALID_FIXTURE_REQUEST" }));
    }
  });
});

server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
