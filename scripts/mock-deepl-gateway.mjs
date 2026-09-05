import http from "node:http";

// DeepL mock：僅供契約測試（DEEPL_BASE_URL=http://127.0.0.1:<port>）
// 回應：每個段落原文加上 [MOCK-DEEPL] 前綴（不增減數字/單位/引文，保全檢查可過）。
const port = Number(process.env.M02_GATEWAY_PORT || 0);
if (!Number.isInteger(port) || port < 1024 || port > 65535) process.exit(2);

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/v2/translate") { response.writeHead(404).end(); return; }
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; if (raw.length > 200_000) request.destroy(); });
  request.on("end", () => {
    try {
      const body = JSON.parse(raw);
      const texts = Array.isArray(body.text) ? body.text.map((item) => String(item)) : [];
      const translations = texts.map((item) => ({ text: `[MOCK-DEEPL] ${item}`, detected_source_language: body.source_lang || "EN" }));
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ translations }));
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "INVALID_FIXTURE_REQUEST" }));
    }
  });
});

server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
