import http from "node:http";
import https from "node:https";
import selfsigned from "selfsigned";

const port = Number(process.env.LOCAL_HTTPS_PROXY_PORT);
const backendPort = Number(process.env.LOCAL_HTTPS_BACKEND_PORT);
if (!Number.isInteger(port) || !Number.isInteger(backendPort) || port < 1024 || backendPort < 1024) process.exit(2);
const certificate = await selfsigned.generate(
  [{ name: "commonName", value: "localhost" }],
  {
    algorithm: "sha256",
    days: 1,
    keySize: 2048,
    extensions: [{ name: "subjectAltName", altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }] }],
  },
);

const server = https.createServer({ key: certificate.private, cert: certificate.cert }, (request, response) => {
  const headers = { ...request.headers, host: `localhost:${port}`, "x-forwarded-host": `localhost:${port}`, "x-forwarded-proto": "https" };
  delete headers.connection;
  delete headers["proxy-connection"];
  delete headers["transfer-encoding"];
  const requestChunks = [];
  request.on("data", (chunk) => requestChunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(requestChunks);
    if (body.length > 0) headers["content-length"] = String(body.length);
    else delete headers["content-length"];
    const upstream = http.request({ hostname: "127.0.0.1", port: backendPort, method: request.method, path: request.url, headers }, (upstreamResponse) => {
      const responseChunks = [];
      upstreamResponse.on("data", (chunk) => responseChunks.push(chunk));
      upstreamResponse.on("end", () => {
        const responseBody = Buffer.concat(responseChunks);
        const responseHeaders = { ...upstreamResponse.headers };
        for (const name of ["connection", "content-length", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]) delete responseHeaders[name];
        responseHeaders["content-length"] = String(responseBody.length);
        responseHeaders.connection = "close";
        response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
        if (request.method !== "HEAD") response.end(responseBody); else response.end();
      });
    });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(502, { "content-length": "0", connection: "close" }); response.end(); });
    if (body.length > 0) upstream.write(body);
    upstream.end();
  });
});
server.listen(port, "127.0.0.1", () => console.log("LOCAL_HTTPS_PROXY_READY=PASS"));

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
