-- 0012: Research Project Foundation & Evidence Integration
-- ResearchProject entity, researcher profiles, canonical literature library,
-- project-literature links, RQ links, analysis cards, citation sources, Zotero connections.
BEGIN;

-- 1. researcher_profiles — per-user research profile (server-side storage; navigator previously had none)
CREATE TABLE researcher_profiles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  position text,
  academic_expertise jsonb NOT NULL DEFAULT '[]',
  teaching_expertise jsonb NOT NULL DEFAULT '[]',
  recent_papers jsonb NOT NULL DEFAULT '[]',
  recent_grants jsonb NOT NULL DEFAULT '[]',
  teaching_outcomes jsonb NOT NULL DEFAULT '[]',
  tech_outcomes jsonb NOT NULL DEFAULT '[]',
  available_equipment jsonb NOT NULL DEFAULT '[]',
  available_data jsonb NOT NULL DEFAULT '[]',
  collaborators jsonb NOT NULL DEFAULT '[]',
  active_grants jsonb NOT NULL DEFAULT '[]',
  past_grants jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- 2. research_projects — formal Research Project entity inheriting topic + navigator outputs
CREATE TABLE research_projects (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  created_by_user_id text NOT NULL,
  project_name text NOT NULL,
  project_type text NOT NULL CHECK (project_type IN ('NSTC', 'MOE_TEACHING_PRACTICE', 'JOURNAL_MANUSCRIPT', 'GENERAL')),
  topic_id text,
  topic_version text,
  submission_navigator_id text,
  researcher_profile_id text,
  current_stage text NOT NULL DEFAULT 'BLUEPRINT' CHECK (current_stage IN ('BLUEPRINT', 'LITERATURE', 'DESIGN', 'ETHICS', 'DATA', 'STATISTICS', 'MANUSCRIPT', 'SUBMISSION')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  blueprint_payload jsonb NOT NULL DEFAULT '{}',
  zotero_library_type text CHECK (zotero_library_type IN ('user', 'group')),
  zotero_library_id text,
  zotero_collection_key text,
  last_synced_at timestamptz,
  zotero_sync_status text NOT NULL DEFAULT 'NOT_LINKED' CHECK (zotero_sync_status IN ('NOT_LINKED', 'CONNECTED', 'SYNCING', 'SYNCED', 'SYNC_CONFLICT', 'SYNC_ERROR')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT research_projects_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT research_projects_run_fk FOREIGN KEY (submission_navigator_id) REFERENCES submission_navigator_runs(id) ON DELETE SET NULL,
  CONSTRAINT research_projects_profile_fk FOREIGN KEY (researcher_profile_id) REFERENCES researcher_profiles(id) ON DELETE SET NULL
);

-- 3. literature_items — canonical literature records (single source of truth for the whole workspace)
CREATE TABLE literature_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id text NOT NULL,
  title text NOT NULL,
  authors jsonb NOT NULL DEFAULT '[]',
  year integer,
  journal text,
  doi text,
  abstract text,
  item_type text,
  url text,
  tags jsonb NOT NULL DEFAULT '[]',
  citation_count integer,
  zotero_item_key text,
  zotero_collection_key text,
  zotero_library_type text CHECK (zotero_library_type IN ('user', 'group')),
  zotero_library_id text,
  normalized_title text NOT NULL,
  source text NOT NULL CHECK (source IN ('WEB_SEARCH', 'ZOTERO_IMPORT', 'MANUAL', 'NAVIGATOR_IMPORT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, doi)
);
CREATE UNIQUE INDEX literature_items_zotero_key_uidx ON literature_items(workspace_id, zotero_item_key) WHERE zotero_item_key IS NOT NULL;
CREATE UNIQUE INDEX literature_items_norm_title_year_uidx ON literature_items(workspace_id, normalized_title, year) WHERE year IS NOT NULL;

-- 4. project_literature_links — many-to-many project <-> literature with role/reading/evidence state
CREATE TABLE project_literature_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  literature_id text NOT NULL,
  created_by_user_id text NOT NULL,
  role jsonb NOT NULL DEFAULT '[]',
  priority integer CHECK (priority BETWEEN 1 AND 5),
  reading_status text NOT NULL DEFAULT 'DISCOVERED' CHECK (reading_status IN ('DISCOVERED', 'ABSTRACT_REVIEWED', 'FULLTEXT_AVAILABLE', 'FULLTEXT_REVIEWED', 'KEY_PAPER', 'EXCLUDED')),
  evidence_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (evidence_status IN ('VERIFIED', 'SUPPORTED', 'INFERRED', 'UNVERIFIED')),
  relevance_score integer CHECK (relevance_score BETWEEN 0 AND 100),
  notes text,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_literature_links_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT project_literature_links_item_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, literature_id)
);

-- 5. literature_rq_links — literature <-> research question relationships
CREATE TABLE literature_rq_links (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  literature_id text NOT NULL,
  rq_key text NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('SUPPORTS', 'THEORY', 'METHOD', 'MEASUREMENT', 'COMPARES', 'BACKGROUND', 'GAP', 'DISCUSSION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT literature_rq_links_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT literature_rq_links_item_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, literature_id, rq_key, relationship)
);

-- 6. literature_analysis_cards — per-project per-paper 12-field research analysis card
CREATE TABLE literature_analysis_cards (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  literature_id text NOT NULL,
  created_by_user_id text NOT NULL,
  research_problem text,
  theory text,
  population text,
  method text,
  variables text,
  main_findings text,
  limitations text,
  future_research text,
  research_gap text,
  supports_my_project text,
  differs_from_my_project text,
  useful_for_sections jsonb NOT NULL DEFAULT '[]',
  user_notes text,
  old_mike_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT literature_analysis_cards_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT literature_analysis_cards_item_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, literature_id)
);

-- 7. citation_sources — citation pipeline reserved for future manuscript writing
CREATE TABLE citation_sources (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  literature_id text NOT NULL,
  zotero_item_key text,
  citation_key text,
  doi text,
  verified_metadata jsonb NOT NULL DEFAULT '{}',
  used_in_sections jsonb NOT NULL DEFAULT '[]',
  supporting_claims jsonb NOT NULL DEFAULT '[]',
  citation_status text NOT NULL DEFAULT 'PLANNED' CHECK (citation_status IN ('PLANNED', 'CITED', 'VERIFIED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT citation_sources_project_fk FOREIGN KEY (workspace_id, project_id) REFERENCES projects(workspace_id, project_id) ON DELETE CASCADE,
  CONSTRAINT citation_sources_item_fk FOREIGN KEY (literature_id) REFERENCES literature_items(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, literature_id)
);

-- 8. zotero_connections — per-user Zotero credentials (encrypted, server-side only)
CREATE TABLE zotero_connections (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  library_type text NOT NULL CHECK (library_type IN ('user', 'group')),
  library_id text NOT NULL,
  collection_key text,
  collection_name text,
  auth_method text NOT NULL CHECK (auth_method IN ('API_KEY', 'OAUTH')),
  credentials_enc text,
  last_synced_at timestamptz,
  sync_status text NOT NULL DEFAULT 'DISCONNECTED' CHECK (sync_status IN ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Indexes
CREATE INDEX research_projects_project_idx ON research_projects(workspace_id, project_id);
CREATE INDEX literature_items_workspace_idx ON literature_items(workspace_id);
CREATE INDEX project_literature_links_project_idx ON project_literature_links(workspace_id, project_id);
CREATE INDEX project_literature_links_literature_idx ON project_literature_links(workspace_id, literature_id);
CREATE INDEX literature_rq_links_project_idx ON literature_rq_links(workspace_id, project_id);
CREATE INDEX literature_rq_links_literature_idx ON literature_rq_links(workspace_id, literature_id);
CREATE INDEX literature_analysis_cards_project_idx ON literature_analysis_cards(workspace_id, project_id);
CREATE INDEX citation_sources_project_idx ON citation_sources(workspace_id, project_id);

COMMIT;
