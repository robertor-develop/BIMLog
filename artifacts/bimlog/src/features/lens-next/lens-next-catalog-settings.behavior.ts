import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
assert.match(view, /Issue Fields and Catalogs/);
assert.match(view, /Campos y catálogos de incidencias/);
assert.match(view, /Active BIMLog project/);
assert.match(view, /Last catalog synchronization/);
assert.match(view, /Responsible Companies/);
assert.match(view, /data-catalog-state/);
assert.match(view, /projects\/\$\{selectedProjectId\}\/directory/);
assert.match(view, /Return here and refresh after an authorized change/);
assert.match(view, /Add responsible company to this project/);
assert.match(view, /Agregar empresa responsable a este proyecto/);
assert.match(view, /Adicionar empresa responsável a este projeto/);
assert.match(view, /onRegisterProjectCompany/);
assert.doesNotMatch(view, /createResponsibleCompanies[^\n]+"Other"/);
console.log("Lens Build 004 gear catalog configuration and BIMLog authority handoff: PASS");
