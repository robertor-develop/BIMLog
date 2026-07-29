import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { PrintPdfButton } from "@/components/PrintPdfButton";
import { Download, UserCheck, UserPlus, Users } from "lucide-react";

interface DirectoryEntry {
  id: number; fullName: string; email: string; companyName?: string;
  role: string; bimlogStatus?: string; notes?: string;
}

interface MemberEntry {
  id: number; userId: number; userFullName: string; userEmail: string;
  userCompanyName?: string; role: string; joinedAt?: string;
}

type DirectoryScope = "all" | "members" | "contacts";
type DirectoryRoleFilter = "all" | "admin" | "member" | "external";
type DirectoryStatusFilter = "all" | "active" | "invited" | "external";
type DirectorySort = "name" | "company" | "role" | "status";

type DirectoryPdfOptions = {
  includeMembers: boolean;
  includeContacts: boolean;
  includeEmail: boolean;
  includeCompany: boolean;
  includeRole: boolean;
  includeStatus: boolean;
};

type DirectoryRow = {
  key: string;
  source: "member" | "contact";
  fullName: string;
  email: string;
  companyName?: string;
  role: string;
  status: "active" | "invited" | "external";
};

const API = "/api/v1";

const DEFAULT_PDF_OPTIONS: DirectoryPdfOptions = {
  includeMembers: true,
  includeContacts: true,
  includeEmail: true,
  includeCompany: true,
  includeRole: true,
  includeStatus: true,
};

const normalizeEmail = (value: string | undefined) => (value || "").trim().toLowerCase();

export function DirectoryTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<DirectoryScope>("all");
  const [roleFilter, setRoleFilter] = useState<DirectoryRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<DirectoryStatusFilter>("all");
  const [sortBy, setSortBy] = useState<DirectorySort>("name");
  const [pdfOptions, setPdfOptions] = useState<DirectoryPdfOptions>(DEFAULT_PDF_OPTIONS);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", company_name: "", role: "", notes: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [rMembers, rDir] = await Promise.all([
        fetch(`${API}/projects/${projectId}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/projects/${projectId}/directory`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rMembers.ok) setMembers(await rMembers.json());
      if (rDir.ok) setEntries(await rDir.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const normalizedSearch = search.trim().toLowerCase();
  const memberEmails = useMemo(() => new Set(members.map(m => normalizeEmail(m.userEmail))), [members]);
  const duplicateContactCount = useMemo(
    () => entries.filter(e => memberEmails.has(normalizeEmail(e.email))).length,
    [entries, memberEmails],
  );
  const additionalContacts = useMemo(
    () => entries.filter(e => !memberEmails.has(normalizeEmail(e.email))),
    [entries, memberEmails],
  );

  const rows = useMemo<DirectoryRow[]>(() => {
    const memberRows: DirectoryRow[] = members.map(m => ({
      key: `m-${m.id}`,
      source: "member",
      fullName: m.userFullName,
      email: m.userEmail,
      companyName: m.userCompanyName,
      role: m.role,
      status: "active",
    }));
    const contactRows: DirectoryRow[] = additionalContacts.map(e => ({
      key: `c-${e.id}`,
      source: "contact",
      fullName: e.fullName,
      email: e.email,
      companyName: e.companyName,
      role: e.role,
      status: e.bimlogStatus === "invited" ? "invited" : "external",
    }));
    return [...memberRows, ...contactRows]
      .filter(row => {
        if (scope === "members" && row.source !== "member") return false;
        if (scope === "contacts" && row.source !== "contact") return false;
        if (roleFilter === "admin" && !["admin", "project_admin"].includes(row.role)) return false;
        if (roleFilter === "member" && (row.source !== "member" || ["admin", "project_admin"].includes(row.role))) return false;
        if (roleFilter === "external" && row.source !== "contact") return false;
        if (statusFilter !== "all" && row.status !== statusFilter) return false;
        if (!normalizedSearch) return true;
        return [row.fullName, row.email, row.companyName, row.role, row.status]
          .some(value => (value || "").toLowerCase().includes(normalizedSearch));
      })
      .sort((a, b) => {
        const read = (row: DirectoryRow) => {
          if (sortBy === "company") return row.companyName || "";
          if (sortBy === "role") return row.role || "";
          if (sortBy === "status") return row.status || "";
          return row.fullName || "";
        };
        return read(a).localeCompare(read(b)) || a.fullName.localeCompare(b.fullName);
      });
  }, [additionalContacts, members, normalizedSearch, roleFilter, scope, sortBy, statusFilter]);

  const filteredMembers = rows.filter(row => row.source === "member");
  const filteredContacts = rows.filter(row => row.source === "contact");
  const anyDirectoryRecords = members.length + additionalContacts.length > 0;
  const selectedSectionCount = [pdfOptions.includeMembers, pdfOptions.includeContacts].filter(Boolean).length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/directory`, {
        method: "POST", headers, body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || t("Could not save this contact.", "No se pudo guardar este contacto.")); return; }
      await load();
      setShowForm(false);
      setForm({ full_name: "", email: "", company_name: "", role: "", notes: "" });
    } finally { setSaving(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg(t("Reading document with AI...", "Leyendo documento con IA..."));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/projects/${projectId}/directory/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setImportMsg(t(`${data.imported ?? 0} contacts imported successfully`, `${data.imported ?? 0} contactos importados correctamente`));
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setImportMsg(t("Import failed - please try again", "La importacion fallo - intenta de nuevo"));
      }
    } catch { setImportMsg(t("Import failed", "La importacion fallo")); }
    finally { setImporting(false); e.target.value = ""; }
  };

  const invite = async (id: number) => {
    setInviting(id);
    try {
      const rInvite = await fetch(`${API}/projects/${projectId}/directory/${id}/invite`, { method: "POST", headers });
      if (!rInvite.ok) { setExportError(t("Invite failed. Please try again.", "La invitacion fallo. Intenta de nuevo.")); return; }
      await load();
    } finally { setInviting(null); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("Remove this entry?", "Eliminar este contacto?"))) return;
    const rDel = await fetch(`${API}/projects/${projectId}/directory/${id}`, { method: "DELETE", headers });
    if (!rDel.ok) { setExportError(t("Remove failed. Please try again.", "No se pudo eliminar. Intenta de nuevo.")); return; }
    await load();
  };

  const exportCurrentViewPdf = async () => {
    setExporting(true);
    setExportError("");
    try {
      const params = new URLSearchParams({
        lang,
        search,
        scope,
        role: roleFilter,
        status: statusFilter,
        sort: sortBy,
        include_members: String(pdfOptions.includeMembers),
        include_contacts: String(pdfOptions.includeContacts),
        include_email: String(pdfOptions.includeEmail),
        include_company: String(pdfOptions.includeCompany),
        include_role: String(pdfOptions.includeRole),
        include_status: String(pdfOptions.includeStatus),
      });
      const res = await fetch(`${API}/projects/${projectId}/directory/export-pdf?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setExportError(data.error || t("Directory PDF export failed.", "No se pudo exportar el PDF del directorio."));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("X-Report-Filename") || "Project-Directory-Current-View.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(t("Directory PDF export failed.", "No se pudo exportar el PDF del directorio."));
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (s?: string) => {
    if (s === "active") return <span className="badge badge-success">{t("BIMLog Active", "BIMLog Activo")}</span>;
    if (s === "invited") return <span className="badge badge-info">{t("Invited", "Invitado")}</span>;
    return <span className="badge badge-outline">{t("External", "Externo")}</span>;
  };

  const roleBadge = (role: string) => {
    if (role === "admin" || role === "project_admin") return <span className="badge badge-warning">{t("Admin", "Admin")}</span>;
    return <span className="badge badge-outline">{role}</span>;
  };

  const scopeLabel = (value: DirectoryScope) => ({
    all: t("All Directory Records", "Todos los registros"),
    members: t("Project Members", "Miembros del Proyecto"),
    contacts: t("Additional Contacts", "Contactos Adicionales"),
  }[value]);
  const roleLabel = (value: DirectoryRoleFilter) => ({
    all: t("All Roles", "Todos los roles"),
    admin: t("Administrators", "Administradores"),
    member: t("Project Members", "Miembros del Proyecto"),
    external: t("External Contacts", "Contactos Externos"),
  }[value]);
  const statusLabel = (value: DirectoryStatusFilter) => ({
    all: t("All Statuses", "Todos los estados"),
    active: t("BIMLog Active", "BIMLog Activo"),
    invited: t("Invited", "Invitado"),
    external: t("External", "Externo"),
  }[value]);
  const sortLabel = (value: DirectorySort) => ({
    name: t("Name", "Nombre"),
    company: t("Company", "Empresa"),
    role: t("Role", "Rol"),
    status: t("Status", "Estado"),
  }[value]);
  const selectedSectionLabels = [
    pdfOptions.includeMembers ? t("Project Members", "Miembros del Proyecto") : "",
    pdfOptions.includeContacts ? t("Additional Contacts", "Contactos Adicionales") : "",
  ].filter(Boolean);
  const selectedColumnLabels = [
    t("Name", "Nombre"),
    pdfOptions.includeEmail ? t("Email", "Correo") : "",
    pdfOptions.includeCompany ? t("Company", "Empresa") : "",
    pdfOptions.includeRole ? t("Role", "Rol") : "",
    pdfOptions.includeStatus ? t("Status", "Estado") : "",
  ].filter(Boolean);

  const filterSummary = [
    `${t("Search", "Busqueda")}: ${search.trim() || t("All", "Todos")}`,
    `${t("Scope", "Alcance")}: ${scopeLabel(scope)}`,
    `${t("Role", "Rol")}: ${roleLabel(roleFilter)}`,
    `${t("Status", "Estado")}: ${statusLabel(statusFilter)}`,
    `${t("Sort", "Orden")}: ${sortLabel(sortBy)}`,
    `${t("Sections", "Secciones")}: ${selectedSectionLabels.join(", ") || t("None selected", "Ninguna seleccionada")}`,
    `${t("Columns", "Columnas")}: ${selectedColumnLabels.join(", ")}`,
  ];

  const renderRows = (visibleRows: DirectoryRow[], source: "member" | "contact") => visibleRows.map(row => {
    const contactEntry = source === "contact"
      ? additionalContacts.find(entry => `c-${entry.id}` === row.key)
      : null;
    return (
      <tr key={row.key}>
        <td>
          <div style={{ fontWeight: 500 }}>{row.fullName}</div>
          {pdfOptions.includeEmail && <div style={{ fontSize: 12, color: "#6B7280" }}>{row.email}</div>}
        </td>
        {pdfOptions.includeCompany && <td>{row.companyName || "-"}</td>}
        {pdfOptions.includeRole && <td>{source === "member" ? roleBadge(row.role) : row.role}</td>}
        {pdfOptions.includeStatus && <td>{source === "member" ? <span className="badge badge-success">{t("BIMLog Active", "BIMLog Activo")}</span> : statusBadge(contactEntry?.bimlogStatus)}</td>}
        {source === "contact" && (
          <td style={{ textAlign: "right" }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {canWrite && (contactEntry?.bimlogStatus === "none" || !contactEntry?.bimlogStatus) && (
                <button className="btn btn-sm btn-outline" onClick={() => contactEntry && invite(contactEntry.id)} disabled={inviting === contactEntry?.id}>
                  {inviting === contactEntry?.id ? t("Inviting...", "Invitando...") : t("Invite", "Invitar")}
                </button>
              )}
              {canWrite && contactEntry && (
                <button className="btn btn-sm btn-danger-outline" onClick={() => remove(contactEntry.id)}>
                  {t("Remove", "Eliminar")}
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  });

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Project Directory", "Directorio del Proyecto")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Project members are auto-populated from the team. Add external stakeholders below.", "Los miembros del proyecto se completan automaticamente. Agrega interesados externos abajo.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <PrintPdfButton
            lang={lang}
            onClick={exportCurrentViewPdf}
            loading={exporting}
            configurationInvalid={selectedSectionCount === 0}
            disabledReason={t("Select at least one PDF section", "Selecciona al menos una sección PDF")}
            currentViewSummary={[...filterSummary, `${t("Showing", "Mostrando")}: ${rows.length}/${members.length + additionalContacts.length}`]}
            options={
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {([
                  ["includeMembers", t("Project Members section", "Sección Miembros del Proyecto")],
                  ["includeContacts", t("Additional Contacts section", "Sección Contactos Adicionales")],
                  ["includeEmail", t("Email column", "Columna correo")],
                  ["includeCompany", t("Company column", "Columna empresa")],
                  ["includeRole", t("Role column", "Columna rol")],
                  ["includeStatus", t("Status column", "Columna estado")],
                ] as const).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={pdfOptions[key]}
                      onChange={event => setPdfOptions(current => ({ ...current, [key]: event.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            }
          />
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <span className="btn btn-outline" style={{ opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? t("Importing...","Importando...") : t("Import Contacts","Importar contactos")}
              </span>
            </label>
          )}
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <UserPlus size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {t("Add External Contact", "Agregar Contacto Externo")}
            </button>
          )}
        </div>
      </div>

      {(importMsg || exportError) && (
        <div className={exportError ? "alert alert-danger" : "alert alert-info"} style={{ marginBottom: 12 }}>
          {exportError || importMsg}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <div>
            <label className="label">{t("Search", "Busqueda")}</label>
            <input
              className="input" placeholder={t("Search by name, email, company, role, or status...", "Buscar por nombre, correo, empresa, rol o estado...")}
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("Directory Scope", "Alcance del Directorio")}</label>
            <select className="input" value={scope} onChange={e => setScope(e.target.value as DirectoryScope)}>
              <option value="all">{t("All Directory Records", "Todos los registros")}</option>
              <option value="members">{t("Project Members", "Miembros del Proyecto")}</option>
              <option value="contacts">{t("Additional Contacts", "Contactos Adicionales")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Role", "Rol")}</label>
            <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value as DirectoryRoleFilter)}>
              <option value="all">{t("All Roles", "Todos los roles")}</option>
              <option value="admin">{t("Administrators", "Administradores")}</option>
              <option value="member">{t("Project Members", "Miembros del Proyecto")}</option>
              <option value="external">{t("External Contacts", "Contactos Externos")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Status", "Estado")}</label>
            <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as DirectoryStatusFilter)}>
              <option value="all">{t("All Statuses", "Todos los estados")}</option>
              <option value="active">{t("BIMLog Active", "BIMLog Activo")}</option>
              <option value="invited">{t("Invited", "Invitado")}</option>
              <option value="external">{t("External", "Externo")}</option>
            </select>
          </div>
          <div>
            <label className="label">{t("Sort By", "Ordenar por")}</label>
            <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as DirectorySort)}>
              <option value="name">{t("Name", "Nombre")}</option>
              <option value="company">{t("Company", "Empresa")}</option>
              <option value="role">{t("Role", "Rol")}</option>
              <option value="status">{t("Status", "Estado")}</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#6B7280" }}>
          {t("Current view", "Vista actual")}: {filterSummary.join(" | ")} | {t("Showing", "Mostrando")} {rows.length} {t("of", "de")} {members.length + additionalContacts.length}
          {duplicateContactCount > 0 && (
            <> | {t("Duplicate contact emails consolidated under Project Members", "Correos duplicados consolidados bajo Miembros del Proyecto")}: {duplicateContactCount}</>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("Add External Contact", "Agregar Contacto Externo")}</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label">{t("Full Name", "Nombre Completo")} *</label>
              <input className="input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Email", "Correo")} *</label>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Company", "Empresa")}</label>
              <input className="input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Role", "Rol")} *</label>
              <input className="input" required placeholder={t("Architect, Engineer, Contractor...", "Arquitecto, Ingeniero...")} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Notes", "Notas")}</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving...", "Guardando...") : t("Save", "Guardar")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading...", "Cargando...")}</div>}

      {!loading && !anyDirectoryRecords && (
        <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
          <Users size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>{t("No directory records yet", "Aun no hay registros del directorio")}</div>
        </div>
      )}

      {!loading && anyDirectoryRecords && rows.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
          <Users size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{t("No records match the current filters", "Ningun registro coincide con los filtros actuales")}</div>
          <div style={{ fontSize: 12 }}>{t("Clear or adjust the filters to show more directory records.", "Limpia o ajusta los filtros para ver mas registros del directorio.")}</div>
        </div>
      )}

      {!loading && pdfOptions.includeMembers && filteredMembers.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <UserCheck size={16} color="#16A34A" />
            <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#111827" }}>
              {t("Project Members", "Miembros del Proyecto")} ({filteredMembers.length})
            </h3>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              - {t("Auto-populated from project team", "Auto-completado desde el equipo")}
            </span>
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>{t("Name", "Nombre")}</th>
                  {pdfOptions.includeCompany && <th>{t("Company", "Empresa")}</th>}
                  {pdfOptions.includeRole && <th>{t("Role", "Rol")}</th>}
                  {pdfOptions.includeStatus && <th>{t("Status", "Estado")}</th>}
                </tr>
              </thead>
              <tbody>{renderRows(filteredMembers, "member")}</tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && pdfOptions.includeContacts && filteredContacts.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Users size={16} color="#6B7280" />
            <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#111827" }}>
              {t("Additional Contacts", "Contactos Adicionales")} ({filteredContacts.length})
            </h3>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              - {t("External stakeholders not yet on BIMLog", "Interesados externos aun no en BIMLog")}
            </span>
          </div>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>{t("Name", "Nombre")}</th>
                  {pdfOptions.includeCompany && <th>{t("Company", "Empresa")}</th>}
                  {pdfOptions.includeRole && <th>{t("Role", "Rol")}</th>}
                  {pdfOptions.includeStatus && <th>{t("Status", "Estado")}</th>}
                  <th style={{ textAlign: "right" }}>{t("Actions", "Acciones")}</th>
                </tr>
              </thead>
              <tbody>{renderRows(filteredContacts, "contact")}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
