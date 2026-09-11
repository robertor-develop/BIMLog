import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
if (!playwrightCore || !chromiumExecutable) throw new Error("Browser runtime paths are required.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const baseUrl = process.env.BIMLOG_JOB_INTAKE_URL || "http://127.0.0.1:4183/job-intake-assurance-harness.html";
const output = path.resolve("evidence/post-p17-build02-job-intake-browser");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(20_000);
page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
page.on("pageerror", (error) => console.error(`[browser:error] ${error.message}`));
console.log("browser: opening Job Intake harness");
await page.goto(`${baseUrl}?project=101`, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.getByRole("heading", { name: "Start with only what you know now" }).waitFor();
assert.ok(await page.getByLabel("Job name — required").isVisible());
assert.ok(await page.getByLabel("Job code — required").isVisible());
await page.getByLabel("Job name — required").fill("521 E Tremont");
await page.getByLabel("Job code — required").fill("TREMONT-521");
console.log("browser: job identity entered");
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByLabel("Customer company — required").selectOption("11");
await page.getByLabel("First Contract Item — required").fill("Coordination Meetings");
await page.getByLabel("Quantity / planned hours — required").fill("120");
console.log("browser: customer and scope entered");
await page.getByRole("button", { name: "Continue", exact: true }).click();
for (const value of ["521 E Tremont · TREMONT-521", "BIMTech Corp", "Coordination Meetings · 120 Hours"])
  assert.ok(await page.getByText(value, { exact: false }).isVisible());
assert.ok(await page.getByRole("button", { name: "Continue to full setup" }).isEnabled());
await page.screenshot({ path: path.join(output, "completed-quick-intake.png"), fullPage: true });
fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ suite: "post-p17-build02-production-component-browser", status: "PASS", component: "QuickJobIntake", assertions: 9 }, null, 2));
await browser.close();
console.log(JSON.stringify({ status: "PASS", assertions: 9, output }, null, 2));
