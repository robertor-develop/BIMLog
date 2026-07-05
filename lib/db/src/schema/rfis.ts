import { pgTable, serial, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const rfisTable = pgTable("rfis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  subject: text("subject").notNull(),
  rfiType: text("rfi_type"),
  description: text("description"),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  createdById: integer("created_by_id").references(() => usersTable.id).notNull(),
  dueDate: timestamp("due_date"),
  respondedAt: timestamp("responded_at"),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // New fields v2
  dateRequested: timestamp("date_requested"),
  dateRequired: timestamp("date_required"),

  submittedByCompany: text("submitted_by_company"),
  submittedByContact: text("submitted_by_contact"),
  submittedByAddress: text("submitted_by_address"),
  submittedByPhone: text("submitted_by_phone"),
  submittedByEmail: text("submitted_by_email"),

  submittedToCompany: text("submitted_to_company"),
  submittedToPerson: text("submitted_to_person"),
  submittedToEmail: text("submitted_to_email"),

  drawingNumber: text("drawing_number"),
  drawingTitle: text("drawing_title"),
  specSection: text("spec_section"),
  detailNumber: text("detail_number"),
  noteNumber: text("note_number"),
  locationDescription: text("location_description"),

  question: text("question"),

  costImpact: text("cost_impact"),
  costImpactAmount: text("cost_impact_amount"),
  scheduleImpact: text("schedule_impact"),
  scheduleImpactDays: integer("schedule_impact_days"),

  answer: text("answer"),
  answeredBy: text("answered_by"),
  dateAnswered: timestamp("date_answered"),

  distributionList: json("distribution_list").$type<string[]>().default([]),
  attachmentsJson: json("attachments_json").$type<string[]>().default([]),
  responseAttachmentsJson: json("response_attachments_json").$type<string[]>().default([]),

  parentRfiId: integer("parent_rfi_id"),
  revisionNumber: integer("revision_number").default(0),
  revisionOf: integer("revision_of"),

  projectAddress: text("project_address"),

  // RFI send accountability: status is self-reported by the author (manual
  // mark-as-sent via copy/paste). There is no platform email delivery.
  sendStatus: text("send_status").default("draft"),
  sentAt: timestamp("sent_at"),
  sentById: integer("sent_by_id").references(() => usersTable.id),
  sendMethod: text("send_method"),

  ballInCourt: text("ball_in_court"),
  lastOverdueNotificationSent: timestamp("last_overdue_notification_sent"),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),

  // Set when an RFI is created from a Navisworks viewpoint via the plugin. Holds
  // the source viewpoint's code so the detail panel can deep-link back to it.
  sourceViewpointId: text("source_viewpoint_id"),
});

export type Rfi = typeof rfisTable.$inferSelect;
