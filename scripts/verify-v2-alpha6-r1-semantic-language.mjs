import assert from "node:assert/strict";

import { preservationFingerprint } from "../lib/academic-language-contract.ts";
import { V2_ALPHA6_LANGUAGE_ALTERNATIVES } from "../lib/v2-alpha6/contracts.ts";
import { createAlpha6LanguageAssistance } from "../lib/v2-alpha6/runtime.ts";
import { V2_ALPHA6_R1_SEMANTIC_FIXTURES } from "../lib/v2-alpha6-r1/semantic-language-fixtures.ts";

let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };

function exactPreservation(source, revision, fixtureId) {
  const before = preservationFingerprint(source);
  const after = preservationFingerprint(revision);
  for (const key of ["citations", "numbers", "units", "formulas"]) equal(after[key], before[key], `${fixtureId} ${key} exact`);
}

function targetScript(task, revision, fixtureId) {
  if (task === "ZH_TW_TO_EN") ok(!/[\u3400-\u9fff]/u.test(revision), `${fixtureId} English target script`);
  if (task === "EN_TO_ZH_TW") ok(/[\u3400-\u9fff]/u.test(revision), `${fixtureId} Taiwan Traditional Chinese target script`);
}

function semanticCautionProfile(value) {
  const normalized = value.toLocaleLowerCase("en-US");
  const uncertainty = [...normalized.matchAll(/\b(?:unverified|uncertain)\b|has not been verified|尚未驗證|未驗證|不確定/gu)].length;
  const withoutUncertainty = normalized.replace(/\b(?:unverified|uncertain)\b|has not been verified|尚未驗證|未驗證|不確定/gu, " ");
  return {
    possibility: [...withoutUncertainty.matchAll(/\b(?:may|might|could|possibly)\b|可能|或許|可望/gu)].length,
    uncertainty,
    negation: [...withoutUncertainty.matchAll(/\b(?:not|no|cannot|fail|fails|failed|prevent|prevents|prevented)\b|尚未|未能|並未|不能|無法|未/gu)].length,
  };
}

for (const fixture of V2_ALPHA6_R1_SEMANTIC_FIXTURES) {
  console.log(`SEMANTIC_FIXTURE=${fixture.fixtureId}`);
  for (const strategy of V2_ALPHA6_LANGUAGE_ALTERNATIVES) equal(semanticCautionProfile(fixture.outputs[strategy].revision), semanticCautionProfile(fixture.source), `${fixture.fixtureId} ${strategy} modality negation uncertainty`);
  const result = createAlpha6LanguageAssistance(fixture.task, fixture.source);
  equal(result.options.map((option) => option.strategy), [...V2_ALPHA6_LANGUAGE_ALTERNATIVES], `${fixture.fixtureId} exact strategies`);
  equal(result.options.filter((option) => option.recommended).map((option) => option.strategy), ["PRECISE_JOURNAL_FORMAL"], `${fixture.fixtureId} exact recommendation`);
  equal(new Set(result.options.map((option) => option.revision)).size, 3, `${fixture.fixtureId} distinct revisions`);
  for (const option of result.options) {
    const expected = fixture.outputs[option.strategy];
    equal(option.revision, expected.revision, `${fixture.fixtureId} ${option.strategy} authored semantic output`);
    equal(option.reason, expected.reason, `${fixture.fixtureId} ${option.strategy} concrete reason`);
    equal(option.risk, expected.risk, `${fixture.fixtureId} ${option.strategy} concrete risk`);
    ok(!option.revision.includes(fixture.source), `${fixture.fixtureId} ${option.strategy} not source plus commentary`);
    for (const anchor of fixture.semanticAnchors) ok(option.revision.toLocaleLowerCase("en-US").includes(anchor.toLocaleLowerCase("en-US")), `${fixture.fixtureId} ${option.strategy} preserves ${anchor}`);
    exactPreservation(fixture.source, option.revision, `${fixture.fixtureId} ${option.strategy}`);
    targetScript(fixture.task, option.revision, `${fixture.fixtureId} ${option.strategy}`);
  }
}

assert.throws(() => createAlpha6LanguageAssistance("ACADEMIC_EN_EDIT", "Arbitrary text outside the authored local semantic fixture corpus."), /alpha6_fixture_input_unsupported/u);
assertions += 1;
console.log(JSON.stringify({ status: "PASS", fixtures: V2_ALPHA6_R1_SEMANTIC_FIXTURES.length, tasks: 4, alternativesPerTask: 3, assertions, unsupported: "FAIL_CLOSED", externalCalls: 0 }));
