-- Bytebase-ready proposal only. Baseline: production 0001..0006 plus the unapplied Alpha2 proposal.
-- Alpha3 must not apply this file online.
BEGIN;

ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_operation_check;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_operation_alpha3_check CHECK (operation IN (
  'GENERATE_DIRECTIONS','EXPAND_SELECTED_S0','FIELD_ASSIST',
  'ALPHA3_CHAT_INSIGHTS','ALPHA3_OPENALEX_QUERY','ALPHA3_SEMANTIC_SCHOLAR_QUERY','ALPHA3_LITERATURE_SYNTHESIS'
));
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_operation_contract_version_check;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_contract_version_alpha3_check CHECK (operation_contract_version IN ('old-mike-v2-alpha2/1.0.0','old-mike-v2-alpha3/1.0.0'));
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_payload_schema_id_check;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_payload_schema_alpha3_check CHECK (payload_schema_id IN (
  'old-mike-v2-alpha2/generate-directions-input/1','old-mike-v2-alpha2/expand-s0-input/1','old-mike-v2-alpha2/field-assist-input/1',
  'old-mike-v2-alpha3/chat-input/1','old-mike-v2-alpha3/openalex-input/1','old-mike-v2-alpha3/semantic-scholar-input/1','old-mike-v2-alpha3/literature-synthesis-input/1'
));
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_lineage;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_lineage_alpha3 CHECK (
  (operation = 'GENERATE_DIRECTIONS' AND root_job_id = id AND parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL)
  OR (operation = 'EXPAND_SELECTED_S0' AND parent_workspace_id = workspace_id AND parent_created_by_user_id = created_by_user_id AND parent_job_id IS NOT NULL AND parent_result_id IS NOT NULL AND selected_item_hash IS NOT NULL)
  OR (operation = 'FIELD_ASSIST' AND ((parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL) OR (parent_workspace_id = workspace_id AND parent_created_by_user_id = created_by_user_id AND parent_job_id IS NOT NULL AND parent_result_id IS NOT NULL AND selected_item_hash IS NOT NULL)))
  OR (operation IN ('ALPHA3_CHAT_INSIGHTS','ALPHA3_OPENALEX_QUERY','ALPHA3_SEMANTIC_SCHOLAR_QUERY','ALPHA3_LITERATURE_SYNTHESIS') AND root_job_id = id AND parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL)
);

ALTER TABLE research_generation_results DROP CONSTRAINT research_generation_results_schema_id_check;
ALTER TABLE research_generation_results ADD CONSTRAINT research_generation_results_schema_alpha3_check CHECK (schema_id IN (
  'old-mike-v2-alpha2/directions/1','old-mike-v2-alpha2/s0/1','old-mike-v2-alpha2/field-assist/1',
  'old-mike-v2-alpha3/chat-insights/1','old-mike-v2-alpha3/openalex-result/1','old-mike-v2-alpha3/semantic-scholar-result/1','old-mike-v2-alpha3/literature-synthesis/1'
));

CREATE TABLE research_domain_profiles (
  workspace_id text NOT NULL,
  created_by_user_id text NOT NULL,
  profile_id text NOT NULL CHECK (profile_id ~ '^dp_[a-z0-9]{24,64}$'),
  version integer NOT NULL CHECK (version >= 1),
  lifecycle_state text NOT NULL CHECK (lifecycle_state IN ('ACTIVE','ARCHIVED')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  normalized_name text NOT NULL CHECK (char_length(normalized_name) BETWEEN 1 AND 120),
  included_keywords text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(included_keywords) <= 12),
  excluded_keywords text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(excluded_keywords) <= 12),
  content_hash char(64) NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  supersedes_version integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (workspace_id, created_by_user_id, profile_id, version),
  CONSTRAINT research_domain_profiles_member_fk FOREIGN KEY (workspace_id, created_by_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT research_domain_profiles_supersedes_fk FOREIGN KEY (workspace_id, created_by_user_id, profile_id, supersedes_version) REFERENCES research_domain_profiles(workspace_id, created_by_user_id, profile_id, version) ON DELETE RESTRICT,
  CONSTRAINT research_domain_profiles_version_chain CHECK ((version = 1 AND supersedes_version IS NULL) OR (version > 1 AND supersedes_version = version - 1)),
  CONSTRAINT research_domain_profiles_keyword_disjoint CHECK (NOT included_keywords && excluded_keywords),
  CONSTRAINT research_domain_profiles_content_unique UNIQUE (workspace_id, created_by_user_id, profile_id, content_hash)
);

CREATE TABLE research_conversation_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id text NOT NULL,
  created_by_user_id text NOT NULL,
  conversation_ref text NOT NULL CHECK (conversation_ref ~ '^vc_[a-z0-9]{24,64}$'),
  event_no integer NOT NULL CHECK (event_no >= 1),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 16 AND 160),
  request_hash char(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  event_kind text NOT NULL CHECK (event_kind IN ('USER_MESSAGE','OLD_MIKE_INSIGHTS','PROMOTION_REQUEST','PROJECT_IMPORT_CONFIRMED')),
  domain_kind text NOT NULL CHECK (domain_kind IN ('BUILTIN','CUSTOM')),
  domain_id text,
  domain_profile_id text,
  domain_profile_version integer,
  domain_profile_content_hash char(64),
  domain_selection_hash char(64) NOT NULL CHECK (domain_selection_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) BETWEEN 2 AND 24576),
  payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  effect_job_id text,
  formal_write_count integer NOT NULL DEFAULT 0 CHECK (formal_write_count = 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT research_conversation_events_member_fk FOREIGN KEY (workspace_id, created_by_user_id) REFERENCES workspace_members(workspace_id, user_id) ON DELETE RESTRICT,
  CONSTRAINT research_conversation_events_profile_fk FOREIGN KEY (workspace_id, created_by_user_id, domain_profile_id, domain_profile_version) REFERENCES research_domain_profiles(workspace_id, created_by_user_id, profile_id, version) ON DELETE RESTRICT,
  CONSTRAINT research_conversation_events_effect_job_fk FOREIGN KEY (workspace_id, created_by_user_id, effect_job_id) REFERENCES research_generation_jobs(workspace_id, created_by_user_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_conversation_events_domain_shape CHECK ((domain_kind='BUILTIN' AND domain_id IS NOT NULL AND domain_profile_id IS NULL AND domain_profile_version IS NULL AND domain_profile_content_hash IS NULL) OR (domain_kind='CUSTOM' AND domain_id IS NULL AND domain_profile_id IS NOT NULL AND domain_profile_version IS NOT NULL AND domain_profile_content_hash IS NOT NULL)),
  CONSTRAINT research_conversation_events_sequence_unique UNIQUE (workspace_id, created_by_user_id, conversation_ref, event_no),
  CONSTRAINT research_conversation_events_request_unique UNIQUE (workspace_id, created_by_user_id, request_id)
);

CREATE TABLE research_generation_job_inputs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id text NOT NULL,
  created_by_user_id text NOT NULL,
  job_id text NOT NULL,
  input_no smallint NOT NULL CHECK (input_no BETWEEN 1 AND 16),
  input_kind text NOT NULL CHECK (input_kind IN ('DOMAIN_SELECTION','CHAT_INSIGHT','CONNECTOR_RESULT','SYNTHESIS_INPUT')),
  domain_selection_hash char(64) NOT NULL CHECK (domain_selection_hash ~ '^[0-9a-f]{64}$'),
  insight_card_hash char(64) CHECK (insight_card_hash IS NULL OR insight_card_hash ~ '^[0-9a-f]{64}$'),
  source_workspace_id text,
  source_created_by_user_id text,
  source_job_id text,
  source_result_id bigint,
  source_selected_item_hash char(64),
  input_payload jsonb NOT NULL CHECK (jsonb_typeof(input_payload)='object' AND octet_length(input_payload::text) BETWEEN 2 AND 24576),
  input_hash char(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT research_generation_job_inputs_job_fk FOREIGN KEY (workspace_id, created_by_user_id, job_id) REFERENCES research_generation_jobs(workspace_id, created_by_user_id, id) ON DELETE RESTRICT,
  CONSTRAINT research_generation_job_inputs_result_fk FOREIGN KEY (source_workspace_id, source_created_by_user_id, source_job_id, source_result_id, source_selected_item_hash) REFERENCES research_generation_results(workspace_id, created_by_user_id, job_id, id, selected_item_hash) MATCH FULL ON DELETE RESTRICT,
  CONSTRAINT research_generation_job_inputs_source_scope CHECK ((source_result_id IS NULL AND source_workspace_id IS NULL AND source_created_by_user_id IS NULL AND source_job_id IS NULL AND source_selected_item_hash IS NULL) OR (source_workspace_id=workspace_id AND source_created_by_user_id=created_by_user_id AND source_job_id IS NOT NULL AND source_result_id IS NOT NULL AND source_selected_item_hash IS NOT NULL)),
  CONSTRAINT research_generation_job_inputs_number_unique UNIQUE (workspace_id, created_by_user_id, job_id, input_no),
  CONSTRAINT research_generation_job_inputs_hash_unique UNIQUE (workspace_id, created_by_user_id, job_id, input_hash)
);

CREATE OR REPLACE FUNCTION reject_v2_alpha3_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'v2_alpha3_append_only'; END;
$$;
CREATE TRIGGER research_domain_profiles_append_only BEFORE UPDATE OR DELETE ON research_domain_profiles FOR EACH ROW EXECUTE FUNCTION reject_v2_alpha3_append_only_mutation();
CREATE TRIGGER research_conversation_events_append_only BEFORE UPDATE OR DELETE ON research_conversation_events FOR EACH ROW EXECUTE FUNCTION reject_v2_alpha3_append_only_mutation();
CREATE TRIGGER research_generation_job_inputs_append_only BEFORE UPDATE OR DELETE ON research_generation_job_inputs FOR EACH ROW EXECUTE FUNCTION reject_v2_alpha3_append_only_mutation();

CREATE INDEX research_domain_profiles_history_idx ON research_domain_profiles(workspace_id,created_by_user_id,profile_id,version DESC);
CREATE INDEX research_domain_profiles_name_idx ON research_domain_profiles(workspace_id,created_by_user_id,normalized_name,version DESC);
CREATE INDEX research_conversation_events_timeline_idx ON research_conversation_events(workspace_id,created_by_user_id,conversation_ref,event_no);
CREATE INDEX research_generation_job_inputs_domain_idx ON research_generation_job_inputs(workspace_id,created_by_user_id,domain_selection_hash,created_at DESC);

REVOKE ALL ON research_domain_profiles,research_conversation_events,research_generation_job_inputs FROM PUBLIC;
REVOKE ALL ON SEQUENCE research_conversation_events_id_seq,research_generation_job_inputs_id_seq FROM PUBLIC;
COMMIT;
