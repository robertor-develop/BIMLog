import { db } from "@workspace/db";
import { rfisTable, submittalsTable, projectsTable, usersTable } from "@workspace/db/schema";
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

export function startOverdueNotifier(): void {
  console.log("[overdue-notifier] Starting hourly overdue check...");
  const run = async () => {
    await checkOverdueRfis();
    await checkOverdueSubmittals();
  };
  run().catch(() => {});
  setInterval(run, ONE_HOUR_MS);
}
