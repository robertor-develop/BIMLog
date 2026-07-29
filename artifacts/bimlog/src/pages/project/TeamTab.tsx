import React, { useState, useEffect } from "react";
import { useListMembers, useAddMember, useRemoveMember, useUpdateMember } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { Button } from "@/components/ui/button";
import { PrintPdfButton } from "@/components/PrintPdfButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, Trash2, Building2, Shield, Mail, Clock, UserCheck, ArrowRightLeft, Download, Search } from "lucide-react";
import { format } from "date-fns";
import { ROLES, ROLE_KEYS, getRole, type RoleKey } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";
import { logClientError } from "@/lib/client-log";

const API = "/api/v1";
const AVATAR_COLORS = ["av-blue", "av-purple", "av-green", "av-orange", "av-teal", "av-red"];
type TeamSortKey = "company_asc" | "name_asc" | "name_desc" | "role_asc" | "joined_desc" | "joined_asc";
type TeamGroupKey = "company" | "none";
type ProjectTeamMember = {
  id: number;
  projectId?: number;
  userId: number;
  userFullName?: string;
  userEmail?: string;
  userCompanyName?: string | null;
  role: string;
  joinedAt: string;
};

const safePdfFileNameFromTitle = (title: string) => {
  const base = title.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project-team-current-view";
  return `${base}.pdf`;
};

const sanitizePdfFileName = (value: string | null) => {
  if (!value) return null;
  const leaf = value.trim().split(/[\\/]/).pop() ?? "";
  const safe = leaf
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  if (!safe || safe === ".pdf") return null;
  return /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
};

const parseContentDispositionFileName = (header: string | null) => {
  if (!header) return null;
  const encodedMatch = header.match(/(?:^|;)\s*filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  const encoded = (encodedMatch?.[1] ?? encodedMatch?.[2])?.trim();
  if (encoded) {
    const encodedValue = encoded.replace(/^UTF-8''/i, "");
    try {
      const decoded = decodeURIComponent(encodedValue);
      const safe = sanitizePdfFileName(decoded);
      if (safe) return safe;
    } catch {
      const safe = sanitizePdfFileName(encodedValue);
      if (safe) return safe;
    }
  }
  const quotedMatch = header.match(/(?:^|;)\s*filename\s*=\s*"((?:[^"\\]|\\.)*)"/i);
  const rawMatch = quotedMatch ? null : header.match(/(?:^|;)\s*filename\s*=\s*([^;]*)/i);
  const value = quotedMatch?.[1]?.replace(/\\(["\\])/g, "$1") ?? rawMatch?.[1]?.trim() ?? null;
  return sanitizePdfFileName(value);
};

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function TeamTab({ projectId, isAdmin = false }: { projectId: number; isAdmin?: boolean }) {
  const { t, tt, lang } = useI18n();
  const { adminRoles } = useConfig();
  const { user: authUser, token } = useAuthStore();
  const { data: members, isLoading } = useListMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState<TeamSortKey>("company_asc");
  const [groupBy, setGroupBy] = useState<TeamGroupKey>("company");
  const [includeEmail, setIncludeEmail] = useState(true);
  const [includeCompany, setIncludeCompany] = useState(true);
  const [includeJoined, setIncludeJoined] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");
  const memberRows = ((members ?? []) as ProjectTeamMember[]);

  const myMembership = memberRows.find(m => m.userId === authUser?.id);
  const iAmAdmin = isAdmin && myMembership?.role === "project_admin";
  const roleLabel = (role: string) => getRole(role)?.label ?? role.replace(/_/g, " ");
  const companies = Array.from(new Set(memberRows.map(m => m.userCompanyName || tt("Unknown company", "Empresa desconocida")))).sort((a, b) => a.localeCompare(b));
  const q = search.trim().toLowerCase();
  const showCompanyColumn = includeCompany && groupBy !== "company";
  const filteredMembers = [...memberRows]
    .filter(m => companyFilter === "all" || (m.userCompanyName || tt("Unknown company", "Empresa desconocida")) === companyFilter)
    .filter(m => roleFilter === "all" || m.role === roleFilter)
    .filter(m => {
      if (!q) return true;
      return [m.userFullName, m.userEmail, m.userCompanyName, roleLabel(m.role)].filter(Boolean).join(" ").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aCompany = a.userCompanyName || tt("Unknown company", "Empresa desconocida");
      const bCompany = b.userCompanyName || tt("Unknown company", "Empresa desconocida");
      const aName = a.userFullName || a.userEmail || "";
      const bName = b.userFullName || b.userEmail || "";
      if (sort === "name_asc") return aName.localeCompare(bName);
      if (sort === "name_desc") return bName.localeCompare(aName);
      if (sort === "role_asc") return roleLabel(a.role).localeCompare(roleLabel(b.role)) || aName.localeCompare(bName);
      if (sort === "joined_asc") return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      if (sort === "joined_desc") return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
      return aCompany.localeCompare(bCompany) || aName.localeCompare(bName);
    });

  const byCompany = filteredMembers.reduce<Record<string, typeof filteredMembers>>((acc, m) => {
    const co = m.userCompanyName || tt("Unknown company", "Empresa desconocida");
    if (!acc[co]) acc[co] = [];
    acc[co]!.push(m);
    return acc;
  }, {});

  const companyCount = companies.length;
  const filteredCompanyCount = Object.keys(byCompany).length;
  const adminCount   = memberRows.filter(m => adminRoles.includes(m.role)).length;
  const filteredAdminCount = filteredMembers.filter(m => adminRoles.includes(m.role)).length;
  const activeSummary = [
    `${tt("Status", "Estado")}: ${tt("Active project members", "Miembros activos del proyecto")}`,
    `${tt("Role", "Rol")}: ${roleFilter === "all" ? tt("All", "Todos") : roleLabel(roleFilter)}`,
    `${tt("Company", "Empresa")}: ${companyFilter === "all" ? tt("All", "Todas") : companyFilter}`,
    `${tt("Search", "Busqueda")}: ${search.trim() || tt("None", "Ninguna")}`,
    `${tt("Sort", "Orden")}: ${sort === "company_asc" ? tt("Company, then name", "Empresa, luego nombre") : sort === "name_asc" ? tt("Name A-Z", "Nombre A-Z") : sort === "name_desc" ? tt("Name Z-A", "Nombre Z-A") : sort === "role_asc" ? tt("Role", "Rol") : sort === "joined_asc" ? tt("Joined oldest first", "Ingreso mas antiguo") : tt("Joined newest first", "Ingreso mas reciente")}`,
    `${tt("Grouping", "Agrupacion")}: ${groupBy === "company" ? tt("Company", "Empresa") : tt("None", "Ninguna")}`,
    `${tt("Rows", "Filas")}: ${filteredMembers.length}/${members?.length ?? 0}`,
    `${tt("Columns", "Columnas")}: ${[includeEmail ? tt("Email", "Correo") : "", showCompanyColumn ? tt("Company", "Empresa") : "", includeJoined ? tt("Joined", "Ingreso") : ""].filter(Boolean).join(", ") || tt("Name and role only", "Solo nombre y rol")}`,
  ];

  const exportCurrentViewPdf = async () => {
    setExportError("");
    setExportingPdf(true);
    const params = new URLSearchParams({
      lang,
      status: "active",
      role: roleFilter,
      company: companyFilter,
      search: search.trim(),
      sort,
      group_by: groupBy,
      include_email: String(includeEmail),
      include_company: String(showCompanyColumn),
      include_joined: String(includeJoined),
    });
    try {
      const res = await fetch(`${API}/projects/${projectId}/members/current-view/pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let message = tt("Project Team PDF export failed.", "Fallo la exportacion PDF del equipo del proyecto.");
        try {
          const body = await res.json();
          message = body?.error || message;
        } catch {
          const text = await res.text();
          if (text) message = text;
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = parseContentDispositionFileName(res.headers.get("Content-Disposition"))
        || safePdfFileNameFromTitle(tt("Project Team - Current View", "Equipo del Proyecto - Vista actual"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : tt("Project Team PDF export failed.", "Fallo la exportacion PDF del equipo del proyecto."));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 16 }}>{t("project.tabs.team")}</div>
          <div className="section-sub">
            {filteredMembers.length}/{members?.length ?? 0} {tt("members", "miembros")} · {filteredCompanyCount}/{companyCount} {tt("companies", "empresas")} · {filteredAdminCount}/{adminCount} {tt("admins", "admins")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <PrintPdfButton
            lang={lang}
            onClick={exportCurrentViewPdf}
            loading={exportingPdf}
            disabled={isLoading}
          />
        {isAdmin && !showAdd && (
          <div style={{ display: "flex", gap: 8 }}>
            {iAmAdmin && (members?.length ?? 0) > 1 && (
              <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)} style={{ gap: 6, fontSize: 12 }}>
                <ArrowRightLeft style={{ width: 13, height: 13 }} />
                Transfer Admin
              </Button>
            )}
            <Button size="sm" onClick={() => setShowAdd(true)} style={{ gap: 6, fontSize: 12 }}>
              <Plus style={{ width: 13, height: 13 }} />
              {t("team.add")}
            </Button>
          </div>
        )}
        </div>
      </div>

      <div style={{ marginBottom: 14, padding: 12, border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--card))" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ minWidth: 220, flex: "1 1 260px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>{tt("Team current-view report", "Reporte de vista actual del equipo")}</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.45 }}>
              {tt("The PDF uses the filters, grouping, and selected columns shown here. Invitations and management controls are not exported.", "El PDF usa los filtros, agrupacion y columnas seleccionadas aqui. Invitaciones y controles administrativos no se exportan.")}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", flex: "1 1 260px" }}>
            {activeSummary.join(" | ")}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 10px", background: "white", minWidth: 0 }}>
            <Search size={14} color="#6B7280" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tt("Search name, email, company, role...", "Buscar nombre, correo, empresa, rol...")} style={{ border: "none", outline: "none", fontSize: 13, width: "100%", minWidth: 0 }} />
          </label>
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 10px", fontSize: 13, minWidth: 0, width: "100%" }}>
            <option value="all">{tt("All companies", "Todas las empresas")}</option>
            {companies.map(company => <option key={company} value={company}>{company}</option>)}
          </select>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 10px", fontSize: 13, minWidth: 0, width: "100%" }}>
            <option value="all">{tt("All roles", "Todos los roles")}</option>
            {ROLE_KEYS.map(key => <option key={key} value={key}>{ROLES[key].label}</option>)}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value as TeamSortKey)} style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 10px", fontSize: 13, minWidth: 0, width: "100%" }}>
            <option value="company_asc">{tt("Company, then name", "Empresa, luego nombre")}</option>
            <option value="name_asc">{tt("Name A-Z", "Nombre A-Z")}</option>
            <option value="name_desc">{tt("Name Z-A", "Nombre Z-A")}</option>
            <option value="role_asc">{tt("Role", "Rol")}</option>
            <option value="joined_desc">{tt("Joined newest first", "Ingreso mas reciente")}</option>
            <option value="joined_asc">{tt("Joined oldest first", "Ingreso mas antiguo")}</option>
          </select>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as TeamGroupKey)} style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 10px", fontSize: 13, minWidth: 0, width: "100%" }}>
            <option value="company">{tt("Group by company", "Agrupar por empresa")}</option>
            <option value="none">{tt("No grouping", "Sin agrupacion")}</option>
          </select>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={includeEmail} onChange={e => setIncludeEmail(e.target.checked)} />
            {tt("Email", "Correo")}
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={includeCompany} onChange={e => setIncludeCompany(e.target.checked)} />
            {tt("Company", "Empresa")}
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={includeJoined} onChange={e => setIncludeJoined(e.target.checked)} />
            {tt("Joined date", "Fecha de ingreso")}
          </label>
        </div>
        {exportError && (
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", fontSize: 12 }}>
            {exportError}
          </div>
        )}
      </div>

      {showTransfer && myMembership && (
        <TransferAdminForm
          projectId={projectId}
          currentAdminMemberId={myMembership.id}
          candidates={memberRows.filter(m => m.userId !== authUser?.id).map(m => ({ id: m.id, name: m.userFullName ?? m.userEmail ?? "Unknown", company: m.userCompanyName ?? "" }))}
          onClose={() => setShowTransfer(false)}
        />
      )}

      {/* Add member form */}
      {showAdd && (
        <AddMemberForm projectId={projectId} onClose={() => setShowAdd(false)} />
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* Members grouped by company */}
      {!isLoading && filteredMembers.length > 0 && groupBy === "company" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(byCompany).map(([company, companyMembers]) => (
            <div key={company}>
              {/* Company header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                marginBottom: 8, padding: "0 2px"
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: "hsl(var(--secondary))",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Building2 style={{ width: 13, height: 13, color: "hsl(var(--muted-foreground))" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>{company}</span>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                  · {companyMembers!.length} member{companyMembers!.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Member table */}
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("team.name")}</th>
                      {includeEmail && <th>{t("team.email")}</th>}
                      <th style={{ width: 130 }}>{t("team.role")}</th>
                      {includeJoined && <th style={{ width: 110 }}>{t("team.joined")}</th>}
                      {isAdmin && <th style={{ width: 80, textAlign: "right" }}>{t("team.actions")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {companyMembers!.map(member => {
                      const isAdminRole = adminRoles.includes(member.role);
                      const avatarColor = getAvatarColor(member.userFullName ?? "?");

                      return (
                        <tr key={member.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <div className={`avatar avatar-sm ${avatarColor}`}>
                                {member.userFullName?.charAt(0).toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                                  {member.userFullName}
                                </div>
                              </div>
                            </div>
                          </td>
                          {includeEmail && (
                            <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                              {member.userEmail}
                            </td>
                          )}
                          <td>
                            {(() => {
                              const r = getRole(member.role);
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={r?.description ?? member.role}>
                                  {isAdminRole && (
                                    <Shield style={{ width: 11, height: 11, color: r?.badgeText ?? "#2563EB", flexShrink: 0 }} />
                                  )}
                                  <span style={{
                                    display: "inline-flex", alignItems: "center",
                                    padding: "2px 8px", borderRadius: 999,
                                    fontSize: 10, fontWeight: 700,
                                    background: r?.badgeBg ?? "#F3F4F6",
                                    color: r?.badgeText ?? "#374151",
                                  }}>
                                    {r?.label ?? member.role}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          {includeJoined && (
                            <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                              {format(new Date(member.joinedAt), "MMM d, yyyy")}
                            </td>
                          )}
                          {isAdmin && (
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                                <RoleSelector projectId={projectId} member={member} />
                                <RemoveMemberButton projectId={projectId} memberId={member.id} />
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredMembers.length > 0 && groupBy === "none" && (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("team.name")}</th>
                {includeEmail && <th>{t("team.email")}</th>}
                {showCompanyColumn && <th style={{ width: 150 }}>{tt("Company", "Empresa")}</th>}
                <th style={{ width: 130 }}>{t("team.role")}</th>
                {includeJoined && <th style={{ width: 110 }}>{t("team.joined")}</th>}
                {isAdmin && <th style={{ width: 80, textAlign: "right" }}>{t("team.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => {
                const isAdminRole = adminRoles.includes(member.role);
                const avatarColor = getAvatarColor(member.userFullName ?? "?");
                const r = getRole(member.role);
                return (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className={`avatar avatar-sm ${avatarColor}`}>{member.userFullName?.charAt(0).toUpperCase() ?? "?"}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--foreground))" }}>{member.userFullName}</div>
                      </div>
                    </td>
                    {includeEmail && <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{member.userEmail}</td>}
                    {showCompanyColumn && <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{member.userCompanyName || tt("Unknown company", "Empresa desconocida")}</td>}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={r?.description ?? member.role}>
                        {isAdminRole && <Shield style={{ width: 11, height: 11, color: r?.badgeText ?? "#2563EB", flexShrink: 0 }} />}
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: r?.badgeBg ?? "#F3F4F6", color: r?.badgeText ?? "#374151" }}>{r?.label ?? member.role}</span>
                      </div>
                    </td>
                    {includeJoined && <td style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{format(new Date(member.joinedAt), "MMM d, yyyy")}</td>}
                    {isAdmin && (
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <RoleSelector projectId={projectId} member={member} />
                          <RemoveMemberButton projectId={projectId} memberId={member.id} />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (members ?? []).length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Users style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div className="empty-title">No team members yet</div>
          <div className="empty-desc">
            Add team members to grant them access to this project. Each member is assigned a role that controls their permissions.
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(true)}
              style={{ marginTop: 14, gap: 6, fontSize: 12 }}
            >
              <Plus style={{ width: 13, height: 13 }} />
              {t("team.add")}
            </Button>
          )}
        </div>
      )}

      {!isLoading && (members ?? []).length > 0 && filteredMembers.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Users style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
          </div>
          <div className="empty-title">{tt("No team members match the current filters", "Ningun miembro coincide con los filtros actuales")}</div>
          <div className="empty-desc">
            {tt("Adjust search, company, role, or grouping options to expand the current view.", "Ajusta busqueda, empresa, rol o agrupacion para ampliar la vista actual.")}
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {isAdmin && <PendingInvitations projectId={projectId} />}

      {/* Role legend */}
      {(members ?? []).length > 0 && (
        <div style={{
          marginTop: 16, padding: "12px 14px",
          background: "hsl(var(--secondary) / 0.5)",
          border: "1px solid hsl(var(--border))",
          borderRadius: 8
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Role permissions
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {ROLE_KEYS.map(key => {
              const r = ROLES[key];
              return (
                <div key={key} style={{ padding: "8px 10px", background: "hsl(var(--card))", borderRadius: 6, border: "1px solid hsl(var(--border))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: r.badgeText,
                    }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: r.badgeText }}>
                      {r.label}
                    </span>
                    {r.canTransfer && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "1px 5px",
                        background: "rgba(37,99,235,0.1)", color: "#1D4ED8",
                        borderRadius: 3, marginLeft: "auto",
                      }}>1 PER PROJECT</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>
                    {r.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AddMemberForm({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { getOptions } = useConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const roleOptions = getOptions("member_role");
  const [activeTab, setActiveTab] = useState<"existing" | "invite">("existing");

  // Existing user tab
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.value ?? "");

  // Invite by email tab
  const [invEmail, setInvEmail] = useState("");
  const [invFullName, setInvFullName] = useState("");
  const [invCompany, setInvCompany] = useState("");
  const [invRole, setInvRole] = useState(roleOptions[0]?.value ?? "");
  const [invPending, setInvPending] = useState(false);

  const { mutate, isPending } = useAddMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: t("team.added") });
        onClose();
      },
      onError: () => toast({ title: "User not found - check the email address", variant: "destructive" }),
    },
  });

  const handleInvite = async () => {
    if (!invEmail) return;
    setInvPending(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const r = await fetch(`${BASE}/api/v1/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: invEmail, fullName: invFullName || undefined, companyName: invCompany || undefined, role: invRole }),
      });
      if (!r.ok) throw new Error(await r.text());
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/invitations`] });
      toast({ title: `Invitation sent to ${invEmail}` });
      onClose();
    } catch (e) {
      toast({ title: "Failed to send invitation", variant: "destructive" });
    } finally {
      setInvPending(false);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: active ? 700 : 500,
    border: "none", background: active ? "hsl(var(--background))" : "transparent",
    color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
    cursor: "pointer", borderRadius: 6, borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div className="inline-form" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))" }}>{t("team.addTitle")}</div>
        <button onClick={onClose} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid hsl(var(--border))", paddingBottom: 0 }}>
        <button style={tabStyle(activeTab === "existing")} onClick={() => setActiveTab("existing")}>
          <UserCheck style={{ width: 12, height: 12, display: "inline", marginRight: 5 }} />
          Existing User
        </button>
        <button style={tabStyle(activeTab === "invite")} onClick={() => setActiveTab("invite")}>
          <Mail style={{ width: 12, height: 12, display: "inline", marginRight: 5 }} />
          Invite by Email
        </button>
      </div>

      {activeTab === "existing" && (
        <>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
            The user must already have a BIMLog account. Enter their registered email address.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input type="email" style={{ flex: 1 }} placeholder={t("team.emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            <select value={role} onChange={e => setRole(e.target.value)} style={{ height: 36, minWidth: 140 }}>
              {roleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
              ))}
            </select>
            <Button size="sm" disabled={!email || isPending} onClick={() => mutate({ projectId, data: { email, role } })} style={{ minWidth: 70 }}>
              {isPending ? "..." : t("team.addButton")}
            </Button>
          </div>
        </>
      )}

      {activeTab === "invite" && (
        <>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>
            Send an invitation to someone who doesn't have a BIMLog account yet. When they register with this email they will be automatically added to the project.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Input type="email" style={{ flex: 1 }} placeholder="Email address *" value={invEmail} onChange={e => setInvEmail(e.target.value)} autoFocus />
              <select value={invRole} onChange={e => setInvRole(e.target.value)} style={{ height: 36, minWidth: 140 }}>
                {roleOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{lang === "es" ? opt.labelEs : opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Input style={{ flex: 1 }} placeholder="Full name (optional)" value={invFullName} onChange={e => setInvFullName(e.target.value)} />
              <Input style={{ flex: 1 }} placeholder="Company (optional)" value={invCompany} onChange={e => setInvCompany(e.target.value)} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button size="sm" disabled={!invEmail || invPending} onClick={handleInvite} style={{ gap: 6 }}>
                <Mail style={{ width: 12, height: 12 }} />
                {invPending ? "Sending..." : "Send Invitation"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PendingInvitations({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInvitations = async () => {
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const r = await fetch(`${BASE}/api/v1/projects/${projectId}/invitations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setInvitations(data.filter((i: any) => i.status === "pending"));
    } catch (error) {
      logClientError("team pending invitations load", error);
    }
  };

  useEffect(() => { loadInvitations(); }, [projectId]);

  const handleCancel = async (id: number) => {
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const r = await fetch(`${BASE}/api/v1/projects/${projectId}/invitations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) { console.error("Request failed", r.status); return; }
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/invitations`] });
      setInvitations(prev => prev.filter(i => i.id !== id));
      toast({ title: "Invitation cancelled" });
    } catch (_) {
      toast({ title: "Failed to cancel invitation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <div style={{ marginTop: 16, padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Clock style={{ width: 13, height: 13, color: "#92400E" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Pending Invitations</span>
        <span style={{ fontSize: 11, color: "#B45309", marginLeft: 4 }}>{invitations.length} awaiting registration</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {invitations.map(inv => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6 }}>
            <Mail style={{ width: 13, height: 13, color: "#B45309", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#78350F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
              {inv.fullName && <div style={{ fontSize: 11, color: "#92400E" }}>{inv.fullName}{inv.companyName ? ` · ${inv.companyName}` : ""}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#FEF9C3", color: "#854D0E", border: "1px solid #FDE68A", flexShrink: 0 }}>
              {inv.role.replace("_", " ")}
            </span>
            <span style={{ fontSize: 10, color: "#B45309", flexShrink: 0 }}>
              {new Date(inv.createdAt).toLocaleDateString()}
            </span>
            <button
              disabled={loading}
              onClick={() => handleCancel(inv.id)}
              title="Cancel invitation"
              style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "#B45309", flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
              onMouseLeave={e => (e.currentTarget.style.color = "#B45309")}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleSelector({ projectId, member }: {
  projectId: number;
  member: { id: number; role: string; userFullName?: string };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [role, setRole] = useState(member.role);

  const { mutate } = useUpdateMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: "Role updated" });
      },
      onError: (e: unknown) => toast({ title: "Failed to update role", description: e instanceof Error ? e.message : "", variant: "destructive" }),
    },
  });

  // Block selecting project_admin from this dropdown - admin transfer happens via the Transfer Admin button.
  const selectable = ROLE_KEYS.filter(k => k !== "project_admin" || member.role === "project_admin");

  return (
    <select
      value={role}
      disabled={member.role === "project_admin"}
      title={member.role === "project_admin" ? "Use Transfer Admin to change the Project Admin." : undefined}
      onChange={e => {
        const v = e.target.value;
        setRole(v);
        mutate({ projectId, memberId: member.id, data: { role: v } });
      }}
      style={{ height: 28, fontSize: 11, minWidth: 130, borderRadius: 5 }}
    >
      {selectable.map(key => (
        <option key={key} value={key}>
          {ROLES[key].label}
        </option>
      ))}
    </select>
  );
}

function TransferAdminForm({ projectId, currentAdminMemberId, candidates, onClose }: {
  projectId: number;
  currentAdminMemberId: number;
  candidates: { id: number; name: string; company: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [target, setTarget] = useState<number | null>(candidates[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const { mutateAsync: updateMember } = useUpdateMember({});

  const handleTransfer = async () => {
    if (!target) return;
    if (!confirm("Transfer Project Admin? You will be demoted to Discipline Lead. Only one admin can exist per project.")) return;
    setBusy(true);
    try {
      // 1. Promote target to project_admin
      await updateMember({ projectId, memberId: target, data: { role: "project_admin" } });
      // 2. Demote self to discipline_lead
      await updateMember({ projectId, memberId: currentAdminMemberId, data: { role: "discipline_lead" } });
      queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
      toast({ title: "Admin transferred", description: "The new admin now has full control of the project." });
      onClose();
    } catch (e) {
      toast({ title: "Transfer failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-form" style={{ marginBottom: 16, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#9A3412", display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowRightLeft style={{ width: 14, height: 14 }} />
          Transfer Project Admin
        </div>
        <button onClick={onClose} style={{ padding: 5, border: "none", background: "transparent", cursor: "pointer", color: "#9A3412" }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#7C2D12", marginBottom: 10, lineHeight: 1.5 }}>
        Only one Project Admin can exist per project. Choose the team member who will take over - you will be demoted to Discipline Lead. This action is logged.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={target ?? ""}
          onChange={e => setTarget(parseInt(e.target.value, 10))}
          style={{ flex: 1, height: 36, fontSize: 12, borderRadius: 5 }}
        >
          {candidates.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.company ? ` - ${c.company}` : ""}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={handleTransfer} disabled={busy || !target} style={{ minWidth: 110 }}>
          {busy ? "Transferring..." : "Transfer Admin"}
        </Button>
      </div>
    </div>
  );
}

function RemoveMemberButton({ projectId, memberId }: { projectId: number; memberId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate, isPending } = useRemoveMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/projects/${projectId}/members`] });
        toast({ title: t("team.removed") });
      },
    },
  });

  return (
    <button
      disabled={isPending}
      onClick={() => { if (confirm(t("team.removeConfirm"))) mutate({ projectId, memberId }); }}
      style={{
        padding: 6, borderRadius: 6, border: "none",
        background: "transparent", cursor: "pointer",
        color: "hsl(var(--muted-foreground))",
        opacity: isPending ? 0.5 : 1,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "#DC2626")}
      onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
    >
      <Trash2 style={{ width: 13, height: 13 }} />
    </button>
  );
}
