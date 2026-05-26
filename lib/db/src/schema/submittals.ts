import { pgTable, serial, text, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const submittalsTable = pgTable("submittals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id).notNull(),
  number: text("number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(),
  specSection: text("spec_section"),
  submittalType: text("submittal_type").notNull(),
  submittedById: integer("submitted_by_id").references(() => usersTable.id).notNull(),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Extended fields v2
  drawingNumber: text("drawing_number"),
  drawingTitle: text("drawing_title"),
  submittalCategory: text("submittal_category"),

  submittedByCompany: text("submitted_by_company"),
  submittedByPerson: text("submitted_by_person"),
  submittedByEmail: text("submitted_by_email"),
  submittedByPhone: text("submitted_by_phone"),
  submittedByAddress: text("submitted_by_address"),

  submittedToCompany: text("submitted_to_company"),
  submittedToPerson: text("submitted_to_person"),
  submittedToEmail: text("submitted_to_email"),
  submittedToExternal: boolean("submitted_to_external").default(false),

  manufacturer: text("manufacturer"),
  modelNumber: text("model_number"),
  dateSubmitted: timestamp("date_submitted"),
  dateRequired: timestamp("date_required"),

  procurementStatus: text("procurement_status").default("not_ordered"),
  ballInCourt: text("ball_in_court"),
  ballInCourtHistory: json("ball_in_court_history").$type<Array<{ party: string; setAt: string; setBy: string }>>().default([]),

  aiCheckResult: json("ai_check_result").$type<{
    overall: "pass" | "possible_issue" | "fail";
    aspects: Array<{ label: string; result: "pass" | "possible_issue" | "fail"; note: string }>;
    summary: string;
  } | null>().default(null),
  aiCheckRan: boolean("ai_check_ran").default(false),

  reviewDecision: text("review_decision"),
  complianceNotes: text("compliance_notes"),
  rejectionReason: text("rejection_reason"),
  reviewerName: text("reviewer_name"),
  reviewedAt: timestamp("reviewed_at"),

  linkedRfiId: integer("linked_rfi_id"),
  rapidApprovalFlag: boolean("rapid_approval_flag").default(false),

  parentSubmittalId: integer("parent_submittal_id"),
  revisionNumber: integer("revision_number").default(0),

  distributionList: json("distribution_list").$type<string[]>().default([]),
  attachmentsJson: json("attachments_json").$type<string[]>().default([]),
  lastOverdueNotificationSent: timestamp("last_overdue_notification_sent"),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),
});

export type Submittal = typeof submittalsTable.$inferSelect;
