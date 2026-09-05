SELECT CASE
  WHEN to_regclass('public.research_domain_profiles') IS NULL
    AND to_regclass('public.research_conversation_events') IS NULL
    AND to_regclass('public.research_generation_job_inputs') IS NULL THEN 'ABSENT'
  WHEN to_regclass('public.research_domain_profiles') IS NULL
    OR to_regclass('public.research_conversation_events') IS NULL
    OR to_regclass('public.research_generation_job_inputs') IS NULL THEN 'PARTIAL'
  WHEN to_regprocedure('public.reject_v2_alpha3_append_only_mutation()') IS NULL THEN 'PARTIAL'
  WHEN (SELECT count(*) FROM pg_trigger WHERE tgname IN ('research_domain_profiles_append_only','research_conversation_events_append_only','research_generation_job_inputs_append_only') AND NOT tgisinternal) <> 3 THEN 'PARTIAL'
  WHEN to_regclass('public.research_conversation_events_id_seq') IS NULL
    OR to_regclass('public.research_generation_job_inputs_id_seq') IS NULL THEN 'PARTIAL'
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid=to_regclass('public.research_generation_jobs')
      AND conname='research_generation_jobs_operation_alpha3_check'
      AND pg_get_constraintdef(oid) LIKE '%ALPHA3_CHAT_INSIGHTS%'
  ) THEN 'PARTIAL'
  WHEN EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_schema='public' AND table_name IN ('research_domain_profiles','research_conversation_events','research_generation_job_inputs')) THEN 'PARTIAL'
  WHEN EXISTS (SELECT 1 FROM information_schema.role_usage_grants WHERE grantee='PUBLIC' AND object_schema='public' AND object_name IN ('research_conversation_events_id_seq','research_generation_job_inputs_id_seq')) THEN 'PARTIAL'
  ELSE 'COMPLETE'
END AS alpha3_schema_state;
