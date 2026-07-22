import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  rfisTable,
  submittalsTable,
  filesTable,
  activityLogTable,
  transmittalsTable,
  changeOrdersTable,
  meetingMinutesTable,
  meetingSubmittalLinksTable,
  meetingLensViewpointLinksTable,
  meetingClashLinksTable,
  meetingScheduleBucketLinksTable,
  meetingScheduleTaskLinksTable,
  actionItemsTable,
  projectMembersTable,
  usersTable,
  namingConventionsTable,
  namingFieldsTable,
  namingConventionVersionsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc, ne } from "drizzle-orm";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import {
  createPdfDocument,
  drawBrandedHeader,
  drawFooter,
  REPORT_THEMES,
  reportFileName,
  type ReportTheme,
} from "../lib/pdf-kit";
import jwt from "jsonwebtoken";

async function verifyReportToken(req: any, res: any): Promise<number | null> {
  const token =
    req.headers.authorization?.split(" ")[1] || (req.query.token as string);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return decoded.userId || decoded.id;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }
}

const router: Router = Router();

function pdfHeader(
  doc: PDFKit.PDFDocument,
  project: { name: string; code: string },
  title: string,
  theme: ReportTheme,
) {
  doc.y =
    drawBrandedHeader(doc, {
      margin: 50,
      companyName: "BIMLog",
      title,
      projectName: project.name,
      projectCode: project.code,
      reportDate: new Date(),
      theme,
    }) + 12;
}

function pdfFooter(doc: PDFKit.PDFDocument, project: { name: string }) {
  drawFooter(doc, {
    margin: 50,
    y: doc.page.height - 30,
    projectName: project.name,
    timestamp: new Date().toLocaleDateString("en-US"),
  });
}

function row(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  labelWidth = 160,
) {
  const y = doc.y;
  doc
    .fontSize(9)
    .font("Helvetica-Bold")
    .fillColor("#374151")
    .text(label, 50, y, { width: labelWidth });
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#111")
    .text(value, 50 + labelWidth, y, {
      width: doc.page.width - 50 - labelWidth - 50,
    });
  doc.moveDown(0.3);
}

async function getProject(projectId: number) {
  const [p] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId));
  return p;
}

// ── PROJECT HEALTH ─────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/project-health/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const [rfis, subs, files] = await Promise.all([
        db.select().from(rfisTable).where(eq(rfisTable.projectId, projectId)),
        db
          .select()
          .from(submittalsTable)
          .where(eq(submittalsTable.projectId, projectId)),
        db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      ]);
      const now = Date.now();
      const openRfis = rfis.filter((r) => r.status !== "closed");
      const overdueRfis = openRfis.filter(
        (r) => r.dueDate && new Date(r.dueDate).getTime() < now,
      );
      const pendingSubs = subs.filter((s) =>
        ["pending", "under_review"].includes(s.status),
      );
      const validFiles = files.filter((f) => f.status === "valid");
      const compRate = files.length
        ? Math.round((validFiles.length / files.length) * 100)
        : 0;

      const doc = createPdfDocument({ size: "LETTER", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Project Health Report";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.platform.health);

      row(doc, "Project Name", project.name);
      row(doc, "Project Code", project.code);
      row(doc, "Status", project.status.toUpperCase());
      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#111")
        .text("Summary Statistics");
      doc.moveDown(0.3);
      row(doc, "Total RFIs", String(rfis.length));
      row(doc, "Open RFIs", String(openRfis.length));
      row(doc, "Overdue RFIs", String(overdueRfis.length));
      row(doc, "Total Submittals", String(subs.length));
      row(doc, "Pending Submittals", String(pendingSubs.length));
      row(doc, "Total Files", String(files.length));
      row(doc, "Compliant Files", String(validFiles.length));
      row(doc, "Compliance Rate", `${compRate}%`);
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── COMPLIANCE ─────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/compliance/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const files = await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.projectId, projectId))
      .orderBy(desc(filesTable.createdAt));
    const doc = createPdfDocument({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    const title = "Naming Compliance Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.files.compliance);

    const valid = files.filter((f) => f.status === "valid");
    const rejected = files.filter((f) => f.status === "rejected");
    row(doc, "Total Files", String(files.length));
    row(doc, "Compliant", String(valid.length));
    row(doc, "Non-Compliant", String(rejected.length));
    row(
      doc,
      "Compliance Rate",
      files.length
        ? `${Math.round((valid.length / files.length) * 100)}%`
        : "—",
    );
    doc.moveDown();
    if (rejected.length) {
      doc.fontSize(10).font("Helvetica-Bold").text("Non-Compliant Files:");
      doc.moveDown(0.3);
      rejected.slice(0, 30).forEach((f) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#DC2626")
          .text(`Failed: ${f.fileName}`, { indent: 10 });
      });
    }
    pdfFooter(doc, project);
    doc.end();
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

// ── RFI AGING ──────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/rfi-aging/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const rfis = await db
      .select()
      .from(rfisTable)
      .where(
        and(eq(rfisTable.projectId, projectId), ne(rfisTable.status, "closed")),
      )
      .orderBy(rfisTable.createdAt);
    const now = Date.now();
    const doc = createPdfDocument({
      size: "LETTER",
      margin: 50,
      layout: "landscape",
    });
    res.setHeader("Content-Type", "application/pdf");
    const title = "RFI Aging Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.rfi.log);

    rfis.forEach((rfi) => {
      const ageDays = Math.floor(
        (now - new Date(rfi.createdAt).getTime()) / 86400000,
      );
      const overdue = rfi.dueDate && new Date(rfi.dueDate).getTime() < now;
      doc
        .fontSize(8)
        .font(overdue ? "Helvetica-Bold" : "Helvetica")
        .fillColor(overdue ? "#DC2626" : "#111")
        .text(
          `${rfi.number} | ${rfi.subject} | ${rfi.status} | Age: ${ageDays}d${overdue ? " OVERDUE" : ""}`,
          { indent: 5 },
        );
    });
    if (!rfis.length)
      doc
        .fontSize(10)
        .fillColor("#666")
        .text("No open RFIs.", { align: "center" });
    pdfFooter(doc, project);
    doc.end();
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

// ── SUBMITTAL STATUS ───────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/submittal-status/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const subs = await db
        .select()
        .from(submittalsTable)
        .where(eq(submittalsTable.projectId, projectId))
        .orderBy(submittalsTable.number);
      const doc = createPdfDocument({
        size: "LETTER",
        margin: 50,
        layout: "landscape",
      });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Submittal Status Report";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.submittal.log);

      subs.forEach((s) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#111")
          .text(
            `${s.number} | ${s.title} | ${s.status.replace(/_/g, " ")} | Ball in Court: ${s.ballInCourt ?? "—"}`,
            { indent: 5 },
          );
      });
      if (!subs.length)
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No submittals found.", { align: "center" });
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── PERFORMANCE ────────────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/performance/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const [rfis, subs, files, members] = await Promise.all([
      db.select().from(rfisTable).where(eq(rfisTable.projectId, projectId)),
      db
        .select()
        .from(submittalsTable)
        .where(eq(submittalsTable.projectId, projectId)),
      db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      db
        .select({ userId: projectMembersTable.userId })
        .from(projectMembersTable)
        .where(eq(projectMembersTable.projectId, projectId)),
    ]);
    const now = Date.now();
    const doc = createPdfDocument({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    const title = "Project Performance Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.platform.performance);

    row(doc, "Team Members", String(members.length));
    row(doc, "Total RFIs", String(rfis.length));
    row(
      doc,
      "Closed RFIs",
      String(rfis.filter((r) => r.status === "closed").length),
    );
    row(doc, "Total Submittals", String(subs.length));
    row(
      doc,
      "Approved Submittals",
      String(subs.filter((s) => s.status === "approved").length),
    );
    row(doc, "Total Files", String(files.length));
    row(
      doc,
      "Compliance Rate",
      files.length
        ? `${Math.round((files.filter((f) => f.status === "valid").length / files.length) * 100)}%`
        : "—",
    );
    pdfFooter(doc, project);
    doc.end();
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

// ── DISPUTE REPORT ─────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/dispute/:module/:itemId/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    const module = req.params.module;
    const itemId = Number(req.params.itemId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const activity = await db
        .select()
        .from(activityLogTable)
        .where(
          and(
            eq(activityLogTable.projectId, projectId),
            eq(activityLogTable.entityId, itemId),
          ),
        )
        .orderBy(activityLogTable.createdAt);

      const doc = createPdfDocument({ size: "LETTER", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      const title = `Dispute Report - ${module.toUpperCase()} ${itemId}`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.platform.dispute);

      doc.fontSize(10).font("Helvetica-Bold").text("Full Audit Trail:");
      doc.moveDown(0.3);
      activity.forEach((a) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#111")
          .text(
            `${new Date(a.createdAt).toLocaleString()} | ${a.userFullName} | ${a.actionType} | ${a.details ?? ""}`,
            { indent: 5 },
          );
      });
      if (!activity.length)
        doc
          .fontSize(9)
          .fillColor("#666")
          .text("No activity recorded for this item.", { indent: 5 });
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── AUDIT CERTIFICATE ──────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/audit-certificate/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const files = await db
        .select()
        .from(filesTable)
        .where(eq(filesTable.projectId, projectId));
      const doc = createPdfDocument({ size: "LETTER", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Document Audit Certificate";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.files.audit);

      row(doc, "Certificate Date", new Date().toLocaleDateString());
      row(doc, "Total Documents", String(files.length));
      row(
        doc,
        "Verified Documents",
        String(files.filter((f) => f.fileHash).length),
      );
      doc.moveDown();
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#374151")
        .text(
          "This certificate confirms that all listed documents were processed through BIMLog's document control system with immutable activity logging, SHA-256 hash verification, and audit trail preservation.",
        );
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── MEETING MINUTES ────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/meeting-minutes/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const [viewer] = await db
        .select({ isSuperAdmin: usersTable.isSuperAdmin })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      if (!viewer?.isSuperAdmin) {
        const [membership] = await db
          .select({ userId: projectMembersTable.userId })
          .from(projectMembersTable)
          .where(
            and(
              eq(projectMembersTable.projectId, projectId),
              eq(projectMembersTable.userId, userId),
            ),
          )
          .limit(1);
        if (!membership) {
          res.status(403).json({ error: "Not a member of this project" });
          return;
        }
      }
      const requestedMeetingId = req.query.meeting_id
        ? Number(req.query.meeting_id)
        : null;
      if (
        requestedMeetingId !== null &&
        !Number.isInteger(requestedMeetingId)
      ) {
        res.status(400).json({ error: "Invalid meeting_id" });
        return;
      }
      const meetings = await db
        .select()
        .from(meetingMinutesTable)
        .where(
          requestedMeetingId === null
            ? eq(meetingMinutesTable.projectId, projectId)
            : and(
                eq(meetingMinutesTable.projectId, projectId),
                eq(meetingMinutesTable.id, requestedMeetingId),
              ),
        )
        .orderBy(desc(meetingMinutesTable.meetingDate));
      const doc = createPdfDocument({ size: "LETTER", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      const title =
        requestedMeetingId !== null && meetings[0]
          ? `Meeting Minutes - ${meetings[0].title}`
          : "Meeting Minutes Report";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.meeting.log);

      for (const m of meetings) {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text(`${new Date(m.meetingDate).toLocaleDateString()} — ${m.title}`);
        if (m.location)
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#666")
            .text(`Location: ${m.location}`);
        if (m.notes)
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(m.notes, { indent: 10 });
        const linkedSubmittals = await db
          .select()
          .from(meetingSubmittalLinksTable)
          .where(
            and(
              eq(meetingSubmittalLinksTable.projectId, projectId),
              eq(meetingSubmittalLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingSubmittalLinksTable.id);
        if (linkedSubmittals.length) {
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text("Linked Submittals (meeting-time values)", { indent: 10 });
          linkedSubmittals.forEach((link) => {
            const details = [
              link.floorSnapshot,
              link.disciplineSnapshot,
              link.statusSnapshot.replace(/[_-]+/g, " "),
              link.responsibleSnapshot,
              link.deadlineSnapshot
                ? `Due ${new Date(link.deadlineSnapshot).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${link.numberSnapshot} — ${link.titleSnapshot}${link.descriptionSnapshot && link.descriptionSnapshot !== link.titleSnapshot ? `: ${link.descriptionSnapshot}` : ""}${details ? ` (${details})` : ""}`,
                { indent: 16 },
              );
          });
        }
        const linkedLensViewpoints = await db
          .select()
          .from(meetingLensViewpointLinksTable)
          .where(
            and(
              eq(meetingLensViewpointLinksTable.projectId, projectId),
              eq(meetingLensViewpointLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingLensViewpointLinksTable.id);
        if (linkedLensViewpoints.length) {
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text("Linked Lens Viewpoints (meeting-time values)", {
              indent: 10,
            });
          linkedLensViewpoints.forEach((link) => {
            const details = [
              link.floorSnapshot,
              link.tradeSnapshot,
              link.responsibleSnapshot,
              link.statusSnapshot.replace(/[_-]+/g, " "),
              `Revision ${link.revisionNumberSnapshot}`,
              link.lifecycleStatusSnapshot,
            ]
              .filter(Boolean)
              .join(" - ");
            const identity = [
              link.displayIdSnapshot || link.viewpointIdSnapshot,
              link.sourceDisplayLabelSnapshot,
              link.bimlogPhysicalIdSnapshot || link.sourcePhysicalIdSnapshot,
            ]
              .filter(Boolean)
              .join(" / ");
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${identity}${link.noteSnapshot ? ` - ${link.noteSnapshot}` : ""}${details ? ` (${details})` : ""}`,
                { indent: 16 },
              );
          });
        }
        const scheduleBuckets = await db
          .select()
          .from(meetingScheduleBucketLinksTable)
          .where(
            and(
              eq(meetingScheduleBucketLinksTable.projectId, projectId),
              eq(meetingScheduleBucketLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingScheduleBucketLinksTable.id);
        for (const bucket of scheduleBuckets) {
          const tasks = await db
            .select()
            .from(meetingScheduleTaskLinksTable)
            .where(
              eq(
                meetingScheduleTaskLinksTable.meetingScheduleBucketLinkId,
                bucket.id,
              ),
            )
            .orderBy(meetingScheduleTaskLinksTable.id);
          const summary = bucket.lastSummary as Record<string, unknown>;
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text(`Schedule Bucket: ${bucket.bucketNameSnapshot}`, {
              indent: 10,
            });
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(
              `Created/Synced task links: ${tasks.length}. Deadline ${new Date(bucket.generalDeadlineSnapshot).toLocaleDateString()}. Summary: created ${summary.created ?? 0}, linked ${summary.linked ?? 0}, updated ${summary.updated ?? 0}, skipped ${summary.skipped ?? 0}, conflicts ${summary.conflicts ?? 0}.`,
              { indent: 16 },
            );
          tasks.forEach((task) => {
            const details = [
              task.floorSnapshot,
              task.disciplineSnapshot,
              task.responsibleSnapshot,
              task.statusSnapshot.replace(/[_-]+/g, " "),
              `Due ${new Date(task.deadlineSnapshot).toLocaleDateString()}`,
            ]
              .filter(Boolean)
              .join(" - ");
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${task.numberSnapshot} - ${task.titleSnapshot}${details ? ` (${details})` : ""}. Schedule task #${task.milestoneId}.`,
                { indent: 16 },
              );
          });
        }
        const linkedClashes = await db
          .select()
          .from(meetingClashLinksTable)
          .where(
            and(
              eq(meetingClashLinksTable.projectId, projectId),
              eq(meetingClashLinksTable.meetingId, m.id),
            ),
          )
          .orderBy(meetingClashLinksTable.id);
        const renderClashes = (
          heading: string,
          links: typeof linkedClashes,
        ) => {
          if (!links.length) return;
          doc
            .fontSize(8)
            .font("Helvetica-Bold")
            .fillColor("#111")
            .text(heading, { indent: 10 });
          links.forEach((link) => {
            const details = [
              link.floorSnapshot,
              link.disciplineSnapshot,
              link.responsibleSnapshot,
              link.groupSnapshot,
              link.statusSnapshot.replace(/[_-]+/g, " "),
              link.deadlineSnapshot
                ? `Due ${new Date(link.deadlineSnapshot).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const notes = link.meetingNotes
              ? ` Meeting notes: ${link.meetingNotes}`
              : "";
            doc
              .fontSize(8)
              .font("Helvetica")
              .fillColor("#374151")
              .text(
                `${link.clashNumberSnapshot || `Clash ${link.clashId}`} — ${link.descriptionSnapshot || "No description"}${details ? ` (${details})` : ""}.${notes}`,
                { indent: 16 },
              );
          });
        };
        renderClashes(
          "Linked Clashes (explicitly refreshed meeting snapshots)",
          linkedClashes.filter((link) => link.linkState === "active"),
        );
        renderClashes(
          "Clash link history (not in active discussion)",
          linkedClashes.filter((link) => link.linkState !== "active"),
        );
        if (m.aiSummary)
          doc
            .fontSize(8)
            .font("Helvetica-Oblique")
            .fillColor("#2563EB")
            .text(`AI Summary: ${m.aiSummary}`, { indent: 10 });
        doc.moveDown(0.5);
      }
      if (!meetings.length)
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No meetings recorded.", { align: "center" });
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── CHANGE ORDER LOG ───────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/change-order-log/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const cos = await db
        .select()
        .from(changeOrdersTable)
        .where(eq(changeOrdersTable.projectId, projectId))
        .orderBy(changeOrdersTable.number);
      const doc = createPdfDocument({
        size: "LETTER",
        margin: 50,
        layout: "landscape",
      });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Change Order Log";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.changeOrder.log);

      cos.forEach((co) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#111")
          .text(
            `${co.number} | ${co.title} | ${co.status.replace(/_/g, " ")} | Impact: ${co.contractValueImpact ?? "—"} | Schedule: ${co.scheduleImpactDays ? co.scheduleImpactDays + "d" : "—"}`,
            { indent: 5 },
          );
      });
      if (!cos.length)
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No change orders.", { align: "center" });
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── TRANSMITTAL LOG ────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/reports/transmittal-log/pdf",
  async (req, res) => {
    const userId = await verifyReportToken(req, res);
    if (!userId) return;
    const projectId = Number(req.params.projectId);
    try {
      const project = await getProject(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const txs = await db
        .select()
        .from(transmittalsTable)
        .where(eq(transmittalsTable.projectId, projectId))
        .orderBy(transmittalsTable.number);
      const doc = createPdfDocument({
        size: "LETTER",
        margin: 50,
        layout: "landscape",
      });
      res.setHeader("Content-Type", "application/pdf");
      const title = "Transmittal Log";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${reportFileName(title)}"`,
      );
      doc.pipe(res);
      pdfHeader(doc, project, title, REPORT_THEMES.transmittal.log);

      txs.forEach((tx) => {
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#111")
          .text(
            `${tx.number} | ${tx.title} | ${tx.status} | ${tx.sentAt ? new Date(tx.sentAt).toLocaleDateString() : "Draft"}`,
            { indent: 5 },
          );
      });
      if (!txs.length)
        doc
          .fontSize(10)
          .fillColor("#666")
          .text("No transmittals.", { align: "center" });
      pdfFooter(doc, project);
      doc.end();
    } catch (err) {
      res
        .status(500)
        .json({
          error: err instanceof Error ? err.message : "Internal server error",
        });
    }
  },
);

// ── CVR FULL REPORT ──────────────────────────────────────────────────────────
router.get("/projects/:projectId/reports/cvr/pdf", async (req, res) => {
  const userId = await verifyReportToken(req, res);
  if (!userId) return;
  const projectId = Number(req.params.projectId);
  try {
    const project = await getProject(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const [allFiles, conventions, versions] = await Promise.all([
      db.select().from(filesTable).where(eq(filesTable.projectId, projectId)),
      db
        .select()
        .from(namingConventionsTable)
        .where(eq(namingConventionsTable.projectId, projectId))
        .limit(1),
      db
        .select()
        .from(namingConventionVersionsTable)
        .where(eq(namingConventionVersionsTable.projectId, projectId))
        .orderBy(desc(namingConventionVersionsTable.conventionVersion)),
    ]);

    const convention = conventions[0] || null;
    let fields: Array<{
      label: string;
      fieldOrder: number;
      allowedValues: string[];
    }> = [];
    if (convention) {
      fields = (await db
        .select()
        .from(namingFieldsTable)
        .where(eq(namingFieldsTable.conventionId, convention.id))
        .orderBy(namingFieldsTable.fieldOrder)) as typeof fields;
    }
    const latestVersion = versions[0] || null;

    const totalFiles = allFiles.length;
    const matched = allFiles.filter(
      (f) => f.contentVerificationResult === "match",
    ).length;
    const flagged = allFiles.filter(
      (f) =>
        f.contentVerificationResult === "possible_mismatch" ||
        f.contentVerificationResult === "clear_mismatch",
    );
    const pendingReview = allFiles.filter(
      (f) => f.cvrWorkflowStatus === "pending_admin_review",
    ).length;
    const adminApproved = allFiles.filter(
      (f) => f.cvrWorkflowStatus === "admin_approved",
    ).length;
    const adminRejected = allFiles.filter(
      (f) => f.cvrWorkflowStatus === "admin_rejected",
    ).length;
    const notApplicable = allFiles.filter(
      (f) => f.contentVerificationResult === "not_applicable",
    ).length;

    const doc = createPdfDocument({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    const title = "Content Verification Report";
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportFileName(title)}"`,
    );
    doc.pipe(res);
    pdfHeader(doc, project, title, REPORT_THEMES.files.cvr);

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1D4ED8")
      .text("Convention Intelligence");
    doc.moveDown(0.3);
    if (convention) {
      row(
        doc,
        "Convention Status",
        convention.isActive ? "Active" : "Inactive",
      );
      row(
        doc,
        "Separator",
        convention.separator === "-"
          ? "Dash (-)"
          : convention.separator === "_"
            ? "Underscore (_)"
            : convention.separator,
      );
      row(doc, "Company Codes", convention.companyCode || "Not set");
      row(doc, "Enforce Uppercase", convention.enforceUppercase ? "Yes" : "No");
      row(
        doc,
        "Convention Version",
        String(
          latestVersion?.conventionVersion ?? convention.conventionVersion ?? 1,
        ),
      );
      row(doc, "Total Versions", String(versions.length));
      if (convention.userGuidance) {
        row(doc, "User Guidance", convention.userGuidance);
      }
    } else {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#6B7280")
        .text("No naming convention configured for this project.");
    }
    doc.moveDown(0.5);

    if (latestVersion) {
      const discs = latestVersion.acceptedDisciplines as Array<{
        code: string;
        label: string;
      }>;
      const docTypes = latestVersion.acceptedDocTypes as Array<{
        code: string;
        label: string;
      }>;
      const systems = latestVersion.acceptedSystems as Array<{
        code: string;
        label: string;
      }>;

      if (discs.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Accepted Disciplines");
        doc.moveDown(0.2);
        discs.forEach((d) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${d.code} — ${d.label}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (docTypes.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Accepted Document Types");
        doc.moveDown(0.2);
        docTypes.forEach((d) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${d.code} — ${d.label}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (systems.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Accepted Systems");
        doc.moveDown(0.2);
        systems.forEach((s) => {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${s.code} — ${s.label}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (fields.length > 0) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Field Order");
        doc.moveDown(0.2);
        fields.forEach((f, i) => {
          const vals = f.allowedValues?.length
            ? ` (${f.allowedValues.slice(0, 6).join(", ")}${f.allowedValues.length > 6 ? "..." : ""})`
            : "";
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#374151")
            .text(`${i + 1}. ${f.label}${vals}`, { indent: 10 });
        });
        doc.moveDown(0.4);
      }
      if (latestVersion.analysisSummary) {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text("Latest Analysis Summary");
        doc.moveDown(0.2);
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#374151")
          .text(latestVersion.analysisSummary, { indent: 10 });
        doc.moveDown(0.4);
      }
    }

    if (versions.length > 1) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#111")
        .text("Version History");
      doc.moveDown(0.2);
      versions.forEach((v) => {
        const dateStr = new Date(v.createdAt).toLocaleDateString();
        const summary = v.changeSummary
          ? ` — ${v.changeSummary.slice(0, 120)}${v.changeSummary.length > 120 ? "..." : ""}`
          : "";
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#374151")
          .text(`v${v.conventionVersion} (${dateStr})${summary}`, {
            indent: 10,
          });
      });
      doc.moveDown(0.5);
    }

    doc
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor("#D1D5DB")
      .stroke();
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1D4ED8")
      .text("File Verification Results");
    doc.moveDown(0.3);

    row(doc, "Total Files Processed", String(totalFiles));
    row(doc, "Matched", String(matched));
    row(doc, "Flagged (Possible + Clear Mismatch)", String(flagged.length));
    row(doc, "Not Applicable", String(notApplicable));
    row(doc, "Pending Admin Review", String(pendingReview));
    row(doc, "Admin Approved", String(adminApproved));
    row(doc, "Admin Rejected", String(adminRejected));
    doc.moveDown();

    if (flagged.length > 0) {
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#DC2626")
        .text("Flagged Files");
      doc.moveDown(0.5);
      for (const f of flagged) {
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#111")
          .text(f.fileName, { continued: true });
        doc
          .font("Helvetica")
          .fillColor("#666")
          .text(
            `  |  CVR: ${f.contentVerificationResult}  |  Workflow: ${f.cvrWorkflowStatus}  |  Uploaded: ${new Date(f.createdAt).toLocaleDateString()}`,
          );
        if (f.hashComparisonNote) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#92400E")
            .text(`  Assessment: ${f.hashComparisonNote}`, { indent: 10 });
        }
        if (f.cvrUserReason) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#555")
            .text(`  User reason: ${f.cvrUserReason}`, { indent: 10 });
        }
        if (f.cvrAdminAction) {
          doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#555")
            .text(`  Admin decision: ${f.cvrAdminAction}`, { indent: 10 });
        }
        doc.moveDown(0.3);
      }
    } else if (totalFiles > 0) {
      doc
        .fontSize(10)
        .fillColor("#16A34A")
        .text("No CVR flags found. All files passed content verification.", {
          align: "center",
        });
    } else {
      doc
        .fontSize(10)
        .fillColor("#6B7280")
        .text(
          "No files have been uploaded to this project yet. CVR file analysis will populate this section when files are submitted.",
          { align: "center" },
        );
    }

    pdfFooter(doc, project);
    doc.end();
  } catch (err) {
    res
      .status(500)
      .json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
  }
});

export default router;
