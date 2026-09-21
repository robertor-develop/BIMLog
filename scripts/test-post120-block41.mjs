import assert from "node:assert/strict";
import fs from "node:fs";

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const app = read("artifacts/bimlog/src/App.tsx");
const feedback = read("artifacts/bimlog/src/components/FeedbackWidget.tsx");
const projectDetail = read("artifacts/bimlog/src/pages/ProjectDetail.tsx");
const vite = read("artifacts/bimlog/vite.config.ts");
const baseline = JSON.parse(read("evidence/stabilization-program-20260919/BUILD_201_BROWSER_PERFORMANCE_BASELINE.json"));

assert.equal(baseline.build, 201);
assert.equal(baseline.routes.length, 53);
assert.equal(baseline.entry.fileBytes, 511219);
assert.match(vite, /manifest: "vite-manifest\.json"/);
assert.doesNotMatch(app, /import \{ FeedbackWidget \}/, "feedback workspace must not be in the initial entry");
assert.match(app, /const FeedbackWidget = namedPage\(\(\) => import\("@\/components\/FeedbackWidget"\)/);
assert.match(app, /const FEEDBACK_IDLE_DELAY_MS = 400/);
assert.match(app, /window\.clearTimeout\(timer\)/, "deferred mounts must be canceled on teardown");
assert.match(app, /if \(!token \|\| !ready\) return null/);
assert.doesNotMatch(feedback, /import \{ FeedbackMarkupEditor \}/, "markup editor must not be eager");
assert.match(feedback, /import\("@\/components\/FeedbackMarkupEditor"\)/);
assert.match(feedback, /key=\{`\$\{editingCapture\.name\}:\$\{editingCapture\.size\}:\$\{editingCapture\.lastModified\}`\}/);
assert.match(feedback, /<Suspense fallback=/);
assert.match(projectDetail, /const ReportsTab = namedProjectTab\(\(\) => import\("\.\/project\/ReportsTab"\)/);
assert.match(projectDetail, /const ConventionBuilder = namedProjectTab\(\(\) => import\("\.\/project\/ConventionBuilder"\)/);

console.log("POST120_BLOCK41=PASS baseline=53-routes public-feedback=deferred editor=lazy stale-state=guarded");
