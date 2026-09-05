import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const files = {
  up: new URL("../database/proposals/v2-alpha3-domain-chat-literature.up.sql", import.meta.url),
  down: new URL("../database/proposals/v2-alpha3-domain-chat-literature.down.sql", import.meta.url),
  verify: new URL("../database/proposals/v2-alpha3-domain-chat-literature.verify.sql", import.meta.url),
  reconcile: new URL("../database/proposals/v2-alpha3-domain-chat-literature.reconcile.sql", import.meta.url),
  descriptor: new URL("../database/proposals/v2-alpha3-domain-chat-literature.descriptor.json", import.meta.url),
  legacyDomains: new URL("../lib/research-config.ts", import.meta.url),
};
const entries = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")])));
const sha = (value) => createHash("sha256").update(value, "utf8").digest("hex");
let assertions = 0;
const requireText = (source, expected) => { assertions += 1; assert.ok(source.includes(expected), `missing ${expected}`); };

for (const table of ["research_domain_profiles", "research_conversation_events", "research_generation_job_inputs"]) requireText(entries.up, `CREATE TABLE ${table}`);
for (const operation of ["ALPHA3_CHAT_INSIGHTS", "ALPHA3_OPENALEX_QUERY", "ALPHA3_SEMANTIC_SCHOLAR_QUERY", "ALPHA3_LITERATURE_SYNTHESIS"]) requireText(entries.up, `'${operation}'`);
requireText(entries.up, "research_domain_profiles_append_only");
requireText(entries.up, "research_generation_job_inputs_result_fk");
requireText(entries.up, "formal_write_count integer NOT NULL DEFAULT 0 CHECK (formal_write_count = 0)");
requireText(entries.up, "REVOKE ALL ON research_domain_profiles,research_conversation_events,research_generation_job_inputs FROM PUBLIC");
requireText(entries.down, "v2_alpha3_down_refuses_nonempty_tables");
requireText(entries.verify, "to_regclass('public.research_domain_profiles')");
requireText(entries.verify, "research_generation_job_inputs_append_only");
requireText(entries.verify, "research_conversation_events_id_seq");
requireText(entries.verify, "role_usage_grants");
requireText(entries.reconcile, "SUBMISSION_POSSIBLE");
assert.equal(entries.up.includes("0007_topic_lab"), false); assertions += 1;
assert.equal(sha(entries.legacyDomains), "e8ed6e6432d1cd44dbcc7dcd91ae8224a3b7b0bf49d7e9e5d13928d1650810e3"); assertions += 1;
const descriptor = JSON.parse(entries.descriptor);
assert.equal(descriptor.onlineExecution, false); assertions += 1;
assert.deepEqual(descriptor.sha256, { up: sha(entries.up), down: sha(entries.down), verify: sha(entries.verify), reconcile: sha(entries.reconcile) }); assertions += 1;
assert.equal(descriptor.tables.length, 3); assertions += 1;
console.log(`PASS V2_ALPHA3_DDL_CONTRACT assertions=${assertions} ddl_sha256=${sha(entries.up)} legacy_domain_immutable=PASS`);
