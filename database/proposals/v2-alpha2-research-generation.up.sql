-- Bytebase-ready proposal only. Target authority: production migrations 0001..0006.
-- This file is intentionally outside database/migrations and must not be applied online in Alpha2.
BEGIN;

CREATE TABLE research_generation_jobs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL,
  project_scope text NOT NULL CHECK (project_scope IN ('PRE_PROJECT', 'TENANT_PROJECT')),
  project_id text,
  created_by_user_id text NOT NULL,
  root_job_id text NOT NULL,
  parent_workspace_id text,
  parent_created_by_user_id text,
  parent_job_id text,
  parent_result_id bigint,
  selected_item_hash char(64) CHECK (selected_item_hash IS NULL OR selected_item_hash ~ '^[0-9a-f]{64}$'),
  operation text NOT NULL CHECK (operation IN ('GENERATE_DIRECTIONS', 'EXPAND_SELECTED_S0', 'FIELD_ASSIST')),
  operation_contract_version text NOT NULL CHECK (operation_contract_version = 'old-mike-v2-alpha2/1.0.0'),
  payload_schema_id text NOT NULL CHECK (payload_schema_id IN ('old-mike-v2-alpha2/generate-directions-input/1', 'old-mike-v2-alpha2/expand-s0-input/1', 'old-mike-v2-alpha2/field-assist-input/1')),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 16 AND 160),
  request_payload jsonb,
  request_byte_count integer NOT NULL CHECK (request_byte_count BETWEEN 2 AND 24576),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RECONCILE_REQUIRED', 'CANCELED')),
  stage text NOT NULL CHECK (stage IN ('QUEUED', 'CLAIMED', 'INTENT_RECORDED', 'SUBMITTING', 'VALIDATING', 'COMMITTED', 'TERMINAL')),
  completion_class text CHECK (completion_class IS NULL OR completion_class IN ('COMPLETE', 'PARTIAL_REVIEW_REQUIRED', 'PROVEN_NOT_SUBMITTED', 'TERMINAL_REJECTED', 'COMPLETION_UNKNOWN')),
  state_version bigint NOT NULL DEFAULT 0 CHECK (state_version >= 0),
  lease_generation bigint NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_owner text,
  lease_token text,
  lease_until timestamptz,
  sanitized_error_code text CHECK (sanitized_error_code IS NULL OR sanitized_error_code IN ('OUTPUT_JSON', 'OUTPUT_SCHEMA', 'DOMAIN_VALIDATE', 'TIMEOUT', 'TRANSPORT', 'COMPLETION_UNKNOWN', 'UNEXPECTED_INTERNAL')),
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload_expires_at timestamptz NOT NULL,
  purged_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT research_generation_jobs_workspace_member_fk FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT research_generation_jobs_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_generation_jobs_root_fk FOREIGN KEY (workspace_id, created_by_user_id, root_job_id)
    REFERENCES research_generation_jobs(workspace_id, created_by_user_id, id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT research_generation_jobs_parent_fk FOREIGN KEY (parent_workspace_id, parent_created_by_user_id, parent_job_id)
    REFERENCES research_generation_jobs(workspace_id, created_by_user_id, id) MATCH FULL ON DELETE RESTRICT,
  CONSTRAINT research_generation_jobs_project_scope CHECK (
    (project_scope = 'PRE_PROJECT' AND project_id IS NULL)
    OR (project_scope = 'TENANT_PROJECT' AND project_id IS NOT NULL)
  ),
  CONSTRAINT research_generation_jobs_lineage CHECK (
    (operation = 'GENERATE_DIRECTIONS' AND root_job_id = id AND parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL)
    OR (operation = 'EXPAND_SELECTED_S0' AND parent_workspace_id = workspace_id AND parent_created_by_user_id = created_by_user_id AND parent_job_id IS NOT NULL AND parent_result_id IS NOT NULL AND selected_item_hash IS NOT NULL)
    OR (operation = 'FIELD_ASSIST' AND (
      (parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL)
      OR (parent_workspace_id = workspace_id AND parent_created_by_user_id = created_by_user_id AND parent_job_id IS NOT NULL AND parent_result_id IS NOT NULL AND selected_item_hash IS NOT NULL)
    ))
  ),
  CONSTRAINT research_generation_jobs_request_payload_retention CHECK (
    (request_payload IS NOT NULL AND purged_at IS NULL AND jsonb_typeof(request_payload) = 'object' AND request_byte_count = octet_length(request_payload::text))
    OR (request_payload IS NULL AND purged_at IS NOT NULL)
  ),
  CONSTRAINT research_generation_jobs_lease_tuple CHECK (
    (lease_owner IS NULL AND lease_token IS NULL AND lease_until IS NULL)
    OR (lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
  ),
  CONSTRAINT research_generation_jobs_workspace_creator_id_unique UNIQUE (workspace_id, created_by_user_id, id),
  CONSTRAINT research_generation_jobs_idempotency_unique UNIQUE (workspace_id, created_by_user_id, request_id)
);

CREATE TABLE research_generation_effects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id text NOT NULL,
  created_by_user_id text NOT NULL,
  job_id text NOT NULL,
  effect_no smallint NOT NULL DEFAULT 1 CHECK (effect_no = 1),
  effect_state text NOT NULL CHECK (effect_state IN ('INTENT_PERSISTED', 'PROVEN_NOT_SUBMITTED', 'SUBMISSION_POSSIBLE', 'ACKNOWLEDGED', 'COMPLETION_UNKNOWN', 'TERMINAL_REJECTED')),
  effect_request_hash char(64) NOT NULL CHECK (effect_request_hash ~ '^[0-9a-f]{64}$'),
  provider_attempt_class text NOT NULL CHECK (provider_attempt_class IN ('NOT_ATTEMPTED', 'SUBMISSION_POSSIBLE', 'RESPONSE_ACKNOWLEDGED', 'UNKNOWN')),
  state_version bigint NOT NULL DEFAULT 0 CHECK (state_version >= 0),
  lease_generation bigint NOT NULL DEFAULT 0 CHECK (lease_generation >= 0),
  lease_owner text,
  lease_token text,
  lease_until timestamptz,
  submission_lease_generation bigint,
  submission_lease_owner text,
  submission_lease_token text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT research_generation_effects_job_fk FOREIGN KEY (workspace_id, created_by_user_id, job_id)
    REFERENCES research_generation_jobs(workspace_id, created_by_user_id, id) ON DELETE CASCADE,
  CONSTRAINT research_generation_effects_one_per_job UNIQUE (job_id),
  CONSTRAINT research_generation_effects_number_unique UNIQUE (job_id, effect_no),
  CONSTRAINT research_generation_effects_workspace_creator_id_unique UNIQUE (workspace_id, created_by_user_id, id),
  CONSTRAINT research_generation_effects_lease_tuple CHECK (
    (lease_owner IS NULL AND lease_token IS NULL AND lease_until IS NULL)
    OR (lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
  ),
  CONSTRAINT research_generation_effects_submission_tuple CHECK (
    (submission_lease_generation IS NULL AND submission_lease_owner IS NULL AND submission_lease_token IS NULL)
    OR (submission_lease_generation IS NOT NULL AND submission_lease_owner IS NOT NULL AND submission_lease_token IS NOT NULL)
  )
);

CREATE TABLE research_generation_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id text NOT NULL,
  created_by_user_id text NOT NULL,
  job_id text NOT NULL,
  result_no smallint NOT NULL DEFAULT 1 CHECK (result_no = 1),
  schema_id text NOT NULL CHECK (schema_id IN ('old-mike-v2-alpha2/directions/1', 'old-mike-v2-alpha2/s0/1', 'old-mike-v2-alpha2/field-assist/1')),
  result_payload jsonb,
  result_byte_count integer NOT NULL CHECK (result_byte_count BETWEEN 2 AND 192000),
  result_hash char(64) NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  selected_item_hash char(64) NOT NULL CHECK (selected_item_hash ~ '^[0-9a-f]{64}$'),
  payload_expires_at timestamptz NOT NULL,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT research_generation_results_job_fk FOREIGN KEY (workspace_id, created_by_user_id, job_id)
    REFERENCES research_generation_jobs(workspace_id, created_by_user_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_generation_results_one_per_job UNIQUE (job_id),
  CONSTRAINT research_generation_results_selected_item_unique UNIQUE (id, selected_item_hash),
  CONSTRAINT research_generation_results_parent_binding_unique UNIQUE (workspace_id, created_by_user_id, job_id, id, selected_item_hash),
  CONSTRAINT research_generation_results_workspace_creator_id_unique UNIQUE (workspace_id, created_by_user_id, id),
  CONSTRAINT research_generation_results_payload_retention CHECK (
    (result_payload IS NOT NULL AND purged_at IS NULL AND jsonb_typeof(result_payload) = 'object' AND result_byte_count = octet_length(result_payload::text))
    OR (result_payload IS NULL AND purged_at IS NOT NULL)
  )
);

ALTER TABLE research_generation_jobs
  ADD CONSTRAINT research_generation_jobs_parent_result_fk
  FOREIGN KEY (parent_workspace_id, parent_created_by_user_id, parent_job_id, parent_result_id, selected_item_hash)
  REFERENCES research_generation_results(workspace_id, created_by_user_id, job_id, id, selected_item_hash) MATCH FULL ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION enforce_research_generation_job_cas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state_version <> OLD.state_version + 1 THEN
    RAISE EXCEPTION 'research_generation_job_state_version_mismatch';
  END IF;
  IF NEW.lease_generation NOT IN (OLD.lease_generation, OLD.lease_generation + 1) THEN
    RAISE EXCEPTION 'research_generation_job_lease_generation_invalid';
  END IF;
  IF NEW.lease_generation = OLD.lease_generation + 1 THEN
    IF OLD.lease_until IS NOT NULL AND OLD.lease_until >= clock_timestamp() THEN
      RAISE EXCEPTION 'research_generation_job_active_lease';
    END IF;
    IF NEW.lease_owner IS NULL OR NEW.lease_token IS NULL OR NEW.lease_until IS NULL THEN
      RAISE EXCEPTION 'research_generation_job_new_lease_incomplete';
    END IF;
  ELSIF (NEW.lease_owner, NEW.lease_token) IS DISTINCT FROM (OLD.lease_owner, OLD.lease_token)
    AND NOT (NEW.lease_owner IS NULL AND NEW.lease_token IS NULL AND NEW.lease_until IS NULL
      AND (OLD.lease_until < clock_timestamp() OR NEW.state IN ('SUCCEEDED','FAILED','RECONCILE_REQUIRED','CANCELED'))) THEN
    RAISE EXCEPTION 'research_generation_job_lease_identity_changed';
  END IF;
  IF (NEW.workspace_id, NEW.created_by_user_id, NEW.request_id, NEW.request_hash, NEW.operation)
     IS DISTINCT FROM (OLD.workspace_id, OLD.created_by_user_id, OLD.request_id, OLD.request_hash, OLD.operation) THEN
    RAISE EXCEPTION 'research_generation_job_authority_immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER research_generation_jobs_cas
  BEFORE UPDATE ON research_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION enforce_research_generation_job_cas();

CREATE OR REPLACE FUNCTION enforce_research_generation_effect_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.effect_state <> 'INTENT_PERSISTED' OR NEW.state_version <> 0 OR NEW.provider_attempt_class <> 'NOT_ATTEMPTED'
     OR NEW.submission_lease_generation IS NOT NULL OR NEW.submission_lease_owner IS NOT NULL OR NEW.submission_lease_token IS NOT NULL THEN
    RAISE EXCEPTION 'research_generation_effect_initial_state_invalid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER research_generation_effects_initial_state
  BEFORE INSERT ON research_generation_effects
  FOR EACH ROW EXECUTE FUNCTION enforce_research_generation_effect_insert();

CREATE OR REPLACE FUNCTION enforce_research_generation_effect_cas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state_version <> OLD.state_version + 1 THEN
    RAISE EXCEPTION 'research_generation_effect_state_version_mismatch';
  END IF;
  IF NEW.lease_generation NOT IN (OLD.lease_generation, OLD.lease_generation + 1) THEN
    RAISE EXCEPTION 'research_generation_effect_lease_generation_invalid';
  END IF;
  IF OLD.effect_state IN ('PROVEN_NOT_SUBMITTED', 'ACKNOWLEDGED', 'COMPLETION_UNKNOWN', 'TERMINAL_REJECTED') THEN
    RAISE EXCEPTION 'research_generation_effect_terminal';
  END IF;
  IF OLD.effect_state = 'INTENT_PERSISTED' AND NEW.effect_state = 'INTENT_PERSISTED' THEN
    IF OLD.lease_until IS NULL OR OLD.lease_until >= clock_timestamp() OR NEW.lease_generation <> OLD.lease_generation + 1 THEN
      RAISE EXCEPTION 'research_generation_effect_reclaim_invalid';
    END IF;
  ELSIF OLD.effect_state = 'INTENT_PERSISTED' AND NEW.effect_state NOT IN ('PROVEN_NOT_SUBMITTED', 'SUBMISSION_POSSIBLE') THEN
    RAISE EXCEPTION 'research_generation_effect_transition_invalid';
  END IF;
  IF OLD.effect_state = 'SUBMISSION_POSSIBLE' AND NEW.effect_state NOT IN ('ACKNOWLEDGED', 'COMPLETION_UNKNOWN', 'TERMINAL_REJECTED') THEN
    RAISE EXCEPTION 'research_generation_effect_transition_invalid';
  END IF;
  IF OLD.effect_state = 'INTENT_PERSISTED' AND NEW.effect_state = 'SUBMISSION_POSSIBLE' THEN
    IF (NEW.submission_lease_generation, NEW.submission_lease_owner, NEW.submission_lease_token)
       IS DISTINCT FROM (OLD.lease_generation, OLD.lease_owner, OLD.lease_token) THEN
      RAISE EXCEPTION 'research_generation_effect_submission_authority_invalid';
    END IF;
  ELSIF OLD.effect_state = 'SUBMISSION_POSSIBLE'
    AND (NEW.submission_lease_generation, NEW.submission_lease_owner, NEW.submission_lease_token)
       IS DISTINCT FROM (OLD.submission_lease_generation, OLD.submission_lease_owner, OLD.submission_lease_token) THEN
    RAISE EXCEPTION 'research_generation_effect_submission_authority_changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER research_generation_effects_cas
  BEFORE UPDATE ON research_generation_effects
  FOR EACH ROW EXECUTE FUNCTION enforce_research_generation_effect_cas();

CREATE OR REPLACE FUNCTION reject_research_generation_result_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.result_payload IS NOT NULL AND NEW.result_payload IS NULL
     AND OLD.purged_at IS NULL AND NEW.purged_at IS NOT NULL
     AND NEW.purged_at >= OLD.payload_expires_at
     AND (to_jsonb(OLD) - 'result_payload' - 'purged_at') = (to_jsonb(NEW) - 'result_payload' - 'purged_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'research_generation_results_are_append_only';
END;
$$;
CREATE TRIGGER research_generation_results_append_only
  BEFORE UPDATE OR DELETE ON research_generation_results
  FOR EACH ROW EXECUTE FUNCTION reject_research_generation_result_mutation();

-- Consumer reference for the repository's exact claim shape. DB time is authoritative.
-- The repository supplies workspace/user scope, owner, token and lease interval.
CREATE OR REPLACE FUNCTION claim_research_generation_job(
  scope_workspace_id text,
  scope_user_id text,
  worker_owner text,
  worker_token text,
  worker_lease interval
) RETURNS SETOF research_generation_jobs LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM research_generation_jobs
    WHERE workspace_id = scope_workspace_id
      AND created_by_user_id = scope_user_id
      AND state = 'QUEUED'
      AND available_at <= clock_timestamp()
      AND lease_owner IS NULL
    ORDER BY created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE research_generation_jobs AS jobs
  SET state = 'RUNNING',
      stage = 'CLAIMED',
      state_version = jobs.state_version + 1,
      lease_generation = jobs.lease_generation + 1,
      lease_owner = worker_owner,
      lease_token = worker_token,
      lease_until = clock_timestamp() + worker_lease,
      updated_at = clock_timestamp()
  FROM candidate
  WHERE jobs.id = candidate.id
  RETURNING jobs.*;
END;
$$;

CREATE OR REPLACE FUNCTION purge_expired_research_generation_payloads(maximum_rows integer)
RETURNS TABLE (jobs_purged integer, results_purged integer) LANGUAGE plpgsql AS $$
DECLARE
  purged_jobs integer := 0;
  purged_results integer := 0;
BEGIN
  IF maximum_rows < 1 OR maximum_rows > 500 THEN
    RAISE EXCEPTION 'research_generation_purge_bound_invalid';
  END IF;
  WITH candidates AS (
    SELECT id FROM research_generation_jobs
    WHERE request_payload IS NOT NULL AND payload_expires_at <= clock_timestamp()
      AND state IN ('SUCCEEDED','FAILED','CANCELED')
      AND completion_class IS DISTINCT FROM 'COMPLETION_UNKNOWN'
    ORDER BY payload_expires_at,id LIMIT maximum_rows FOR UPDATE SKIP LOCKED
  )
  UPDATE research_generation_jobs jobs
  SET request_payload=NULL,purged_at=clock_timestamp(),state_version=jobs.state_version+1,updated_at=clock_timestamp()
  FROM candidates WHERE jobs.id=candidates.id;
  GET DIAGNOSTICS purged_jobs = ROW_COUNT;

  WITH candidates AS (
    SELECT results.id FROM research_generation_results results
    JOIN research_generation_jobs jobs ON jobs.id=results.job_id
    WHERE results.result_payload IS NOT NULL AND results.payload_expires_at <= clock_timestamp()
      AND jobs.state IN ('SUCCEEDED','FAILED','CANCELED')
      AND jobs.completion_class IS DISTINCT FROM 'COMPLETION_UNKNOWN'
    ORDER BY results.payload_expires_at,results.id LIMIT maximum_rows FOR UPDATE OF results SKIP LOCKED
  )
  UPDATE research_generation_results results
  SET result_payload=NULL,purged_at=clock_timestamp()
  FROM candidates WHERE results.id=candidates.id;
  GET DIAGNOSTICS purged_results = ROW_COUNT;
  RETURN QUERY SELECT purged_jobs,purged_results;
END;
$$;

CREATE INDEX research_generation_jobs_claim_idx ON research_generation_jobs(state, available_at, created_at, id) WHERE state = 'QUEUED';
CREATE INDEX research_generation_jobs_reconcile_idx ON research_generation_jobs(state, lease_until) WHERE state IN ('RUNNING', 'RECONCILE_REQUIRED');
CREATE INDEX research_generation_jobs_user_idx ON research_generation_jobs(workspace_id, created_by_user_id, created_at DESC);
CREATE INDEX research_generation_jobs_project_idx ON research_generation_jobs(workspace_id, project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX research_generation_jobs_retention_idx ON research_generation_jobs(payload_expires_at, expires_at) WHERE state IN ('SUCCEEDED','FAILED','CANCELED') AND completion_class IS DISTINCT FROM 'COMPLETION_UNKNOWN';
CREATE INDEX research_generation_results_job_idx ON research_generation_results(workspace_id, created_by_user_id, job_id);
CREATE INDEX research_generation_effects_reconcile_idx ON research_generation_effects(effect_state, lease_until) WHERE effect_state IN ('SUBMISSION_POSSIBLE', 'COMPLETION_UNKNOWN');

REVOKE ALL ON TABLE research_generation_jobs FROM PUBLIC;
REVOKE ALL ON TABLE research_generation_effects FROM PUBLIC;
REVOKE ALL ON TABLE research_generation_results FROM PUBLIC;
REVOKE ALL ON SEQUENCE research_generation_effects_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE research_generation_results_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_research_generation_job_cas() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_research_generation_effect_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_research_generation_effect_cas() FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_research_generation_result_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_research_generation_job(text, text, text, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_expired_research_generation_payloads(integer) FROM PUBLIC;

COMMIT;
