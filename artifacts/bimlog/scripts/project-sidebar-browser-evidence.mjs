import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
if (!playwrightCore || !chromiumExecutable) throw new Error("Browser runtime paths are required.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const baseUrl = process.env.BIMLOG_PROJECT_SIDEBAR_URL || "http://127.0.0.1:4185/project-sidebar-assurance-harness.html";
const output = path.resolve("evidence/project-sidebar-browser-assurance");
fs.mkdirSync(output, { recursive: true });

const expectedHrefs = [
  "command-center", "coordination", "activity", "intake", "operations", "files",
  "rfis", "submittals", "transmittals", "change-orders", "meetings", "schedule",
  "clash-reports", "financial/apu", "commercial/team-performance", "analytics",
  "reports", "directory", "team", "generator", "convention", "integrations",
].map(target => `/projects/91/${target}`);
const expectedActionTitles = [
  "Project Budget", "Contracts & Commitments", "BIMLog Sync Agent",
];

const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
page.setDefaultTimeout(20_000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.goto(baseUrl, { waitUntil: "networkidle" });

const sidebar = page.locator(".phasea-project-sidebar");
const resizer = page.getByRole("button", { name: "Resize project navigation" });
const nav = page.getByRole("navigation", { name: "Scrollable project navigation" });
assert.equal(await sidebar.isVisible(), true);
assert.equal(Math.round((await sidebar.boundingBox()).width), 248);

await resizer.focus();
await resizer.press("End");
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 420);
await resizer.press("Home");
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 248);

assert.equal(await resizer.locator("svg").count(), 0);
assert.equal(await resizer.evaluate(element => getComputedStyle(element, "::after").backgroundColor), "rgb(147, 197, 253)");
await page.getByRole("navigation", { name: "Scrollable project navigation" }).focus();
await page.waitForTimeout(150);
assert.equal(await resizer.evaluate(element => getComputedStyle(element, "::after").backgroundColor), "rgba(0, 0, 0, 0)");

const handle = await resizer.boundingBox();
assert.ok(handle);
await resizer.hover({ position: { x: handle.width / 2, y: 120 } });
await page.waitForTimeout(150);
assert.equal(await resizer.evaluate(element => getComputedStyle(element, "::after").backgroundColor), "rgb(147, 197, 253)");
await page.mouse.move(handle.x + handle.width / 2, handle.y + 120);
await page.mouse.down();
await page.waitForTimeout(50);
await page.mouse.move(340, handle.y + 120, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 340);
assert.equal(await page.evaluate(() => localStorage.getItem("bimlog-project-sidebar-width")), "340");

for (const group of await page.locator(".phasea-nav-group-trigger").all()) {
  if ((await group.getAttribute("aria-expanded")) === "false") await group.click();
}
for (const href of expectedHrefs) {
  const item = page.locator(`.phasea-nav-list a[href="${href}"]`);
  assert.equal(await item.count(), 1, href);
  await item.scrollIntoViewIfNeeded();
  assert.equal(await item.isVisible(), true, href);
}
for (const title of expectedActionTitles) {
  const item = page.locator(`.phasea-nav-list button[title="${title}"]`);
  assert.equal(await item.count(), 1, title);
  await item.scrollIntoViewIfNeeded();
  assert.equal(await item.isVisible(), true, title);
}
const scrollState = await nav.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
assert.ok(scrollState.content > scrollState.height, JSON.stringify(scrollState));
await nav.evaluate(element => { element.scrollTop = element.scrollHeight; });
assert.ok(await nav.evaluate(element => element.scrollTop > 0));
assert.equal(Math.round((await sidebar.boundingBox()).width), 340);

await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 78);
assert.equal(await page.evaluate(() => localStorage.getItem("bimlog-project-sidebar-collapsed")), "true");
await page.reload({ waitUntil: "networkidle" });
assert.equal(Math.round((await sidebar.boundingBox()).width), 78);
await page.getByRole("button", { name: "Expand navigation" }).click();
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 340);
await page.reload({ waitUntil: "networkidle" });
assert.equal(Math.round((await sidebar.boundingBox()).width), 340);

await page.screenshot({ path: path.join(output, "desktop-expanded.png"), fullPage: true });
await page.setViewportSize({ width: 700, height: 720 });
assert.equal(await sidebar.isVisible(), false);
const mobileTrigger = page.getByRole("button", { name: "Open project navigation" });
assert.equal(await mobileTrigger.isVisible(), true);
await mobileTrigger.click();
const mobileNav = page.getByRole("complementary", { name: "Project navigation" });
assert.equal(await mobileNav.isVisible(), true);
await page.screenshot({ path: path.join(output, "mobile-drawer.png"), fullPage: true });
await page.setViewportSize({ width: 390, height: 640 });
const mobileScrollState = await mobileNav.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
assert.ok(mobileScrollState.content > mobileScrollState.height, JSON.stringify(mobileScrollState));
await mobileNav.evaluate(element => { element.scrollTop = element.scrollHeight; });
assert.ok(await mobileNav.evaluate(element => element.scrollTop > 0));
assert.equal(await page.locator("#phasea-mobile-project-nav a[href='/projects/91/integrations']").isVisible(), true);
await page.screenshot({ path: path.join(output, "mobile-390-scrolled.png"), fullPage: true });
await page.getByRole("button", { name: "Close", exact: true }).click();
assert.equal(await mobileNav.isVisible(), false);

assert.deepEqual(errors, []);
const result = {
  suite: "project-sidebar-production-component-browser-assurance",
  status: "PASS",
  assertions: 45,
  persistedWidth: 340,
  collapsedWidth: 78,
  capabilityHrefs: expectedHrefs,
  capabilityActions: expectedActionTitles,
  viewports: ["1440x720", "700x720", "390x640"],
  errors,
};
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(result, null, 2));
await browser.close();
console.log(JSON.stringify(result, null, 2));
