import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { FileText, Trash2, Sparkles, Send } from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { downloadAuthenticatedPdf, PrintPdfButton } from "@/components/PrintPdfButton";

interface Transmittal {
  id: number; number: string; title: string; purpose?: string;
  status: string; sentAt?: string; acknowledgedAt?: string; createdAt: string;
  sentTo?: Array<{ name?: string; email?: string; userId?: number }> | null;
}

export type ExactTransmittalDeepLink =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "valid"; id: number };

export function parseExactTransmittalDeepLink(search: string): ExactTransmittalDeepLink {
  const values = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).getAll("transmittal");
  if (values.length === 0) return { kind: "none" };
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return { kind: "invalid" };
  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? { kind: "valid", id } : { kind: "invalid" };
}

const API = "/api/v1";

export function TransmittalsTab({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { lang } = useI18n();
  const { token } = useAuthStore();
  const searchParams = useSearch();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [items, setItems] = useState<Transmittal[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_desc");
  const [exportingViewPdf, setExportingViewPdf] = useState(false);
  const [loadError, setLoadError] = useState(false);

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
  const [exportError, setExportError] = useState("");
  const [filter, setFilter] = useState("all");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await fetch(`${API}/projects/${projectId}/transmittals`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`load ${r.status}`);
      setItems(await r.json());
    } catch {
      setLoadError(true);
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

  const exportPdf = async (id: number) => {
    if (!token) return;
    try {
      await downloadAuthenticatedPdf(
        `${API}/projects/${projectId}/transmittals/${id}/export`,
        token,
        `transmittal-${id}.pdf`,
      );
    } catch {
      setError(t("Could not prepare the Transmittal PDF.", "No se pudo preparar el PDF de la Transmisión."));
    }
  };

  const buildCurrentViewParams = () => {
    const params = new URLSearchParams({
      status: filter,
      search: search.trim(),
      sort: sortBy,
    });
    return params;
  };

  const filenameFromDisposition = (header: string, fallback: string) => {
    const match = /filename="?([^";]+)"?/i.exec(header);
    return match?.[1] || fallback;
  };

  const exportCurrentViewPdf = async () => {
    setExportingViewPdf(true);
    setExportError("");
    try {
      const res = await fetch(`${API}/projects/${projectId}/transmittals/export-pdf?${buildCurrentViewParams().toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Transmittals PDF export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(res.headers.get("Content-Disposition") || "", "Transmittals-Current-View-Report.pdf");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("Transmittals PDF export failed", "Error al exportar PDF de transmisiones"));
    } finally {
      setExportingViewPdf(false);
    }
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

  const recipientText = (tx: Transmittal) =>
    Array.isArray(tx.sentTo) && tx.sentTo.length
      ? tx.sentTo.map(r => [r?.name, r?.email].filter(Boolean).join(" <")).filter(Boolean).join(", ")
      : "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter(i => filter === "all" || i.status === filter)
      .filter(i => {
        if (!q) return true;
        return [i.number, i.title, i.purpose, i.status, recipientText(i)]
          .some(value => String(value || "").toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (sortBy === "created_asc") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === "sent_desc") return new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime();
        if (sortBy === "title_asc") return a.title.localeCompare(b.title);
        if (sortBy === "status_asc") return a.status.localeCompare(b.status) || a.number.localeCompare(b.number);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filter, items, search, sortBy]);
  const exactTransmittalDeepLink = useMemo(() => parseExactTransmittalDeepLink(searchParams), [searchParams]);
  const exactTransmittalTarget = exactTransmittalDeepLink.kind === "valid"
    ? items.find(item => item.id === exactTransmittalDeepLink.id) ?? null
    : null;
  const exactTransmittalNotFound = exactTransmittalDeepLink.kind === "valid" && loaded && !loading && !loadError && !exactTransmittalTarget;
  const resolvedTransmittalTarget = loaded && !loading && !loadError ? exactTransmittalTarget : null;
  const openedTransmittal = resolvedTransmittalTarget && selected?.id === resolvedTransmittalTarget.id ? selected : null;
  const visibleTransmittals = resolvedTransmittalTarget && !filtered.some(item => item.id === resolvedTransmittalTarget.id)
    ? [resolvedTransmittalTarget, ...filtered]
    : filtered;

  useEffect(() => {
    if (!loaded) return;
    setSelected(resolvedTransmittalTarget);
  }, [loaded, resolvedTransmittalTarget]);

  useEffect(() => {
    if (!openedTransmittal) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`transmittal-${openedTransmittal.id}`)?.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openedTransmittal?.id]);

  const currentViewSummary = [
    `${t("Status", "Estado")}: ${filter === "all" ? t("All", "Todos") : t(filter.charAt(0).toUpperCase() + filter.slice(1), filter === "draft" ? "Borrador" : filter === "sent" ? "Enviado" : "Acusado")}`,
    search.trim() ? `${t("Search", "Búsqueda")}: ${search.trim()}` : "",
    `${t("Sort", "Orden")}: ${sortBy.replace(/_/g, " ")}`,
    `${t("Visible", "Visible")}: ${filtered.length}/${items.length}`,
  ].filter(Boolean);

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

      <div style={{ display: "grid", gap: 10, marginBottom: 16, padding: 12, border: "1px solid #E5E7EB", borderRadius: 10, background: "#FFFFFF" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t("Current view report", "Reporte de vista actual")}</div>
            <div style={{ color: "#6B7280", fontSize: 12 }}>{t("Export a governed PDF of the filtered Transmittals view shown below.", "Exporta un PDF gobernado de la vista filtrada de transmisiones que se muestra abajo.")}</div>
          </div>
          <PrintPdfButton
            lang={lang}
            onClick={() => void exportCurrentViewPdf()}
            loading={exportingViewPdf}
            disabled={loading}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700 }}>
            {t("Search", "Búsqueda")}
            <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t("Number, title, purpose, recipient...", "Número, título, propósito, destinatario...")} style={{ fontSize: 12 }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700 }}>
            {t("Status", "Estado")}
            <select className="input" value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: 12 }}>
              {["all", "draft", "sent", "acknowledged"].map(s => (
                <option key={s} value={s}>
                  {t(s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1),
                    s === "all" ? "Todos" : s === "draft" ? "Borrador" : s === "sent" ? "Enviado" : "Acusado")}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 11, fontWeight: 700 }}>
            {t("Sort", "Orden")}
            <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ fontSize: 12 }}>
              <option value="created_desc">{t("Newest first", "Más recientes primero")}</option>
              <option value="created_asc">{t("Oldest first", "Más antiguos primero")}</option>
              <option value="sent_desc">{t("Sent date newest", "Fecha de envío reciente")}</option>
              <option value="title_asc">{t("Title A-Z", "Título A-Z")}</option>
              <option value="status_asc">{t("Status A-Z", "Estado A-Z")}</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {currentViewSummary.map(part => (
            <span key={part} style={{ display: "inline-flex", padding: "4px 7px", borderRadius: 6, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1E3A5F", fontSize: 11, fontWeight: 800 }}>{part}</span>
          ))}
        </div>
        {exportError && (
          <div className="alert alert-danger" style={{ margin: 0, fontSize: 12 }}>
            {exportError}
          </div>
        )}
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

      {loadError && !loading && (
        <div role="alert" className="alert alert-danger">
          {t("Transmittals could not be loaded. No record was selected.", "No se pudieron cargar las transmisiones. No se seleccionó ningún registro.")}
        </div>
      )}
      {exactTransmittalDeepLink.kind === "invalid" && (
        <div role="alert" className="alert alert-danger">
          {t("The transmittal link is invalid. No transmittal was selected.", "El enlace de la transmisión no es válido. No se seleccionó ninguna transmisión.")}
        </div>
      )}
      {exactTransmittalNotFound && exactTransmittalDeepLink.kind === "valid" && (
        <div role="alert" className="alert alert-danger">
          {t(`Transmittal #${exactTransmittalDeepLink.id} was not found in this project. No other transmittal was selected.`, `La transmisión #${exactTransmittalDeepLink.id} no se encontró en este proyecto. No se seleccionó ninguna otra transmisión.`)}
        </div>
      )}
      {openedTransmittal && (
        <section aria-label={t("Opened transmittal detail", "Detalle de transmisión abierto")} data-deep-link-detail="true" className="card" style={{ marginBottom: 16, padding: 16, border: "2px solid #2563EB", background: "#EFF6FF" }}>
          <div style={{ color: "#1E3A5F", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>{t("Opened exact transmittal", "Transmisión exacta abierta")}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{openedTransmittal.number}</strong>
            {statusBadge(openedTransmittal.status)}
          </div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>{openedTransmittal.title}</div>
          {openedTransmittal.purpose && <div style={{ color: "#4B5563", fontSize: 12, marginTop: 4 }}>{openedTransmittal.purpose}</div>}
          <div style={{ color: "#6B7280", fontSize: 11, marginTop: 6 }}>{t("Record ID", "ID del registro")}: {openedTransmittal.id}</div>
        </section>
      )}

      {!loading && !loadError && visibleTransmittals.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Send size={40} color="#D1D5DB" /></div>
          <div style={{ fontWeight: 600 }}>
            {items.length === 0
              ? t("No transmittals yet", "Sin transmisiones aún")
              : t("No transmittals match the current filters", "No hay transmisiones que coincidan con los filtros actuales")}
          </div>
          {items.length > 0 && (
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {t("Adjust the status, search, or sort controls above to change the current view.", "Ajusta el estado, la búsqueda o el orden arriba para cambiar la vista actual.")}
            </div>
          )}
        </div>
      )}

      {!loading && !loadError && visibleTransmittals.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visibleTransmittals.map(tx => (
            <div
              id={`transmittal-${tx.id}`}
              key={tx.id}
              data-deep-link-target={openedTransmittal?.id === tx.id ? "true" : undefined}
              aria-current={openedTransmittal?.id === tx.id ? "true" : undefined}
              className="card"
              style={{ padding: 16, border: openedTransmittal?.id === tx.id ? "2px solid #2563EB" : undefined, background: openedTransmittal?.id === tx.id ? "#EFF6FF" : undefined }}
            >
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
                  <button className="btn btn-sm btn-outline" title={t("Download this individual transmittal report as PDF", "Descargar este reporte individual de transmisión en PDF")} onClick={() => exportPdf(tx.id)}>{t("Individual Transmittal PDF", "PDF individual de transmisión")}</button>
                  {canWrite && (
                    <button
                      title={t("Delete", "Eliminar")}
                      onClick={() => setDeleteTarget({ id: tx.id, label: tx.number })}
                      style={{ padding: "4px 8px", border: "1px solid #FECACA", borderRadius: 4, background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "inline-flex", alignItems: "center" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          open
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setItems(prev => prev.filter(x => x.id !== deleteTarget.id));
            setDeleteTarget(null);
          }}
          endpoint={`/api/v1/projects/${projectId}/transmittals/${deleteTarget.id}`}
          entityLabel={`Transmittal ${deleteTarget.label}`}
          warning={t("Items and linked references will be removed.", "Los items y referencias enlazadas serán eliminadas.")}
        />
      )}
    </div>
  );
}
