import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
if (!playwrightCore || !chromiumExecutable) throw new Error("Browser runtime paths are required.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const base = process.env.BIMLOG_GLOBAL_SHELL_URL || "http://127.0.0.1:4186/global-shell-assurance-harness.html";
const output = path.resolve("evidence/global-shell-browser-assurance");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));

async function open(state, file) {
  await page.goto(`${base}?state=${state}`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("body").evaluate(el => el.scrollWidth <= el.clientWidth), true, `${state} horizontal overflow`);
  assert.equal(await page.locator("h1").count(), 1, `${state} requires one h1`);
  await page.screenshot({ path: path.join(output, file), fullPage: true });
}

await open("dashboard", "desktop-dashboard.png");
const sidebar = page.locator("#headquarters-global-sidebar");
assert.equal(await sidebar.isVisible(), true);
const resizer = page.getByRole("button", { name: "Resize main navigation" });
await resizer.press("End");
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 420);
await page.getByRole("button", { name: "Collapse navigation" }).click();
await page.waitForTimeout(250);
assert.equal(Math.round((await sidebar.boundingBox()).width), 58);
await page.screenshot({ path: path.join(output, "desktop-collapsed.png"), fullPage: true });

await open("admin", "desktop-administration.png");
await open("denied", "desktop-denied.png");
await open("error", "desktop-error.png");

await page.setViewportSize({ width: 390, height: 844 });
await open("dashboard", "mobile-dashboard.png");
const trigger = page.getByRole("button", { name: "Open headquarters navigation" });
await trigger.click();
await page.waitForTimeout(250);
const drawer = page.getByRole("dialog", { name: "Headquarters navigation" });
assert.equal(await drawer.isVisible(), true);
assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
await page.screenshot({ path: path.join(output, "mobile-navigation.png"), fullPage: true });
await page.keyboard.press("Escape");
await page.waitForTimeout(150);
assert.equal(await drawer.isVisible(), false);
assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
assert.equal(await page.locator("body").evaluate(el => el.scrollWidth <= el.clientWidth), true);

assert.deepEqual(errors, []);
const result = { suite: "global-shell-production-component-browser-assurance", status: "PASS", screenshots: 7, viewports: ["1440x800", "390x844"], errors };
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(result, null, 2));
await browser.close();
console.log(JSON.stringify(result));
