import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(root, "scripts", "run-controlled-invite.sh");
const createPath = path.join(root, "scripts", "create-registration-invite.mjs");
const manifest = JSON.parse(await readFile(path.join(root, "scripts", "operator", "operator-runtime-manifest.json"), "utf8"));
const runner = await readFile(runnerPath);
const source = runner.toString("utf8");
const createSource = await readFile(createPath, "utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");

assert.equal(runner.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, "runner must not have UTF-8 BOM");
assert.equal(source.includes("\r"), false, "runner must use LF line endings");
assert.equal(source.endsWith("\n"), true, "runner must have a final newline");
assert.equal(source.endsWith("\n\n"), false, "runner must have exactly one final newline");
assert.equal(digest(runner), manifest.files["run-controlled-invite.sh"]);
assert.equal(runner.length, manifest.sizes["run-controlled-invite.sh"]);
assert.equal(digest(Buffer.from(`\ufeff${source}`, "utf8")) === digest(runner), false);
assert.equal(digest(Buffer.from(source.replaceAll("\n", "\r\n"), "utf8")) === digest(runner), false);
assert.equal(digest(Buffer.from(source.slice(0, -1), "utf8")) === digest(runner), false);
assert.match(source, /IFS= read -r -s controlled_email <\/dev\/tty/);
assert.match(source, /--email-stdin/);
assert.doesNotMatch(source, /--email\s+["']?\$controlled_email/);
assert.doesNotMatch(source, /export\s+controlled_email/);
assert.doesNotMatch(source.replace("printf '%s\\n' \"$controlled_email\" |", ""), /(?:printf|echo)[^\n]*controlled_email/);
assert.match(source, /stty echo <\/dev\/tty/);
assert.match(createSource, /process\.stdin\.isTTY/);
assert.match(createSource, /email_stdin_required/);
assert.doesNotMatch(createSource, /normalizeEmail\(required\("email"\)\)/);
assert.equal(manifest.contractVersion, "old-mike.operator-runtime-manifest.v3");

console.log("controlled input runner contract: PASS (canonical LF bytes, stdin-only Email, echo recovery, fixed manifest)");
