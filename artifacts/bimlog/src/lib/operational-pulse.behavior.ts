import assert from "node:assert/strict";
import { operationalPulse } from "./operational-pulse";

const pulse = operationalPulse({ openRfis: 13, pendingSubmittals: 3, filesNeedingAttention: 14 });
assert.equal(pulse.total, 30);
assert.deepEqual(pulse.queues.map(queue => [queue.key, queue.count, queue.href]), [
  ["rfis", 13, "/pending?type=rfis"],
  ["submittals", 3, "/pending?type=submittals"],
  ["files", 14, "/pending?type=files"],
]);
assert.deepEqual(pulse.queues.map(queue => queue.share), [43, 10, 47]);
assert.deepEqual(operationalPulse({ openRfis: -1, pendingSubmittals: Number.NaN, filesNeedingAttention: 0 }), {
  total: 0,
  queues: [
    { key: "rfis", count: 0, share: 0, href: "/pending?type=rfis" },
    { key: "submittals", count: 0, share: 0, href: "/pending?type=submittals" },
    { key: "files", count: 0, share: 0, href: "/pending?type=files" },
  ],
});

console.log("Headquarters operational pulse model: PASS");
