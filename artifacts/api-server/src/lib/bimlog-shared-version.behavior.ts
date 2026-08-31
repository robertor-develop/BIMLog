import assert from "node:assert/strict";
import {
  BIMLOG_FIRST_SHARED_VERSION,
  assertBimlogVersionTransition,
  nextBimlogSharedVersion,
  parseBimlogSharedVersion,
} from "./bimlog-shared-version";

assert.equal(nextBimlogSharedVersion("v1.0.51", "platform-apu"), BIMLOG_FIRST_SHARED_VERSION);
assert.equal(nextBimlogSharedVersion("anything-legacy", "lens-next"), BIMLOG_FIRST_SHARED_VERSION);
assert.equal(nextBimlogSharedVersion("v1.05.N01-P01", "platform-apu"), "v1.05.N01-P02");
assert.equal(nextBimlogSharedVersion("v1.05.N01-P02", "lens-next"), "v1.05.N02-P02");
assert.equal(nextBimlogSharedVersion("v1.05.N02-P02", "platform-apu"), "v1.05.N02-P03");
assert.deepEqual(parseBimlogSharedVersion("v1.05.N12-P103"), {
  raw: "v1.05.N12-P103",
  lensNext: 12,
  platform: 103,
});
assert.equal(parseBimlogSharedVersion("v1.0.51"), null);
assert.doesNotThrow(() =>
  assertBimlogVersionTransition({ previous: "v1.0.51", next: "v1.05.N01-P01", owner: "platform-apu" }),
);
assert.throws(
  () => assertBimlogVersionTransition({ previous: "v1.0.51", next: "v1.05.N01-P52", owner: "platform-apu" }),
  /BIMLOG_FIRST_SHARED_VERSION_REQUIRED/,
);
assert.throws(
  () => assertBimlogVersionTransition({ previous: "v1.05.N01-P01", next: "v1.05.N02-P02", owner: "platform-apu" }),
  /BIMLOG_LENS_COUNTER_NOT_OWNED/,
);
assert.throws(
  () => assertBimlogVersionTransition({ previous: "v1.05.N01-P01", next: "v1.05.N02-P02", owner: "lens-next" }),
  /BIMLOG_PLATFORM_COUNTER_NOT_OWNED/,
);

console.log("BIMLog shared version behavior: PASS");
