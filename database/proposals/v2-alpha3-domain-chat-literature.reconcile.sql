SELECT
  (SELECT count(*) FROM research_domain_profiles) AS domain_profile_versions,
  (SELECT count(*) FROM research_conversation_events) AS conversation_events,
  (SELECT count(*) FROM research_generation_job_inputs) AS job_input_bindings,
  (SELECT count(*) FROM research_generation_jobs WHERE operation LIKE 'ALPHA3_%' AND state='RECONCILE_REQUIRED') AS reconcile_required_jobs,
  (SELECT count(*) FROM research_generation_effects e JOIN research_generation_jobs j ON j.id=e.job_id WHERE j.operation LIKE 'ALPHA3_%' AND e.effect_state='SUBMISSION_POSSIBLE') AS submission_possible_effects;
