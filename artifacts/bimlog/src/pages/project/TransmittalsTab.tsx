import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Send, Sparkles } from "lucide-react";

interface Transmittal {
  id: number; number: string; title: string; purpose?: string;
  status: string; sentAt?: string; acknowledgedAt?: string; createdAt: string;
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
  const [form, setForm] = useState({ title: "", purpose: "" });
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
      const r = await fetch(`${API}/projects/${projectId}/transmittals`, {
        method: "POST", headers, body: JSON.stringify(form),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error || "Error"); return; }
      await load();
      setShowForm(false);
      setForm({ title: "", purpose: "" });
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
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + {t("New Transmittal", "Nueva Transmisión")}
          </button>
        )}
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
