-- 0008: Research Provenance chain (workspace-level, append-only)
-- RadarOpportunity -> InspirationRun -> ResearchIdea -> TopicEvaluation
-- Each record keeps parent_id so a research project can be traced back to the
-- radar opportunity and the scholarly evidence that produced it.

BEGIN;

CREATE TABLE radar_opportunities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  created_by_user_id TEXT NOT NULL REFERENCES "user"(id),
  scan_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  trend TEXT,
  maturity TEXT,
  opportunity_score INTEGER NOT NULL,
  grade TEXT NOT NULL,
  summary TEXT,
  signals JSONB NOT NULL DEFAULT '[]',
  gap_signals JSONB NOT NULL DEFAULT '[]',
  evidence JSONB NOT NULL DEFAULT '[]',
  evidence_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  generated_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (workspace_id, scan_id, opportunity_id)
);

CREATE TABLE inspiration_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  created_by_user_id TEXT NOT NULL REFERENCES "user"(id),
  radar_opportunity_id TEXT,
  focus TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT 'AUTO',
  input_hash TEXT NOT NULL,
  evidence_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  generated_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL
);

CREATE TABLE research_ideas (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  created_by_user_id TEXT NOT NULL REFERENCES "user"(id),
  inspiration_run_id TEXT,
  idea_index INTEGER NOT NULL,
  idea_type TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  research_question TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL,
  evidence_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  content_hash TEXT NOT NULL
);

CREATE TABLE topic_evaluations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  created_by_user_id TEXT NOT NULL REFERENCES "user"(id),
  idea_id TEXT,
  topic_title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parameters JSONB NOT NULL DEFAULT '{}',
  decomposition JSONB NOT NULL DEFAULT '[]',
  gap_matrix JSONB NOT NULL DEFAULT '[]',
  novelty JSONB NOT NULL DEFAULT '{}',
  score JSONB NOT NULL DEFAULT '{}',
  reviewer2 JSONB NOT NULL DEFAULT '[]',
  recommended_next_step TEXT,
  evidence_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  generated_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL
);

-- Append-only protection mirrors the research_* tables.
CREATE TRIGGER radar_opportunities_append_only BEFORE UPDATE OR DELETE ON radar_opportunities
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER inspiration_runs_append_only BEFORE UPDATE OR DELETE ON inspiration_runs
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER research_ideas_append_only BEFORE UPDATE OR DELETE ON research_ideas
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();
CREATE TRIGGER topic_evaluations_append_only BEFORE UPDATE OR DELETE ON topic_evaluations
  FOR EACH ROW EXECUTE FUNCTION research_append_only_guard();

CREATE INDEX radar_opportunities_ws_scan_idx ON radar_opportunities (workspace_id, scan_id);
CREATE INDEX inspiration_runs_ws_created_idx ON inspiration_runs (workspace_id, created_by_user_id);
CREATE INDEX research_ideas_ws_run_idx ON research_ideas (workspace_id, inspiration_run_id);
CREATE INDEX topic_evaluations_ws_idea_idx ON topic_evaluations (workspace_id, idea_id);

COMMIT;
