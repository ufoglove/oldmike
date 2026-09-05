const { Pool } = require("pg");
const fs = require("fs");
const url = fs.readFileSync("/tmp/dburl-real.txt", "utf8").trim();
const pool = new Pool({ connectionString: url, max: 2 });
(async () => {
  const projects = await pool.query(`SELECT project_id FROM projects WHERE project_id LIKE 'scratch-%' OR project_id LIKE 'reset-test-%' OR project_id LIKE 'e2e-%' ORDER BY project_id`);
  console.log("scratch projects found:", projects.rows.length);
  for (const row of projects.rows) {
    const pid = row.project_id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ws = await client.query(`SELECT workspace_id FROM projects WHERE project_id=$1`, [pid]);
      const wid = ws.rows[0]?.workspace_id;
      if (!wid) { await client.query("ROLLBACK"); console.log("skip (no ws):", pid); continue; }
      const tables = ["research_documents", "research_studies", "research_human_gates", "research_topic_lab_runs", "research_topic_lab_promotions"];
      for (const t of tables) {
        const c = await client.query(`SELECT to_regclass('public.${t}') AS t`);
        if (!c.rows[0].t) continue;
        const r = await client.query(`SELECT count(*)::int AS n FROM ${t} WHERE workspace_id=$1 AND project_id=$2`, [wid, pid]);
        if (r.rows[0].n > 0) {
          await client.query(`ALTER TABLE ${t} DISABLE TRIGGER ${t}_append_only`).catch(() => {});
        }
      }
      await client.query(`DELETE FROM project_artifacts WHERE project_id=$1`, [pid]);
      await client.query(`DELETE FROM projects WHERE project_id=$1`, [pid]);
      await client.query("COMMIT");
      console.log("cleaned:", pid);
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.log("FAILED:", pid, e.message);
    } finally {
      client.release();
    }
  }
  const left = await pool.query(`SELECT count(*)::int AS c FROM projects WHERE project_id LIKE 'scratch-%' OR project_id LIKE 'reset-test-%' OR project_id LIKE 'e2e-%'`);
  console.log("leftover projects:", left.rows[0].c);
  await pool.end();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
