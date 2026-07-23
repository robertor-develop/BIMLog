import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import express from "express";
import { and, eq } from "drizzle-orm";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment before running this evidence script.");
process.env.JWT_SECRET ||= "meeting-ruben-workflow-browser-local-evidence-secret";

const evidenceDir = process.argv[2];
if (!evidenceDir) throw new Error("Evidence directory is required.");
fs.mkdirSync(evidenceDir, { recursive: true });

const distDir = path.resolve("../bimlog/dist/public");
assert.ok(fs.existsSync(path.join(distDir, "index.html")), "Build the BIMLog web app before browser evidence.");

const [
  dbModule,
  schema,
  authModule,
  { default: app },
] = await Promise.all([
  import("@workspace/db"),
  import("@workspace/db/schema"),
  import("../src/middlewares/auth"),
  import("../src/app"),
]);
const { pool, db } = dbModule;
const { signToken } = authModule;
const {
  activityLogTable,
  companiesTable,
  meetingAttendeesTable,
  meetingDraftsTable,
  meetingMinutesTable,
  meetingRfiLinksTable,
  projectDirectoryTable,
  projectMembersTable,
  projectsTable,
  rfisTable,
  usersTable,
} = schema;

app.use(express.static(distDir));
app.use((req, res, next) => (req.method === "GET" ? res.sendFile(path.join(distDir, "index.html")) : next()));

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address!.port}`;
const marker = `meeting-ruben-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;

const ids: {
  companies: number[];
  users: number[];
  projects: number[];
  rfis: number[];
  meetings: number[];
  directory: number[];
} = { companies: [], users: [], projects: [], rfis: [], meetings: [], directory: [] };

const api = async (pathname: string, token: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, { ...init, headers });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
};

const [ownerCompany] = await db.insert(companiesTable).values({ name: `${marker} BIMTECH CORP` }).returning();
ids.companies.push(ownerCompany.id);
const [owner] = await db.insert(usersTable).values({
  email: `${marker}@example.invalid`,
  passwordHash: "proof",
  fullName: `${marker} Owner`,
  companyId: ownerCompany.id,
}).returning();
ids.users.push(owner.id);
const [assignee] = await db.insert(usersTable).values({
  email: `${marker}-assignee@example.invalid`,
  passwordHash: "proof",
  fullName: `${marker} Assignee`,
  companyId: ownerCompany.id,
}).returning();
ids.users.push(assignee.id);
const [outsiderCompany] = await db.insert(companiesTable).values({ name: `${marker} Outsider Co` }).returning();
ids.companies.push(outsiderCompany.id);
const [outsider] = await db.insert(usersTable).values({
  email: `${marker}-outsider@example.invalid`,
  passwordHash: "proof",
  fullName: `${marker} Outsider`,
  companyId: outsiderCompany.id,
}).returning();
ids.users.push(outsider.id);
const [project] = await db.insert(projectsTable).values({
  name: `${marker} Project`,
  code: marker,
  status: "active",
  createdById: owner.id,
}).returning();
ids.projects.push(project.id);
const [otherProject] = await db.insert(projectsTable).values({
  name: `${marker} Other`,
  code: `${marker}-other`,
  status: "active",
  createdById: outsider.id,
}).returning();
ids.projects.push(otherProject.id);
const role = await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') LIMIT 1");
assert.ok(role.rows[0]?.value);
await db.insert(projectMembersTable).values([
  { projectId: project.id, userId: owner.id, role: role.rows[0].value, status: "active" },
  { projectId: project.id, userId: assignee.id, role: role.rows[0].value, status: "active" },
  { projectId: otherProject.id, userId: outsider.id, role: role.rows[0].value, status: "active" },
]);
const [baseDirectory] = await db.insert(projectDirectoryTable).values({
  projectId: project.id,
  fullName: `${marker} Saved Contact`,
  email: `${marker}-saved-contact@example.invalid`,
  companyName: ownerCompany.name,
  companyId: ownerCompany.id,
  role: "Reviewer",
  notes: "Trade: Electrical | Phone: +1 555 0100",
  addedById: owner.id,
  bimlogStatus: "none",
}).returning();
ids.directory.push(baseDirectory.id);
const [rfi] = await db.insert(rfisTable).values({
  projectId: project.id,
  number: `${marker}-RFI-001`,
  subject: "Pump room access",
  description: "Long RFI description should not appear in compact Meeting row",
  status: "open",
  priority: "normal",
  createdById: owner.id,
  assignedToId: owner.id,
  ballInCourt: owner.fullName,
}).returning();
ids.rfis.push(rfi.id);
const [otherRfi] = await db.insert(rfisTable).values({
  projectId: otherProject.id,
  number: `${marker}-RFI-XPROJECT`,
  subject: "Other project RFI",
  description: "Must reject cross project linking",
  status: "open",
  priority: "normal",
  createdById: outsider.id,
}).returning();
ids.rfis.push(otherRfi.id);

const ownerToken = signToken({
  userId: owner.id,
  email: owner.email,
  companyId: ownerCompany.id,
  fullName: owner.fullName,
  companyName: ownerCompany.name,
});
const outsiderToken = signToken({
  userId: outsider.id,
  email: outsider.email,
  companyId: outsiderCompany.id,
  fullName: outsider.fullName,
  companyName: outsiderCompany.name,
});

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync);
assert.ok(chrome, "Chrome not found");
const debugPort = 9365;
const profileDir = path.join(evidenceDir, "chrome-profile");
const chromeProcess = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank"], { stdio: "ignore", windowsHide: true });

async function waitJson(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { method: url.includes("/json/new") ? "PUT" : "GET" });
      if (response.ok) return response.json();
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome endpoint unavailable: ${url}`);
}

const target = await waitJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
  socket.addEventListener("open", () => resolve());
  socket.addEventListener("error", () => reject(new Error("CDP socket failed")));
});

let commandId = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const browserErrors: string[] = [];
const failedApi: string[] = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const item = pending.get(message.id)!;
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails.text);
  } else if (message.method === "Network.responseReceived" && String(message.params.response.url).includes("/api/v1/") && message.params.response.status >= 400) {
    failedApi.push(`${message.params.response.status} ${message.params.response.url}`);
  }
});
const cdp = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression: string, label: string) => {
  for (let attempt = 0; attempt < 140; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const debug = await evaluate("({url:location.href,text:document.body.innerText.slice(0,2200),overflow:document.documentElement.scrollWidth>window.innerWidth})");
  fs.writeFileSync(path.join(evidenceDir, `failure-${label.replace(/[^a-z0-9]+/gi, "-")}.json`), JSON.stringify(debug, null, 2));
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(debug)}`);
};
const screenshot = async (name: string) => {
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(evidenceDir, name), Buffer.from(shot.data, "base64"));
};

const setAuth = async (lang: "en" | "es") => {
  const auth = JSON.stringify({ state: { token: ownerToken, user: { id: owner.id, email: owner.email, fullName: owner.fullName, companyId: ownerCompany.id, companyName: ownerCompany.name } }, version: 0 });
  await evaluate(`localStorage.setItem('bimlog-auth', ${JSON.stringify(auth)}); localStorage.setItem('bimlog-lang', ${JSON.stringify(lang)})`);
};
const fillByIndex = (index: number, value: string) => `(()=>{const input=[...document.querySelectorAll('input,textarea')][${index}]; const setter=Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); return {tag:input.tagName, placeholder:input.getAttribute('placeholder'), value:input.value};})()`;
const clickText = (text: string) => `(()=>{const el=[...document.querySelectorAll('button,a')].find((node)=>node.textContent?.includes(${JSON.stringify(text)})); if(!el)return false; el.scrollIntoView({block:'center'}); el.click(); return true;})()`;

const results: Record<string, unknown> = {};

try {
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable");
  await waitFor("document.readyState === 'complete'", "initial page");
  await setAuth("en");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${project.id}/meetings` });
  await waitFor("document.body.innerText.includes('New Meeting')", "English Meetings tab");
  assert.equal(await evaluate(clickText("New Meeting")), true);
  await waitFor("document.body.innerText.includes('Add company not in list') && document.body.innerText.includes('Add Existing RFI')", "new Meeting form controls");

  await evaluate(fillByIndex(1, `${marker} Draft Meeting`));
  await evaluate(fillByIndex(2, "2026-07-22"));
  await evaluate(fillByIndex(4, "Coordination room"));
  await evaluate(fillByIndex(5, "Initial agenda survives navigation"));

  assert.equal(await evaluate(clickText("Add company not in list")), true);
  await waitFor("document.body.innerText.includes('New Company Details')", "company inline registration");
  const quickCompany = `${marker} Vorea Group`;
  await evaluate(`(()=>{const labels=[...document.querySelectorAll('div')]; const label=labels.find(x=>x.textContent?.trim()==='Company Name *'); const input=label?.parentElement?.querySelector('input'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,${JSON.stringify(quickCompany)}); input.dispatchEvent(new Event('input',{bubbles:true})); return input.value;})()`);
  assert.equal(await evaluate(clickText("Add Company")), true);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(quickCompany)}) && !document.body.innerText.includes('New Company Details')`, "quick canonical company selected");
  await screenshot("desktop-en-company-quick-create.png");
  await evaluate(`(()=>{const rows=[...document.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('select').length>=2); const row=rows[0]; const person=row.querySelectorAll('select')[1]; const value=[...person.options].find(o=>o.textContent?.includes(${JSON.stringify(quickCompany)}))?.value || ${JSON.stringify(quickCompany)}; const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(person,value); person.dispatchEvent(new Event('input',{bubbles:true})); person.dispatchEvent(new Event('change',{bubbles:true})); const reactKey=Object.keys(person).find(k=>k.startsWith('__reactProps$')); person[reactKey]?.onChange?.({target:person,currentTarget:person,nativeEvent:new Event('change')}); return value;})()`);
  await waitFor(`(()=>{const rows=[...document.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('select').length>=2); return rows[0]?.querySelectorAll('select')[1]?.value?.includes(${JSON.stringify(quickCompany)});})()`, "quick attendee contact populated");

  const duplicate = await api(`/projects/${project.id}/directory/companies`, ownerToken, { method: "POST", body: JSON.stringify({ company_name: `  ${quickCompany.toUpperCase().replace(/\s+/g, "   ")}  ` }) });
  assert.equal(duplicate.status, 200);
  assert.equal(await evaluate(`(()=>[...document.querySelectorAll('select option')].filter(o=>o.textContent?.includes(${JSON.stringify(quickCompany)})).length >= 2)()`), true);
  results.duplicateCompanySelection = { status: duplicate.status, reused: duplicate.json.reused };

  assert.equal(await evaluate(clickText("Add Attendee")), true);
  await waitFor("document.body.innerText.includes('2.')", "second attendee row");
  assert.ok(await evaluate(`(()=>[...document.querySelectorAll('select option')].some(o=>o.textContent?.includes(${JSON.stringify(quickCompany)})))()`));
  results.companyImmediateDropdownRefresh = true;

  const fullCompany = await api(`/projects/${project.id}/directory/companies`, ownerToken, {
    method: "POST",
    body: JSON.stringify({
      company_name: `${marker} Full Customer`,
      website: "https://example.invalid",
      address: "100 Test Ave",
      phone: "+1 555 0200",
      industry: "Concrete",
      company_type: "Customer",
      profile_description: "Optional details proof",
      primary_contact_name: "Full Contact",
      primary_contact_email: `${marker}-full-contact@example.invalid`,
      primary_contact_phone: "+1 555 0201",
    }),
  });
  assert.equal(fullCompany.status, 201);
  ids.companies.push(fullCompany.json.id);
  ids.directory.push(fullCompany.json.directoryEntry.id);
  results.expandedCompanyRegistration = {
    fields: ["name", "website", "address", "phone", "industry", "companyType", "profileDescription", "primary contact"],
    status: fullCompany.status,
  };

  await evaluate(`(()=>{const rows=[...document.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('select').length>=2); const row=rows[rows.length-1]; const select=row?.querySelector('select'); const value=[...select.options].find(o=>o.textContent?.includes(${JSON.stringify(ownerCompany.name)}))?.value; const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(select,value); select.dispatchEvent(new Event('input',{bubbles:true})); select.dispatchEvent(new Event('change',{bubbles:true})); return value;})()`);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`${marker} Saved Contact`)})`, "saved contact option");
  if (process.env.BIMLOG_ATTENDEE_DIAGNOSTIC === "1") {
    const directoryResponse = await api(`/projects/${project.id}/directory`, ownerToken);
    const diagnostic = await evaluate(`(async()=>{
      const rows=[...document.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('select').length>=2);
      const row=rows[rows.length-1];
      const selects=row.querySelectorAll('select');
      const companySelect=selects[0];
      const person=selects[1];
      const option=[...person.options].find(o=>o.textContent?.includes(${JSON.stringify(`${marker} Saved Contact`)}));
      const events=[];
      ['pointerdown','mousedown','mouseup','click','input','change','keydown','keyup'].forEach(type=>person.addEventListener(type,event=>events.push({type:event.type,value:person.value,selectedIndex:person.selectedIndex}),true));
      const state=()=>({
        companySelectValue: companySelect.value,
        personValue: person.value,
        personSelectedIndex: person.selectedIndex,
        optionValue: option?.value || null,
        optionText: option?.textContent || null,
        inputs:[...row.querySelectorAll('input')].map(input=>({value:input.value, placeholder:input.getAttribute('placeholder')||''})),
        text: row.innerText,
        alertText:[...document.querySelectorAll('[role=alert]')].map(x=>x.textContent?.trim()).filter(Boolean),
      });
      const before=state();
      const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
      setter.call(person, option?.value || '');
      person.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      person.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      person.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      person.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      person.dispatchEvent(new Event('input',{bubbles:true}));
      person.dispatchEvent(new Event('change',{bubbles:true}));
      const reactKey=Object.keys(person).find(k=>k.startsWith('__reactProps$'));
      const reactProps=reactKey ? Object.keys(person[reactKey] || {}) : [];
      const reactOnChangeType=reactKey && person[reactKey]?.onChange ? typeof person[reactKey].onChange : null;
      if (reactKey && person[reactKey]?.onChange) person[reactKey].onChange({target:person,currentTarget:person,nativeEvent:new Event('change')});
      const immediate=state();
      await new Promise(resolve=>setTimeout(resolve,600));
      const postRender=state();
      return {rowCount: rows.length, before, events, immediate, postRender, reactKey: !!reactKey, reactProps, reactOnChangeType, browserLanguage: localStorage.getItem('bimlog-lang'), location: location.href};
    })()`);
    const report = { suite: "attendee-auto-populate-diagnostic", marker, target: { host: "127.0.0.1", database: "bimlog_rfi_test" }, selected: { projectId: project.id, companyId: ownerCompany.id, directoryEntryId: baseDirectory.id, contactEmail: baseDirectory.email }, contactListStatus: directoryResponse.status, contactList: directoryResponse.json, diagnostic, browserErrors, failedApi };
    const diagnosticPath = path.join(evidenceDir, "attendee-auto-populate-diagnostic.json");
    fs.writeFileSync(diagnosticPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ suite: report.suite, diagnosticPath, postRender: diagnostic.postRender }, null, 2));
    throw new Error("ATTENDEE_DIAGNOSTIC_COMPLETE");
  }
  await evaluate(`(()=>{const rows=[...document.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('select').length>=2); const row=rows[rows.length-1]; const selects=row.querySelectorAll('select'); const person=selects[1]; const value=[...person.options].find(o=>o.textContent?.includes(${JSON.stringify(`${marker} Saved Contact`)}))?.value; const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(person,value); person.dispatchEvent(new Event('input',{bubbles:true})); person.dispatchEvent(new Event('change',{bubbles:true})); const reactKey=Object.keys(person).find(k=>k.startsWith('__reactProps$')); person[reactKey]?.onChange?.({target:person,currentTarget:person}); return value;})()`);
  await waitFor(`(()=>{const rows=[...document.querySelectorAll('tbody tr')].filter(row=>row.querySelectorAll('select').length>=2); const row=rows[rows.length-1]; const values=[...row.querySelectorAll('input')].map(input=>input.value).join(' | '); return values.includes(${JSON.stringify(`${marker}-saved-contact@example.invalid`)}) && values.includes('+1 555 0100');})()`, "saved attendee auto-populates");
  results.reusableAttendeeSelection = true;

  assert.equal(await evaluate(clickText("Add Existing RFI")), true);
  await waitFor(`document.querySelector('[role=dialog]')?.innerText.includes(${JSON.stringify(rfi.number)})`, "RFI selector opens");
  await evaluate("document.querySelector('[role=dialog] input[type=checkbox]')?.click()");
  assert.equal(await evaluate(clickText("Add Selected (1)")), true);
  await waitFor(`!document.querySelector('[role=dialog]') && document.body.innerText.includes(${JSON.stringify(rfi.number)}) && document.body.innerText.includes('View RFI')`, "compact RFI linked row");
  const compact = await evaluate(`(()=>{const text=document.body.innerText; return {hasNumber:text.includes(${JSON.stringify(rfi.number)}), hasTitle:text.includes('Pump room access'), leaksDescription:text.includes('Long RFI description should not appear')};})()`);
  assert.equal(compact.hasNumber && compact.hasTitle && !compact.leaksDescription, true);
  await screenshot("desktop-en-compact-rfi-controls.png");

  const updatedBefore = await api(`/projects/${project.id}/rfis/${rfi.id}`, ownerToken);
  const validStatus = (await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='rfi_status' AND value <> $1 ORDER BY sort_order NULLS LAST, value LIMIT 1", [rfi.status])).rows[0]?.value || "answered";
  const updateResult = await api(`/projects/${project.id}/rfis/${rfi.id}`, ownerToken, { method: "PATCH", body: JSON.stringify({ status: validStatus, assignedToId: assignee.id, expected_updated_at: updatedBefore.json.updatedAt }) });
  assert.equal(updateResult.status, 200);
  const staleResult = await api(`/projects/${project.id}/rfis/${rfi.id}`, ownerToken, { method: "PATCH", body: JSON.stringify({ status: rfi.status, expected_updated_at: updatedBefore.json.updatedAt }) });
  assert.equal(staleResult.status, 409);
  const unauthorizedResult = await api(`/projects/${project.id}/rfis/${rfi.id}`, outsiderToken, { method: "PATCH", body: JSON.stringify({ status: validStatus }) });
  assert.ok([401, 403, 404].includes(unauthorizedResult.status));
  results.canonicalRfiControls = { updatedStatus: validStatus, stale: staleResult.status, unauthorized: unauthorizedResult.status };

  assert.equal(await evaluate(clickText("View RFI")), true);
  await waitFor(`location.pathname.endsWith('/rfis') && location.search.includes('rfi=${rfi.id}') && location.search.includes('meetingDraft=new') && document.body.innerText.includes('Back to Meeting Draft')`, "exact RFI deep link with Meeting draft return");
  assert.equal(await evaluate(clickText("Back to Meeting Draft")), true);
  await waitFor(`(()=>{const values=[...document.querySelectorAll('input,textarea')].map(input=>input.value).join(' | '); return values.includes(${JSON.stringify(`${marker} Draft Meeting`)}) && document.body.innerText.includes(${JSON.stringify(rfi.number)});})()`, "draft restored after RFI navigation");
  results.draftRestoredAfterRfiNavigation = true;

  await cdp("Page.reload", { ignoreCache: true });
  await waitFor(`(()=>{const values=[...document.querySelectorAll('input,textarea')].map(input=>input.value).join(' | '); return values.includes(${JSON.stringify(`${marker} Draft Meeting`)}) && document.body.innerText.includes(${JSON.stringify(quickCompany)});})()`, "draft restored after refresh");
  await screenshot("desktop-en-draft-restored-refresh.png");
  results.draftRestoredAfterRefresh = true;

  assert.equal(await evaluate(clickText("Save Meeting")), true);
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`${marker} Draft Meeting`)}) && document.body.innerText.includes('Download PDF') && document.body.innerText.includes('Print Meeting')`, "meeting saved with PDF Print");
  const savedMeetingId = await pool.query<{ id: number }>("SELECT id FROM meeting_minutes WHERE project_id=$1 AND title=$2 ORDER BY id DESC LIMIT 1", [project.id, `${marker} Draft Meeting`]);
  assert.ok(savedMeetingId.rows[0]?.id);
  ids.meetings.push(savedMeetingId.rows[0].id);
  const draftAfterSave = await db.select().from(meetingDraftsTable).where(and(eq(meetingDraftsTable.projectId, project.id), eq(meetingDraftsTable.userId, owner.id)));
  assert.equal(draftAfterSave.length, 0);
  await screenshot("desktop-en-saved-edit-pdf-print.png");

  assert.equal(await evaluate(clickText("Edit")), true);
  await waitFor("document.body.innerText.includes('Discard Draft') && document.body.innerText.includes('Save Changes')", "edit meeting opens");
  results.editPreserved = true;

  await setAuth("es");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${project.id}/meetings` });
  await waitFor("document.body.innerText.includes('Nueva Reunión')", "Spanish Meetings tab");
  const mobileOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
  assert.equal(mobileOverflow, false);
  assert.ok(await evaluate("document.body.innerText.includes('Ver RFI') && document.body.innerText.includes('Descargar PDF') && (document.body.innerText.includes('Imprimir Reunión') || document.body.innerText.includes('Imprimir reunión'))"));
  await screenshot("mobile-es-390-meeting-workflows.png");
  results.spanishMobile = { width: 390, horizontalOverflow: false };

  const crossProject = await api(`/projects/${project.id}/meetings/${savedMeetingId.rows[0].id}/rfis`, ownerToken, { method: "POST", body: JSON.stringify({ rfi_ids: [otherRfi.id] }) });
  assert.ok([400, 403, 404].includes(crossProject.status));
  results.crossProjectRfiRejected = crossProject.status;

  const attendeeRows = await db.select().from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, savedMeetingId.rows[0].id));
  assert.ok(attendeeRows.some((row) => row.companyId));
  const finalRfi = await db.select().from(rfisTable).where(eq(rfisTable.id, rfi.id)).limit(1);
  assert.equal(finalRfi[0]?.assignedToId, assignee.id);
  assert.equal(finalRfi[0]?.status, validStatus);
  const draftIsolation = await api(`/projects/${project.id}/meetings/draft`, outsiderToken);
  assert.ok([401, 403, 404].includes(draftIsolation.status));
  results.draftIsolation = draftIsolation.status;

  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedApi.filter((entry) => !entry.includes("/rfis/") && !entry.includes("/meetings/draft")), []);
  const report = {
    suite: "meeting-ruben-workflow-browser",
    marker,
    target: { host: "127.0.0.1", database: "bimlog_rfi_test" },
    desktop: {
      language: "en",
      width: 1366,
      screenshots: [
        "desktop-en-company-quick-create.png",
        "desktop-en-compact-rfi-controls.png",
        "desktop-en-draft-restored-refresh.png",
        "desktop-en-saved-edit-pdf-print.png",
      ],
    },
    mobile: { language: "es", width: 390, screenshot: "mobile-es-390-meeting-workflows.png", horizontalOverflow: false },
    results,
    browserErrors,
    failedApi,
  };
  const reportPath = path.join(evidenceDir, "browser-proof.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const hash = crypto.createHash("sha256").update(fs.readFileSync(reportPath)).digest("hex");
  fs.writeFileSync(path.join(evidenceDir, "browser-proof.sha256"), `${hash}  browser-proof.json\n`);
  console.log(JSON.stringify({ suite: report.suite, marker, evidenceDir, sha256: hash, passed: Object.keys(results).length }));
} finally {
  socket.close();
  chromeProcess.kill();
  await new Promise((resolve) => { chromeProcess.once("exit", resolve); setTimeout(resolve, 1200); });
  try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }); } catch { /* evidence hygiene */ }
  server.close();
  await pool.query("DELETE FROM telegram_rfi_notification_source_history WHERE source_event_id IN (SELECT id FROM telegram_rfi_notification_source_events WHERE project_id=ANY($1::int[]))", [ids.projects]);
  await pool.query("DELETE FROM telegram_rfi_notification_source_events WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM activity_log WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_rfi_links WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_attendees WHERE meeting_id=ANY($1::int[])", [ids.meetings]);
  await pool.query("DELETE FROM meeting_drafts WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_minutes WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM rfi_view_events WHERE rfi_id=ANY($1::int[])", [ids.rfis]);
  await pool.query("DELETE FROM rfis WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM project_directory WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM project_members WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM projects WHERE id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [ids.users]);
  await pool.query("DELETE FROM companies WHERE id=ANY($1::int[])", [ids.companies]);
  await pool.end();
}

process.exit(0);
