import { pgTable, bigserial, integer, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { lensViewpointsTable } from "./lens-viewpoints";

export const lensNextPublishReceiptsTable = pgTable("lens_next_publish_receipts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  viewpointId: integer("viewpoint_id").references(() => lensViewpointsTable.id).notNull(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id).notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  requestId: text("request_id").notNull(),
  actionType: text("action_type").notNull(),
  beforeSnapshot: jsonb("before_snapshot").notNull(),
  afterSnapshot: jsonb("after_snapshot").notNull(),
  reason: text("reason").notNull(),
  comment: text("comment"),
  modelFingerprint: text("model_fingerprint"),
  responsePayload: jsonb("response_payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  actorIdempotencyUnique: uniqueIndex("lens_next_publish_receipts_actor_key_uidx").on(t.actorUserId, t.idempotencyKey),
  viewpointCreatedIdx: index("lens_next_publish_receipts_viewpoint_created_idx").on(t.viewpointId, t.createdAt),
}));
