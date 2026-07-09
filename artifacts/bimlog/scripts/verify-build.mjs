import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const artifactDir = dirname(scriptDir);
const indexPath = join(artifactDir, "dist", "public", "index.html");

if (!existsSync(indexPath)) {
  console.error(`FAIL: ${indexPath} does not exist. Build first.`);
  process.exit(1);
}

const html = readFileSync(indexPath, "utf8");
const badRefs = [...html.matchAll(/src="\/(?!assets\/)[^/]+\//g)].map((m) => m[0]);
const badHrefs = [...html.matchAll(/href="\/(?!assets\/|favicon|apple)[^/]+\//g)].map((m) => m[0]);

if (badRefs.length || badHrefs.length) {
  console.error("FAIL: index.html contains asset references with wrong base path.");
  console.error("Expected: /assets/...");
  console.error("Found:");
  for (const ref of badRefs) console.error(`  ${ref}`);
  for (const href of badHrefs) console.error(`  ${href}`);
  console.error("");
  console.error("Production serves at /. Rebuild with BASE_PATH=/ or unset BASE_PATH.");
  process.exit(1);
}

const jsCount = (html.match(/\/assets\/[^"]+\.js/g) ?? []).length;
const cssCount = (html.match(/\/assets\/[^"]+\.css/g) ?? []).length;

if (jsCount < 1) {
  console.error("FAIL: No JS asset references found in index.html.");
  process.exit(1);
}

if (cssCount < 1) {
  console.error("FAIL: No CSS asset references found in index.html.");
  process.exit(1);
}

console.log(`OK: Build verified. ${jsCount} JS + ${cssCount} CSS assets at /assets/...`);
