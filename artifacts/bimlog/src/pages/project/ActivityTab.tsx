import { useState } from "react";
import { useListActivity } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { PrintPdfButton } from "@/components/PrintPdfButton";
import { Shield, Activity, Download, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { activityDetailsClampStyle, presentActivityDetails } from "@/lib/activity-presentation";

const ACTION_CONFIG: Record<string, { badgeClass: string; dotColor: string; label: string }> = {
  upload:        { badgeClass: "badge-blue",   dotColor: "#2563EB", label: "UPLOAD" },
  rename:        { badgeClass: "badge-amber",  dotColor: "#D97706", label: "RENAME" },
  delete:        { badgeClass: "badge-red",    dotColor: "#DC2626", label: "DELETE" },
  status_change: { badgeClass: "badge-purple", dotColor: "#7C3AED", label: "STATUS" },
  reject:        { badgeClass: "badge-red",    dotColor: "#DC2626", label: "REJECT" },
  create:        { badgeClass: "badge-green",  dotColor: "#16A34A", label: "CREATE" },
  update:        { badgeClass: "badge-gray",   dotColor: "#6B7280", label: "UPDATE" },
};

const AVATAR_COLORS = ["av-blue", "av-purple", "av-green", "av-orange", "av-teal", "av-red"];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ActivityTab({ projectId }: { projectId: number }) {
  const { t, tt, lang } = useI18n();
  const { token } = useAuthStore();
  const { data: activities, isLoading } = useListActivity(projectId);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const presentedDetails = (a: { details?: string | null; actionType?: string; entityType?: string | null }) =>
    presentActivityDetails(a.details, { actionType: a.actionType, entityType: a.entityType ?? undefined });

  const filtered = (activities ?? []).filter(a => {
    const detail = presentedDetails(a);
    const matchesSearch =
      !search ||
      a.userFullName?.toLowerCase().includes(search.toLowerCase()) ||
      a.userCompanyName?.toLowerCase().includes(search.toLowerCase()) ||
      a.fileNameAfter?.toLowerCase().includes(search.toLowerCase()) ||
      a.fileNameBefore?.toLowerCase().includes(search.toLowerCase()) ||
      detail.summary.toLowerCase().includes(search.toLowerCase()) ||
      detail.meta.join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || a.actionType === actionFilter;
    const ts = new Date(a.createdAt).getTime();
    const matchesFrom = !dateFrom || ts >= new Date(dateFrom).getTime();
    const matchesTo = !dateTo || ts <= new Date(dateTo + "T23:59:59.999").getTime();
    return matchesSearch && matchesAction && matchesFrom && matchesTo;
  });

  const actionTypes = [...new Set((activities ?? []).map(a => a.actionType))];

  const exportCsv = () => {
    if (!activities?.length) return;
    const headers = [
      tt("Timestamp", "Fecha/hora"),
      tt("User", "Usuario"),
      tt("Company", "Empresa"),
      tt("Action", "Acción"),
      tt("Entity", "Entidad"),
      tt("File Before", "Archivo anterior"),
      tt("File After", "Archivo posterior"),
      tt("Details", "Detalles"),
    ];
    const rows = filtered.map(a => [
      format(new Date(a.createdAt), "yyyy-MM-dd HH:mm:ss"),
      a.userFullName ?? "",
      a.userCompanyName ?? "",
      a.actionType,
      a.entityType ?? "",
      a.fileNameBefore ?? "",
      a.fileNameAfter ?? "",
      [presentedDetails(a).summary, ...presentedDetails(a).meta].filter(Boolean).join(" | "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bimlog-activity-${projectId}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!token) return;
    setExportingPdf(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      params.set("lang", lang);
      if (search.trim()) params.set("search", search.trim());
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const response = await fetch(`/api/v1/projects/${projectId}/activity/export.pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`PDF export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bimlog-activity-${projectId}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 14 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.activity")}</div>
          <div className="section-sub">
            {activities?.length ?? 0} {tt("events permanently recorded", "eventos registrados permanentemente")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="locked-badge">
            <Shield style={{ width: 11, height: 11 }} />
            {t("activity.auditTrail")}
          </div>
          <PrintPdfButton
            lang={lang}
            loading={exportingPdf}
            disabled={!token}
            disabledReason={tt("Sign in to print this activity view.", "Inicia sesion para imprimir esta vista de actividad.")}
            onClick={() => void exportPdf()}
          />
          {(activities?.length ?? 0) > 0 && (
            <>
              <button
                onClick={exportCsv}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 6,
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--muted-foreground))"
                }}
              >
                <Download style={{ width: 12, height: 12 }} />
                {tt("Export CSV", "Exportar CSV")}
              </button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div role="alert" style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 6, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#991B1B", fontSize: 11 }}>
          {tt("PDF export could not be generated.", "No se pudo generar la exportación PDF")} {exportError}
        </div>
      )}

      {/* Immutable notice */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
        padding: "10px 14px", background: "#F0FDF4",
        border: "1px solid #BBF7D0", borderRadius: 8,
        fontSize: 11, color: "#166534"
      }}>
        <Shield style={{ width: 14, height: 14, flexShrink: 0 }} />
        <span>
          {tt("This log is ", "Este registro es ")}<strong>{tt("immutable and append-only", "inmutable y solo permite agregar eventos")}</strong>{tt(". No events can be deleted or modified.", ". No se pueden eliminar ni modificar eventos.")}
          {" "}
          {tt("Every file upload, rename, deletion, and status change is permanently attributed to the user and company that performed it.", "Cada carga, cambio de nombre, eliminación y cambio de estado queda atribuido permanentemente al usuario y la empresa que lo realizó.")}
        </span>
      </div>

      {/* Search + filter row */}
      {(activities?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              width: 13, height: 13, color: "hsl(var(--muted-foreground))"
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tt("Search by user, company, or file name...", "Buscar por usuario, empresa o nombre de archivo...")}
              style={{
                width: "100%", height: 34, paddingLeft: 30, paddingRight: 12,
                border: "1px solid hsl(var(--border))", borderRadius: 6,
                fontSize: 12, background: "hsl(var(--card))",
                color: "hsl(var(--foreground))", outline: "none",
                fontFamily: "var(--font-sans)"
              }}
            />
          </div>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Filter style={{
              position: "absolute", left: 9, width: 12, height: 12,
              color: "hsl(var(--muted-foreground))", pointerEvents: "none"
            }} />
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              style={{ height: 34, paddingLeft: 26, paddingRight: 10, fontSize: 12, minWidth: 130 }}
            >
              <option value="all">{tt("All actions", "Todas las acciones")}</option>
              {actionTypes.map(type => (
                <option key={type} value={type}>
                  {ACTION_CONFIG[type]?.label ?? type.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>{tt("From", "Desde")}</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ height: 34, padding: "0 8px", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12, background: "hsl(var(--card))", color: "hsl(var(--foreground))", outline: "none", cursor: "pointer" }}
            />
            <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>{tt("To", "Hasta")}</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ height: 34, padding: "0 8px", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12, background: "hsl(var(--card))", color: "hsl(var(--foreground))", outline: "none", cursor: "pointer" }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                style={{ height: 34, padding: "0 8px", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11, background: "hsl(var(--card))", color: "hsl(var(--muted-foreground))", cursor: "pointer" }}
              >
                {tt("Clear", "Limpiar")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        filtered.length > 0 ? (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>{t("activity.date")}</th>
                  <th style={{ width: 160 }}>{t("activity.user")}</th>
                  <th style={{ width: 90 }}>{t("activity.action")}</th>
                  <th>{t("activity.details")}</th>
                  <th style={{ width: 140 }}>{tt("File before", "Archivo anterior")}</th>
                  <th style={{ width: 140 }}>{tt("File after", "Archivo posterior")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(act => {
                  const cfg = ACTION_CONFIG[act.actionType] ?? { badgeClass: "badge-gray", dotColor: "#6B7280", label: act.actionType.toUpperCase() };
                  const avatarColor = getAvatarColor(act.userFullName ?? "?");
                  const detail = presentedDetails(act);

                  return (
                    <tr key={act.id}>
                      <td>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                          {format(new Date(act.createdAt), "MMM d, yyyy")}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                          {format(new Date(act.createdAt), "HH:mm:ss")}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className={`avatar avatar-sm ${avatarColor}`}>
                            {act.userFullName?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                              {act.userFullName}
                            </div>
                            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                              {act.userCompanyName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${cfg.badgeClass}`} style={{ fontSize: 9 }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", maxWidth: 220 }}>
                        {detail.summary && (
                          <span style={activityDetailsClampStyle}>
                            {detail.summary}
                          </span>
                        )}
                        {detail.meta.length > 0 && (
                          <span style={{ display: "block", marginTop: 2, fontSize: 10 }}>
                            {detail.meta.join(" • ")}
                          </span>
                        )}
                      </td>
                      <td>
                        {act.fileNameBefore && (
                          <span className="file-name" style={{ fontSize: 10, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130, color: "hsl(var(--muted-foreground))" }}>
                            {act.fileNameBefore}
                          </span>
                        )}
                      </td>
                      <td>
                        {act.fileNameAfter && (
                          <span className="file-name" style={{ fontSize: 10, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                            {act.fileNameAfter}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer count */}
            <div style={{
              padding: "10px 16px", borderTop: "1px solid hsl(var(--border))",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: 11, color: "hsl(var(--muted-foreground))"
            }}>
              <span>
                {tt("Showing", "Mostrando")} {filtered.length} {tt("of", "de")} {activities?.length ?? 0} {tt("events", "eventos")}
                {search && ` ${tt("matching", "que coinciden con")} "${search}"`}
                {actionFilter !== "all" && ` · ${tt("action", "acción")}: ${actionFilter}`}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Shield style={{ width: 11, height: 11 }} />
                {tt("Immutable · append-only · no deletions permitted", "Inmutable · solo agregar · no se permiten eliminaciones")}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <Activity style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
            </div>
            <div className="empty-title">
              {search || actionFilter !== "all" ? tt("No matching events", "No hay eventos coincidentes") : t("activity.empty")}
            </div>
            <div className="empty-desc">
              {search || actionFilter !== "all"
                ? tt("Try adjusting your search or filter to find what you're looking for.", "Ajusta la búsqueda o el filtro para encontrar lo que necesitas.")
                : tt("Activity will be recorded here as soon as the first file is uploaded or an RFI is created.", "La actividad se registrará aquí cuando se cargue el primer archivo o se cree una RFI.")}
            </div>
          </div>
        )
      )}
    </div>
  );
}
