import { db } from "@workspace/db";
import {
  activityLogTable,
  changeOrdersTable,
  filesTable,
  financialContractsTable,
  genericProjectApuVersionsTable,
  jobIntakesTable,
  lensViewpointsTable,
  meetingMinutesTable,
  projectBudgetVersionsTable,
  projectMembersTable,
  rfisTable,
  submittalsTable,
  transmittalsTable,
} from "@workspace/db/schema";
import { count, eq } from "drizzle-orm";

export const PROJECT_RETIREMENT_INVENTORY_VERSION = 1;

const projectRecordGroups = [
  ["memberships", projectMembersTable],
  ["files", filesTable],
  ["rfis", rfisTable],
  ["submittals", submittalsTable],
  ["lensViewpoints", lensViewpointsTable],
  ["jobIntakes", jobIntakesTable],
  ["contracts", financialContractsTable],
  ["projectApus", genericProjectApuVersionsTable],
  ["budgets", projectBudgetVersionsTable],
  ["meetings", meetingMinutesTable],
  ["transmittals", transmittalsTable],
  ["changeOrders", changeOrdersTable],
  ["activityEvents", activityLogTable],
] as const;

export type ProjectRetirementRecordCounts = Record<(typeof projectRecordGroups)[number][0], number>;

export async function collectProjectRetirementInventory(projectId: number): Promise<ProjectRetirementRecordCounts> {
  const rows = await Promise.all(projectRecordGroups.map(async ([key, table]) => {
    const [result] = await db.select({ value: count() }).from(table).where(eq(table.projectId, projectId));
    return [key, Number(result.value)] as const;
  }));
  return Object.fromEntries(rows) as ProjectRetirementRecordCounts;
}

export function totalProjectRetirementRecords(counts: ProjectRetirementRecordCounts) {
  return Object.values(counts).reduce((total, value) => total + value, 0);
}
