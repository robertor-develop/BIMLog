import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Send, Sparkles } from "lucide-react";

interface Transmittal {
  id: number; number: string; title: string; purpose?: string;
  status: string; sentAt?: string; acknowledgedAt?: string; createdAt: string;
  sentTo?: Array<{ name?: string; email?: string; userId?: number }> | null;
}

const API = "/api/v1";

export function TransmittalsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<Transmittal[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Transmittal | null>(null);
  const [form, setForm] = useState({ title: "", purpose: "", sentTo: "", sentToEmail: "", sentToPhone: "" });
  const [showAddTxCompany, setShowAddTxCompany] = useState(false);
  const [newTxCompany, setNewTxCompany] = useState("");
  const [newTxContactPerson, setNewTxContactPerson] = useState("");
  const [newTxEmail, setNewTxEmail] = useState("");
  const [newTxPhone, setNewTxPhone] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("Reading document with AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API}/projects/${projectId}/transmittals/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        let msg = `${data.imported ?? 0} transmittals imported successfully`;
        if (data.renameCount > 0) msg += `. ${data.renameCount} duplicate(s) renamed with DRF suffix`;
        setImportMsg(msg);
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setImportMsg("Import failed — please try again");
      }
    } catch { setImportMsg("Import failed"); }
    finally { setImporting(false); e.target.value = ""; }
  };
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/transmittals`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setItems(await r.json());
    } finally { setLoading(false); setLoaded(true); }
  };

  if (!loaded && !loading) { load(); }

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = { title: form.title, purpose: form.purpose };
      if (form.sentTo.trim()) {
        body.sent_to = [{ name: form.sentTo.trim(), email: form.sentToEmail.trim() || undefined, phone: form.sentToPhone.trim() || undefined }];
      }
      const r = await fetch(`${API}/projects/${projectId}/transmittals`, {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ title: "", purpose: "", sentTo: "", sentToEmail: "", sentToPhone: "" });
      setShowAddTxCompany(false); setNewTxCompany("");
    } finally { setSaving(false); }
  };

  const send = async (id: number) => {
    if (!confirm(t("Send this transmittal?", "¿Enviar esta transmisión?"))) return;
    const r = await fetch(`${API}/projects/${projectId}/transmittals/${id}/send`, { method: "POST", headers });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Request failed"); return; }
    await load();
  };

  const acknowledge = async (id: number) => {
    const r = await fetch(`${API}/projects/${projectId}/transmittals/${id}/acknowledge`, { method: "POST", headers });
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Request failed"); return; }
    await load();
  };

  const exportPdf = (id: number) => {
    window.open(`${API}/projects/${projectId}/transmittals/${id}/export?token=${token}`, "_blank");
  };

  const aiDraft = async (id: number) => {
    setAiLoading(true);
    try {
      const r = await fetch(`${API}/projects/${projectId}/transmittals/${id}/ai-draft`, { method: "POST", headers });
      if (r.ok) {
        const d = await r.json();
        setItems(prev => prev.map(tx => tx.id === id ? { ...tx, purpose: d.purpose } : tx));
      }
    } finally { setAiLoading(false); }
  };

  const statusColor: Record<string, string> = {
    draft: "#6B7280", sent: "#2563EB", acknowledged: "#16A34A",
  };

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);

  const statusBadge = (s: string) => (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: `${statusColor[s] ?? "#6B7280"}20`, color: statusColor[s] ?? "#6B7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
      {s}
    </span>
  );

  return (
    <div className="tab-content-wrapper">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>{t("Transmittals", "Transmisiones")}</h2>
          <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 13 }}>{t("Formal document transmittals with acknowledgement tracking", "Transmisiones formales con seguimiento de acuse")}</p>
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
              + {t("New Transmittal", "Nueva Transmisión")}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "draft", "sent", "acknowledged"].map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-outline"}`} onClick={() => setFilter(s)}>
            {t(s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1),
              s === "all" ? "Todos" : s === "draft" ? "Borrador" : s === "sent" ? "Enviado" : "Acusado")}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 16 }}>{t("New Transmittal", "Nueva Transmisión")}</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
          <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label className="label">{t("Title", "Título")} *</label>
              <input className="input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">{t("Purpose", "Propósito")}</label>
              <textarea className="input" rows={3} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
            <div>
              <label className="label">{t("Sent To (Company)", "Enviado A (Empresa)")}</label>
              <select className="input" value={form.sentTo} onChange={e => setForm(f => ({ ...f, sentTo: e.target.value }))}
                style={{ height: 36 }}>
                <option value="">{t("— Select company —", "— Seleccionar empresa —")}</option>
                {[...new Set(items.flatMap(i => Array.isArray(i.sentTo) ? i.sentTo : []).map((r: any) => r?.name).filter(Boolean))].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <input className="input" placeholder="email@company.com" value={form.sentToEmail} onChange={e => setForm(f => ({ ...f, sentToEmail: e.target.value }))} />
                <input className="input" placeholder="+1 (555) 000-0000" value={form.sentToPhone} onChange={e => setForm(f => ({ ...f, sentToPhone: e.target.value }))} />
              </div>
              <button type="button" onClick={() => setShowAddTxCompany(!showAddTxCompany)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 11, borderRadius: 5, border: "1px dashed #2563EB", background: showAddTxCompany ? "#EFF6FF" : "transparent", cursor: "pointer", color: "#2563EB", width: "fit-content", marginTop: 8 }}>
                + {t("Add company not in list", "Agregar empresa fuera de lista")}
              </button>
              {showAddTxCompany && (
                <div style={{ marginTop: 6, padding: "12px 14px", background: "#EFF6FF", borderRadius: 8, border: "1px solid #BFDBFE" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 10 }}>{t("New Company", "Nueva Empresa")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Company Name *", "Nombre *")}</div>
                      <input value={newTxCompany} onChange={e => setNewTxCompany(e.target.value)} placeholder="e.g. VOREA Group"
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Contact Person", "Contacto")}</div>
                      <input value={newTxContactPerson} onChange={e => setNewTxContactPerson(e.target.value)} placeholder="e.g. John Smith"
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>Email</div>
                      <input value={newTxEmail} onChange={e => setNewTxEmail(e.target.value)} placeholder="email@company.com"
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 700, marginBottom: 3 }}>{t("Phone", "Teléfono")}</div>
                      <input value={newTxPhone} onChange={e => setNewTxPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                        style={{ width: "100%", fontSize: 12, border: "1px solid #BFDBFE", borderRadius: 6, padding: "5px 8px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => { setShowAddTxCompany(false); setNewTxCompany(""); }}
                      style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6, border: "1px solid #D1D5DB", background: "white", cursor: "pointer" }}>
                      {t("Cancel", "Cancelar")}
                    </button>
                    <button type="button" onClick={async () => {
                      if (!newTxCompany.trim()) return;
                      const tok = JSON.parse(localStorage.getItem("bimlog-auth") || "{}").state?.token;
                      await fetch(`/api/v1/projects/${projectId}/directory`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
                        body: JSON.stringify({ full_name: newTxContactPerson.trim() || newTxCompany.trim(), email: newTxEmail.trim() || "contact@bimlog.io", company_name: newTxCompany.trim(), role: "External Company", notes: `Phone: ${newTxPhone}` }),
                      });
                      setForm(f => ({ ...f, sentTo: newTxCompany.trim(), sentToEmail: newTxEmail.trim(), sentToPhone: newTxPhone.trim() }));
                      setNewTxCompany(""); setNewTxContactPerson(""); setNewTxEmail(""); setNewTxPhone("");
                      setShowAddTxCompany(false);
                    }} style={{ padding: "5px 14px", fontSize: 11, borderRadius: 6, background: "#2563EB", color: "white", border: "none", cursor: "pointer", fontWeight: 700 }}>
                      {t("Add Company", "Agregar Empresa")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t("Saving…", "Guardando…") : t("Create", "Crear")}</button>
              <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setError(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </form>
        </div>
      )}

      {loading && <div className="text-muted">{t("Loading…", "Cargando…")}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Send size={40} color="#D1D5DB" /></div>
          <div style={{ fontWeight: 600 }}>{t("No transmittals yet", "Sin transmisiones aún")}</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(tx => (
            <div key={tx.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#1D4ED8" }}>{tx.number}</span>
                    {statusBadge(tx.status)}
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{tx.title}</div>
                  {tx.purpose && <div style={{ fontSize: 12, color: "#6B7280" }}>{tx.purpose}</div>}
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    {tx.sentAt ? t("Sent", "Enviado") + ": " + new Date(tx.sentAt).toLocaleDateString() : t("Created", "Creado") + ": " + new Date(tx.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canWrite && tx.status === "draft" && (
                    <>
                      <button className="btn btn-sm btn-outline" onClick={() => aiDraft(tx.id)} disabled={aiLoading} title={t("AI Draft Purpose", "Borrador IA")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={12} /> AI</button>
                      <button className="btn btn-sm btn-primary" onClick={() => send(tx.id)}>{t("Send", "Enviar")}</button>
                    </>
                  )}
                  {tx.status === "sent" && canWrite && (
                    <button className="btn btn-sm btn-outline" onClick={() => acknowledge(tx.id)}>{t("Acknowledge", "Acusar")}</button>
                  )}
                  <button className="btn btn-sm btn-outline" onClick={() => exportPdf(tx.id)}>PDF</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
