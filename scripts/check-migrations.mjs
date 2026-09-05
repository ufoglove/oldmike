// Migration 書目檢查：確保 repo `database/migrations/*.up.sql` 與 DB 的 schema_migrations 同步。
//
// 背景：migration 採手動 psql 套用、無追蹤表 → 可能漏套而不自知。
// 用法：
//   DATABASE_URL=<prod-url> node scripts/check-migrations.mjs              # 唯讀檢查；有 PENDING 或 UNKNOWN 時 exit 1（可作為部署前 gate）
//   DATABASE_URL=<prod-url> node scripts/check-migrations.mjs --record-all # 將 repo 現有 .up.sql 全數記為已套用（backfill；僅在確認當前 DB 已達該版本時使用）
//
// 慣例：每支新 migration 套用後，執行 `--record-all` 即可把新檔記錄下來（冪等）。

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "database", "migrations");

if (!process.env.DATABASE_URL) {
  console.error("MIGRATION_CHECK_FATAL DATABASE_URL required");
  process.exit(2);
}
const recordAll = process.argv.includes("--record-all");

const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".up.sql")).sort();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now(),
       recorded_by text NOT NULL DEFAULT 'check-migrations'
     )`,
  );
  const { rows } = await pool.query("SELECT filename FROM schema_migrations ORDER BY filename");
  const recorded = new Set(rows.map((row) => row.filename));
  const pending = files.filter((name) => !recorded.has(name));
  const unknown = [...recorded].filter((name) => !files.includes(name));

  if (recordAll && pending.length) {
    for (const name of pending) {
      await pool.query("INSERT INTO schema_migrations (filename, recorded_by) VALUES ($1, 'check-migrations --record-all') ON CONFLICT (filename) DO NOTHING", [name]);
      recorded.add(name);
    }
    console.log(`RECORDED ${pending.length} migration(s): ${pending.join(", ")}`);
  }

  const finalPending = files.filter((name) => !recorded.has(name));
  const finalUnknown = [...recorded].filter((name) => !files.includes(name));
  console.log(`MIGRATION_CHECK files=${files.length} recorded=${recorded.size} pending=${finalPending.length} unknown=${finalUnknown.length}`);
  if (finalPending.length) console.log(`PENDING (repo 有、DB 未記錄): ${finalPending.join(", ")}`);
  if (finalUnknown.length) console.log(`UNKNOWN (已記錄、repo 無檔案): ${finalUnknown.join(", ")}`);
  process.exit(finalPending.length || finalUnknown.length ? 1 : 0);
} finally {
  await pool.end();
}
