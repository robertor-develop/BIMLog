import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const route = readFileSync("artifacts/api-server/src/routes/support-case-messages.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/components/commercial/SupportConversation.tsx", "utf8");
const customer = readFileSync("artifacts/bimlog/src/components/commercial/SupportCasesPanel.tsx", "utf8");
const admin = readFileSync("artifacts/bimlog/src/components/admin/SupportCaseQueue.tsx", "utf8");

for (const contract of [
  'router.post("/support/cases/:id/messages",authMiddleware,post("customer"))',
  'router.post("/admin/support/cases/:id/messages",authMiddleware,isSuperAdminMiddleware,post("administrator"))',
  'router.put("/support/cases/:id/messages/read",authMiddleware,markRead(false))',
  'router.put("/admin/support/cases/:id/messages/read",authMiddleware,isSuperAdminMiddleware,markRead(true))',
  "requesterUserId", "companyId", "assignedToUserId!==actorId", "SUPPORT_CASE_CLOSED",
  "SUPPORT_MESSAGE_REQUEST_CONFLICT", "SUPPORT_READ_MESSAGE_MISMATCH", 'for("update")',
  "onConflictDoUpdate", 'private, no-store', "notificationsTable",
]) assert.ok(route.includes(contract), `${contract} must remain in support conversation authority`);

for (const visible of [
  "Support conversation", "Conversación de soporte", "Conversation", "Conversación",
  "No messages yet.", "Todavía no hay mensajes.", "Send reply", "Enviar respuesta",
  "Conversation marked as read.", "Conversación marcada como leída.",
  "Message could not be sent. Refresh and try again.", "No se pudo enviar el mensaje. Actualice e intente de nuevo.",
  'role="status"', 'role="alert"', "Refresh conversation", "Actualizar conversación",
]) assert.ok(ui.includes(visible), `${visible} must remain visible`);
assert.ok(customer.includes("SupportConversation") && admin.includes("SupportConversation"), "customer and administrator queues must both expose the conversation");
assert.match(ui, /canPost&&<form/);
assert.match(customer, /!\["resolved","closed"\]\.includes\(item\.status\)/);

const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const fixture of [
  "artifacts/api-server/src/routes/support-case-messages.behavior.ts",
  "artifacts/api-server/src/lib/support-conversation-read-route.behavior.ts",
  "artifacts/bimlog/src/components/commercial/support-conversation.behavior.ts",
  "artifacts/bimlog/src/components/commercial/support-conversation-read.behavior.ts",
  "artifacts/bimlog/src/components/commercial/support-unread-awareness.behavior.ts",
  "artifacts/bimlog/src/components/commercial/support-notification-navigation.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(fixture)], { stdio: "inherit", windowsHide: true });

console.log("P207 support-message customer/admin discovery, role/company/requester isolation, assigned-owner denial, idempotency, notification, read persistence, closed-state denial, bilingual accessibility, and refresh/reopen gates passed.");
