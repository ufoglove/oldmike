-- Bytebase rollback proposal. Fail closed when any durable generation evidence exists.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM research_generation_jobs LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_generation_effects LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_generation_results LIMIT 1) THEN
    RAISE EXCEPTION 'research_generation_rows_present';
  END IF;
END;
$$;

DROP FUNCTION claim_research_generation_job(text, text, text, text, interval);
DROP FUNCTION purge_expired_research_generation_payloads(integer);
ALTER TABLE research_generation_jobs DROP CONSTRAINT research_generation_jobs_parent_result_fk;
DROP TABLE research_generation_results;
DROP TABLE research_generation_effects;
DROP TABLE research_generation_jobs;
DROP FUNCTION reject_research_generation_result_mutation();
DROP FUNCTION enforce_research_generation_effect_cas();
DROP FUNCTION enforce_research_generation_effect_insert();
DROP FUNCTION enforce_research_generation_job_cas();

COMMIT;
