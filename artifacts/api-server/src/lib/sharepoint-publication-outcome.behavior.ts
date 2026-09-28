import assert from "node:assert/strict";
import { classifySharePointPublicationOutcome } from "./sharepoint-publication-outcome";
assert.deepEqual(classifySharePointPublicationOutcome("completed"), { outcome: "completed", action: "none", published: true });
assert.equal(classifySharePointPublicationOutcome("retry").published, false);
assert.equal(classifySharePointPublicationOutcome("dead_letter").action, "administrator_review");
assert.deepEqual(classifySharePointPublicationOutcome("unknown"), { outcome: "pending", action: "refresh", published: false });
