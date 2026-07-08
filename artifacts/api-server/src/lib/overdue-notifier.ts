import { db } from "@workspace/db";
import { rfisTable, submittalsTable, projectsTable, usersTable, filesTable, activityLogTable } from "@workspace/db/schema";
import { and, eq, lt, isNull, or, isNotNull } from "drizzle-orm";
import { sendEmail, makeRfiOverdueEmail, makeSubmittalOverdueEmail, getUserLang, notifEnabled } from "./email";

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

async function checkOverdueRfis(): Promise<void> {
  try {
    const now = new Date();
    const openStatuses = ["open", "in_review", "pending"];

    const rfis = await db.select().from(rfisTable)
      .where(and(
        lt(rfisTable.dateRequired, now),
        isNull(rfisTable.lastOverdueNotificationSent),
      ));

    const overdueRfis = rfis.filter(r =>
      openStatuses.includes(r.status) && r.submittedToEmail
    );

    for (const rfi of overdueRfis) {
      const project = await db.select().from(projectsTable).where(eq(projectsTable.id, rfi.projectId)).limit(1);
      const projectName = project[0]?.name || "Unknown Project";
      const daysOverdue = Math.ceil((now.getTime() - new Date(rfi.dateRequired!).getTime()) / ONE_DAY_MS);

      const recipient = await db.select().from(usersTable).where(eq(usersTable.email, rfi.submittedToEmail!)).limit(1);
      const prefs = recipient[0]?.notificationPreferences;
      if (!notifEnabled(prefs, "rfi_overdue")) continue;
      const lang = getUserLang(prefs);

      await sendEmail({
        to: rfi.submittedToEmail!,
        subject: lang === "es"
          ? `VENCIDO: Respuesta requerida — RFI ${rfi.number}`
          : `OVERDUE: RFI ${rfi.number} response required`,
        html: makeRfiOverdueEmail({
          lang,
          rfiNumber: rfi.number,
          subject: rfi.subject,
          projectName,
          daysOverdue,
          projectId: rfi.projectId,
        }),
      });

      await db.update(rfisTable)
        .set({ lastOverdueNotificationSent: now })
        .where(eq(rfisTable.id, rfi.id));
    }
  } catch (err) {
    console.error("[overdue-notifier] RFI check failed:", err instanceof Error ? err.message : err);
  }
}

async function checkOverdueSubmittals(): Promise<void> {
  try {
    const now = new Date();

    const submittals = await db.select().from(submittalsTable)
      .where(and(
        lt(submittalsTable.dateRequired, now),
        isNull(submittalsTable.lastOverdueNotificationSent),
      ));

    const overdueSubmittals = submittals.filter(s =>
      s.status === "pending" && s.submittedToEmail
    );

    for (const sub of overdueSubmittals) {
      const project = await db.select().from(projectsTable).where(eq(projectsTable.id, sub.projectId)).limit(1);
      const projectName = project[0]?.name || "Unknown Project";
      const daysOverdue = Math.ceil((now.getTime() - new Date(sub.dateRequired!).getTime()) / ONE_DAY_MS);

      const recipient = await db.select().from(usersTable).where(eq(usersTable.email, sub.submittedToEmail!)).limit(1);
      const prefs = recipient[0]?.notificationPreferences;
      if (!notifEnabled(prefs, "submittal_overdue")) continue;
      const lang = getUserLang(prefs);

      await sendEmail({
        to: sub.submittedToEmail!,
        subject: lang === "es"
          ? `VENCIDO: Revisión de Entregable ${sub.number} requerida`
          : `OVERDUE: Submittal ${sub.number} review required`,
        html: makeSubmittalOverdueEmail({
          lang,
          submittalNumber: sub.number,
          title: sub.title,
          projectName,
          daysOverdue,
          projectId: sub.projectId,
        }),
      });

      await db.update(submittalsTable)
        .set({ lastOverdueNotificationSent: now })
        .where(eq(submittalsTable.id, sub.id));
    }
  } catch (err) {
    console.error("[overdue-notifier] Submittal check failed:", err instanceof Error ? err.message : err);
  }
}

async function checkCvrReminders(): Promise<void> {
  try {
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() - ONE_DAY_MS);
    const reminderCooldown = new Date(now.getTime() - ONE_DAY_MS);

    const pendingFiles = await db.select().from(filesTable)
      .where(and(
        eq(filesTable.cvrWorkflowStatus, "pending_admin_review"),
        lt(filesTable.createdAt, reminderThreshold),
        or(isNull(filesTable.cvrReminderSentAt), lt(filesTable.cvrReminderSentAt, reminderCooldown)),
      ));

    for (const file of pendingFiles) {
      await db.insert(activityLogTable).values({
        projectId: file.projectId,
        userId: file.uploadedById,
        userFullName: "System",
        userCompanyName: "",
        actionType: "cvr_reminder_sent",
        entityType: "file",
        entityId: file.id,
        fileNameAfter: file.fileName,
        details: `CVR review reminder: file "${file.fileName}" has been pending admin review for more than 24 hours.`,
      });

      await db.update(filesTable)
        .set({ cvrReminderSentAt: now, updatedAt: now })
        .where(eq(filesTable.id, file.id));
    }

    if (pendingFiles.length > 0) {
      console.log(`[overdue-notifier] CVR reminders sent for ${pendingFiles.length} file(s)`);
    }
  } catch (err) {
    console.error("[overdue-notifier] CVR reminder check failed:", err instanceof Error ? err.message : err);
  }
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function startOverdueNotifier(): void {
  console.log("[overdue-notifier] Starting hourly overdue check...");
  const run = async () => {
    await checkOverdueRfis();
    await checkOverdueSubmittals();
  };
  run().catch((error) => {
    console.error("[overdue-notifier] Initial overdue check failed:", error instanceof Error ? error.message : error);
  });
  setInterval(run, ONE_HOUR_MS);

  const runCvr = async () => { await checkCvrReminders(); };
  runCvr().catch((error) => {
    console.error("[overdue-notifier] Initial CVR reminder check failed:", error instanceof Error ? error.message : error);
  });
  setInterval(runCvr, SIX_HOURS_MS);
}
