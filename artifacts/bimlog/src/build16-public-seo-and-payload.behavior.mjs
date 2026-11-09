import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const metadata = readFileSync(new URL("./components/PublicRouteMetadata.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const submittals = readFileSync(new URL("./pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");
const robots = readFileSync(new URL("../public/robots.txt", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const llms = readFileSync(new URL("../public/llms.txt", import.meta.url), "utf8");

for (const route of ["/", "/features", "/pricing", "/about", "/contact"]) {
  assert.ok(metadata.includes(`"${route}"`), `route metadata exists for ${route}`);
}
assert.match(metadata, /link\[rel="canonical"\]/, "canonical URL is managed per public route");
assert.match(metadata, /og:title/, "Open Graph title is managed per public route");
assert.match(metadata, /og:description/, "Open Graph description is managed per public route");
assert.match(metadata, /meta\[name="robots"\]/, "public routes explicitly opt into indexing");
assert.match(metadata, /twitter:card/, "Twitter card metadata is managed per public route");
assert.match(app, /<PublicRouteMetadata \/>/, "route metadata is mounted inside the router");
assert.doesNotMatch(metadata, /ratingValue|reviewCount|userCount|customerCount/, "no invented structured social proof");
assert.doesNotMatch(submittals, /^import \* as XLSX from "xlsx";/m, "spreadsheet parser is not eager in the Submittals route");
assert.match(submittals, /const XLSX = await import\("xlsx\/dist\/xlsx\.mini\.min\.js"\)/, "the read-only mini spreadsheet parser loads only when import is invoked");
assert.match(robots, /Sitemap: https:\/\/bimlog\.app\/sitemap\.xml/, "robots advertises the canonical sitemap");
for (const route of ["", "features", "pricing", "about", "contact"]) {
  assert.ok(sitemap.includes(`<loc>https://bimlog.app/${route}</loc>`), `sitemap contains public route /${route}`);
}
assert.doesNotMatch(sitemap, /dashboard|project|admin|api\//i, "sitemap excludes authenticated and API routes");
assert.match(llms, /customer, company, project, document, and job data is private/i, "AI discovery file states the private-data boundary");
assert.match(llms, /not an API credential, authorization grant, tool manifest/i, "AI discovery file cannot be mistaken for agent authority");
assert.doesNotMatch(llms, /Bearer |api[_ -]?key|secret|token=/i, "AI discovery file contains no credential material");

console.log("SUMMARY 24/24 PASS");
