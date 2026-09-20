import assert from "node:assert/strict";
import fs from "node:fs";

const read = (relative: string) => fs.readFileSync(new URL(`../routes/${relative}`, import.meta.url), "utf8");
const members = read("members.ts");
const directory = read("project_directory.ts");

assert.match(members, /applyPdfDownloadHeaders\(res, \{ title \}\)/u);
assert.match(directory, /applyPdfDownloadHeaders\(res, \{ fileName \}\)/u);
assert.doesNotMatch(`${members}\n${directory}`, /setHeader\("Content-Type", "application\/pdf"\)/u);
assert.match(directory, /X-Report-Filename/u, "existing directory response metadata must remain intact");

for (const bilingualText of [
  "Exportar vista actual",
  "Directorio del Proyecto",
  "Miembros activos del proyecto",
  "Contactos Adicionales",
]) assert.match(`${members}\n${directory}`, new RegExp(bilingualText, "u"));

assert.match(members, /computeContentHash/u);
assert.match(directory, /computeContentHash/u);
assert.match(members, /addPageNumbers/u);
assert.match(directory, /addPageNumbers/u);

console.log("POST120_BUILD139=PASS project-team project-directory shared-delivery bilingual-content-preserved");
