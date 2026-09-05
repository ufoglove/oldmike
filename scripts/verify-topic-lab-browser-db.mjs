import assert from "node:assert/strict";
import { Pool } from "pg";

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl || process.env.INTEGRATION_DATABASE_DISPOSABLE !== "1" || process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1") process.exit(2);
const parsed = new URL(databaseUrl);
assert.ok(["127.0.0.1", "localhost", "::1"].includes(parsed.hostname));
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM research_topic_lab_runs WHERE project_id='topic-lab-browser-project') AS runs,
      (SELECT count(*)::int FROM research_human_gates WHERE project_id='topic-lab-browser-project' AND gate_type='RESEARCH_DIRECTION') AS gates,
      (SELECT count(*)::int FROM research_topic_lab_promotions WHERE project_id='topic-lab-browser-project') AS promotions,
      (SELECT count(*)::int FROM research_studies WHERE project_id='topic-lab-browser-project' AND stage_detail='S1_DESIGN_DRAFT') AS drafts
  `);
  assert.deepEqual(result.rows[0], { runs: 1, gates: 1, promotions: 1, drafts: 1 });
  console.log("TOPIC_LAB_BROWSER_DATABASE_POSTCHECK=PASS");
} finally {
  await pool.end();
}
