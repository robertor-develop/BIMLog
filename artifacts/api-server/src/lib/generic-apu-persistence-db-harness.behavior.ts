import assert from "node:assert/strict";
import {
  GENERIC_APU_PERSISTENCE_COMMAND,
  prepareGenericApuPersistenceHarness,
} from "./generic-apu-persistence-db-harness.ts";

const refuses = (url: string | undefined, code: RegExp) =>
  assert.throws(
    () => prepareGenericApuPersistenceHarness({ PROD_DATABASE_URL: url }),
    code,
  );

refuses(undefined, /APU_DB_HARNESS_CREDENTIAL_MISSING/);
refuses("", /APU_DB_HARNESS_CREDENTIAL_MISSING/);
refuses("not-a-url", /APU_DB_HARNESS_URL_INVALID/);
refuses("https://user:pass@127.0.0.1:55436/bimlog_financial_build2", /PROTOCOL_REJECTED/);
refuses("postgresql://user:pass@db.example.com:55436/bimlog_financial_build2", /HOST_REJECTED/);
refuses("postgresql://user:pass@127.0.0.1:5432/bimlog_financial_build2", /PORT_REJECTED/);
refuses("postgresql://user:pass@127.0.0.1:55436/production", /DATABASE_REJECTED/);
refuses("postgresql://127.0.0.1:55436/bimlog_financial_build2", /CREDENTIAL_MISSING/);
refuses("postgresql://user:pass@127.0.0.1:55436/bimlog_financial_build2?sslmode=disable", /OPTIONS_REJECTED/);

for (const host of ["127.0.0.1", "localhost"] as const) {
  const launch = prepareGenericApuPersistenceHarness({
    PROD_DATABASE_URL: `postgresql://disposable-user:process-only-secret@${host}:55436/bimlog_financial_build2`,
  });
  assert.equal(launch.command, GENERIC_APU_PERSISTENCE_COMMAND);
  assert.equal(launch.cwd, "artifacts/api-server");
  assert.equal(launch.environmentVariable, "PROD_DATABASE_URL");
  assert.equal(launch.target, `postgresql://${host}:55436/bimlog_financial_build2`);
  assert.doesNotMatch(JSON.stringify(launch), /process-only-secret|disposable-user/);
}

console.log(JSON.stringify({
  suite: "generic-apu-persistence-db-harness",
  status: "PASS",
  checks: 19,
  networkConnections: 0,
  databaseMutations: 0,
  command: GENERIC_APU_PERSISTENCE_COMMAND,
}));
