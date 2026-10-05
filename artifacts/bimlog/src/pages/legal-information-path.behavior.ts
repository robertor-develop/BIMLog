import assert from "node:assert/strict";
import fs from "node:fs";
import { LEGAL_DOCUMENTS, LEGAL_EFFECTIVE_DATE } from "../lib/legal-information";

const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const app = read("../App.tsx");
const footer = read("../components/layout/Footer.tsx");
const sidebar = read("../components/layout/SidebarUtilities.tsx");
const feedback = read("../components/FeedbackWidget.tsx");
const pages = [read("./Terms.tsx"), read("./Privacy.tsx"), read("./Disclaimer.tsx")];

assert.equal(LEGAL_EFFECTIVE_DATE.iso, "2026-03-21");
for (const document of LEGAL_DOCUMENTS) {
  assert.ok(app.includes(`path="${document.href}"`), `${document.href} is public`);
  assert.ok(footer.includes(document.href), `${document.href} is linked from the public footer`);
  assert.ok(sidebar.includes(document.href), `${document.href} is linked from authenticated Info navigation`);
  assert.ok(feedback.includes(`"${document.href}"`), `${document.href} stays free of the authenticated feedback overlay`);
}
assert.ok(app.indexOf('path="/legal-notice"') < app.indexOf("{/* Protected Routes */}"), "Legal Notice stays outside authentication");
for (const page of pages) {
  assert.match(page, /<LegalDocumentNav current=/);
  assert.match(page, /<main id="main-content"/);
  assert.match(page, /<article aria-labelledby=/);
  assert.match(page, /BIMCapital Partners INC/);
  assert.match(page, /info@ignitesmart\.ai/);
  assert.match(page, /<Footer \/>/);
}
assert.match(app, /path="\/disclaimer" component=\{Disclaimer\}/, "legacy Legal Notice URL remains readable");
console.log("B310 complete public legal-information journey: PASS");
