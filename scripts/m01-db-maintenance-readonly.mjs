import { Client } from "pg";
import { runReadonlyAudit, sanitizeEvidence } from "./m01-db-maintenance-contract.mjs";

if (process.argv.length !== 2 || !process.env.DATABASE_URL) {
  process.stdout.write(`${JSON.stringify({ errorCategory: "ENV_INVALID" })}\n`);
  process.exitCode = 2;
} else {
  const evidence = await runReadonlyAudit({
    clientFactory: (configuration) => new Client(configuration),
    databaseUrl: process.env.DATABASE_URL,
  });
  process.stdout.write(`${JSON.stringify(sanitizeEvidence(evidence))}\n`);
  if (evidence.schemaState === "EVIDENCE_INSUFFICIENT") process.exitCode = 2;
}
