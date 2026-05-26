import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Users, UserCheck, UserPlus } from "lucide-react";

interface DirectoryEntry {
  id: number; fullName: string; email: string; companyName?: string;
  role: string; bimlogStatus?: string; notes?: string;
}

interface MemberEntry {
  id: number; userId: number; userFullName: string; userEmail: string;
  userCompanyName?: string; role: string; joinedAt?: string;
}

const API = "/api/v1";

export function DirectoryTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", company_name: "", role: "", notes: "" });
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
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
        setImportMsg(`${data.imported ?? 0} contacts imported successfully`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setImportMsg("Import failed — please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };
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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/projects/${projectId}/directory`, {
        method: "POST", headers, body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ full_name: "", email: "", company_name: "", role: "", notes: "" });
    } finally { setSaving(false); }
  };

  const invite = async (id: number) => {
    setInviting(id);
    try {
      const rInvite = await fetch(`${API}/projects/${projectId}/directory/${id}/invite`, { method: "POST", headers });
      if (!rInvite.ok) { console.error("Request failed", rInvite.status); return; }
      await load();
    } finally { setInviting(null); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("Remove this entry?", "¿Eliminar este contacto?"))) return;
    const rDel = await fetch(`${API}/projects/${projectId}/directory/${id}`, { method: "DELETE", headers });
    if (!rDel.ok) { console.error("Request failed", rDel.status); return; }
    await load();
  };

  // Exclude any "additional contact" already linked to a member (by email)
  const memberEmails = new Set(members.map(m => m.userEmail.toLowerCase()));
  const additionalContacts = entries.filter(e => !memberEmails.has((e.email || "").toLowerCase()));

  const filteredMembers = members.filter(m =>
    !search ||
    m.userFullName.toLowerCase().includes(search.toLowerCase()) ||
    m.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    (m.userCompanyName ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredContacts = additionalContacts.filter(e =>
    !search ||
    e.fullName.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.companyName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s?: string) => {
    if (s === "active") return <span className="badge badge-success">{t("BIMLog Active", "BIMLog Activo")}</span>;
    if (s === "invited") return <span className="badge badge-info">{t("Invited", "Invitado")}</span>;
    return <span className="badge badge-outline">{t("External", "Externo")}</span>;
  };

  const roleBadge = (role: string) => {
    if (role === "admin" || role === "project_admin") return <span className="badge badge-warning">{t("Admin", "Admin")}</span>;
    return <span className="badge badge-outline">{role}</span>;
  };

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Project Directory", "Directorio del Proyecto")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>
            {t("Project members are auto-populated from the team. Add external stakeholders below.", "Los miembros del proyecto se completan automáticamente. Agrega interesados externos abajo.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canWrite && (
            <label style={{ cursor: importing ? "not-allowed" : "pointer" }}>
              <input type="file" onChange={handleImport} disabled={importing} style={{ display: "none" }} />
              <span className="btn btn-outline" style={{ opacity: importing ? 0.6 : 1, pointerEvents: importing ? "none" : "auto" }}>
                {importing ? t("Importing...","Importando...") : t("Import","Importar")}
              </span>
            </label>
          )}
          {importMsg && <span style={{ fontSize: 12, color: "#1D4ED8" }}>{importMsg}</span>}
          {canWrite && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <UserPlus size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
              {t("Add External Contact", "Agregar Contacto Externo")}
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          className="input" placeholder={t("Search by name, email or company…", "Buscar por nombre, correo o empresa…")}
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
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
              <input className="input" required placeholder={t("Architect, Engineer, Contractor…", "Arquitecto, Ingeniero…")} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">{t("Notes", "Notas")}</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…", "Guardando…") : t("Save", "Guardar")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading…", "Cargando…")}</div>}

      {/* SECTION 1 — Project Members (auto-populated) */}
      {!loading && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <UserCheck size={16} color="#16A34A" />
            <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#111827" }}>
              {t("Project Members", "Miembros del Proyecto")} ({filteredMembers.length})
            </h3>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              · {t("Auto-populated from project team", "Auto-completado desde el equipo")}
            </span>
          </div>
          {filteredMembers.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
              <Users size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>{t("No project members yet", "Sin miembros del proyecto aún")}</div>
            </div>
          ) : (
            <div className="card">
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>{t("Name", "Nombre")}</th>
                    <th>{t("Company", "Empresa")}</th>
                    <th>{t("Role", "Rol")}</th>
                    <th>{t("Status", "Estado")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(m => (
                    <tr key={`m-${m.id}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{m.userFullName}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{m.userEmail}</div>
                      </td>
                      <td>{m.userCompanyName || "—"}</td>
                      <td>{roleBadge(m.role)}</td>
                      <td><span className="badge badge-success">{t("BIMLog Active", "BIMLog Activo")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2 — Additional Contacts */}
      {!loading && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Users size={16} color="#6B7280" />
            <h3 style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#111827" }}>
              {t("Additional Contacts", "Contactos Adicionales")} ({filteredContacts.length})
            </h3>
            <span style={{ fontSize: 11, color: "#6B7280" }}>
              · {t("External stakeholders not yet on BIMLog", "Interesados externos aún no en BIMLog")}
            </span>
          </div>
          {filteredContacts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
              <UserPlus size={28} color="#D1D5DB" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{t("No additional contacts", "Sin contactos adicionales")}</div>
              <div style={{ fontSize: 12 }}>{t("Add external stakeholders to track them on this project", "Agrega interesados externos para registrarlos en el proyecto")}</div>
            </div>
          ) : (
            <div className="card">
              <table className="table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>{t("Name", "Nombre")}</th>
                    <th>{t("Company", "Empresa")}</th>
                    <th>{t("Role", "Rol")}</th>
                    <th>{t("Status", "Estado")}</th>
                    <th style={{ textAlign: "right" }}>{t("Actions", "Acciones")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(entry => (
                    <tr key={`c-${entry.id}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{entry.fullName}</div>
                        <div style={{ fontSize: 12, color: "#6B7280" }}>{entry.email}</div>
                      </td>
                      <td>{entry.companyName || "—"}</td>
                      <td>{entry.role}</td>
                      <td>{statusBadge(entry.bimlogStatus)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {canWrite && (entry.bimlogStatus === "none" || !entry.bimlogStatus) && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => invite(entry.id)}
                              disabled={inviting === entry.id}
                            >
                              {inviting === entry.id ? t("Inviting…", "Invitando…") : t("Invite", "Invitar")}
                            </button>
                          )}
                          {canWrite && (
                            <button className="btn btn-sm btn-danger-outline" onClick={() => remove(entry.id)}>
                              {t("Remove", "Eliminar")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
