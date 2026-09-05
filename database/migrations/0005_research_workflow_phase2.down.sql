BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM research_studies LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_datasets LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_analysis_plans LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_analysis_runs LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_evidence_sources LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_claims LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_claim_evidence LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_documents LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_human_gates LIMIT 1)
     OR EXISTS (SELECT 1 FROM research_workflow_events LIMIT 1) THEN
    RAISE EXCEPTION '0005_disposable_down_refused_formal_data_present';
  END IF;
END $$;
DROP TABLE research_workflow_events;
DROP TABLE research_human_gates;
DROP TABLE research_documents;
DROP TABLE research_claim_evidence;
DROP TABLE research_claims;
DROP TABLE research_evidence_sources;
DROP TABLE research_analysis_runs;
DROP TABLE research_analysis_plans;
DROP TABLE research_datasets;
DROP TABLE research_studies;
DROP FUNCTION research_append_only_guard();
COMMIT;
