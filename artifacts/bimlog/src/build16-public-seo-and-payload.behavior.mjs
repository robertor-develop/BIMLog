import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const metadata = readFileSync(new URL("./components/PublicRouteMetadata.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const submittals = readFileSync(new URL("./pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");

for (const route of ["/", "/features", "/pricing", "/about", "/contact"]) {
  assert.ok(metadata.includes(`"${route}"`), `route metadata exists for ${route}`);
}
assert.match(metadata, /link\[rel="canonical"\]/, "canonical URL is managed per public route");
assert.match(metadata, /og:title/, "Open Graph title is managed per public route");
assert.match(metadata, /og:description/, "Open Graph description is managed per public route");
assert.match(app, /<PublicRouteMetadata \/>/, "route metadata is mounted inside the router");
assert.doesNotMatch(metadata, /ratingValue|reviewCount|userCount|customerCount/, "no invented structured social proof");
assert.doesNotMatch(submittals, /^import \* as XLSX from "xlsx";/m, "spreadsheet parser is not eager in the Submittals route");
assert.match(submittals, /const XLSX = await import\("xlsx"\);/, "spreadsheet parser loads only when import is invoked");

console.log("SUMMARY 12/12 PASS");
