import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const sql = readFileSync(new URL("../database/migrations/0020_ethics_compliance_package.up.sql", import.meta.url), "utf8");
const b64 = Buffer.from(sql).toString("base64");
console.log("MIGRATION_0020_SHA256=" + createHash("sha256").update(sql).digest("hex"));
console.log("MIGRATION_0020_BASE64_LEN=" + b64.length);
console.log(b64);
