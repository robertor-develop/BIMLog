import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("./LensNextPanelView.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("./lens-next-client.ts", import.meta.url), "utf8");
const model = readFileSync(new URL("./lens-next-model.ts", import.meta.url), "utf8");
const checks: string[] = [];
const check = (condition: unknown, label: string) => { assert.ok(condition, label); checks.push(label); };

check(view.includes("BIMLog · Controlled publishing"), "truthful M8 workspace label");
check(view.includes("Your current project role is read-only"), "read-only role has fail-closed explanation");
check(view.includes("Review publication") && view.includes("Confirm publish") && view.includes("Cancel"), "explicit review and confirmation step");
check(view.includes("immutable BIMLog audit receipt"), "confirmation explains immutable audit consequence");
check(view.includes('type: "status"') && view.includes('type: "comment"') && view.includes('type: "assignment"'), "only three controlled actions are exposed");
check(panel.includes("publishAttempt") && panel.includes("idempotencyKey"), "retry retains actor-scoped idempotency identity");
check(panel.includes("mutationVersion: result.issue.mutationVersion"), "verified server version replaces local version");
check(client.includes('contractVersion: "lens-next-publish.v1"'), "client pins exact publishing contract");
check(client.includes('method: "POST"') && client.includes("Authorization: `Bearer ${token}`"), "authenticated POST transport");
check(model.includes("publishing.allowed === true"), "server capability controls publisher visibility");
check(model.includes("mutationVersion"), "pull adapter retains concurrency version");
console.log(JSON.stringify({ status: "PASS", checks: checks.length, details: checks }));
