import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { runMigration, sanitizeEvidence } from "./m01-db-maintenance-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "database", "migrations", "0016_theory_mechanism_lab.up.sql");

if (process.argv.length !== 2 || !process.env.DATABASE_URL) {
  process.stdout.write(`${JSON.stringify({ errorCategory: "ENV_INVALID" })}\n`);
  process.exitCode = 2;
} else {
  const evidence = await runMigration({
    clientFactory: (configuration) => new Client(configuration),
    databaseUrl: process.env.DATABASE_URL,
    direction: "UP",
    migrationBytes: await readFile(migrationPath),
  });
  process.stdout.write(`${JSON.stringify(sanitizeEvidence(evidence))}\n`);
  if (!new Set(["APPLIED_0016", "ALREADY_COMPLETE"]).has(evidence.migrationResult)) process.exitCode = 2;
}
