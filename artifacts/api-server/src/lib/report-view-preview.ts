import type { OwnedReportView, ReportViewActor } from "./report-view-ownership";
import { reportViewAccess } from "./report-view-ownership";

export type PreviewableReportView = OwnedReportView & { name: string; configuration: unknown };

export function openReportView(view: PreviewableReportView, actor: ReportViewActor, mode: "preview" | "edit") {
  const access = reportViewAccess(view, actor);
  if (!access.canRead) throw new Error("REPORT_VIEW_READ_DENIED");
  if (mode === "edit" && !access.canEdit) throw new Error("REPORT_VIEW_WRITE_DENIED");
  return { view, mode, writable: mode === "edit" && access.canEdit, autosave: false } as const;
}

export function duplicateReportViewAsPersonal(input: { source: PreviewableReportView; actor: ReportViewActor; newId: string; newName: string }) {
  const opened = openReportView(input.source, input.actor, "preview");
  return { ...opened.view, id: input.newId, name: input.newName.trim(), owner: { scope: "personal" as const, userId: input.actor.userId }, version: 1, defaultVersion: null, readOnly: false };
}

export function saveReportView(opened: ReturnType<typeof openReportView>) {
  if (!opened.writable || opened.mode !== "edit") throw new Error("REPORT_VIEW_EXPLICIT_EDIT_REQUIRED");
  return { ...opened.view, version: opened.view.version + 1 };
}
