-- Beta2 A1 durable-core proposal. Additive and disposable-PostgreSQL tested only.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.projects') IS NULL
     OR to_regclass('public.workspace_members') IS NULL
     OR to_regclass('public."user"') IS NULL THEN
    RAISE EXCEPTION 'beta2_required_baseline_missing';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'old_mike_beta2_owner') THEN
    CREATE ROLE old_mike_beta2_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'old_mike_beta2_app') THEN
    CREATE ROLE old_mike_beta2_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END;
$$;

CREATE SCHEMA old_mike_beta2_private AUTHORIZATION old_mike_beta2_owner;
REVOKE ALL ON SCHEMA old_mike_beta2_private FROM PUBLIC;

CREATE TABLE beta2_generation_jobs (
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  job_id text NOT NULL,
  created_by_user_id text NOT NULL,
  contract_version text NOT NULL CHECK (contract_version = 'old-mike-v2-beta2/2.0.0-alpha.11'),
  stage_id text NOT NULL CHECK (stage_id = 'DURABLE_CORE_GENERATION'),
  stage_instance_hash text NOT NULL CHECK (stage_instance_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 16 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  source_revision bigint NOT NULL CHECK (source_revision >= 0),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  request_payload jsonb NOT NULL CHECK (jsonb_typeof(request_payload) = 'object'),
  state text NOT NULL CHECK (state IN ('INTENT_RECORDED','SUBMITTING','SUCCEEDED','FAILED','RECONCILE_REQUIRED')),
  completion_class text NOT NULL CHECK (completion_class IN ('PENDING','COMPLETE','COMPLETION_UNKNOWN','TERMINAL_REJECTED')),
  provider_submission_count smallint NOT NULL DEFAULT 0 CHECK (provider_submission_count BETWEEN 0 AND 1),
  provider_receipt_commitment text CHECK (provider_receipt_commitment IS NULL OR provider_receipt_commitment ~ '^[0-9a-f]{64}$'),
  provider_result_hash text CHECK (provider_result_hash IS NULL OR provider_result_hash ~ '^[0-9a-f]{64}$'),
  sanitized_reason_code text CHECK (sanitized_reason_code IS NULL OR sanitized_reason_code ~ '^[A-Z0-9_]{3,80}$'),
  state_version bigint NOT NULL DEFAULT 1 CHECK (state_version >= 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  submit_started_at timestamptz,
  terminal_at timestamptz,
  PRIMARY KEY (workspace_id, project_id, job_id),
  CONSTRAINT beta2_generation_jobs_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_generation_jobs_actor_fk FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_members (workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_generation_jobs_stage_instance_unique UNIQUE (workspace_id, project_id, stage_id, stage_instance_hash),
  CONSTRAINT beta2_generation_jobs_idempotency_unique UNIQUE (workspace_id, project_id, stage_id, idempotency_key),
  CONSTRAINT beta2_generation_jobs_request_unique UNIQUE (workspace_id, project_id, stage_id, request_id),
  CONSTRAINT beta2_generation_jobs_state_shape CHECK (
    (state = 'INTENT_RECORDED' AND completion_class = 'PENDING' AND provider_submission_count = 0 AND provider_receipt_commitment IS NULL AND provider_result_hash IS NULL AND submit_started_at IS NULL AND terminal_at IS NULL)
    OR (state = 'SUBMITTING' AND completion_class = 'PENDING' AND provider_submission_count = 1 AND provider_receipt_commitment IS NOT NULL AND provider_result_hash IS NULL AND submit_started_at IS NOT NULL AND terminal_at IS NULL)
    OR (state = 'SUCCEEDED' AND completion_class = 'COMPLETE' AND provider_submission_count = 1 AND provider_receipt_commitment IS NOT NULL AND provider_result_hash IS NOT NULL AND terminal_at IS NOT NULL)
    OR (state = 'RECONCILE_REQUIRED' AND completion_class = 'COMPLETION_UNKNOWN' AND provider_submission_count = 1 AND provider_receipt_commitment IS NOT NULL AND provider_result_hash IS NULL AND terminal_at IS NOT NULL)
    OR (state = 'FAILED' AND completion_class = 'TERMINAL_REJECTED' AND provider_submission_count BETWEEN 0 AND 1 AND provider_result_hash IS NULL AND terminal_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX beta2_generation_jobs_job_id_unique ON beta2_generation_jobs(job_id);
CREATE INDEX beta2_generation_jobs_reconciliation_idx
  ON beta2_generation_jobs(workspace_id, project_id, updated_at)
  WHERE state IN ('SUBMITTING','RECONCILE_REQUIRED');

CREATE TABLE beta2_generation_receipts (
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  job_id text NOT NULL,
  receipt_no integer NOT NULL CHECK (receipt_no > 0),
  job_state_version bigint NOT NULL CHECK (job_state_version > 0),
  transition_xid bigint NOT NULL,
  receipt_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('INTENT_PERSISTED','SUBMISSION_STARTED','COMPLETION_OBSERVED','COMPLETION_UNKNOWN','RECONCILIATION_OBSERVED','TERMINAL_REJECTED')),
  completion_class text NOT NULL CHECK (completion_class IN ('PENDING','COMPLETE','COMPLETION_UNKNOWN','TERMINAL_REJECTED')),
  submission_count smallint NOT NULL CHECK (submission_count BETWEEN 0 AND 1),
  provider_reference_commitment text CHECK (provider_reference_commitment IS NULL OR provider_reference_commitment ~ '^[0-9a-f]{64}$'),
  result_hash text CHECK (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$'),
  predecessor_receipt_hash text CHECK (predecessor_receipt_hash IS NULL OR predecessor_receipt_hash ~ '^[0-9a-f]{64}$'),
  receipt_hash text NOT NULL CHECK (receipt_hash ~ '^[0-9a-f]{64}$'),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, project_id, job_id, receipt_no),
  CONSTRAINT beta2_generation_receipts_job_fk FOREIGN KEY (workspace_id, project_id, job_id)
    REFERENCES beta2_generation_jobs (workspace_id, project_id, job_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_generation_receipts_id_unique UNIQUE (workspace_id, project_id, receipt_id),
  CONSTRAINT beta2_generation_receipts_state_version_unique UNIQUE (workspace_id, project_id, job_id, job_state_version),
  CONSTRAINT beta2_generation_receipts_transition_xid_unique UNIQUE (workspace_id, project_id, job_id, transition_xid)
);

CREATE UNIQUE INDEX beta2_generation_receipts_submission_once
  ON beta2_generation_receipts(workspace_id, project_id, job_id)
  WHERE kind = 'SUBMISSION_STARTED';

CREATE TABLE beta2_project_snapshots (
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  contract_version text NOT NULL CHECK (contract_version = 'old-mike-v2-beta2/2.0.0-alpha.11'),
  schema_id text NOT NULL CHECK (schema_id = 'old-mike-v2-beta2/durable-snapshot/1'),
  snapshot_payload jsonb NOT NULL CHECK (jsonb_typeof(snapshot_payload) = 'object'),
  source_job_id text,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, project_id, revision),
  CONSTRAINT beta2_project_snapshots_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_project_snapshots_actor_fk FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_members (workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_project_snapshots_job_fk FOREIGN KEY (workspace_id, project_id, source_job_id)
    REFERENCES beta2_generation_jobs (workspace_id, project_id, job_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX beta2_project_snapshots_hash_unique
  ON beta2_project_snapshots(workspace_id, project_id, content_hash);

CREATE TABLE beta2_project_events (
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  event_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('GENERATION_COMPLETE','GENERATION_UNKNOWN','GENERATION_TERMINAL_FAILURE','RECONCILIATION_COMPLETE','RECONCILIATION_TERMINAL_FAILURE','DIRECTION_SELECTION_SAVED','CONFIRMED_WORKSPACE_SAVED')),
  operation text NOT NULL CHECK (operation IN ('GENERATE_DURABLE_CORE','SAVE_DIRECTION_SELECTION','SAVE_CONFIRMED_WORKSPACE','RECONCILE_UNKNOWN')),
  idempotency_key text,
  job_id text,
  request_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  from_revision bigint NOT NULL CHECK (from_revision >= 0),
  to_revision bigint NOT NULL CHECK (to_revision >= from_revision),
  snapshot_revision bigint,
  predecessor_event_hash text CHECK (predecessor_event_hash IS NULL OR predecessor_event_hash ~ '^[0-9a-f]{64}$'),
  event_hash text NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, project_id, sequence),
  CONSTRAINT beta2_project_events_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_project_events_actor_fk FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_members (workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_project_events_job_fk FOREIGN KEY (workspace_id, project_id, job_id)
    REFERENCES beta2_generation_jobs (workspace_id, project_id, job_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_project_events_snapshot_fk FOREIGN KEY (workspace_id, project_id, snapshot_revision)
    REFERENCES beta2_project_snapshots (workspace_id, project_id, revision) ON DELETE RESTRICT,
  CONSTRAINT beta2_project_events_id_unique UNIQUE (workspace_id, project_id, event_id),
  CONSTRAINT beta2_project_events_transition_shape CHECK (
    (event_type = 'GENERATION_COMPLETE' AND operation = 'GENERATE_DURABLE_CORE' AND idempotency_key IS NOT NULL AND job_id IS NOT NULL AND to_revision = from_revision + 1 AND snapshot_revision = to_revision)
    OR (event_type = 'RECONCILIATION_COMPLETE' AND operation = 'RECONCILE_UNKNOWN' AND idempotency_key IS NULL AND job_id IS NOT NULL AND to_revision = from_revision + 1 AND snapshot_revision = to_revision)
    OR (event_type = 'DIRECTION_SELECTION_SAVED' AND operation = 'SAVE_DIRECTION_SELECTION' AND idempotency_key IS NOT NULL AND job_id IS NULL AND to_revision = from_revision + 1 AND snapshot_revision = to_revision)
    OR (event_type = 'CONFIRMED_WORKSPACE_SAVED' AND operation = 'SAVE_CONFIRMED_WORKSPACE' AND idempotency_key IS NOT NULL AND job_id IS NULL AND to_revision = from_revision + 1 AND snapshot_revision = to_revision)
    OR (event_type IN ('GENERATION_UNKNOWN','GENERATION_TERMINAL_FAILURE') AND operation = 'GENERATE_DURABLE_CORE' AND idempotency_key IS NOT NULL AND job_id IS NOT NULL AND to_revision = from_revision AND snapshot_revision IS NULL)
    OR (event_type = 'RECONCILIATION_TERMINAL_FAILURE' AND operation = 'RECONCILE_UNKNOWN' AND idempotency_key IS NULL AND job_id IS NOT NULL AND to_revision = from_revision AND snapshot_revision IS NULL)
  )
);

CREATE UNIQUE INDEX beta2_project_events_hash_unique
  ON beta2_project_events(workspace_id, project_id, event_hash);
CREATE UNIQUE INDEX beta2_project_events_snapshot_unique
  ON beta2_project_events(workspace_id, project_id, snapshot_revision)
  WHERE snapshot_revision IS NOT NULL;
CREATE UNIQUE INDEX beta2_project_events_operation_idempotency_unique
  ON beta2_project_events(workspace_id, project_id, operation, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX beta2_project_events_operation_request_unique
  ON beta2_project_events(workspace_id, project_id, operation, request_id);

CREATE TABLE beta2_operation_intents (
  workspace_id text NOT NULL,
  project_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('GENERATE_DURABLE_CORE','SAVE_DIRECTION_SELECTION','SAVE_CONFIRMED_WORKSPACE')),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 128),
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 16 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('PENDING','COMMITTED')),
  committed_revision bigint,
  committed_content_hash text CHECK (committed_content_hash IS NULL OR committed_content_hash ~ '^[0-9a-f]{64}$'),
  committed_event_hash text CHECK (committed_event_hash IS NULL OR committed_event_hash ~ '^[0-9a-f]{64}$'),
  committed_response_authority jsonb,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  committed_at timestamptz,
  PRIMARY KEY (workspace_id, project_id, operation, request_id),
  CONSTRAINT beta2_operation_intents_project_fk FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects (workspace_id, project_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_operation_intents_actor_fk FOREIGN KEY (workspace_id, created_by_user_id)
    REFERENCES workspace_members (workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT beta2_operation_intents_idempotency_global UNIQUE (workspace_id, project_id, idempotency_key),
  CONSTRAINT beta2_operation_intents_request_global UNIQUE (workspace_id, project_id, request_id),
  CONSTRAINT beta2_operation_intents_snapshot_fk FOREIGN KEY (workspace_id, project_id, committed_revision)
    REFERENCES beta2_project_snapshots (workspace_id, project_id, revision) ON DELETE RESTRICT,
  CONSTRAINT beta2_operation_intents_event_fk FOREIGN KEY (workspace_id, project_id, committed_event_hash)
    REFERENCES beta2_project_events (workspace_id, project_id, event_hash) ON DELETE RESTRICT,
  CONSTRAINT beta2_operation_intents_state_shape CHECK (
    (status='PENDING' AND committed_revision IS NULL AND committed_content_hash IS NULL AND committed_event_hash IS NULL AND committed_response_authority IS NULL AND committed_at IS NULL)
    OR (status='COMMITTED' AND committed_revision IS NOT NULL AND committed_revision>0 AND committed_content_hash IS NOT NULL AND committed_event_hash IS NOT NULL AND jsonb_typeof(committed_response_authority)='object' AND committed_at IS NOT NULL)
  )
);

GRANT SELECT ON public.projects, public.workspace_members TO old_mike_beta2_owner;
GRANT SELECT, INSERT, UPDATE ON public.beta2_generation_jobs TO old_mike_beta2_owner;
GRANT SELECT, INSERT ON public.beta2_generation_receipts, public.beta2_project_snapshots, public.beta2_project_events TO old_mike_beta2_owner;
GRANT SELECT, INSERT, UPDATE ON public.beta2_operation_intents TO old_mike_beta2_owner;

SET LOCAL ROLE old_mike_beta2_owner;

CREATE FUNCTION old_mike_beta2_private.beta2_receipt_hash(
  p_workspace_id text, p_project_id text, p_job_id text, p_receipt_no integer, p_job_state_version bigint,
  p_kind text, p_completion_class text, p_submission_count smallint,
  p_provider_reference_commitment text, p_result_hash text, p_predecessor_receipt_hash text
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    '{"completionClass":' || COALESCE(pg_catalog.to_json(p_completion_class)::text,'null') ||
    ',"jobId":' || COALESCE(pg_catalog.to_json(p_job_id)::text,'null') ||
    ',"jobStateVersion":' || p_job_state_version::text ||
    ',"kind":' || COALESCE(pg_catalog.to_json(p_kind)::text,'null') ||
    ',"predecessorReceiptHash":' || COALESCE(pg_catalog.to_json(p_predecessor_receipt_hash)::text,'null') ||
    ',"projectId":' || COALESCE(pg_catalog.to_json(p_project_id)::text,'null') ||
    ',"providerReferenceCommitment":' || COALESCE(pg_catalog.to_json(p_provider_reference_commitment)::text,'null') ||
    ',"receiptNo":' || p_receipt_no::text ||
    ',"resultHash":' || COALESCE(pg_catalog.to_json(p_result_hash)::text,'null') ||
    ',"submissionCount":' || p_submission_count::text ||
    ',"workspaceId":' || COALESCE(pg_catalog.to_json(p_workspace_id)::text,'null') || '}', 'UTF8')), 'hex');
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_event_hash(
  p_workspace_id text, p_project_id text, p_sequence bigint, p_event_type text, p_operation text,
  p_idempotency_key text, p_job_id text, p_request_id text, p_request_hash text,
  p_from_revision bigint, p_to_revision bigint, p_snapshot_revision bigint, p_predecessor_event_hash text
) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    '{"eventType":' || COALESCE(pg_catalog.to_json(p_event_type)::text,'null') ||
    ',"fromRevision":' || p_from_revision::text ||
    ',"idempotencyKey":' || COALESCE(pg_catalog.to_json(p_idempotency_key)::text,'null') ||
    ',"jobId":' || COALESCE(pg_catalog.to_json(p_job_id)::text,'null') ||
    ',"operation":' || COALESCE(pg_catalog.to_json(p_operation)::text,'null') ||
    ',"predecessorEventHash":' || COALESCE(pg_catalog.to_json(p_predecessor_event_hash)::text,'null') ||
    ',"projectId":' || COALESCE(pg_catalog.to_json(p_project_id)::text,'null') ||
    ',"requestHash":' || COALESCE(pg_catalog.to_json(p_request_hash)::text,'null') ||
    ',"requestId":' || COALESCE(pg_catalog.to_json(p_request_id)::text,'null') ||
    ',"sequence":' || p_sequence::text ||
    ',"snapshotRevision":' || COALESCE(p_snapshot_revision::text,'null') ||
    ',"toRevision":' || p_to_revision::text ||
    ',"workspaceId":' || COALESCE(pg_catalog.to_json(p_workspace_id)::text,'null') || '}', 'UTF8')), 'hex');
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_reconciliation_request_hash(p_job_id text, p_request_id text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    '{"jobId":' || pg_catalog.to_json(p_job_id)::text ||
    ',"operation":"RECONCILE_UNKNOWN","requestId":' || pg_catalog.to_json(p_request_id)::text || '}', 'UTF8')), 'hex');
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_canonical_jsonb(p_value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE result text;
BEGIN
  CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{' || COALESCE(pg_catalog.string_agg(pg_catalog.to_json(item.key)::text || ':' || old_mike_beta2_private.beta2_canonical_jsonb(item.value), ',' ORDER BY item.key COLLATE "C"),'') || '}'
        INTO result FROM pg_catalog.jsonb_each(p_value) AS item(key,value);
    WHEN 'array' THEN
      SELECT '[' || COALESCE(pg_catalog.string_agg(old_mike_beta2_private.beta2_canonical_jsonb(item.value), ',' ORDER BY item.ordinality),'') || ']'
        INTO result FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY AS item(value,ordinality);
    WHEN 'string' THEN result := pg_catalog.to_json(p_value #>> '{}')::text;
    ELSE result := p_value::text;
  END CASE;
  RETURN result;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_jsonb_hash(p_value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(old_mike_beta2_private.beta2_canonical_jsonb(p_value),'UTF8')),'hex');
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_material_is_blank(p_value text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT p_value IS NULL OR pg_catalog.regexp_replace(pg_catalog.encode(pg_catalog.textsend(p_value),'hex'),
    '(09|0a|0b|0c|0d|20|c2a0|e19a80|e2808[0-9a]|e280a[89f]|e2819f|e38080|efbbbf)+','','g')='';
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_render_human_artifact(p_direction jsonb, p_s0 jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE
  markdown text;
  field_name text;
  option jsonb;
  renderer_version constant text := 'old-mike-v2-beta2/human-readable/1';
  field_names constant text[] := ARRAY['workingTitle','domain','outputTrack','problemContext','targetUsers','expectedContribution','existingData','availableData','methodIdea','timeline','constraints','ethicsPrivacyRisks','unresolvedItems'];
BEGIN
  markdown := '# ' || (p_direction->>'title') || E'\n\n研究問題：' || (p_direction->>'researchQuestion')
    || E'\n作用機制：' || (p_direction->>'mechanism') || E'\n方法：' || (p_direction->>'method')
    || E'\n預期貢獻：' || (p_direction->>'contribution') || E'\n\n## 完整 13 欄 S0\n';
  FOREACH field_name IN ARRAY field_names LOOP
    markdown := markdown || '### ' || field_name || E'\n' || (p_s0->>field_name) || E'\n\n';
  END LOOP;
  markdown := markdown || E'## Field Assist\n';
  FOREACH field_name IN ARRAY field_names LOOP
    markdown := markdown || '### ' || field_name || E'\n';
    FOR option IN SELECT value FROM pg_catalog.jsonb_array_elements(p_direction->'fieldAssist'->field_name) LOOP
      markdown := markdown || '- ' || (option->>'text') || E'\n  - 理由：' || (option->>'rationale') || E'\n  - 風險：' || (option->>'risk') || E'\n';
    END LOOP;
    markdown := markdown || E'\n';
  END LOOP;
  markdown := pg_catalog.regexp_replace(markdown,E'\n{3,}',E'\n\n','g');
  markdown := pg_catalog.rtrim(markdown,E' \t\r\n') || E'\n';
  RETURN pg_catalog.jsonb_build_object('rendererVersion',renderer_version,'markdown',markdown,'artifactHash',
    old_mike_beta2_private.beta2_jsonb_hash(pg_catalog.jsonb_build_object('rendererVersion',renderer_version,'markdown',markdown)));
END;
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_register_operation_intent(
  p_workspace_id text, p_project_id text, p_created_by_user_id text, p_operation text,
  p_idempotency_key text, p_request_id text, p_request_hash text
) RETURNS TABLE(out_existing boolean, out_status text, out_committed_revision bigint, out_committed_content_hash text)
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE intent public.beta2_operation_intents%ROWTYPE; match_count integer;
BEGIN
  SELECT pg_catalog.count(*) INTO match_count FROM public.beta2_operation_intents
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id
     AND (idempotency_key=p_idempotency_key OR request_id=p_request_id);
  IF match_count>1 THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
  SELECT * INTO intent FROM public.beta2_operation_intents
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id
     AND (idempotency_key=p_idempotency_key OR request_id=p_request_id) FOR UPDATE;
  IF FOUND THEN
    IF intent.operation<>p_operation OR intent.idempotency_key<>p_idempotency_key OR intent.request_id<>p_request_id
       OR intent.request_hash<>p_request_hash OR intent.created_by_user_id<>p_created_by_user_id THEN
      RAISE EXCEPTION 'beta2_idempotency_conflict';
    END IF;
    out_existing:=true; out_status:=intent.status; out_committed_revision:=intent.committed_revision;
    out_committed_content_hash:=intent.committed_content_hash; RETURN NEXT; RETURN;
  END IF;
  INSERT INTO public.beta2_operation_intents
    (workspace_id,project_id,operation,idempotency_key,request_id,request_hash,status,created_by_user_id)
  VALUES (p_workspace_id,p_project_id,p_operation,p_idempotency_key,p_request_id,p_request_hash,'PENDING',p_created_by_user_id);
  out_existing:=false; out_status:='PENDING'; out_committed_revision:=NULL; out_committed_content_hash:=NULL; RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_commit_operation_intent(
  p_workspace_id text, p_project_id text, p_operation text, p_idempotency_key text, p_request_id text,
  p_request_hash text, p_committed_revision bigint, p_committed_content_hash text, p_committed_event_hash text
) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE intent public.beta2_operation_intents%ROWTYPE; expected_response jsonb;
BEGIN
  SELECT * INTO STRICT intent FROM public.beta2_operation_intents
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND idempotency_key=p_idempotency_key AND request_id=p_request_id FOR UPDATE;
  IF intent.operation<>p_operation OR intent.request_hash<>p_request_hash THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
  expected_response:=pg_catalog.jsonb_build_object('operation',p_operation,'revision',p_committed_revision,'contentHash',p_committed_content_hash,'eventHash',p_committed_event_hash);
  IF intent.status='COMMITTED' THEN
    IF intent.committed_revision<>p_committed_revision OR intent.committed_content_hash<>p_committed_content_hash
       OR intent.committed_event_hash<>p_committed_event_hash OR intent.committed_response_authority<>expected_response THEN
      RAISE EXCEPTION 'beta2_operation_intent_commit_conflict';
    END IF;
    RETURN;
  END IF;
  UPDATE public.beta2_operation_intents SET status='COMMITTED',committed_revision=p_committed_revision,
    committed_content_hash=p_committed_content_hash,committed_event_hash=p_committed_event_hash,
    committed_response_authority=expected_response,committed_at=pg_catalog.clock_timestamp()
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND operation=p_operation AND request_id=p_request_id;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_write_receipt(p_workspace_id text, p_project_id text, p_job_id text, p_kind text) RETURNS text
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  job public.beta2_generation_jobs%ROWTYPE;
  prior_no integer;
  prior_hash text;
  current_hash text;
BEGIN
  SELECT * INTO STRICT job FROM public.beta2_generation_jobs
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id FOR UPDATE;
  SELECT receipt_no, receipt_hash INTO prior_no, prior_hash FROM public.beta2_generation_receipts
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id ORDER BY receipt_no DESC LIMIT 1;
  IF prior_no IS NULL THEN
    IF job.state_version <> 1 THEN RAISE EXCEPTION 'beta2_receipt_state_version_gap'; END IF;
  ELSIF prior_no <> job.state_version - 1 THEN
    RAISE EXCEPTION 'beta2_receipt_state_version_gap';
  END IF;
  current_hash := old_mike_beta2_private.beta2_receipt_hash(
    p_workspace_id,p_project_id,p_job_id,job.state_version::integer,job.state_version,p_kind,job.completion_class,
    job.provider_submission_count,job.provider_receipt_commitment,job.provider_result_hash,prior_hash);
  INSERT INTO public.beta2_generation_receipts
    (workspace_id,project_id,job_id,receipt_no,job_state_version,transition_xid,receipt_id,kind,completion_class,submission_count,provider_reference_commitment,result_hash,predecessor_receipt_hash,receipt_hash)
  VALUES
    (p_workspace_id,p_project_id,p_job_id,job.state_version::integer,job.state_version,pg_catalog.txid_current(),
     'beta2-receipt-' || pg_catalog.substr(current_hash,1,32),p_kind,job.completion_class,
     job.provider_submission_count,job.provider_receipt_commitment,job.provider_result_hash,prior_hash,current_hash);
  RETURN current_hash;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.beta2_write_event(
  p_workspace_id text, p_project_id text, p_event_type text, p_operation text, p_idempotency_key text,
  p_job_id text, p_request_id text, p_request_hash text, p_from_revision bigint, p_to_revision bigint,
  p_snapshot_revision bigint, p_created_by_user_id text
) RETURNS text
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  prior_sequence bigint;
  prior_hash text;
  current_sequence bigint;
  current_hash text;
BEGIN
  SELECT sequence,event_hash INTO prior_sequence,prior_hash FROM public.beta2_project_events
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id ORDER BY sequence DESC LIMIT 1;
  current_sequence := COALESCE(prior_sequence,0)+1;
  current_hash := old_mike_beta2_private.beta2_event_hash(
    p_workspace_id,p_project_id,current_sequence,p_event_type,p_operation,p_idempotency_key,p_job_id,
    p_request_id,p_request_hash,p_from_revision,p_to_revision,p_snapshot_revision,prior_hash);
  INSERT INTO public.beta2_project_events
    (workspace_id,project_id,sequence,event_id,event_type,operation,idempotency_key,job_id,request_id,request_hash,from_revision,to_revision,snapshot_revision,predecessor_event_hash,event_hash,created_by_user_id)
  VALUES
    (p_workspace_id,p_project_id,current_sequence,'beta2-event-' || pg_catalog.substr(current_hash,1,32),
     p_event_type,p_operation,p_idempotency_key,p_job_id,p_request_id,p_request_hash,p_from_revision,p_to_revision,
     p_snapshot_revision,prior_hash,current_hash,p_created_by_user_id);
  RETURN current_hash;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.reserve_generation_intent(
  p_workspace_id text, p_project_id text, p_created_by_user_id text, p_stage_instance_hash text,
  p_idempotency_key text, p_request_id text, p_request_hash text, p_source_revision bigint,
  p_source_hash text, p_request_payload jsonb
) RETURNS TABLE(out_job_id text, out_receipt_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE intent_existing boolean; intent_status text; intent_revision bigint; intent_content_hash text; existing_job public.beta2_generation_jobs%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  SELECT * INTO intent_existing,intent_status,intent_revision,intent_content_hash
    FROM old_mike_beta2_private.beta2_register_operation_intent(p_workspace_id,p_project_id,p_created_by_user_id,
      'GENERATE_DURABLE_CORE',p_idempotency_key,p_request_id,p_request_hash);
  IF intent_existing THEN
    SELECT * INTO STRICT existing_job FROM public.beta2_generation_jobs
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND idempotency_key=p_idempotency_key AND request_id=p_request_id;
    IF existing_job.stage_instance_hash<>p_stage_instance_hash OR existing_job.request_hash<>p_request_hash
       OR existing_job.source_revision<>p_source_revision OR existing_job.source_hash<>p_source_hash
       OR existing_job.request_payload<>p_request_payload THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
    out_job_id:=existing_job.job_id; out_receipt_hash:=NULL; RETURN NEXT; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.beta2_generation_jobs WHERE workspace_id=p_workspace_id AND project_id=p_project_id
      AND stage_id='DURABLE_CORE_GENERATION' AND stage_instance_hash=p_stage_instance_hash) THEN
    RAISE EXCEPTION 'beta2_idempotency_conflict';
  END IF;
  out_job_id := 'beta2-job-' || pg_catalog.substr(p_stage_instance_hash,1,32);
  INSERT INTO public.beta2_generation_jobs
    (workspace_id,project_id,job_id,created_by_user_id,contract_version,stage_id,stage_instance_hash,idempotency_key,request_id,request_hash,source_revision,source_hash,request_payload,state,completion_class,provider_submission_count)
  VALUES
    (p_workspace_id,p_project_id,out_job_id,p_created_by_user_id,'old-mike-v2-beta2/2.0.0-alpha.11','DURABLE_CORE_GENERATION',
     p_stage_instance_hash,p_idempotency_key,p_request_id,p_request_hash,p_source_revision,p_source_hash,p_request_payload,
     'INTENT_RECORDED','PENDING',0);
  out_receipt_hash := old_mike_beta2_private.beta2_write_receipt(p_workspace_id,p_project_id,out_job_id,'INTENT_PERSISTED');
  RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.mark_submission_started(
  p_workspace_id text, p_project_id text, p_job_id text, p_receipt_commitment text
) RETURNS TABLE(out_should_submit boolean, out_receipt_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE current_state text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  SELECT state INTO STRICT current_state FROM public.beta2_generation_jobs
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id FOR UPDATE;
  IF current_state <> 'INTENT_RECORDED' THEN
    out_should_submit := false; out_receipt_hash := NULL; RETURN NEXT; RETURN;
  END IF;
  UPDATE public.beta2_generation_jobs SET state='SUBMITTING',provider_submission_count=1,
    provider_receipt_commitment=p_receipt_commitment,submit_started_at=pg_catalog.clock_timestamp(),
    updated_at=pg_catalog.clock_timestamp(),state_version=state_version+1
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id;
  out_receipt_hash := old_mike_beta2_private.beta2_write_receipt(p_workspace_id,p_project_id,p_job_id,'SUBMISSION_STARTED');
  out_should_submit := true; RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.mark_completion_unknown(
  p_workspace_id text, p_project_id text, p_job_id text, p_reason_code text
) RETURNS TABLE(out_replayed boolean, out_event_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE job public.beta2_generation_jobs%ROWTYPE; head_revision bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  SELECT * INTO STRICT job FROM public.beta2_generation_jobs
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id FOR UPDATE;
  IF job.state='RECONCILE_REQUIRED' THEN
    SELECT event_hash INTO out_event_hash FROM public.beta2_project_events
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id AND event_type='GENERATION_UNKNOWN';
    out_replayed := true; RETURN NEXT; RETURN;
  END IF;
  IF job.state <> 'SUBMITTING' THEN RAISE EXCEPTION 'beta2_unknown_transition_invalid'; END IF;
  SELECT COALESCE(max(revision),0) INTO head_revision FROM public.beta2_project_snapshots WHERE workspace_id=p_workspace_id AND project_id=p_project_id;
  UPDATE public.beta2_generation_jobs SET state='RECONCILE_REQUIRED',completion_class='COMPLETION_UNKNOWN',
    sanitized_reason_code=p_reason_code,terminal_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp(),state_version=state_version+1
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id;
  PERFORM old_mike_beta2_private.beta2_write_receipt(p_workspace_id,p_project_id,p_job_id,'COMPLETION_UNKNOWN');
  out_event_hash := old_mike_beta2_private.beta2_write_event(p_workspace_id,p_project_id,'GENERATION_UNKNOWN','GENERATE_DURABLE_CORE',
    job.idempotency_key,p_job_id,job.request_id,job.request_hash,head_revision,head_revision,NULL,job.created_by_user_id);
  out_replayed := false; RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.commit_provider_success(
  p_workspace_id text, p_project_id text, p_job_id text, p_provider_result_hash text,
  p_snapshot_revision bigint, p_snapshot_content_hash text, p_snapshot_schema_id text, p_snapshot_payload jsonb,
  p_event_type text, p_reconciliation_request_id text
) RETURNS TABLE(out_replayed boolean, out_receipt_hash text, out_event_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE job public.beta2_generation_jobs%ROWTYPE; existing_event public.beta2_project_events%ROWTYPE; from_revision bigint; event_operation text; event_request_id text; event_request_hash text; event_idempotency text; receipt_kind text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  SELECT * INTO STRICT job FROM public.beta2_generation_jobs
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id FOR UPDATE;
  IF job.state='SUCCEEDED' THEN
    SELECT * INTO STRICT existing_event FROM public.beta2_project_events
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id
       AND event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE') ORDER BY sequence DESC LIMIT 1;
    IF p_event_type IS DISTINCT FROM existing_event.event_type
       OR (existing_event.event_type='GENERATION_COMPLETE' AND (p_reconciliation_request_id IS NOT NULL OR existing_event.operation<>'GENERATE_DURABLE_CORE' OR existing_event.request_id<>job.request_id))
       OR (existing_event.event_type='RECONCILIATION_COMPLETE' AND (p_reconciliation_request_id IS NULL OR existing_event.operation<>'RECONCILE_UNKNOWN' OR existing_event.request_id<>p_reconciliation_request_id
           OR existing_event.request_hash<>old_mike_beta2_private.beta2_reconciliation_request_hash(p_job_id,p_reconciliation_request_id))) THEN
      RAISE EXCEPTION 'beta2_state_event_pair_invalid';
    END IF;
    out_replayed:=true; RETURN NEXT; RETURN;
  END IF;
  IF job.state NOT IN ('SUBMITTING','RECONCILE_REQUIRED') THEN RAISE EXCEPTION 'beta2_job_not_committable'; END IF;
  IF (job.state='SUBMITTING' AND (p_event_type<>'GENERATION_COMPLETE' OR p_reconciliation_request_id IS NOT NULL))
     OR (job.state='RECONCILE_REQUIRED' AND (p_event_type<>'RECONCILIATION_COMPLETE' OR p_reconciliation_request_id IS NULL))
     OR p_event_type NOT IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE')
     OR (p_reconciliation_request_id IS NOT NULL AND (pg_catalog.length(p_reconciliation_request_id) NOT BETWEEN 16 AND 128 OR p_reconciliation_request_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$')) THEN
    RAISE EXCEPTION 'beta2_state_event_pair_invalid';
  END IF;
  SELECT COALESCE(max(revision),0) INTO from_revision FROM public.beta2_project_snapshots WHERE workspace_id=p_workspace_id AND project_id=p_project_id;
  IF p_snapshot_revision <> from_revision+1 THEN RAISE EXCEPTION 'beta2_snapshot_revision_invalid'; END IF;
  INSERT INTO public.beta2_project_snapshots
    (workspace_id,project_id,revision,content_hash,contract_version,schema_id,snapshot_payload,source_job_id,created_by_user_id)
  VALUES
    (p_workspace_id,p_project_id,p_snapshot_revision,p_snapshot_content_hash,'old-mike-v2-beta2/2.0.0-alpha.11',p_snapshot_schema_id,p_snapshot_payload,p_job_id,job.created_by_user_id);
  UPDATE public.beta2_generation_jobs SET state='SUCCEEDED',completion_class='COMPLETE',provider_result_hash=p_provider_result_hash,
    sanitized_reason_code=NULL,terminal_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp(),state_version=state_version+1
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id;
  receipt_kind := CASE WHEN p_event_type='GENERATION_COMPLETE' THEN 'COMPLETION_OBSERVED' ELSE 'RECONCILIATION_OBSERVED' END;
  out_receipt_hash := old_mike_beta2_private.beta2_write_receipt(p_workspace_id,p_project_id,p_job_id,receipt_kind);
  IF p_reconciliation_request_id IS NULL THEN
    event_operation:='GENERATE_DURABLE_CORE'; event_request_id:=job.request_id; event_request_hash:=job.request_hash; event_idempotency:=job.idempotency_key;
  ELSE
    event_operation:='RECONCILE_UNKNOWN'; event_request_id:=p_reconciliation_request_id;
    event_request_hash:=old_mike_beta2_private.beta2_reconciliation_request_hash(p_job_id,p_reconciliation_request_id); event_idempotency:=NULL;
  END IF;
  out_event_hash := old_mike_beta2_private.beta2_write_event(p_workspace_id,p_project_id,p_event_type,event_operation,event_idempotency,
    p_job_id,event_request_id,event_request_hash,from_revision,p_snapshot_revision,p_snapshot_revision,job.created_by_user_id);
  PERFORM old_mike_beta2_private.beta2_commit_operation_intent(p_workspace_id,p_project_id,'GENERATE_DURABLE_CORE',
    job.idempotency_key,job.request_id,job.request_hash,p_snapshot_revision,p_snapshot_content_hash,out_event_hash);
  out_replayed:=false; RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.mark_terminal_rejected(
  p_workspace_id text, p_project_id text, p_job_id text, p_reason_code text, p_reconciliation_request_id text
) RETURNS TABLE(out_replayed boolean, out_event_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE job public.beta2_generation_jobs%ROWTYPE; existing_event public.beta2_project_events%ROWTYPE; head_revision bigint; event_type text; event_operation text; event_request_id text; event_request_hash text; event_idempotency text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  SELECT * INTO STRICT job FROM public.beta2_generation_jobs
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id FOR UPDATE;
  IF job.state='FAILED' THEN
    SELECT * INTO STRICT existing_event FROM public.beta2_project_events WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id ORDER BY sequence DESC LIMIT 1;
    IF (p_reconciliation_request_id IS NULL AND (existing_event.event_type<>'GENERATION_TERMINAL_FAILURE' OR existing_event.request_id<>job.request_id))
       OR (p_reconciliation_request_id IS NOT NULL AND (existing_event.event_type<>'RECONCILIATION_TERMINAL_FAILURE' OR existing_event.request_id<>p_reconciliation_request_id)) THEN
      RAISE EXCEPTION 'beta2_state_event_pair_invalid';
    END IF;
    out_event_hash:=existing_event.event_hash;
    out_replayed:=true; RETURN NEXT; RETURN;
  END IF;
  IF job.state NOT IN ('INTENT_RECORDED','SUBMITTING','RECONCILE_REQUIRED') THEN RAISE EXCEPTION 'beta2_failure_transition_invalid'; END IF;
  IF (job.state IN ('INTENT_RECORDED','SUBMITTING') AND p_reconciliation_request_id IS NOT NULL)
     OR (job.state='RECONCILE_REQUIRED' AND p_reconciliation_request_id IS NULL)
     OR (p_reconciliation_request_id IS NOT NULL AND (pg_catalog.length(p_reconciliation_request_id) NOT BETWEEN 16 AND 128 OR p_reconciliation_request_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$')) THEN
    RAISE EXCEPTION 'beta2_state_event_pair_invalid';
  END IF;
  SELECT COALESCE(max(revision),0) INTO head_revision FROM public.beta2_project_snapshots WHERE workspace_id=p_workspace_id AND project_id=p_project_id;
  UPDATE public.beta2_generation_jobs SET state='FAILED',completion_class='TERMINAL_REJECTED',sanitized_reason_code=p_reason_code,
    terminal_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp(),state_version=state_version+1
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_job_id;
  PERFORM old_mike_beta2_private.beta2_write_receipt(p_workspace_id,p_project_id,p_job_id,'TERMINAL_REJECTED');
  IF p_reconciliation_request_id IS NULL THEN
    event_type:='GENERATION_TERMINAL_FAILURE'; event_operation:='GENERATE_DURABLE_CORE'; event_request_id:=job.request_id;
    event_request_hash:=job.request_hash; event_idempotency:=job.idempotency_key;
  ELSE
    event_type:='RECONCILIATION_TERMINAL_FAILURE'; event_operation:='RECONCILE_UNKNOWN'; event_request_id:=p_reconciliation_request_id;
    event_request_hash:=old_mike_beta2_private.beta2_reconciliation_request_hash(p_job_id,p_reconciliation_request_id); event_idempotency:=NULL;
  END IF;
  out_event_hash := old_mike_beta2_private.beta2_write_event(p_workspace_id,p_project_id,event_type,event_operation,event_idempotency,
    p_job_id,event_request_id,event_request_hash,head_revision,head_revision,NULL,job.created_by_user_id);
  out_replayed:=false; RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.save_direction_selection(
  p_workspace_id text, p_project_id text, p_created_by_user_id text, p_request_id text, p_idempotency_key text,
  p_request_hash text, p_snapshot_revision bigint, p_snapshot_content_hash text, p_snapshot_schema_id text,
  p_snapshot_payload jsonb, p_source_job_id text
) RETURNS TABLE(out_replayed boolean, out_event_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  existing public.beta2_project_events%ROWTYPE;
  current_snapshot public.beta2_project_snapshots%ROWTYPE;
  replay_snapshot public.beta2_project_snapshots%ROWTYPE;
  predecessor_snapshot public.beta2_project_snapshots%ROWTYPE;
  latest_job public.beta2_generation_jobs%ROWTYPE;
  terminal_event public.beta2_project_events%ROWTYPE;
  terminal_receipt public.beta2_generation_receipts%ROWTYPE;
  selected_direction jsonb;
  selected_direction_id text;
  expected_snapshot_core jsonb;
  expected_snapshot_payload jsonb;
  expected_snapshot_hash text;
  expected_request_hash text;
  from_revision bigint;
  intent_existing boolean;
  intent_status text;
  intent_revision bigint;
  intent_content_hash text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  IF NOT EXISTS (
    SELECT 1 FROM public.projects project
    JOIN public.workspace_members member ON member.workspace_id=project.workspace_id AND member.user_id=p_created_by_user_id
    WHERE project.workspace_id=p_workspace_id AND project.project_id=p_project_id AND project.status='ACTIVE' AND project.legacy=false
      AND member.role IN ('owner','member')
  ) THEN RAISE EXCEPTION 'beta2_selection_not_available'; END IF;

  SELECT * INTO intent_existing,intent_status,intent_revision,intent_content_hash
    FROM old_mike_beta2_private.beta2_register_operation_intent(p_workspace_id,p_project_id,p_created_by_user_id,
      'SAVE_DIRECTION_SELECTION',p_idempotency_key,p_request_id,p_request_hash);
  IF intent_existing THEN
    IF intent_status<>'COMMITTED' OR intent_revision IS NULL OR intent_content_hash IS NULL THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
    SELECT * INTO STRICT existing FROM public.beta2_project_events WHERE workspace_id=p_workspace_id AND project_id=p_project_id
      AND operation='SAVE_DIRECTION_SELECTION' AND request_id=p_request_id AND idempotency_key=p_idempotency_key;
    SELECT * INTO STRICT replay_snapshot FROM public.beta2_project_snapshots
      WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=intent_revision;
    SELECT * INTO STRICT predecessor_snapshot FROM public.beta2_project_snapshots
      WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=existing.from_revision;
    selected_direction_id:=replay_snapshot.snapshot_payload->>'selectedDirectionId';
    expected_request_hash:=old_mike_beta2_private.beta2_jsonb_hash(pg_catalog.jsonb_build_object(
      'contractVersion','old-mike-v2-beta2/2.0.0-alpha.11','operation','SAVE_DIRECTION_SELECTION','projectId',p_project_id,
      'baseRevision',predecessor_snapshot.revision,'baseContentHash',predecessor_snapshot.content_hash,'selectedDirectionId',selected_direction_id));
    IF existing.request_hash<>p_request_hash OR replay_snapshot.content_hash<>intent_content_hash
       OR p_snapshot_revision<>replay_snapshot.revision OR p_snapshot_content_hash<>replay_snapshot.content_hash
       OR p_snapshot_schema_id<>replay_snapshot.schema_id OR p_snapshot_payload<>replay_snapshot.snapshot_payload
       OR p_source_job_id<>replay_snapshot.source_job_id OR p_request_hash<>expected_request_hash THEN
      RAISE EXCEPTION 'beta2_selection_authority_invalid';
    END IF;
    out_replayed:=true; out_event_hash:=existing.event_hash; RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO current_snapshot FROM public.beta2_project_snapshots
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id ORDER BY revision DESC LIMIT 1;
  IF EXISTS (
    SELECT 1 FROM public.beta2_generation_jobs
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id
       AND state IN ('INTENT_RECORDED','SUBMITTING','RECONCILE_REQUIRED')
  ) THEN RAISE EXCEPTION 'beta2_selection_not_available'; END IF;
  SELECT * INTO latest_job FROM public.beta2_generation_jobs
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id ORDER BY created_at DESC,job_id DESC LIMIT 1;
  IF current_snapshot.revision IS NULL OR current_snapshot.source_job_id IS NULL OR latest_job.job_id IS NULL
     OR current_snapshot.source_job_id<>p_source_job_id OR latest_job.job_id<>p_source_job_id
     OR latest_job.state<>'SUCCEEDED' OR latest_job.completion_class<>'COMPLETE' OR latest_job.provider_submission_count<>1
     OR latest_job.provider_receipt_commitment IS NULL OR latest_job.provider_result_hash IS NULL THEN
    RAISE EXCEPTION 'beta2_selection_not_available';
  END IF;
  SELECT * INTO terminal_event FROM public.beta2_project_events
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_source_job_id
     AND event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE') ORDER BY sequence DESC LIMIT 1;
  SELECT * INTO terminal_receipt FROM public.beta2_generation_receipts
   WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND job_id=p_source_job_id ORDER BY receipt_no DESC LIMIT 1;
  IF terminal_event.sequence IS NULL OR terminal_receipt.receipt_no IS NULL
     OR terminal_receipt.job_state_version<>latest_job.state_version
     OR terminal_receipt.kind NOT IN ('COMPLETION_OBSERVED','RECONCILIATION_OBSERVED')
     OR terminal_receipt.completion_class<>'COMPLETE' OR terminal_receipt.submission_count<>1
     OR terminal_receipt.provider_reference_commitment IS DISTINCT FROM latest_job.provider_receipt_commitment
     OR terminal_receipt.result_hash IS DISTINCT FROM latest_job.provider_result_hash THEN
    RAISE EXCEPTION 'beta2_selection_not_available';
  END IF;

  SELECT * INTO existing FROM public.beta2_project_events WHERE workspace_id=p_workspace_id AND project_id=p_project_id
   AND operation='SAVE_DIRECTION_SELECTION' AND (request_id=p_request_id OR idempotency_key=p_idempotency_key);
  IF FOUND THEN
    IF existing.request_id<>p_request_id OR existing.idempotency_key<>p_idempotency_key OR existing.request_hash<>p_request_hash THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
    SELECT * INTO STRICT replay_snapshot FROM public.beta2_project_snapshots
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=existing.snapshot_revision;
    SELECT * INTO STRICT predecessor_snapshot FROM public.beta2_project_snapshots
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=existing.from_revision;
    selected_direction_id:=replay_snapshot.snapshot_payload->>'selectedDirectionId';
    expected_request_hash:=old_mike_beta2_private.beta2_jsonb_hash(pg_catalog.jsonb_build_object(
      'contractVersion','old-mike-v2-beta2/2.0.0-alpha.11','operation','SAVE_DIRECTION_SELECTION','projectId',p_project_id,
      'baseRevision',predecessor_snapshot.revision,'baseContentHash',predecessor_snapshot.content_hash,'selectedDirectionId',selected_direction_id));
    IF current_snapshot.revision<>replay_snapshot.revision OR current_snapshot.content_hash<>replay_snapshot.content_hash
       OR current_snapshot.snapshot_payload<>replay_snapshot.snapshot_payload
       OR p_snapshot_revision<>replay_snapshot.revision OR p_snapshot_content_hash<>replay_snapshot.content_hash
       OR p_snapshot_schema_id<>replay_snapshot.schema_id OR p_snapshot_payload<>replay_snapshot.snapshot_payload
       OR p_source_job_id<>replay_snapshot.source_job_id OR p_request_hash<>expected_request_hash THEN
      RAISE EXCEPTION 'beta2_selection_authority_invalid';
    END IF;
    out_replayed:=true; out_event_hash:=existing.event_hash; RETURN NEXT; RETURN;
  END IF;
  from_revision:=current_snapshot.revision;
  selected_direction_id:=p_snapshot_payload->>'selectedDirectionId';
  SELECT item INTO selected_direction FROM pg_catalog.jsonb_array_elements(current_snapshot.snapshot_payload->'directions') AS item
   WHERE item->>'directionId'=selected_direction_id;
  IF selected_direction IS NULL OR p_snapshot_revision<>from_revision+1 OR p_snapshot_schema_id<>'old-mike-v2-beta2/durable-snapshot/1'
     OR pg_catalog.length(p_request_id) NOT BETWEEN 16 AND 128 OR p_request_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$'
     OR pg_catalog.length(p_idempotency_key) NOT BETWEEN 16 AND 128 OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'beta2_selection_authority_invalid';
  END IF;
  expected_snapshot_core:=(current_snapshot.snapshot_payload - 'contentHash') || pg_catalog.jsonb_build_object(
    'revision',p_snapshot_revision,'selectedDirectionId',selected_direction_id,'s0Summary',selected_direction->'s0',
    'fieldAssist',selected_direction->'fieldAssist','humanReadableArtifact',selected_direction->'humanReadableArtifact',
    'confirmedWorkspace',NULL);
  expected_snapshot_hash:=old_mike_beta2_private.beta2_jsonb_hash(expected_snapshot_core);
  expected_snapshot_payload:=expected_snapshot_core || pg_catalog.jsonb_build_object('contentHash',expected_snapshot_hash);
  expected_request_hash:=old_mike_beta2_private.beta2_jsonb_hash(pg_catalog.jsonb_build_object(
    'contractVersion','old-mike-v2-beta2/2.0.0-alpha.11','operation','SAVE_DIRECTION_SELECTION','projectId',p_project_id,
    'baseRevision',from_revision,'baseContentHash',current_snapshot.content_hash,'selectedDirectionId',selected_direction_id));
  IF p_snapshot_content_hash<>expected_snapshot_hash OR p_snapshot_payload<>expected_snapshot_payload OR p_request_hash<>expected_request_hash THEN
    RAISE EXCEPTION 'beta2_selection_authority_invalid';
  END IF;
  INSERT INTO public.beta2_project_snapshots
    (workspace_id,project_id,revision,content_hash,contract_version,schema_id,snapshot_payload,source_job_id,created_by_user_id)
  VALUES
    (p_workspace_id,p_project_id,p_snapshot_revision,p_snapshot_content_hash,'old-mike-v2-beta2/2.0.0-alpha.11',p_snapshot_schema_id,p_snapshot_payload,p_source_job_id,p_created_by_user_id);
  out_event_hash:=old_mike_beta2_private.beta2_write_event(p_workspace_id,p_project_id,'DIRECTION_SELECTION_SAVED','SAVE_DIRECTION_SELECTION',
    p_idempotency_key,NULL,p_request_id,p_request_hash,from_revision,p_snapshot_revision,p_snapshot_revision,p_created_by_user_id);
  PERFORM old_mike_beta2_private.beta2_commit_operation_intent(p_workspace_id,p_project_id,'SAVE_DIRECTION_SELECTION',
    p_idempotency_key,p_request_id,p_request_hash,p_snapshot_revision,p_snapshot_content_hash,out_event_hash);
  out_replayed:=false; RETURN NEXT;
END;
$$;

CREATE FUNCTION old_mike_beta2_private.save_confirmed_workspace(
  p_workspace_id text, p_project_id text, p_created_by_user_id text, p_request_id text, p_idempotency_key text,
  p_request_hash text, p_snapshot_revision bigint, p_snapshot_content_hash text, p_snapshot_schema_id text,
  p_snapshot_payload jsonb, p_source_job_id text, p_selected_direction_id text, p_confirmed_s0 jsonb,
  p_applied_assist_option_ids jsonb
) RETURNS TABLE(out_replayed boolean, out_event_hash text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  existing public.beta2_project_events%ROWTYPE;
  current_snapshot public.beta2_project_snapshots%ROWTYPE;
  replay_snapshot public.beta2_project_snapshots%ROWTYPE;
  predecessor_snapshot public.beta2_project_snapshots%ROWTYPE;
  latest_job public.beta2_generation_jobs%ROWTYPE;
  selected_direction jsonb;
  option_value jsonb;
  expected_s0 jsonb := '{}'::jsonb;
  expected_confirmation_core jsonb;
  expected_confirmation jsonb;
  expected_snapshot_core jsonb;
  expected_snapshot_payload jsonb;
  expected_snapshot_hash text;
  expected_request_hash text;
  from_revision bigint;
  field_name text;
  option_id text;
  field_names constant text[] := ARRAY['workingTitle','domain','outputTrack','problemContext','targetUsers','expectedContribution','existingData','availableData','methodIdea','timeline','constraints','ethicsPrivacyRisks','unresolvedItems'];
  intent_existing boolean;
  intent_status text;
  intent_revision bigint;
  intent_content_hash text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('old-mike-v2-beta2/project-lock/2' || pg_catalog.chr(31) || p_workspace_id || pg_catalog.chr(31) || p_project_id,22020));
  IF NOT EXISTS (
    SELECT 1 FROM public.projects project
    JOIN public.workspace_members member ON member.workspace_id=project.workspace_id AND member.user_id=p_created_by_user_id
    WHERE project.workspace_id=p_workspace_id AND project.project_id=p_project_id AND project.status='ACTIVE' AND project.legacy=false
      AND member.role IN ('owner','member')
  ) THEN RAISE EXCEPTION 'beta2_workspace_confirmation_not_available'; END IF;
  SELECT * INTO intent_existing,intent_status,intent_revision,intent_content_hash
    FROM old_mike_beta2_private.beta2_register_operation_intent(p_workspace_id,p_project_id,p_created_by_user_id,
      'SAVE_CONFIRMED_WORKSPACE',p_idempotency_key,p_request_id,p_request_hash);
  IF intent_existing THEN
    IF intent_status<>'COMMITTED' OR intent_revision IS NULL OR intent_content_hash IS NULL THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
    SELECT * INTO STRICT existing FROM public.beta2_project_events WHERE workspace_id=p_workspace_id AND project_id=p_project_id
      AND operation='SAVE_CONFIRMED_WORKSPACE' AND request_id=p_request_id AND idempotency_key=p_idempotency_key;
    SELECT * INTO STRICT replay_snapshot FROM public.beta2_project_snapshots
      WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=intent_revision;
    SELECT * INTO STRICT current_snapshot FROM public.beta2_project_snapshots
      WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=existing.from_revision;
    IF replay_snapshot.content_hash<>intent_content_hash THEN RAISE EXCEPTION 'beta2_workspace_confirmation_authority_invalid'; END IF;
  ELSE
    SELECT * INTO current_snapshot FROM public.beta2_project_snapshots
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id ORDER BY revision DESC LIMIT 1;
    IF EXISTS (
      SELECT 1 FROM public.beta2_generation_jobs WHERE workspace_id=p_workspace_id AND project_id=p_project_id
        AND state IN ('INTENT_RECORDED','SUBMITTING','RECONCILE_REQUIRED')
    ) THEN RAISE EXCEPTION 'beta2_workspace_confirmation_not_available'; END IF;
    SELECT * INTO latest_job FROM public.beta2_generation_jobs
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id ORDER BY created_at DESC,job_id DESC LIMIT 1;
    IF current_snapshot.revision IS NULL OR current_snapshot.source_job_id IS NULL OR latest_job.job_id IS NULL
       OR current_snapshot.source_job_id<>p_source_job_id OR latest_job.job_id<>p_source_job_id
       OR latest_job.state<>'SUCCEEDED' OR latest_job.completion_class<>'COMPLETE' OR latest_job.provider_submission_count<>1
       OR latest_job.provider_receipt_commitment IS NULL OR latest_job.provider_result_hash IS NULL THEN
      RAISE EXCEPTION 'beta2_workspace_confirmation_not_available';
    END IF;
  END IF;
  SELECT item INTO selected_direction FROM pg_catalog.jsonb_array_elements(current_snapshot.snapshot_payload->'directions') AS item
   WHERE item->>'directionId'=p_selected_direction_id;
  IF selected_direction IS NULL OR current_snapshot.snapshot_payload->>'selectedDirectionId'<>p_selected_direction_id
     OR pg_catalog.jsonb_typeof(p_confirmed_s0)<>'object' OR pg_catalog.jsonb_typeof(p_applied_assist_option_ids)<>'object'
     OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_confirmed_s0))<>13
     OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(p_applied_assist_option_ids))<>13
     OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_confirmed_s0) key WHERE NOT key=ANY(field_names))
     OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_applied_assist_option_ids) key WHERE NOT key=ANY(field_names)) THEN
    RAISE EXCEPTION 'beta2_workspace_confirmation_invalid';
  END IF;
  FOREACH field_name IN ARRAY field_names LOOP
    IF NOT (p_confirmed_s0 ? field_name) OR NOT (p_applied_assist_option_ids ? field_name) OR pg_catalog.jsonb_typeof(p_confirmed_s0->field_name)<>'string' THEN
      RAISE EXCEPTION 'beta2_workspace_confirmation_invalid';
    END IF;
    IF p_applied_assist_option_ids->field_name='null'::jsonb THEN
      option_value:=selected_direction->'s0'->field_name;
    ELSE
      IF pg_catalog.jsonb_typeof(p_applied_assist_option_ids->field_name)<>'string' THEN RAISE EXCEPTION 'beta2_workspace_confirmation_invalid'; END IF;
      option_id:=p_applied_assist_option_ids->>field_name;
      SELECT option->'applyValue' INTO option_value FROM pg_catalog.jsonb_array_elements(selected_direction->'fieldAssist'->field_name) option
       WHERE option->>'optionId'=option_id;
      IF option_value IS NULL THEN RAISE EXCEPTION 'beta2_workspace_confirmation_invalid'; END IF;
    END IF;
    IF p_confirmed_s0->field_name<>option_value THEN RAISE EXCEPTION 'beta2_workspace_confirmation_invalid'; END IF;
    expected_s0:=expected_s0 || pg_catalog.jsonb_build_object(field_name,option_value);
  END LOOP;
  expected_confirmation_core:=pg_catalog.jsonb_build_object(
    'schemaId','old-mike-v2-beta2/confirmed-workspace/1','selectedDirectionId',p_selected_direction_id,
    's0',expected_s0,'appliedAssistOptionIds',p_applied_assist_option_ids);
  expected_confirmation:=expected_confirmation_core || pg_catalog.jsonb_build_object(
    'confirmationHash',old_mike_beta2_private.beta2_jsonb_hash(expected_confirmation_core));
  SELECT * INTO existing FROM public.beta2_project_events WHERE workspace_id=p_workspace_id AND project_id=p_project_id
   AND operation='SAVE_CONFIRMED_WORKSPACE' AND (request_id=p_request_id OR idempotency_key=p_idempotency_key);
  IF FOUND THEN
    IF existing.request_id<>p_request_id OR existing.idempotency_key<>p_idempotency_key OR existing.request_hash<>p_request_hash THEN RAISE EXCEPTION 'beta2_idempotency_conflict'; END IF;
    SELECT * INTO STRICT replay_snapshot FROM public.beta2_project_snapshots
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=existing.snapshot_revision;
    SELECT * INTO STRICT predecessor_snapshot FROM public.beta2_project_snapshots
     WHERE workspace_id=p_workspace_id AND project_id=p_project_id AND revision=existing.from_revision;
    expected_request_hash:=old_mike_beta2_private.beta2_jsonb_hash(pg_catalog.jsonb_build_object(
      'contractVersion','old-mike-v2-beta2/2.0.0-alpha.11','operation','SAVE_CONFIRMED_WORKSPACE','projectId',p_project_id,
      'baseRevision',predecessor_snapshot.revision,'baseContentHash',predecessor_snapshot.content_hash,
      'selectedDirectionId',p_selected_direction_id,'s0Summary',expected_s0,'appliedAssistOptionIds',p_applied_assist_option_ids));
    IF p_snapshot_revision<>replay_snapshot.revision
       OR p_snapshot_content_hash<>replay_snapshot.content_hash OR p_snapshot_schema_id<>replay_snapshot.schema_id
       OR p_snapshot_payload<>replay_snapshot.snapshot_payload OR p_source_job_id<>replay_snapshot.source_job_id
       OR replay_snapshot.snapshot_payload->'confirmedWorkspace'<>expected_confirmation OR p_request_hash<>expected_request_hash THEN
      RAISE EXCEPTION 'beta2_workspace_confirmation_authority_invalid';
    END IF;
    out_replayed:=true; out_event_hash:=existing.event_hash; RETURN NEXT; RETURN;
  END IF;
  from_revision:=current_snapshot.revision;
  IF p_snapshot_revision<>from_revision+1 OR p_snapshot_schema_id<>'old-mike-v2-beta2/durable-snapshot/1'
     OR pg_catalog.length(p_request_id) NOT BETWEEN 16 AND 128 OR p_request_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$'
     OR pg_catalog.length(p_idempotency_key) NOT BETWEEN 16 AND 128 OR p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'beta2_workspace_confirmation_authority_invalid';
  END IF;
  expected_snapshot_core:=(current_snapshot.snapshot_payload - 'contentHash') || pg_catalog.jsonb_build_object(
    'revision',p_snapshot_revision,'s0Summary',expected_s0,
    'humanReadableArtifact',old_mike_beta2_private.beta2_render_human_artifact(selected_direction,expected_s0),
    'confirmedWorkspace',expected_confirmation);
  expected_snapshot_hash:=old_mike_beta2_private.beta2_jsonb_hash(expected_snapshot_core);
  expected_snapshot_payload:=expected_snapshot_core || pg_catalog.jsonb_build_object('contentHash',expected_snapshot_hash);
  expected_request_hash:=old_mike_beta2_private.beta2_jsonb_hash(pg_catalog.jsonb_build_object(
    'contractVersion','old-mike-v2-beta2/2.0.0-alpha.11','operation','SAVE_CONFIRMED_WORKSPACE','projectId',p_project_id,
    'baseRevision',from_revision,'baseContentHash',current_snapshot.content_hash,'selectedDirectionId',p_selected_direction_id,
    's0Summary',expected_s0,'appliedAssistOptionIds',p_applied_assist_option_ids));
  IF p_snapshot_content_hash<>expected_snapshot_hash OR p_snapshot_payload<>expected_snapshot_payload OR p_request_hash<>expected_request_hash THEN
    RAISE EXCEPTION 'beta2_workspace_confirmation_authority_invalid';
  END IF;
  INSERT INTO public.beta2_project_snapshots
    (workspace_id,project_id,revision,content_hash,contract_version,schema_id,snapshot_payload,source_job_id,created_by_user_id)
  VALUES
    (p_workspace_id,p_project_id,p_snapshot_revision,p_snapshot_content_hash,'old-mike-v2-beta2/2.0.0-alpha.11',p_snapshot_schema_id,p_snapshot_payload,p_source_job_id,p_created_by_user_id);
  out_event_hash:=old_mike_beta2_private.beta2_write_event(p_workspace_id,p_project_id,'CONFIRMED_WORKSPACE_SAVED','SAVE_CONFIRMED_WORKSPACE',
    p_idempotency_key,NULL,p_request_id,p_request_hash,from_revision,p_snapshot_revision,p_snapshot_revision,p_created_by_user_id);
  PERFORM old_mike_beta2_private.beta2_commit_operation_intent(p_workspace_id,p_project_id,'SAVE_CONFIRMED_WORKSPACE',
    p_idempotency_key,p_request_id,p_request_hash,p_snapshot_revision,p_snapshot_content_hash,out_event_hash);
  out_replayed:=false; RETURN NEXT;
END;
$$;

RESET ROLE;

CREATE OR REPLACE FUNCTION beta2_reject_append_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'beta2_append_only_relation'; END; $$;

CREATE OR REPLACE FUNCTION beta2_guard_job_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE request_key_count integer; source_key_count integer; malformed_material_count integer; coverage_key_count integer; malformed_coverage_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('old-mike-v2-beta2/project-lock/2' || chr(31) || NEW.workspace_id || chr(31) || NEW.project_id,22020));
  IF NOT EXISTS (SELECT 1 FROM public.projects p JOIN public.workspace_members m ON m.workspace_id=p.workspace_id AND m.user_id=NEW.created_by_user_id
    WHERE p.workspace_id=NEW.workspace_id AND p.project_id=NEW.project_id AND p.status='ACTIVE' AND p.legacy=false AND m.role IN ('owner','member')) THEN RAISE EXCEPTION 'beta2_job_tenant_authority_invalid'; END IF;
  SELECT count(*) INTO request_key_count FROM jsonb_object_keys(NEW.request_payload);
  SELECT count(*) INTO source_key_count FROM jsonb_object_keys(COALESCE(NEW.request_payload->'source','{}'::jsonb));
  SELECT count(*) INTO malformed_material_count FROM jsonb_array_elements(COALESCE(NEW.request_payload->'source'->'materials','[]'::jsonb)) material
   WHERE jsonb_typeof(material)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(material))<>6
      OR NOT (material ?& ARRAY['materialId','kind','title','content','contentByteLength','contentHash'])
      OR old_mike_beta2_private.beta2_material_is_blank(material->>'content');
  SELECT count(*) INTO coverage_key_count FROM jsonb_object_keys(COALESCE(NEW.request_payload->'source'->'materialCoverage','{}'::jsonb));
  SELECT count(*) INTO malformed_coverage_count FROM jsonb_each_text(COALESCE(NEW.request_payload->'source'->'materialCoverage','{}'::jsonb)) coverage
   WHERE coverage.key NOT IN ('ABSTRACT','INTRODUCTION','METHODS','RESULTS','STATISTICS') OR coverage.value NOT IN ('PROVIDED_UNVERIFIED','MISSING');
  IF request_key_count<>8 OR source_key_count<>7 OR malformed_material_count<>0 OR coverage_key_count<>5 OR malformed_coverage_count<>0
     OR NOT (NEW.request_payload ?& ARRAY['contractVersion','operation','projectId','requestId','idempotencyKey','baseRevision','baseContentHash','source'])
     OR NOT ((NEW.request_payload->'source') ?& ARRAY['entryMode','researchDirection','outputTarget','sourceStrategy','materials','materialCoverage','sourceHash'])
     OR NEW.request_payload->>'contractVersion'<>NEW.contract_version OR NEW.request_payload->>'operation'<>'GENERATE_DURABLE_CORE'
     OR NEW.request_payload->>'projectId'<>NEW.project_id OR NEW.request_payload->>'requestId'<>NEW.request_id
     OR NEW.request_payload->>'idempotencyKey'<>NEW.idempotency_key OR (NEW.request_payload->>'baseRevision')::bigint<>NEW.source_revision
     OR NEW.request_payload->'source'->>'sourceHash'<>NEW.source_hash OR NEW.request_payload->'source'->>'sourceStrategy'<>'NONE'
     OR jsonb_typeof(NEW.request_payload->'source'->'materials')<>'array'
     OR EXISTS (
       SELECT 1 FROM unnest(ARRAY['ABSTRACT','INTRODUCTION','METHODS','RESULTS','STATISTICS']) kind
       WHERE NEW.request_payload->'source'->'materialCoverage'->>kind IS DISTINCT FROM
         CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.request_payload->'source'->'materials') material WHERE material->>'kind'=kind)
           THEN 'PROVIDED_UNVERIFIED' ELSE 'MISSING' END
     ) THEN RAISE EXCEPTION 'beta2_job_request_authority_invalid'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION beta2_guard_snapshot_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_revision bigint; payload_key_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('old-mike-v2-beta2/project-lock/2' || chr(31) || NEW.workspace_id || chr(31) || NEW.project_id,22020));
  SELECT max(revision) INTO prior_revision FROM public.beta2_project_snapshots WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id;
  SELECT count(*) INTO payload_key_count FROM jsonb_object_keys(NEW.snapshot_payload);
  IF NEW.revision<>COALESCE(prior_revision,0)+1 OR payload_key_count<>20
    OR NOT (NEW.snapshot_payload ?& ARRAY['schemaId','contractVersion','durabilityClass','projectId','revision','source','directions','recommendedDirectionId','selectedDirectionId','s0Summary','fieldAssist','humanReadableArtifact','confirmedWorkspace','stageId','stageInstanceHash','jobId','providerSubmissionCount','persistenceStatus','formalResearchWriteCount','contentHash'])
    OR NEW.snapshot_payload->>'schemaId'<>NEW.schema_id OR NEW.snapshot_payload->>'contractVersion'<>NEW.contract_version
    OR NEW.snapshot_payload->>'projectId'<>NEW.project_id OR (NEW.snapshot_payload->>'revision')::bigint<>NEW.revision
    OR NEW.snapshot_payload->>'contentHash'<>NEW.content_hash OR NEW.snapshot_payload->>'jobId' IS DISTINCT FROM NEW.source_job_id
    OR NEW.snapshot_payload->>'providerSubmissionCount'<>'1' OR NEW.snapshot_payload->>'formalResearchWriteCount'<>'0' THEN RAISE EXCEPTION 'beta2_snapshot_authority_invalid'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION beta2_guard_job_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'beta2_jobs_delete_forbidden'; END IF;
  IF ROW(OLD.workspace_id,OLD.project_id,OLD.job_id,OLD.created_by_user_id,OLD.contract_version,OLD.stage_id,OLD.stage_instance_hash,OLD.idempotency_key,OLD.request_id,OLD.request_hash,OLD.source_revision,OLD.source_hash,OLD.request_payload,OLD.created_at)
     IS DISTINCT FROM ROW(NEW.workspace_id,NEW.project_id,NEW.job_id,NEW.created_by_user_id,NEW.contract_version,NEW.stage_id,NEW.stage_instance_hash,NEW.idempotency_key,NEW.request_id,NEW.request_hash,NEW.source_revision,NEW.source_hash,NEW.request_payload,NEW.created_at) THEN RAISE EXCEPTION 'beta2_job_authority_immutable'; END IF;
  IF NEW.provider_submission_count<OLD.provider_submission_count OR NEW.provider_submission_count>1 THEN RAISE EXCEPTION 'beta2_submission_count_invalid'; END IF;
  IF OLD.provider_receipt_commitment IS NOT NULL AND NEW.provider_receipt_commitment IS DISTINCT FROM OLD.provider_receipt_commitment THEN RAISE EXCEPTION 'beta2_provider_receipt_commitment_immutable'; END IF;
  IF OLD.submit_started_at IS NOT NULL AND NEW.submit_started_at IS DISTINCT FROM OLD.submit_started_at THEN RAISE EXCEPTION 'beta2_submit_started_at_immutable'; END IF;
  IF OLD.provider_submission_count=1 AND NEW.provider_submission_count<>1 THEN RAISE EXCEPTION 'beta2_submission_count_immutable'; END IF;
  IF NOT ((OLD.state='INTENT_RECORDED' AND NEW.state IN ('SUBMITTING','FAILED')) OR (OLD.state='SUBMITTING' AND NEW.state IN ('SUCCEEDED','FAILED','RECONCILE_REQUIRED')) OR (OLD.state='RECONCILE_REQUIRED' AND NEW.state IN ('SUCCEEDED','FAILED'))) THEN RAISE EXCEPTION 'beta2_job_transition_invalid'; END IF;
  IF OLD.state='INTENT_RECORDED' AND NEW.state='SUBMITTING' AND NOT (NEW.provider_submission_count=1 AND NEW.provider_receipt_commitment IS NOT NULL AND NEW.submit_started_at IS NOT NULL) THEN RAISE EXCEPTION 'beta2_submitting_authority_invalid'; END IF;
  IF OLD.state='INTENT_RECORDED' AND NEW.state='FAILED' AND NOT (NEW.provider_submission_count=0 AND NEW.provider_receipt_commitment IS NULL AND NEW.submit_started_at IS NULL) THEN RAISE EXCEPTION 'beta2_intent_failure_authority_invalid'; END IF;
  IF NEW.state_version<>OLD.state_version+1 THEN RAISE EXCEPTION 'beta2_state_version_invalid'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION beta2_guard_operation_intent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot_hash text; event_revision bigint; expected_response jsonb;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'beta2_operation_intent_delete_forbidden'; END IF;
  IF ROW(OLD.workspace_id,OLD.project_id,OLD.operation,OLD.idempotency_key,OLD.request_id,OLD.request_hash,OLD.created_by_user_id,OLD.created_at)
     IS DISTINCT FROM ROW(NEW.workspace_id,NEW.project_id,NEW.operation,NEW.idempotency_key,NEW.request_id,NEW.request_hash,NEW.created_by_user_id,NEW.created_at) THEN
    RAISE EXCEPTION 'beta2_operation_intent_authority_immutable';
  END IF;
  IF OLD.status<>'PENDING' OR NEW.status<>'COMMITTED' THEN RAISE EXCEPTION 'beta2_operation_intent_transition_invalid'; END IF;
  SELECT content_hash INTO STRICT snapshot_hash FROM public.beta2_project_snapshots
   WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id AND revision=NEW.committed_revision;
  SELECT snapshot_revision INTO STRICT event_revision FROM public.beta2_project_events
   WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id AND event_hash=NEW.committed_event_hash;
  expected_response:=jsonb_build_object('operation',NEW.operation,'revision',NEW.committed_revision,'contentHash',NEW.committed_content_hash,'eventHash',NEW.committed_event_hash);
  IF snapshot_hash<>NEW.committed_content_hash OR event_revision<>NEW.committed_revision
     OR NEW.committed_response_authority<>expected_response THEN RAISE EXCEPTION 'beta2_operation_intent_commit_invalid'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION beta2_guard_receipt_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_no integer; prior_hash text; job public.beta2_generation_jobs%ROWTYPE; expected_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('old-mike-v2-beta2/project-lock/2' || chr(31) || NEW.workspace_id || chr(31) || NEW.project_id,22020));
  SELECT receipt_no,receipt_hash INTO prior_no,prior_hash FROM public.beta2_generation_receipts WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id AND job_id=NEW.job_id ORDER BY receipt_no DESC LIMIT 1;
  SELECT * INTO STRICT job FROM public.beta2_generation_jobs WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id AND job_id=NEW.job_id;
  IF NEW.receipt_no<>NEW.job_state_version OR NEW.job_state_version<>job.state_version OR NEW.transition_xid<>txid_current() THEN RAISE EXCEPTION 'beta2_receipt_state_version_invalid'; END IF;
  IF prior_no IS NULL THEN
    IF NEW.receipt_no<>1 OR NEW.predecessor_receipt_hash IS NOT NULL THEN RAISE EXCEPTION 'beta2_receipt_chain_invalid'; END IF;
  ELSIF NEW.receipt_no<>prior_no+1 OR NEW.predecessor_receipt_hash IS DISTINCT FROM prior_hash THEN RAISE EXCEPTION 'beta2_receipt_chain_invalid'; END IF;
  expected_hash:=old_mike_beta2_private.beta2_receipt_hash(NEW.workspace_id,NEW.project_id,NEW.job_id,NEW.receipt_no,NEW.job_state_version,NEW.kind,NEW.completion_class,NEW.submission_count,NEW.provider_reference_commitment,NEW.result_hash,NEW.predecessor_receipt_hash);
  IF NEW.receipt_hash<>expected_hash THEN RAISE EXCEPTION 'beta2_receipt_hash_invalid'; END IF;
  IF NOT ((NEW.kind='INTENT_PERSISTED' AND job.state='INTENT_RECORDED' AND NEW.completion_class='PENDING' AND NEW.submission_count=0 AND NEW.provider_reference_commitment IS NULL AND NEW.result_hash IS NULL)
    OR (NEW.kind='SUBMISSION_STARTED' AND job.state='SUBMITTING' AND NEW.completion_class='PENDING' AND NEW.submission_count=1 AND NEW.provider_reference_commitment IS NOT DISTINCT FROM job.provider_receipt_commitment AND NEW.result_hash IS NULL)
    OR (NEW.kind IN ('COMPLETION_OBSERVED','RECONCILIATION_OBSERVED') AND job.state='SUCCEEDED' AND NEW.completion_class='COMPLETE' AND NEW.submission_count=1 AND NEW.provider_reference_commitment IS NOT DISTINCT FROM job.provider_receipt_commitment AND NEW.result_hash IS NOT DISTINCT FROM job.provider_result_hash)
    OR (NEW.kind='COMPLETION_UNKNOWN' AND job.state='RECONCILE_REQUIRED' AND NEW.completion_class='COMPLETION_UNKNOWN' AND NEW.submission_count=1 AND NEW.provider_reference_commitment IS NOT DISTINCT FROM job.provider_receipt_commitment AND NEW.result_hash IS NULL)
    OR (NEW.kind='TERMINAL_REJECTED' AND job.state='FAILED' AND NEW.completion_class='TERMINAL_REJECTED' AND NEW.submission_count=job.provider_submission_count AND NEW.provider_reference_commitment IS NOT DISTINCT FROM job.provider_receipt_commitment AND NEW.result_hash IS NULL)) THEN RAISE EXCEPTION 'beta2_receipt_job_shape_invalid'; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION beta2_guard_event_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_sequence bigint; prior_hash text; prior_revision bigint; snapshot_job_id text; job public.beta2_generation_jobs%ROWTYPE; expected_hash text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('old-mike-v2-beta2/project-lock/2' || chr(31) || NEW.workspace_id || chr(31) || NEW.project_id,22020));
  SELECT sequence,event_hash,to_revision INTO prior_sequence,prior_hash,prior_revision FROM public.beta2_project_events WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id ORDER BY sequence DESC LIMIT 1;
  IF prior_sequence IS NULL THEN
    IF NEW.sequence<>1 OR NEW.predecessor_event_hash IS NOT NULL OR NEW.from_revision<>0 THEN RAISE EXCEPTION 'beta2_event_chain_invalid'; END IF;
  ELSIF NEW.sequence<>prior_sequence+1 OR NEW.predecessor_event_hash IS DISTINCT FROM prior_hash OR NEW.from_revision<>prior_revision THEN RAISE EXCEPTION 'beta2_event_chain_invalid'; END IF;
  expected_hash:=old_mike_beta2_private.beta2_event_hash(NEW.workspace_id,NEW.project_id,NEW.sequence,NEW.event_type,NEW.operation,NEW.idempotency_key,NEW.job_id,NEW.request_id,NEW.request_hash,NEW.from_revision,NEW.to_revision,NEW.snapshot_revision,NEW.predecessor_event_hash);
  IF NEW.event_hash<>expected_hash THEN RAISE EXCEPTION 'beta2_event_hash_invalid'; END IF;
  IF NEW.snapshot_revision IS NOT NULL THEN
    SELECT source_job_id INTO STRICT snapshot_job_id FROM public.beta2_project_snapshots WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id AND revision=NEW.snapshot_revision;
    IF NEW.event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE') AND NEW.job_id IS DISTINCT FROM snapshot_job_id THEN RAISE EXCEPTION 'beta2_event_snapshot_job_invalid'; END IF;
  END IF;
  IF NEW.job_id IS NOT NULL THEN
    SELECT * INTO STRICT job FROM public.beta2_generation_jobs WHERE workspace_id=NEW.workspace_id AND project_id=NEW.project_id AND job_id=NEW.job_id;
    IF NEW.event_type IN ('GENERATION_COMPLETE','GENERATION_UNKNOWN','GENERATION_TERMINAL_FAILURE') AND (NEW.request_hash IS DISTINCT FROM job.request_hash OR NEW.idempotency_key IS DISTINCT FROM job.idempotency_key) THEN RAISE EXCEPTION 'beta2_event_job_authority_invalid'; END IF;
    IF (NEW.event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE') AND job.state<>'SUCCEEDED') OR (NEW.event_type='GENERATION_UNKNOWN' AND job.state<>'RECONCILE_REQUIRED') OR (NEW.event_type IN ('GENERATION_TERMINAL_FAILURE','RECONCILIATION_TERMINAL_FAILURE') AND job.state<>'FAILED') THEN RAISE EXCEPTION 'beta2_event_job_state_invalid'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION beta2_validate_job_receipt_pair() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE workspace_value text:=NEW.workspace_id; project_value text:=NEW.project_id; job_value text:=NEW.job_id; job public.beta2_generation_jobs%ROWTYPE; receipt public.beta2_generation_receipts%ROWTYPE; version_count integer;
BEGIN
  SELECT * INTO job FROM public.beta2_generation_jobs WHERE workspace_id=workspace_value AND project_id=project_value AND job_id=job_value;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO version_count FROM public.beta2_generation_receipts WHERE workspace_id=workspace_value AND project_id=project_value AND job_id=job_value AND job_state_version=job.state_version;
  IF version_count<>1 THEN RAISE EXCEPTION 'beta2_job_receipt_missing_or_duplicate'; END IF;
  SELECT * INTO STRICT receipt FROM public.beta2_generation_receipts WHERE workspace_id=workspace_value AND project_id=project_value AND job_id=job_value AND job_state_version=job.state_version;
  IF NOT ((job.state='INTENT_RECORDED' AND receipt.kind='INTENT_PERSISTED') OR (job.state='SUBMITTING' AND receipt.kind='SUBMISSION_STARTED') OR (job.state='SUCCEEDED' AND receipt.kind IN ('COMPLETION_OBSERVED','RECONCILIATION_OBSERVED')) OR (job.state='RECONCILE_REQUIRED' AND receipt.kind='COMPLETION_UNKNOWN') OR (job.state='FAILED' AND receipt.kind='TERMINAL_REJECTED'))
    OR receipt.receipt_no<>job.state_version OR receipt.submission_count<>job.provider_submission_count OR receipt.provider_reference_commitment IS DISTINCT FROM job.provider_receipt_commitment OR receipt.result_hash IS DISTINCT FROM job.provider_result_hash THEN RAISE EXCEPTION 'beta2_job_receipt_pair_invalid'; END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION beta2_validate_snapshot_event_pair() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE workspace_value text:=NEW.workspace_id; project_value text:=NEW.project_id; revision_value bigint; pair_count integer; source_job text; paired_event_type text; paired_job text;
BEGIN
  IF TG_TABLE_NAME='beta2_project_snapshots' THEN revision_value:=NEW.revision; ELSE revision_value:=NEW.snapshot_revision; END IF;
  IF revision_value IS NULL THEN RETURN NULL; END IF;
  SELECT count(*),max(s.source_job_id),max(e.event_type),max(e.job_id) INTO pair_count,source_job,paired_event_type,paired_job
    FROM public.beta2_project_snapshots s LEFT JOIN public.beta2_project_events e ON e.workspace_id=s.workspace_id AND e.project_id=s.project_id AND e.snapshot_revision=s.revision
   WHERE s.workspace_id=workspace_value AND s.project_id=project_value AND s.revision=revision_value;
  IF pair_count<>1 OR paired_event_type IS NULL THEN RAISE EXCEPTION 'beta2_snapshot_event_pair_missing'; END IF;
  IF paired_event_type IN ('GENERATION_COMPLETE','RECONCILIATION_COMPLETE') AND paired_job IS DISTINCT FROM source_job THEN RAISE EXCEPTION 'beta2_snapshot_event_pair_invalid'; END IF;
  IF paired_event_type='DIRECTION_SELECTION_SAVED' AND paired_job IS NOT NULL THEN RAISE EXCEPTION 'beta2_selection_event_pair_invalid'; END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER beta2_generation_jobs_guard BEFORE UPDATE OR DELETE ON beta2_generation_jobs FOR EACH ROW EXECUTE FUNCTION beta2_guard_job_mutation();
CREATE TRIGGER beta2_operation_intents_guard BEFORE UPDATE OR DELETE ON beta2_operation_intents FOR EACH ROW EXECUTE FUNCTION beta2_guard_operation_intent_mutation();
CREATE TRIGGER beta2_generation_jobs_insert_guard BEFORE INSERT ON beta2_generation_jobs FOR EACH ROW EXECUTE FUNCTION beta2_guard_job_insert();
CREATE TRIGGER beta2_generation_receipts_append_only BEFORE UPDATE OR DELETE ON beta2_generation_receipts FOR EACH ROW EXECUTE FUNCTION beta2_reject_append_mutation();
CREATE TRIGGER beta2_project_snapshots_append_only BEFORE UPDATE OR DELETE ON beta2_project_snapshots FOR EACH ROW EXECUTE FUNCTION beta2_reject_append_mutation();
CREATE TRIGGER beta2_project_snapshots_insert_guard BEFORE INSERT ON beta2_project_snapshots FOR EACH ROW EXECUTE FUNCTION beta2_guard_snapshot_insert();
CREATE TRIGGER beta2_project_events_append_only BEFORE UPDATE OR DELETE ON beta2_project_events FOR EACH ROW EXECUTE FUNCTION beta2_reject_append_mutation();
CREATE TRIGGER beta2_generation_receipts_insert_guard BEFORE INSERT ON beta2_generation_receipts FOR EACH ROW EXECUTE FUNCTION beta2_guard_receipt_insert();
CREATE TRIGGER beta2_project_events_insert_guard BEFORE INSERT ON beta2_project_events FOR EACH ROW EXECUTE FUNCTION beta2_guard_event_insert();
CREATE CONSTRAINT TRIGGER beta2_generation_jobs_receipt_pair AFTER INSERT OR UPDATE ON beta2_generation_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION beta2_validate_job_receipt_pair();
CREATE CONSTRAINT TRIGGER beta2_generation_receipts_job_pair AFTER INSERT ON beta2_generation_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION beta2_validate_job_receipt_pair();
CREATE CONSTRAINT TRIGGER beta2_project_snapshots_event_pair AFTER INSERT ON beta2_project_snapshots DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION beta2_validate_snapshot_event_pair();
CREATE CONSTRAINT TRIGGER beta2_project_events_snapshot_pair AFTER INSERT ON beta2_project_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION beta2_validate_snapshot_event_pair();

REVOKE ALL ON TABLE beta2_generation_jobs,beta2_generation_receipts,beta2_project_snapshots,beta2_project_events,beta2_operation_intents FROM PUBLIC,old_mike_beta2_app;
GRANT USAGE ON SCHEMA public,old_mike_beta2_private TO old_mike_beta2_app;
GRANT SELECT ON projects,workspace_members,beta2_generation_jobs,beta2_generation_receipts,beta2_project_snapshots,beta2_project_events,beta2_operation_intents TO old_mike_beta2_app;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA old_mike_beta2_private FROM PUBLIC,old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.reserve_generation_intent(text,text,text,text,text,text,text,bigint,text,jsonb) TO old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.mark_submission_started(text,text,text,text) TO old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.mark_completion_unknown(text,text,text,text) TO old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.commit_provider_success(text,text,text,text,bigint,text,text,jsonb,text,text) TO old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.mark_terminal_rejected(text,text,text,text,text) TO old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.save_direction_selection(text,text,text,text,text,text,bigint,text,text,jsonb,text) TO old_mike_beta2_app;
GRANT EXECUTE ON FUNCTION old_mike_beta2_private.save_confirmed_workspace(text,text,text,text,text,text,bigint,text,text,jsonb,text,text,jsonb,jsonb) TO old_mike_beta2_app;

REVOKE EXECUTE ON FUNCTION beta2_reject_append_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_guard_job_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_guard_snapshot_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_guard_job_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_guard_operation_intent_mutation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_guard_receipt_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_guard_event_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_validate_job_receipt_pair() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION beta2_validate_snapshot_event_pair() FROM PUBLIC;

COMMIT;
