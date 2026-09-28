export type ReportViewOwner = { scope: "personal"; userId: number } | { scope: "company"; companyId: number };
export type ReportViewActor = { userId: number; companyId: number; canManageCompanyViews: boolean };
export type OwnedReportView = { id: string; owner: ReportViewOwner; version: number; defaultVersion: number | null; readOnly: boolean };

export function reportViewAccess(view: OwnedReportView, actor: ReportViewActor) {
  const owner = view.owner.scope === "personal" ? view.owner.userId === actor.userId : view.owner.companyId === actor.companyId;
  const canRead = owner;
  const canEdit = canRead && !view.readOnly && (view.owner.scope === "personal" || actor.canManageCompanyViews);
  return { canRead, canEdit, canSetDefault: canEdit };
}

export function updateOwnedReportView(input: { view: OwnedReportView; actor: ReportViewActor; expectedVersion: number; setDefault?: boolean }) {
  const access = reportViewAccess(input.view, input.actor);
  if (!access.canEdit) throw new Error("REPORT_VIEW_WRITE_DENIED");
  if (input.view.version !== input.expectedVersion) throw new Error("REPORT_VIEW_VERSION_CONFLICT");
  if (input.setDefault && !access.canSetDefault) throw new Error("REPORT_VIEW_DEFAULT_DENIED");
  return { ...input.view, version: input.view.version + 1, defaultVersion: input.setDefault ? input.view.version + 1 : input.view.defaultVersion };
}

export function selectVersionedDefault(views: readonly OwnedReportView[]) {
  return views.filter(view => view.defaultVersion === view.version).sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}
