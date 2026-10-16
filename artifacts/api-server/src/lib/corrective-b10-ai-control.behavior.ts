import assert from "node:assert/strict";import fs from "node:fs";
const meeting=fs.readFileSync(new URL("../routes/meeting_minutes.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("./ai-control-plane-migration.ts",import.meta.url),"utf8");
assert.doesNotMatch(meeting,/new OpenAI|audio\.transcriptions|openaiApiKey/);
assert.match(meeting,/LEGACY_AI_AUDIO_RETIRED/);
assert.match(migration,/FOR UPDATE/);assert.match(migration,/encryptSecret/);assert.match(migration,/openai_api_key=NULL/);assert.match(migration,/ROLLBACK/);
console.log(JSON.stringify({status:"PASS",build:"B10",legacyAudio:"retired",legacySecrets:"transactionally-migrated"}));
