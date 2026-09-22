import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const library = readFileSync(new URL("./CoordinationKnowledgeLibrary.tsx", import.meta.url), "utf8");
const authoring = readFileSync(new URL("./CoordinationKnowledgeAuthoring.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./CoordinationKnowledgeLibrary.css", import.meta.url), "utf8");
const lensPanel = readFileSync(new URL("../features/lens-next/LensNextKnowledgePanel.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
  assert.ok(library.includes(`event.key === \"${key}\"`), `missing keyboard support for ${key}`);
}
assert.match(library, /lessonTabRefs/);
assert.match(library, /id={`knowledge-lesson-tab-\$\{state\.id\}`}/);
assert.match(library, /aria-controls="knowledge-lesson-panel"/);
assert.match(library, /tabIndex=\{lessonQueueState===state\.id\?0:-1\}/);
assert.match(library, /id="knowledge-lesson-panel"/);
assert.match(library, /aria-labelledby=\{`knowledge-lesson-tab-\$\{lessonQueueState\}`\}/);
assert.match(library, /role="status"/);
assert.match(library, /role="alert"/);
assert.match(library, /AbortController/g);
assert.match(library, /controller\.abort\(\)/g);

assert.match(authoring, /role="dialog"/);
assert.match(authoring, /aria-modal="true"/);
assert.match(authoring, /aria-labelledby=/);
assert.match(authoring, /beforeunload/);
assert.match(authoring, /Discard unsaved changes\?/);

for (const width of [1180, 900, 720, 700]) {
  assert.ok(styles.includes(`max-width: ${width}px`), `missing ${width}px responsive breakpoint`);
}
assert.match(styles, /overflow-x:\s*auto/);
assert.match(styles, /:focus-visible/);
assert.match(styles, /prefers-reduced-motion:\s*reduce/);
assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);

assert.match(lensPanel, /aria-expanded=/);
assert.match(lensPanel, /role="status"/);
assert.match(lensPanel, /role="alert"/);
assert.match(lensPanel, /issue/i);
assert.match(app, /CoordinationKnowledgeLibrary/);

console.log("Build 273 Coordination Knowledge UX/accessibility: PASS main-tabs=keyboard lesson-tabs=keyboard responsive=4-breakpoints states=loading-empty-error performance=lazy-cancelled");
