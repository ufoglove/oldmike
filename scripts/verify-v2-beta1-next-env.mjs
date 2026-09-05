import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const forms = {
  production: {
    content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\nimport "./.next/types/routes.d.ts";\nimport "./.next/types/root-params.d.ts";\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n',
    bytes: 288,
    sha256: "1862ac4bbbc5192d4bf562161df66ea547ed3e67173100656ab606ae9797db2b",
  },
  development: {
    content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\nimport "./.next/dev/types/routes.d.ts";\nimport "./.next/dev/types/root-params.d.ts";\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n',
    bytes: 296,
    sha256: "0f70629890b72a0a82e91972cc032c04b658b26c265373cb711cf576bfbf8fcc",
  },
};

const requested = process.argv.find((item) => item.startsWith("--expected="))?.slice("--expected=".length) ?? null;
if (requested !== null && !Object.hasOwn(forms, requested)) throw new Error("beta1_next_env_expected_mode_invalid");
const raw = await readFile(new URL("../next-env.d.ts", import.meta.url), "utf8");
const content = raw.replace(/\r\n?/gu, "\n");
const match = Object.entries(forms).find(([, value]) => value.content === content);
assert.ok(match, "beta1_next_env_unknown_third_form");
const [mode, expected] = match;
const bytes = Buffer.byteLength(content, "utf8");
const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
assert.deepEqual({ bytes, sha256 }, { bytes: expected.bytes, sha256: expected.sha256 });
if (requested !== null) assert.equal(mode, requested, "beta1_next_env_mode_mismatch");
console.log(JSON.stringify({ status: "PASS", nextVersion: "16.3.1", mode, lineEndings: "LF_NORMALIZED", bytes, sha256, unknownThirdForm: "FAIL_CLOSED" }));
