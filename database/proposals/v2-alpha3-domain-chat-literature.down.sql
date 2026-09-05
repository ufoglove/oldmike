BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM research_domain_profiles LIMIT 1) OR EXISTS (SELECT 1 FROM research_conversation_events LIMIT 1) OR EXISTS (SELECT 1 FROM research_generation_job_inputs LIMIT 1) THEN
    RAISE EXCEPTION 'v2_alpha3_down_refuses_nonempty_tables';
  END IF;
END $$;
DROP TABLE research_generation_job_inputs;
DROP TABLE research_conversation_events;
DROP TABLE research_domain_profiles;
DROP FUNCTION reject_v2_alpha3_append_only_mutation();
ALTER TABLE research_generation_results DROP CONSTRAINT research_generation_results_schema_alpha3_check;
ALTER TABLE research_generation_results ADD CONSTRAINT research_generation_results_schema_id_check CHECK (schema_id IN ('old-mike-v2-alpha2/directions/1','old-mike-v2-alpha2/s0/1','old-mike-v2-alpha2/field-assist/1'));
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_lineage_alpha3;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_lineage CHECK ((operation='GENERATE_DIRECTIONS' AND root_job_id=id AND parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL) OR (operation='EXPAND_SELECTED_S0' AND parent_workspace_id=workspace_id AND parent_created_by_user_id=created_by_user_id AND parent_job_id IS NOT NULL AND parent_result_id IS NOT NULL AND selected_item_hash IS NOT NULL) OR (operation='FIELD_ASSIST' AND ((parent_workspace_id IS NULL AND parent_created_by_user_id IS NULL AND parent_job_id IS NULL AND parent_result_id IS NULL AND selected_item_hash IS NULL) OR (parent_workspace_id=workspace_id AND parent_created_by_user_id=created_by_user_id AND parent_job_id IS NOT NULL AND parent_result_id IS NOT NULL AND selected_item_hash IS NOT NULL))));
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_payload_schema_alpha3_check;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_payload_schema_id_check CHECK (payload_schema_id IN ('old-mike-v2-alpha2/generate-directions-input/1','old-mike-v2-alpha2/expand-s0-input/1','old-mike-v2-alpha2/field-assist-input/1'));
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_contract_version_alpha3_check;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_operation_contract_version_check CHECK (operation_contract_version='old-mike-v2-alpha2/1.0.0');
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_operation_alpha3_check;
ALTER TABLE research_generation_jobs ADD CONSTRAINT research_generation_jobs_operation_check CHECK (operation IN ('GENERATE_DIRECTIONS','EXPAND_SELECTED_S0','FIELD_ASSIST'));
COMMIT;
