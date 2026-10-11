import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile = readFileSync(new URL("../artifacts/bimlog/src/pages/Profile.tsx", import.meta.url), "utf8");

for (const label of [
  "Profile workspace", "Espacio de perfil",
  "Choose the area you want to manage", "Elige el área que deseas administrar",
  "Personal", "Work", "Trabajo", "Security", "Seguridad", "Connections", "Conexiones",
]) assert.ok(profile.includes(label), `missing ${label}`);

assert.match(profile, /type ProfileArea = "personal" \| "work" \| "security" \| "connections"/);
assert.match(profile, /section"\) === "email-sending" \? "connections" : "personal"/);
assert.match(profile, /profileArea === "personal" && <>/);
assert.match(profile, /profileArea === "work" && <>/);
assert.match(profile, /profileArea === "security" && <>/);
assert.match(profile, /profileArea === "connections" && <>/);
assert.match(profile, /if \(profileArea === "work"\) \{\s*loadPerformance\(\);\s*loadMyProjects\(\);\s*loadRecentActivity\(\);/);
assert.match(profile, /if \(profileArea !== "connections"\) return;\s*loadConnections\(\);\s*loadTelegramStatus\(\);\s*loadTelegramPanel\(\);/);
assert.match(profile, /repeat\(auto-fit,minmax\(min\(140px,100%\),1fr\)\)/);
assert.match(profile, /id="profile-email-sending"/);

console.log("Progressive disclosure Block 4 Profile acceptance: PASS");
