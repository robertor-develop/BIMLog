import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const lensIssueResponsesTable = pgTable("lens_issue_responses", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  issueId: integer("issue_id").notNull(),
  clientRequestId: text("client_request_id").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  issueMutationVersion: integer("issue_mutation_version").notNull(),
  resultingMutationVersion: integer("resulting_mutation_version").notNull(),
  outcome: text("outcome").notNull(),
  response: text("response").notNull(),
  recommendedCompany: text("recommended_company"),
  reviewStatus: text("review_status").notNull().default("pending_review"),
  actorUserId: integer("actor_user_id").notNull(),
  actorCompanyName: text("actor_company_name").notNull(),
  reviewerUserId: integer("reviewer_user_id"),
  reviewDecision: text("review_decision"),
  reviewReason: text("review_reason"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectIssueRequestUnique: uniqueIndex("lens_issue_responses_project_issue_request_unique")
    .on(table.projectId, table.issueId, table.clientRequestId),
  projectIssueCreatedIndex: index("lens_issue_responses_project_issue_created_idx")
    .on(table.projectId, table.issueId, table.createdAt),
}));

