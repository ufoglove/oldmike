export const ADMIN_BOOTSTRAP_TRANSACTION_CONTRACT = "old-mike.admin-bootstrap-transaction.v2";

const SCHEMA_SIGNATURE_QUERY = `
WITH required_tables(table_name) AS (
  VALUES
    ('user'), ('account'), ('session'), ('workspaces'), ('workspace_members'),
    ('portal_administrator'), ('account_provisioning_state'), ('account_admin_events')
), required_columns(table_name, column_name) AS (
  VALUES
    ('portal_administrator', 'singleton_key'),
    ('portal_administrator', 'user_id'),
    ('account_provisioning_state', 'user_id'),
    ('account_provisioning_state', 'status'),
    ('account_provisioning_state', 'must_change_password'),
    ('account_provisioning_state', 'temporary_password_expires_at'),
    ('account_provisioning_state', 'password_version'),
    ('account_provisioning_state', 'created_by_admin_id'),
    ('account_admin_events', 'actor_admin_id'),
    ('account_admin_events', 'target_user_key'),
    ('account_admin_events', 'event_kind'),
    ('account_admin_events', 'idempotency_key')
), required_constraints(table_name, constraint_name) AS (
  VALUES
    ('portal_administrator', 'portal_administrator_pkey'),
    ('portal_administrator', 'portal_administrator_user_id_key'),
    ('portal_administrator', 'portal_administrator_singleton'),
    ('portal_administrator', 'portal_administrator_user_id_fkey'),
    ('account_provisioning_state', 'account_provisioning_state_pkey'),
    ('account_provisioning_state', 'account_provisioning_state_status_check'),
    ('account_provisioning_state', 'account_provisioning_state_password_version_check'),
    ('account_provisioning_state', 'account_provisioning_state_temporary_password_check'),
    ('account_provisioning_state', 'account_provisioning_state_required_status_check'),
    ('account_admin_events', 'account_admin_events_pkey'),
    ('account_admin_events', 'account_admin_events_idempotency_key_key'),
    ('account_admin_events', 'account_admin_events_target_key_check'),
    ('account_admin_events', 'account_admin_events_idempotency_key_check'),
    ('account_admin_events', 'account_admin_events_kind_check')
)
SELECT
  NOT EXISTS (
    SELECT 1 FROM required_tables required
    WHERE to_regclass('public.' || quote_ident(required.table_name)) IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM required_columns required
    LEFT JOIN information_schema.columns actual
      ON actual.table_schema = 'public'
     AND actual.table_name = required.table_name
     AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM required_constraints required
    LEFT JOIN information_schema.table_constraints actual
      ON actual.constraint_schema = 'public'
     AND actual.table_name = required.table_name
     AND actual.constraint_name = required.constraint_name
    WHERE actual.constraint_name IS NULL
  )
  AND EXISTS (
    SELECT 1
    FROM pg_trigger trigger_record
    JOIN pg_class relation ON relation.oid = trigger_record.tgrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'account_admin_events'
      AND trigger_record.tgname = 'account_admin_events_are_append_only'
      AND NOT trigger_record.tgisinternal
  ) AS schema_valid
`;

const CARDINALITY_QUERY = `
SELECT
  (SELECT count(*)::int FROM portal_administrator) AS administrator_count,
  (SELECT count(*)::int FROM "user") AS user_count,
  (SELECT count(*)::int FROM account) AS account_count,
  (SELECT count(*)::int FROM "session") AS session_count,
  (SELECT count(*)::int FROM workspaces) AS workspace_count,
  (SELECT count(*)::int FROM workspace_members) AS membership_count
`;

function contractError(category) {
  return new Error(category);
}

function exactlyOneRow(result, category) {
  if (result?.rowCount !== 1) throw contractError(category);
  return result.rows[0];
}

async function insertExactlyOne(client, text, values) {
  const result = await client.query(text, values);
  exactlyOneRow(result, "BOOTSTRAP_AFFECTED_ROW_MISMATCH");
}

export async function executeAdminBootstrapTransaction({
  client,
  input,
  passwordHash,
  userId,
  accountId,
  workspaceId,
  now,
  expiresAt,
  targetKey,
  eventKey,
}) {
  let transactionOpen = false;
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["old-mike.portal-administrator.v1"]);

    const schema = exactlyOneRow(await client.query(SCHEMA_SIGNATURE_QUERY), "BOOTSTRAP_SCHEMA_INVALID");
    if (schema.schema_valid !== true) throw contractError("BOOTSTRAP_SCHEMA_INVALID");

    const cardinality = exactlyOneRow(await client.query(CARDINALITY_QUERY), "BOOTSTRAP_PRECONDITION_NOT_EMPTY");
    if (Number(cardinality.administrator_count) !== 0) throw contractError("PORTAL_ADMINISTRATOR_ALREADY_EXISTS");
    if ([
      cardinality.user_count,
      cardinality.account_count,
      cardinality.session_count,
      cardinality.workspace_count,
      cardinality.membership_count,
    ].some((value) => Number(value) !== 0)) {
      throw contractError("BOOTSTRAP_PRECONDITION_NOT_EMPTY");
    }

    await insertExactlyOne(
      client,
      `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, false, $4, $4)
       RETURNING id`,
      [userId, input.name, input.email, now],
    );
    await insertExactlyOne(
      client,
      `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $3, $4, $5, $5)
       RETURNING id`,
      [accountId, userId, userId, passwordHash, now],
    );
    await insertExactlyOne(
      client,
      `INSERT INTO workspaces (id, name, owner_user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [workspaceId, `${input.name} Personal Workspace`, userId],
    );
    await insertExactlyOne(
      client,
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, 'owner')
       RETURNING workspace_id`,
      [workspaceId, userId],
    );
    await insertExactlyOne(
      client,
      `INSERT INTO portal_administrator (singleton_key, user_id)
       VALUES (1, $1)
       RETURNING singleton_key`,
      [userId],
    );
    await insertExactlyOne(
      client,
      `INSERT INTO account_provisioning_state
         (user_id, status, must_change_password, temporary_password_expires_at,
          password_version, created_by_admin_id, created_at, updated_at)
       VALUES ($1, 'PASSWORD_CHANGE_REQUIRED', true, $2, 1, $1, $3, $3)
       RETURNING user_id`,
      [userId, expiresAt, now],
    );
    await insertExactlyOne(
      client,
      `INSERT INTO account_admin_events
         (actor_admin_id, target_user_key, event_kind, idempotency_key)
       VALUES ($1, $2, 'ADMIN_BOOTSTRAPPED', $3)
       RETURNING id`,
      [userId, targetKey, eventKey],
    );

    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
