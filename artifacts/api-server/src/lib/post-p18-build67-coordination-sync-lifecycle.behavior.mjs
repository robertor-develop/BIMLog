import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertConnectorJobTransition, retryDelaySeconds } from "./connector-foundation-contract.ts";

const migration = await readFile(new URL("./connector-foundation-migration.ts", import.meta.url), "utf8");
const store = await readFile(new URL("./coordination-hub-postgres-store.ts", import.meta.url), "utf8");
const service = await readFile(new URL("./coordination-hub-service.ts", import.meta.url), "utf8");

assert.doesNotThrow(() => assertConnectorJobTransition("queued", "leased"));
assert.doesNotThrow(() => assertConnectorJobTransition("leased", "retry"));
assert.doesNotThrow(() => assertConnectorJobTransition("leased", "completed"));
assert.doesNotThrow(() => assertConnectorJobTransition("leased", "dead_letter"));
assert.doesNotThrow(() => assertConnectorJobTransition("dead_letter", "queued"));
assert.throws(() => assertConnectorJobTransition("completed", "queued"), /Invalid connector job transition/);
assert.equal(retryDelaySeconds(1), 30);
assert.equal(retryDelaySeconds(8), 3600);

const checks = [
  ["claim is limited to queued or retry jobs", /state IN \('queued','retry'\)/, migration],
  ["claim refuses exhausted attempts", /attempts<max_attempts/, migration],
  ["expired lease is reclaimable", /lease_expires_at IS NULL OR lease_expires_at<now\(\)/, migration],
  ["workers use skip locked", /FOR UPDATE SKIP LOCKED LIMIT 1/, migration],
  ["claim increments fencing and attempt counters", /fencing_token=fencing_token\+1,[\s\S]*attempts=attempts\+1/, migration],
  ["attempt bounds are database-enforced", /attempts>=0 AND max_attempts>0 AND attempts<=max_attempts/, migration],
  ["lease fields are state-consistent", /connector_jobs_lease_chk/, migration],
  ["terminal timestamps are state-consistent", /connector_jobs_terminal_chk/, migration],
  ["job events are immutable", /connector_job_events_immutable BEFORE UPDATE OR DELETE/, migration],
  ["enqueue writes the first scoped immutable event", /INSERT INTO connector_job_events[\s\S]*1,'queued','none','queued',0,'user',[\s\S]*'job_enqueued'/, store],
  ["queue event preserves attributable actor", /String\(record\.createdById\)/, store],
  ["queue event evidence binds request digest", /requestDigest: record\.requestDigest/, store],
  ["idempotent replay requires an identical request digest", /existing\.requestDigest !== command\.job\.requestDigest[\s\S]*CoordinationConflictError/, service],
  ["terminal dead letters surface as attention", /state='dead_letter'\) AS "attentionJobs"/, store],
];

for (const [name, pattern, source] of checks) assert.match(source, pattern, name);
console.log(`PASS post-P18 Build 67 Coordination synchronization lifecycle (${checks.length + 8} checks)`);
