-- Query-only reconciliation inventory. Run only after verify.sql reports COMPLETE.
-- This query never changes job/effect/result state and never authorizes resubmission.
SELECT jobs.id AS job_ref,
       jobs.state,
       jobs.stage,
       jobs.completion_class,
       jobs.sanitized_error_code,
       effects.effect_state,
       effects.provider_attempt_class,
       jobs.state_version,
       jobs.lease_generation
FROM research_generation_jobs AS jobs
LEFT JOIN research_generation_effects AS effects ON effects.job_id=jobs.id
WHERE jobs.state='RECONCILE_REQUIRED'
   OR effects.effect_state IN ('SUBMISSION_POSSIBLE','COMPLETION_UNKNOWN')
ORDER BY jobs.created_at,jobs.id;
