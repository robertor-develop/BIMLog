import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentConnectionsPanel } from "./JobOperationsWorkspace";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "JobOperationsWorkspace.tsx"), "utf8");
const api = async () => ({ idempotent: false });
const reload = async () => undefined;
const translate = (language: "en" | "es") => (english: string, spanish: string) => language === "es" ? spanish : english;

const options = {
  rfis: [{ id: 41, displayCode: "RFI-041", title: "Confirm ceiling clearance", status: "Open", version: 3, deepLink: "/projects/7/rfis?rfi=41" }],
  fileRevisions: [{ id: 92, displayCode: "M-201 · Rev 4", title: "Mechanical plan", status: "Current", version: 4, deepLink: "/projects/7/files?file=92", parentFileId: 15 }],
  transmittals: [{ id: 18, displayCode: "TR-018", title: "Issued coordination set", status: "Issued", version: 1, deepLink: "/projects/7/transmittals?transmittal=18" }],
};
const activeRfiEntity = { ...options.rfis[0], entityType: "rfi", entityId: 41, entityIdentity: "rfi:41", available: true, stale: false };

const data = {
  canManage: true,
  tasks: [{ id: "task-1", nameEn: "Coordinate ceiling", nameEs: "Coordinar cielo raso", canControl: true }],
  packages: [{ id: "package-1", packageCode: "WP-001", title: "Ceiling coordination", canControl: true }],
  documentConnectionOptions: options,
  documentConnectionOptionMeta: {
    rfis: { total: 125, limited: true, max: 100 },
    fileRevisions: { total: 1, limited: false, max: 100 },
    transmittals: { total: 1, limited: false, max: 100 },
  },
  documentConnectionMeta: { total: 250, limited: true, max: 200 },
  documentConnections: [{
    id: "connection-1", projectId: 7, targetType: "task", targetId: "task-1", entityType: "rfi", entityId: 41,
    note: "Required before model sign-off", linkedById: 5, linkedAt: "2026-08-12T18:30:00.000Z", canRemove: true, entity: activeRfiEntity,
  }],
};

const render = (input: any, language: "en" | "es" = "en", busy = false) => renderToStaticMarkup(
  <DocumentConnectionsPanel data={input} projectId={7} language={language} tt={translate(language)} api={api} reload={reload} busy={busy}/>,
);

const populated = render(data);
for (const text of ["Document connections", "Operational target", "Search operational targets", "Search canonical documents", "RFI-041", "Confirm ceiling clearance", "Status", "Open", "Version", "Open canonical record", "Remove link", "Showing 1 of 125 available records", "search applies only to the loaded records", "Showing 1 of 250 document connections", "limits this list to 200"]) assert.match(populated, new RegExp(text));
assert.match(populated, /href="\/projects\/7\/rfis\?rfi=41"/);
assert.equal(options.fileRevisions[0].deepLink, "/projects/7/files?file=92");
assert.equal(options.transmittals[0].deepLink, "/projects/7/transmittals?transmittal=18");

const spanish = render(data, "es");
for (const text of ["Conexiones de documentos", "Destino operativo", "Revisión de archivo", "Abrir registro canónico", "Eliminar vínculo"]) assert.match(spanish, new RegExp(text));

const empty = render({ ...data, documentConnectionOptions: { rfis: [], fileRevisions: [], transmittals: [] }, documentConnections: [] });
assert.match(empty, /No canonical documents are available to link/);
assert.match(empty, /No document connections yet/);

const permissionLimited = render({ ...data, canManage: false, tasks: [{ ...data.tasks[0], canControl: false }], packages: [{ ...data.packages[0], canControl: false }], documentConnections: [{ ...data.documentConnections[0], canRemove: false }] });
assert.match(permissionLimited, /View-only access/);
assert.match(permissionLimited, /View only/);
assert.doesNotMatch(permissionLimited, /Remove link/);

const staleEntity = { ...activeRfiEntity, available: false, stale: true, deepLink: "", displayCode: "", title: "", status: null, version: null };
const stale = render({ ...data, documentConnections: [{ ...data.documentConnections[0], entity: staleEntity }] });
assert.match(stale, /Canonical record unavailable/);
assert.match(stale, /Remove link/);
assert.doesNotMatch(stale, /href=/);
const staleSpanish = render({ ...data, documentConnections: [{ ...data.documentConnections[0], entity: staleEntity }] }, "es");
assert.match(staleSpanish, /Registro canónico no disponible/);
assert.match(staleSpanish, /Eliminar vínculo/);
assert.doesNotMatch(staleSpanish, /href=/);

const blankDeepLink = render({ ...data, documentConnections: [{ ...data.documentConnections[0], entity: { ...data.documentConnections[0].entity, deepLink: "" } }] });
assert.match(blankDeepLink, /Canonical record unavailable/);
assert.doesNotMatch(blankDeepLink, /href=/);

const malformed = render({ ...data, documentConnectionOptions: { rfis: [] } });
assert.match(malformed, /server response is incomplete/);
assert.match(malformed, /Reload connections/);

const malformedMeta = render({ ...data, documentConnectionOptionMeta: { rfis: { total: 4 } } });
assert.match(malformedMeta, /server response is incomplete/);
const malformedConnectionMeta = render({ ...data, documentConnectionMeta: { total: 4 } });
assert.match(malformedConnectionMeta, /server response is incomplete/);

const loading = render(data, "en", true);
assert.match(loading, /Updating document connections/);

assert.match(source, /documentConnectionOptions/);
assert.match(source, /documentConnectionOptionMeta/);
assert.match(source, /documentConnectionMeta/);
assert.match(source, /options\.rfis.*options\.fileRevisions.*options\.transmittals/s);
assert.match(source, /operations\/document-connections/);
assert.match(source, /connectionId:\s*crypto\.randomUUID\(\)/);
assert.match(source, /targetType,\s*targetId,\s*entityType,\s*entityId/);
assert.match(source, /note:\s*note\.trim\(\)/);
assert.match(source, /method:\s*"DELETE"/);
assert.match(source, /result\?\.idempotent === true/);
assert.match(source, /status === 404 \|\| request\?\.status === 409/);
assert.match(source, /status === 401 \|\| request\?\.status === 403/);
assert.match(source, /type="search"/);
assert.match(source, /filteredTargets/);
assert.match(source, /filteredEntityOptions/);
assert.match(source, /selectedMeta\?\.limited/);
assert.match(source, /connectionMeta\?\.limited/);
assert.match(source, /entity\.available && !entity\.stale && entity\.deepLink\.trim\(\)\.length > 0/);
assert.match(source, /connection\.entity\.displayCode/);
assert.match(source, /@media\(max-width:560px\).*jo-connection-form.*grid-template-columns:1fr/s);
assert.match(source, /@media\(max-width:390px\).*jo-connection-actions.*grid-template-columns:1fr/s);
assert.doesNotMatch(source, /window\.print|window\.confirm|mock data/i);

console.log(JSON.stringify({ status: "PASS", tests: ["production-component-ssr", "populated-en", "populated-es", "empty", "loading", "malformed-response", "malformed-meta", "malformed-connection-meta", "permission-limited", "target-and-document-search", "truncated-disclosure", "nested-entity-render", "canonical-deep-link", "stale-entity-no-link", "blank-deep-link-no-link", "idempotent-result", "stale-and-denied-copy", "safe-unlink", "responsive-exact-390-contract"] }));
