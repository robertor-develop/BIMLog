import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Users } from "lucide-react";

interface DirectoryEntry {
  id: number; fullName: string; email: string; companyName?: string;
  role: string; bimlogStatus?: string; notes?: string;
}

const API = "/api/v1";

export function DirectoryTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", company_name: "", role: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/directory`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setEntries(await r.json());
    } finally { setLoading(false); setLoaded(true); }
  };

  if (!loaded && !loading) { load(); }

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

  const filtered = entries.filter(e =>
    !search ||
    e.fullName.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.companyName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s?: string) => {
    if (s === "active") return <span className="badge badge-success">BIMLog Active</span>;
    if (s === "invited") return <span className="badge badge-info">{t("Invited", "Invitado")}</span>;
    return <span className="badge badge-outline">{t("External", "Externo")}</span>;
  };

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Project Directory", "Directorio del Proyecto")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>{t("All stakeholders and contacts on this project", "Todos los interesados y contactos del proyecto")}</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + {t("Add Contact", "Agregar Contacto")}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          className="input" placeholder={t("Search by name, email or company…", "Buscar por nombre, correo o empresa…")}
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("Add Contact", "Agregar Contacto")}</h3>
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

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Users size={40} color="#D1D5DB" /></div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t("No contacts yet", "Sin contactos aún")}</div>
          <div style={{ fontSize: 13 }}>{t("Add stakeholders to your project directory", "Agrega interesados al directorio del proyecto")}</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
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
              {filtered.map(entry => (
                <tr key={entry.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{entry.fullName}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{entry.email}</div>
                  </td>
                  <td>{entry.companyName || "—"}</td>
                  <td>{entry.role}</td>
                  <td>{statusBadge(entry.bimlogStatus)}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {canWrite && entry.bimlogStatus === "none" && (
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
  );
}
