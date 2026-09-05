DO $$
DECLARE
  object_count integer;
  constraint_count integer;
  index_count integer;
  trigger_count integer;
  public_grant_count integer;
  app_grant_count integer;
  app_function_count integer;
  security_definer_count integer;
BEGIN
  SELECT count(*) INTO object_count
  FROM unnest(ARRAY['beta2_generation_jobs','beta2_generation_receipts','beta2_project_snapshots','beta2_project_events','beta2_operation_intents']) AS name
  WHERE to_regclass('public.' || name) IS NOT NULL;
  IF object_count <> 5 THEN RAISE EXCEPTION 'beta2_verify_table_count:%', object_count; END IF;

  SELECT count(*) INTO constraint_count
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE n.nspname = 'public'
    AND r.relname = ANY(ARRAY['beta2_generation_jobs','beta2_generation_receipts','beta2_project_snapshots','beta2_project_events','beta2_operation_intents'])
    AND c.conname = ANY(ARRAY[
      'beta2_generation_jobs_project_fk','beta2_generation_jobs_actor_fk','beta2_generation_jobs_stage_instance_unique','beta2_generation_jobs_idempotency_unique','beta2_generation_jobs_request_unique','beta2_generation_jobs_state_shape',
      'beta2_generation_receipts_job_fk','beta2_generation_receipts_id_unique','beta2_generation_receipts_state_version_unique','beta2_generation_receipts_transition_xid_unique',
      'beta2_project_snapshots_project_fk','beta2_project_snapshots_actor_fk','beta2_project_snapshots_job_fk',
      'beta2_project_events_project_fk','beta2_project_events_actor_fk','beta2_project_events_job_fk','beta2_project_events_snapshot_fk','beta2_project_events_id_unique','beta2_project_events_transition_shape',
      'beta2_operation_intents_project_fk','beta2_operation_intents_actor_fk','beta2_operation_intents_idempotency_global','beta2_operation_intents_request_global','beta2_operation_intents_snapshot_fk','beta2_operation_intents_event_fk','beta2_operation_intents_state_shape'
    ]);
  IF constraint_count <> 26 THEN RAISE EXCEPTION 'beta2_verify_constraint_count:%', constraint_count; END IF;

  SELECT count(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = ANY(ARRAY[
      'beta2_generation_jobs_job_id_unique','beta2_generation_jobs_reconciliation_idx',
      'beta2_generation_receipts_submission_once','beta2_project_snapshots_hash_unique','beta2_project_events_hash_unique',
      'beta2_project_events_snapshot_unique','beta2_project_events_operation_idempotency_unique','beta2_project_events_operation_request_unique'
    ]);
  IF index_count <> 8 THEN RAISE EXCEPTION 'beta2_verify_index_count:%', index_count; END IF;

  SELECT count(*) INTO trigger_count
  FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
    AND t.tgname = ANY(ARRAY[
      'beta2_generation_jobs_guard','beta2_operation_intents_guard','beta2_generation_jobs_insert_guard','beta2_generation_receipts_append_only','beta2_project_snapshots_append_only','beta2_project_snapshots_insert_guard','beta2_project_events_append_only',
      'beta2_generation_receipts_insert_guard','beta2_project_events_insert_guard','beta2_generation_jobs_receipt_pair',
      'beta2_generation_receipts_job_pair','beta2_project_snapshots_event_pair','beta2_project_events_snapshot_pair'
    ])
    AND t.tgenabled IN ('O','A');
  IF trigger_count <> 13 THEN RAISE EXCEPTION 'beta2_verify_trigger_count:%', trigger_count; END IF;

  SELECT count(*) INTO public_grant_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY(ARRAY['projects','workspace_members','beta2_generation_jobs','beta2_generation_receipts','beta2_project_snapshots','beta2_project_events','beta2_operation_intents'])
    AND grantee = 'PUBLIC';
  IF public_grant_count <> 0 THEN RAISE EXCEPTION 'beta2_verify_public_grants:%', public_grant_count; END IF;

  SELECT count(*) INTO app_grant_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY(ARRAY['projects','workspace_members','beta2_generation_jobs','beta2_generation_receipts','beta2_project_snapshots','beta2_project_events','beta2_operation_intents'])
    AND grantee = 'old_mike_beta2_app';
  IF app_grant_count <> 7 THEN RAISE EXCEPTION 'beta2_verify_app_grants:%', app_grant_count; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ANY(ARRAY['beta2_generation_jobs','beta2_generation_receipts','beta2_project_snapshots','beta2_project_events','beta2_operation_intents'])
      AND grantee = 'old_mike_beta2_app'
      AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
  ) THEN RAISE EXCEPTION 'beta2_verify_raw_truth_write_privilege_invalid'; END IF;

  SELECT count(*) INTO security_definer_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
  WHERE n.nspname='old_mike_beta2_private' AND p.prosecdef=true AND r.rolname='old_mike_beta2_owner'
    AND p.proname=ANY(ARRAY['reserve_generation_intent','mark_submission_started','mark_completion_unknown','commit_provider_success','mark_terminal_rejected','save_direction_selection','save_confirmed_workspace'])
    AND 'search_path=pg_catalog'=ANY(COALESCE(p.proconfig,ARRAY[]::text[]))
    AND pg_get_functiondef(p.oid) !~* '\mEXECUTE\M';
  IF security_definer_count<>7 THEN RAISE EXCEPTION 'beta2_verify_security_definer_count:%',security_definer_count; END IF;

  SELECT count(*) INTO app_function_count
  FROM information_schema.routine_privileges
  WHERE specific_schema='old_mike_beta2_private' AND grantee='old_mike_beta2_app' AND privilege_type='EXECUTE'
    AND routine_name=ANY(ARRAY['reserve_generation_intent','mark_submission_started','mark_completion_unknown','commit_provider_success','mark_terminal_rejected','save_direction_selection','save_confirmed_workspace']);
  IF app_function_count<>7 THEN RAISE EXCEPTION 'beta2_verify_app_function_count:%',app_function_count; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE specific_schema='old_mike_beta2_private' AND grantee='PUBLIC' AND privilege_type='EXECUTE'
  ) THEN RAISE EXCEPTION 'beta2_verify_public_function_execute_invalid'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.routine_privileges
    WHERE specific_schema='old_mike_beta2_private' AND grantee='old_mike_beta2_app' AND privilege_type='EXECUTE'
      AND routine_name NOT IN ('reserve_generation_intent','mark_submission_started','mark_completion_unknown','commit_provider_success','mark_terminal_rejected','save_direction_selection','save_confirmed_workspace')
  ) THEN RAISE EXCEPTION 'beta2_verify_internal_function_execute_invalid'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'old_mike_beta2_app' AND rolsuper = false AND rolcreatedb = false AND rolcreaterole = false) THEN
    RAISE EXCEPTION 'beta2_verify_app_role_invalid';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'old_mike_beta2_owner' AND rolcanlogin=false AND rolsuper=false AND rolcreatedb=false AND rolcreaterole=false) THEN
    RAISE EXCEPTION 'beta2_verify_owner_role_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
     WHERE grantee='old_mike_beta2_app'
       AND table_schema='public'
       AND table_name IN ('research_documents','research_studies','research_human_gates','user','account','session')
  ) THEN RAISE EXCEPTION 'beta2_verify_formal_or_auth_grant_invalid'; END IF;
END;
$$;

SELECT 'BETA2_DURABLE_CORE_VERIFY=PASS';
