-- Query-only Bytebase verification descriptor. Every lookup is safe when objects are absent.
WITH authority AS (
  SELECT to_regclass('public.research_generation_jobs') AS jobs,
         to_regclass('public.research_generation_effects') AS effects,
         to_regclass('public.research_generation_results') AS results
), classified AS (
  SELECT jobs,effects,results,
         ((jobs IS NOT NULL)::integer + (effects IS NOT NULL)::integer + (results IS NOT NULL)::integer) AS present_count
  FROM authority
)
SELECT CASE present_count WHEN 0 THEN 'ABSENT' WHEN 3 THEN 'COMPLETE' ELSE 'PARTIAL' END AS schema_class,
       jobs IS NOT NULL AS jobs_present,
       effects IS NOT NULL AS effects_present,
       results IS NOT NULL AS results_present
FROM classified;

SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'PUBLIC'
  AND table_schema = 'public'
  AND table_name IN ('research_generation_jobs', 'research_generation_effects', 'research_generation_results')
ORDER BY table_name, privilege_type;

SELECT object_name AS sequence_name, privilege_type
FROM information_schema.role_usage_grants
WHERE grantee = 'PUBLIC'
  AND object_schema = 'public'
  AND object_name IN ('research_generation_effects_id_seq', 'research_generation_results_id_seq')
ORDER BY sequence_name, privilege_type;

SELECT routine_name, privilege_type
FROM information_schema.role_routine_grants
WHERE grantee = 'PUBLIC'
  AND specific_schema = 'public'
  AND routine_name IN (
    'claim_research_generation_job',
    'purge_expired_research_generation_payloads',
    'enforce_research_generation_job_cas',
    'enforce_research_generation_effect_insert',
    'enforce_research_generation_effect_cas',
    'reject_research_generation_result_mutation'
  )
ORDER BY routine_name, privilege_type;

SELECT conrelid::regclass::text AS relation_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (
  to_regclass('public.research_generation_jobs'),
  to_regclass('public.research_generation_effects'),
  to_regclass('public.research_generation_results')
)
ORDER BY relation_name, conname;

SELECT indexrelid::regclass::text AS index_name, pg_get_indexdef(indexrelid) AS definition
FROM pg_index
WHERE indrelid IN (
  to_regclass('public.research_generation_jobs'),
  to_regclass('public.research_generation_effects'),
  to_regclass('public.research_generation_results')
)
ORDER BY index_name;

SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema='public'
  AND event_object_table IN ('research_generation_jobs','research_generation_effects','research_generation_results')
ORDER BY event_object_table,trigger_name,event_manipulation;
