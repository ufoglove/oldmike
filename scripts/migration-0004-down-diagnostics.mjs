export const migration0004DownGuardIdentifier =
  "MIGRATION_0004_DOWN_BLOCKED_REGISTRATION_INVITES_NOT_EMPTY";

export function classifyMigration0004DownFailure(status, capturedOutput = "") {
  if (status === 0) return "NONE";
  return String(capturedOutput).includes(migration0004DownGuardIdentifier)
    ? "DATA_LOSS_GUARD"
    : "DATABASE_MIGRATION";
}
