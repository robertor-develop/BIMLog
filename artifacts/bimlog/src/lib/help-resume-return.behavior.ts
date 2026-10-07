import assert from "node:assert/strict";
import { safeHelpResumeTarget } from "./task-journeys";

const exact = "/help?view=guides&journey=setup&step=2&from=%2Fprojects%2F63%2Fintake%3Fstage%3Ddelivery";
assert.equal(safeHelpResumeTarget(exact, 63), exact);
for (const unsafe of [
  "https://evil.test/help?from=%2Fprojects%2F63%2Fintake",
  "/help?from=%2Fprojects%2F62%2Fintake",
  "/help?from=%2Fprojects%2F63%2Fintake&token=secret",
  "/help?from=%2Fprojects%2F63%2Fintake&from=%2Fprojects%2F63%2Ffiles",
  "/help?view=unknown&from=%2Fprojects%2F63%2Fintake",
  "/help?step=two&from=%2Fprojects%2F63%2Fintake",
  "/help?from=%2Fprojects%2F63%2Fintake#escape",
]) assert.equal(safeHelpResumeTarget(unsafe, 63), null, unsafe);
console.log("Help resume return contract: PASS");
