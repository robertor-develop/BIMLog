import assert from "node:assert/strict";
import { readBimlogSource } from "./block21-source-reader.js";

const app = readBimlogSource("App.tsx");
const landing = readBimlogSource("pages/Landing.tsx");
const register = readBimlogSource("pages/Register.tsx");
const onboarding = readBimlogSource("components/OnboardingFlow.tsx");
const help = readBimlogSource("pages/HelpCenter.tsx");

for (const route of ["/", "/features", "/pricing", "/register", "/login", "/help"]) {
  assert.ok(app.includes(`path=\"${route}\"`), `missing route ${route}`);
}
assert.match(landing, /href="\/register"/);
assert.match(register, /setLocation\("\/dashboard"\)/);
assert.match(onboarding, /Go to Dashboard/);
assert.match(onboarding, /role="dialog"/);
assert.match(help, /Help Center/);
assert.match(help, /Search Help Center/);

console.log("block21 build105 public-to-authenticated acceptance contract: PASS");
