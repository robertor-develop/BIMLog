import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { companiesTable, usersTable } from "./users";
import { projectDirectoryTable } from "./project-directory";
import { rfisTable } from "./rfis";
import { submittalsTable } from "./submittals";
import { clashesTable, clashReportsTable } from "./clash_reports";
import { lensViewpointsTable } from "./lens-viewpoints";
import { projectMilestonesTable } from "./project-milestones";
import { scheduleBucketsTable } from "./schedule-planner";

export const meetingMinutesTable = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projectsTable.id)
    .notNull(),
  title: text("title").notNull(),
  meetingDate: timestamp("meeting_date").notNull(),
  location: text("location"),
  createdById: integer("created_by_id")
    .references(() => usersTable.id)
    .notNull(),
  notes: text("notes"),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deleteReason: text("delete_reason"),
});

export const meetingAttendeesTable = pgTable("meeting_attendees", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id")
    .references(() => meetingMinutesTable.id)
    .notNull(),
  userId: integer("user_id").references(() => usersTable.id),
  companyId: integer("company_id").references(() => companiesTable.id),
  directoryEntryId: integer("directory_entry_id").references(() => projectDirectoryTable.id),
  externalEmail: text("external_email"),
  fullName: text("full_name").notNull(),
  company: text("company"),
  role: text("role"),
});

export const meetingDraftsTable = pgTable(
  "meeting_drafts",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    meetingId: integer("meeting_id").references(() => meetingMinutesTable.id),
    draftKey: text("draft_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    canonicalUpdatedAt: timestamp("canonical_updated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => ({
    meetingDraftScopeUnique: uniqueIndex("meeting_drafts_scope_uidx").on(
      t.projectId,
      t.userId,
      t.draftKey,
    ),
    meetingDraftExpiryIdx: index("meeting_drafts_expiry_idx").on(t.expiresAt),
  }),
);

// Canonical RFI identity plus immutable meeting-time display snapshots. Later
// RFI edits therefore cannot rewrite saved or exported meeting history.
export const meetingRfiLinksTable = pgTable(
  "meeting_rfi_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    rfiId: integer("rfi_id")
      .references(() => rfisTable.id)
      .notNull(),
    rfiNumberSnapshot: text("rfi_number_snapshot").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    descriptionSnapshot: text("description_snapshot"),
    statusSnapshot: text("status_snapshot").notNull(),
    responsibleSnapshot: text("responsible_snapshot"),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingRfiUnique: uniqueIndex("meeting_rfi_links_meeting_rfi_uidx").on(
      t.meetingId,
      t.rfiId,
    ),
    projectMeetingIdx: index("meeting_rfi_links_project_meeting_idx").on(
      t.projectId,
      t.meetingId,
    ),
  }),
);

// Canonical Submittal identity plus immutable meeting-time display snapshots.
// Later Submittal edits cannot silently rewrite saved or exported minutes.
export const meetingSubmittalLinksTable = pgTable(
  "meeting_submittal_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    submittalId: integer("submittal_id")
      .references(() => submittalsTable.id)
      .notNull(),
    numberSnapshot: text("number_snapshot").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    descriptionSnapshot: text("description_snapshot"),
    floorSnapshot: text("floor_snapshot"),
    disciplineSnapshot: text("discipline_snapshot"),
    disciplineBucketSnapshot: text("discipline_bucket_snapshot"),
    statusSnapshot: text("status_snapshot").notNull(),
    responsibleSnapshot: text("responsible_snapshot"),
    deadlineSnapshot: timestamp("deadline_snapshot"),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingSubmittalUnique: uniqueIndex(
      "meeting_submittal_links_meeting_submittal_uidx",
    ).on(t.meetingId, t.submittalId),
    projectMeetingIdx: index("meeting_submittal_links_project_meeting_idx").on(
      t.projectId,
      t.meetingId,
    ),
  }),
);

// Stable Clash Log identity plus an explicitly refreshed meeting snapshot.
// Removal is a meeting-only state transition; the canonical Clash is untouched.
export const meetingClashLinksTable = pgTable(
  "meeting_clash_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    clashId: integer("clash_id")
      .references(() => clashesTable.id)
      .notNull(),
    clashReportIdSnapshot: integer("clash_report_id_snapshot")
      .references(() => clashReportsTable.id)
      .notNull(),
    clashNumberSnapshot: text("clash_number_snapshot"),
    descriptionSnapshot: text("description_snapshot"),
    floorSnapshot: text("floor_snapshot"),
    disciplineSnapshot: text("discipline_snapshot"),
    responsibleSnapshot: text("responsible_snapshot"),
    groupSnapshot: text("group_snapshot"),
    statusSnapshot: text("status_snapshot").notNull(),
    deadlineSnapshot: timestamp("deadline_snapshot"),
    meetingNotes: text("meeting_notes"),
    linkState: text("link_state").default("active").notNull(),
    firstLoadedAt: timestamp("first_loaded_at").defaultNow().notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingClashUnique: uniqueIndex(
      "meeting_clash_links_meeting_clash_uidx",
    ).on(t.meetingId, t.clashId),
    projectMeetingIdx: index("meeting_clash_links_project_meeting_idx").on(
      t.projectId,
      t.meetingId,
    ),
  }),
);

export const meetingClashRefreshEventsTable = pgTable(
  "meeting_clash_refresh_events",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    actorId: integer("actor_id")
      .references(() => usersTable.id)
      .notNull(),
    eventType: text("event_type").notNull(),
    addedCount: integer("added_count").default(0).notNull(),
    updatedCount: integer("updated_count").default(0).notNull(),
    unchangedCount: integer("unchanged_count").default(0).notNull(),
    excludedCount: integer("excluded_count").default(0).notNull(),
    userExcludedCount: integer("user_excluded_count").default(0).notNull(),
    failureCount: integer("failure_count").default(0).notNull(),
    openCount: integer("open_count").default(0).notNull(),
    followUpCount: integer("follow_up_count").default(0).notNull(),
    changedFields: text("changed_fields"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingIdx: index("meeting_clash_refresh_events_meeting_idx").on(
      t.projectId,
      t.meetingId,
      t.createdAt,
    ),
  }),
);

// Canonical BIMLog Lens viewpoint identity plus immutable meeting-time snapshots.
// Later Lens edits/revisions do not silently rewrite saved or exported meeting history.
export const meetingLensViewpointLinksTable = pgTable(
  "meeting_lens_viewpoint_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    lensViewpointId: integer("lens_viewpoint_id")
      .references(() => lensViewpointsTable.id)
      .notNull(),
    viewpointIdSnapshot: text("viewpoint_id_snapshot").notNull(),
    displayIdSnapshot: text("display_id_snapshot"),
    navisworksGuidSnapshot: text("navisworks_guid_snapshot"),
    bimlogPhysicalIdSnapshot: text("bimlog_physical_id_snapshot"),
    sourcePhysicalIdSnapshot: text("source_physical_id_snapshot"),
    sourceDisplayLabelSnapshot: text("source_display_label_snapshot"),
    issueGroupIdSnapshot: text("issue_group_id_snapshot"),
    noteSnapshot: text("note_snapshot"),
    floorSnapshot: text("floor_snapshot"),
    tradeSnapshot: text("trade_snapshot"),
    responsibleSnapshot: text("responsible_snapshot"),
    statusSnapshot: text("status_snapshot").notNull(),
    lifecycleStatusSnapshot: text("lifecycle_status_snapshot").notNull(),
    revisionNumberSnapshot: integer("revision_number_snapshot").notNull(),
    capturedAtSnapshot: timestamp("captured_at_snapshot", {
      withTimezone: true,
    }),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingLensUnique: uniqueIndex(
      "meeting_lens_viewpoint_links_meeting_lens_uidx",
    ).on(t.meetingId, t.lensViewpointId),
    projectMeetingIdx: index(
      "meeting_lens_viewpoint_links_project_meeting_idx",
    ).on(t.projectId, t.meetingId),
  }),
);

// Meeting M4: durable Schedule Bucket creation/sync relationship. The idempotency
// key and request fingerprint make retries deterministic without relying on a
// bucket name, Submittal number, or mutable task title.
export const meetingScheduleBucketLinksTable = pgTable(
  "meeting_schedule_bucket_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    bucketId: integer("bucket_id")
      .references(() => scheduleBucketsTable.id)
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    bucketNameSnapshot: text("bucket_name_snapshot").notNull(),
    targetScheduleSnapshot: text("target_schedule_snapshot"),
    generalDeadlineSnapshot: timestamp("general_deadline_snapshot").notNull(),
    responsibleSnapshot: text("responsible_snapshot"),
    assignedUserIdSnapshot: integer("assigned_user_id_snapshot").references(
      () => usersTable.id,
    ),
    includeModeSnapshot: text("include_mode_snapshot").notNull(),
    syncPolicySnapshot: jsonb("sync_policy_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    lastSummary: jsonb("last_summary")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    lastSyncedById: integer("last_synced_by_id").references(
      () => usersTable.id,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingKeyUnique: uniqueIndex(
      "meeting_schedule_bucket_links_meeting_key_uidx",
    ).on(t.projectId, t.meetingId, t.idempotencyKey),
    meetingBucketUnique: uniqueIndex(
      "meeting_schedule_bucket_links_meeting_bucket_uidx",
    ).on(t.meetingId, t.bucketId),
  }),
);

export const meetingScheduleTaskLinksTable = pgTable(
  "meeting_schedule_task_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projectsTable.id)
      .notNull(),
    meetingScheduleBucketLinkId: integer("meeting_schedule_bucket_link_id")
      .references(() => meetingScheduleBucketLinksTable.id)
      .notNull(),
    meetingId: integer("meeting_id")
      .references(() => meetingMinutesTable.id)
      .notNull(),
    meetingSubmittalLinkId: integer("meeting_submittal_link_id")
      .references(() => meetingSubmittalLinksTable.id)
      .notNull(),
    submittalId: integer("submittal_id")
      .references(() => submittalsTable.id)
      .notNull(),
    milestoneId: integer("milestone_id")
      .references(() => projectMilestonesTable.id)
      .notNull(),
    bucketId: integer("bucket_id")
      .references(() => scheduleBucketsTable.id)
      .notNull(),
    numberSnapshot: text("number_snapshot").notNull(),
    titleSnapshot: text("title_snapshot").notNull(),
    floorSnapshot: text("floor_snapshot"),
    disciplineSnapshot: text("discipline_snapshot"),
    responsibleSnapshot: text("responsible_snapshot"),
    statusSnapshot: text("status_snapshot").notNull(),
    deadlineSnapshot: timestamp("deadline_snapshot").notNull(),
    meetingNotesSnapshot: text("meeting_notes_snapshot"),
    linkState: text("link_state").notNull().default("active"),
    createdById: integer("created_by_id")
      .references(() => usersTable.id)
      .notNull(),
    lastSyncedById: integer("last_synced_by_id").references(
      () => usersTable.id,
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    meetingSubmittalUnique: uniqueIndex(
      "meeting_schedule_task_links_meeting_submittal_uidx",
    ).on(t.projectId, t.meetingId, t.meetingSubmittalLinkId),
    meetingMilestoneUnique: uniqueIndex(
      "meeting_schedule_task_links_meeting_milestone_uidx",
    ).on(t.projectId, t.meetingId, t.milestoneId),
  }),
);

export type MeetingMinutes = typeof meetingMinutesTable.$inferSelect;
export type MeetingAttendee = typeof meetingAttendeesTable.$inferSelect;
export type MeetingRfiLink = typeof meetingRfiLinksTable.$inferSelect;
export type MeetingSubmittalLink =
  typeof meetingSubmittalLinksTable.$inferSelect;
export type MeetingClashLink = typeof meetingClashLinksTable.$inferSelect;
export type MeetingClashRefreshEvent =
  typeof meetingClashRefreshEventsTable.$inferSelect;
export type MeetingLensViewpointLink =
  typeof meetingLensViewpointLinksTable.$inferSelect;
export type MeetingScheduleBucketLink =
  typeof meetingScheduleBucketLinksTable.$inferSelect;
export type MeetingScheduleTaskLink =
  typeof meetingScheduleTaskLinksTable.$inferSelect;
