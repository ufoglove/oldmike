import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../components/GuidedResearchCenter.tsx", import.meta.url), "utf8");
assert.match(source, /aria-required="true"/);
assert.match(source, /aria-describedby=/);
assert.match(source, /aria-invalid=/);
assert.match(source, /role="alert"/);
assert.match(source, /aria-live=/);
assert.match(source, /data-testid="quick-start"/);
assert.match(source, /data-testid="topic-candidate"/);
assert.match(source, /data-testid="s0-preview"/);
assert.match(source, /data-testid="project-confirm"/);
assert.match(source, /mobile-only/);
console.log("v1.3 accessibility floor: PASS (required fields, descriptions, invalid/error/live states, stable journey selectors, responsive navigation)");
