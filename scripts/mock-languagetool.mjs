import http from "node:http";

// LanguageTool mock（僅供契約測試；LT_BASE_URL=http://127.0.0.1:<port>）
// 規則：文字含 "an test" → 回報 1 個 match（offset=an test 起始、length=2、建議 "a"）。
const port = Number(process.env.M02_GATEWAY_PORT || 0);
if (!Number.isInteger(port) || port < 1024 || port > 65535) process.exit(2);

const server = http.createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/v2/check") { response.writeHead(404).end(); return; }
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; if (raw.length > 200_000) request.destroy(); });
  request.on("end", () => {
    try {
      const params = new URLSearchParams(raw);
      const text = params.get("text") || "";
      const matches = [];
      const idx = text.indexOf("an test");
      if (idx >= 0) {
        matches.push({ offset: idx, length: 2, message: "Use \u201ca\u201d instead of \u2018an\u2019 if the following word doesn\u2019t start with a vowel sound.", shortMessage: "Use \u2018a\u2019", rule: { id: "EN_A_VS_AN", category: { id: "MISC" } }, replacements: [{ value: "a" }] });
      }
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ software: { name: "LanguageTool", version: "6.8-mock" }, language: { code: "en-US" }, matches }));
    } catch {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "INVALID_FIXTURE_REQUEST" }));
    }
  });
});

server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
