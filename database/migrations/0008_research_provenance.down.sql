-- 0008 down: drop research provenance chain
BEGIN;
DROP TRIGGER IF EXISTS topic_evaluations_append_only ON topic_evaluations;
DROP TRIGGER IF EXISTS research_ideas_append_only ON research_ideas;
DROP TRIGGER IF EXISTS inspiration_runs_append_only ON inspiration_runs;
DROP TRIGGER IF EXISTS radar_opportunities_append_only ON radar_opportunities;
DROP TABLE IF EXISTS topic_evaluations;
DROP TABLE IF EXISTS research_ideas;
DROP TABLE IF EXISTS inspiration_runs;
DROP TABLE IF EXISTS radar_opportunities;
COMMIT;
