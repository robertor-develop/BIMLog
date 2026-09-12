import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
if (!playwrightCore || !chromiumExecutable) throw new Error("Browser runtime paths are required.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const baseUrl = process.env.BIMLOG_JOB_INTAKE_URL || "http://127.0.0.1:4183/job-intake-assurance-harness.html";
const output = path.resolve("evidence/post-p17-build03-job-intake-persistence");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(20_000);
const open = (project) => page.goto(`${baseUrl}?project=${project}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

await open(201);
await page.getByLabel("Job name — required").fill("Persistent Job 201");
await page.getByLabel("Job code — required").fill("JOB-201");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByLabel("Customer company — required").selectOption("11");
await page.getByLabel("First Contract Item — required").fill("Persistent scope");
await page.getByLabel("Quantity / planned hours — required").fill("80");
await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
assert.equal(await page.getByText("Section 2 of 3").isVisible(), true);
assert.equal(await page.getByLabel("Customer company — required").inputValue(), "11");
assert.equal(await page.getByLabel("First Contract Item — required").inputValue(), "Persistent scope");
assert.equal(await page.getByLabel("Quantity / planned hours — required").inputValue(), "80");

await open(202);
assert.equal(await page.getByText("Section 1 of 3").isVisible(), true);
assert.equal(await page.getByLabel("Job name — required").inputValue(), "");
await page.getByLabel("Job name — required").fill("Isolated Job 202");
await page.getByLabel("Job code — required").fill("JOB-202");

await open(201);
assert.equal(await page.getByText("Section 2 of 3").isVisible(), true);
assert.equal(await page.getByLabel("First Contract Item — required").inputValue(), "Persistent scope");
await page.screenshot({ path: path.join(output, "project-201-restored-after-switch.png"), fullPage: true });

fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({
  suite: "post-p17-build03-save-refresh-return-project-switch",
  status: "PASS",
  assertions: 8,
  coverage: ["save", "refresh", "return", "project-switch-isolation", "section-restoration"],
}, null, 2));
await browser.close();
console.log(JSON.stringify({ status: "PASS", assertions: 8, output }, null, 2));
