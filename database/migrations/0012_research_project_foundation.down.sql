-- 0012: Research Project Foundation & Evidence Integration (rollback)
BEGIN;

DROP TABLE IF EXISTS zotero_connections;
DROP TABLE IF EXISTS citation_sources;
DROP TABLE IF EXISTS literature_analysis_cards;
DROP TABLE IF EXISTS literature_rq_links;
DROP TABLE IF EXISTS project_literature_links;
DROP TABLE IF EXISTS literature_items;
DROP TABLE IF EXISTS research_projects;
DROP TABLE IF EXISTS researcher_profiles;

COMMIT;
