import assert from "node:assert/strict";
import { Pool } from "pg";

import { createInsightCard, createBuiltinDomainSelection, createCustomDomainSelection } from "../lib/v2-alpha3/contracts.ts";
import { V2Alpha3PostgresRepository, V2Alpha3RepositoryError } from "../lib/v2-alpha3/repository.ts";
import { V2Alpha2PostgresRepository } from "../lib/v2-alpha2/repository.ts";

if (process.env.INTEGRATION_TEST_MODE !== "1" || process.env.TEST_FIXTURE !== "1" || !process.env.DATABASE_URL) throw new Error("alpha3_postgres_fixture_authority_missing");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (actual, message) => { assertions += 1; assert.ok(actual, message); };

try {
  await pool.query(`
    INSERT INTO "user"(id,name,email,"emailVerified") VALUES
      ('fixture-user-v2','Alpha3 Fixture','alpha3@example.invalid',true),
      ('fixture-user-other','Other Fixture','alpha3-other@example.invalid',true);
    INSERT INTO workspaces(id,name,owner_user_id) VALUES
      ('fixture-workspace-v2','Alpha3 Workspace','fixture-user-v2'),
      ('fixture-workspace-other','Other Workspace','fixture-user-other');
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES
      ('fixture-workspace-v2','fixture-user-v2','owner'),
      ('fixture-workspace-other','fixture-user-other','owner');
    INSERT INTO projects(project_id,workspace_id,created_by,title,status,legacy,storage_backend) VALUES
      ('fixture-project-v2','fixture-workspace-v2','fixture-user-v2','Synthetic project','ACTIVE',false,'POSTGRES_INDEX_PENDING_SAFE_STORAGE');
  `);

  const principal = { workspaceId: "fixture-workspace-v2", userId: "fixture-user-v2" };
  const repository = new V2Alpha3PostgresRepository(pool, principal);
  const created = await repository.createProfile({ name: "AI 教育決策", includedKeywords: ["教師", "證據"], excludedKeywords: ["個資"] });
  equal(created.profileVersion, 1, "profile version one");
  await assert.rejects(() => repository.createProfile({ name: "ＡＩ　教育決策" }), (error) => error instanceof V2Alpha3RepositoryError && error.code === "PROFILE_CONFLICT"); assertions += 1;
  const revised = await repository.reviseProfile({ profileId: created.profileId, expectedVersion: 1, name: "AI 教育決策與證據", includedKeywords: ["教師", "證據"], excludedKeywords: ["個資"] });
  equal(revised.profileVersion, 2, "edit appends version");
  await assert.rejects(() => repository.reviseProfile({ profileId: created.profileId, expectedVersion: 1, name: "stale" }), (error) => error instanceof V2Alpha3RepositoryError && error.code === "VERSION_CONFLICT"); assertions += 1;
  const archived = await repository.archiveProfile({ profileId: created.profileId, expectedVersion: 2 });
  equal(archived.version, 3, "archive appends version");
  const history = await repository.listProfileHistory();
  equal(history.map((item) => item.version), [1, 2, 3], "history preserved");
  await repository.resolveDomainSelection(created);
  await repository.resolveDomainSelection(revised);
  await repository.resolveDomainSelection(createCustomDomainSelection({ profileId: archived.profileId, version: archived.version, name: revised.label, contentHash: archived.contentHash }));
  assertions += 1;
  const triggerBlocked = await pool
    .query("UPDATE research_domain_profiles SET name='forbidden' WHERE workspace_id='fixture-workspace-v2'")
    .then(() => false, () => true);
  equal(triggerBlocked, true, "append-only profile trigger");

  const builtin = createBuiltinDomainSelection("ai-education");
  const card = createInsightCard({ kind: "direction", title: "證據校準與課程決策", researchQuestion: "哪些證據促使教師修正課程決策？", mechanism: "證據可見性影響信任校準。", value: "形成可反駁的決策機制。", domainFit: "限定於 AI 應用於教育。", evidenceBoundary: "UNVERIFIED", assumptions: ["尚未檢索文獻"], nextAction: "發展為三方向" });
  const event = await repository.appendConversationEvent({ eventNo: 1, requestId: "alpha3-event-fixture-0001", eventKind: "OLD_MIKE_INSIGHTS", domainSelection: builtin, payload: { insights: [card] } });
  const replay = await repository.appendConversationEvent({ conversationRef: event.conversationRef, eventNo: 1, requestId: "alpha3-event-fixture-0001", eventKind: "OLD_MIKE_INSIGHTS", domainSelection: builtin, payload: { insights: [card] } });
  equal(replay.replayed, true, "event replay exact");
  await assert.rejects(() => repository.appendConversationEvent({ conversationRef: event.conversationRef, eventNo: 2, requestId: "alpha3-event-fixture-0001", eventKind: "OLD_MIKE_INSIGHTS", domainSelection: builtin, payload: { changed: true } }), (error) => error instanceof V2Alpha3RepositoryError && error.code === "IDEMPOTENCY_CONFLICT"); assertions += 1;

  const alpha2 = new V2Alpha2PostgresRepository(pool, principal);
  const journey = await alpha2.create({ requestId: "alpha3-promotion-fixture-0001", operation: "GENERATE_DIRECTIONS", payloadSchemaId: "old-mike-v2-alpha2/generate-directions-input/1", requestPayload: { researchDirection: card.researchQuestion, sourceStrategy: "NONE", alpha3Promotion: { domainSelectionHash: builtin.selectionHash, insightCardHash: card.hash } } });
  const binding1 = await repository.bindGenerationInput({ jobId: journey.jobRef, inputNo: 1, inputKind: "DOMAIN_SELECTION", domainSelection: builtin, payload: { domainSelectionHash: builtin.selectionHash } });
  const binding2 = await repository.bindGenerationInput({ jobId: journey.jobRef, inputNo: 2, inputKind: "CHAT_INSIGHT", domainSelection: builtin, insightCard: card, payload: { insightCardHash: card.hash } });
  equal(binding1.replayed, false, "domain binding inserted"); equal(binding2.replayed, false, "card binding inserted");
  equal((await repository.bindGenerationInput({ jobId: journey.jobRef, inputNo: 1, inputKind: "DOMAIN_SELECTION", domainSelection: builtin, payload: { domainSelectionHash: builtin.selectionHash } })).replayed, true, "binding replay exact");
  const bindings = await repository.getGenerationInputBindings(journey.jobRef);
  equal(bindings.map((item) => item.inputKind), ["DOMAIN_SELECTION", "CHAT_INSIGHT"], "exact promotion inputs");

  const other = new V2Alpha3PostgresRepository(pool, { workspaceId: "fixture-workspace-other", userId: "fixture-user-other" });
  await assert.rejects(() => other.bindGenerationInput({ jobId: journey.jobRef, inputNo: 3, inputKind: "DOMAIN_SELECTION", domainSelection: builtin, payload: { domainSelectionHash: builtin.selectionHash } }), (error) => error instanceof V2Alpha3RepositoryError && error.code === "BINDING_CONFLICT"); assertions += 1;

  const formal = await pool.query("SELECT (SELECT count(*) FROM research_documents)::int + (SELECT count(*) FROM research_studies)::int + (SELECT count(*) FROM research_human_gates)::int AS count");
  equal(formal.rows[0].count, 0, "formal research writes zero");
  const publicGrants = await pool.query("SELECT count(*)::int AS count FROM information_schema.role_table_grants WHERE grantee='PUBLIC' AND table_name IN ('research_domain_profiles','research_conversation_events','research_generation_job_inputs')");
  equal(publicGrants.rows[0].count, 0, "public grants zero");
  ok((await pool.query("SELECT count(*)::int AS count FROM research_generation_job_inputs")).rows[0].count === 2, "exact binding rows");

  console.log(`PASS V2_ALPHA3_POSTGRES assertions=${assertions} profile_versions=3 conversation_events=1 input_bindings=2 formal_writes=0`);
} finally {
  await pool.end();
}
