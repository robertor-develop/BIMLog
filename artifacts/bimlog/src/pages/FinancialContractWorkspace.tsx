import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { PrintPdfButton } from "@/components/PrintPdfButton";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type SovDraft = { stableLineId: string; budgetSnapshotLineId: string; projectCostNodeId: string; description: string; amount: string; scheduleItemPlacementId: string };
const emptyLine = (): SovDraft => ({ stableLineId: `SOV-${Date.now()}`, budgetSnapshotLineId: "", projectCostNodeId: "", description: "", amount: "", scheduleItemPlacementId: "" });
type ContractSort = "created_desc" | "legal_asc" | "legal_desc" | "counterparty_asc" | "status_asc" | "value_desc" | "value_asc" | "approved_desc" | "executed_desc";
type ContractColumn = "legalNumber" | "title" | "counterparty" | "status" | "type" | "perspective" | "originalValue" | "currentCommitment" | "currency" | "approvedAt" | "executedAt";
type ContractSection = "summary" | "filters" | "contracts";
const defaultColumns: ContractColumn[] = ["legalNumber", "title", "counterparty", "status", "type", "perspective", "originalValue", "currentCommitment", "currency"];
const defaultSections: ContractSection[] = ["summary", "filters", "contracts"];
const statusOptions = ["all", "draft", "submitted", "under_review", "approved", "executed", "returned", "rejected", "withdrawn", "superseded", "terminated", "voided", "closed"];
const typeOptions = ["all", "subcontract", "purchase_order", "consultant_agreement", "owner_prime", "other_commitment"];
const perspectiveOptions = ["all", "downstream", "upstream"];
const sortOptions: ContractSort[] = ["created_desc", "legal_asc", "legal_desc", "counterparty_asc", "status_asc", "value_desc", "value_asc", "approved_desc", "executed_desc"];
const human = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const decimal = (value: unknown) => Number(String(value ?? "0").replace(/,/g, ""));
const safePdfFileName = (value: string | null, fallback: string) => {
  const leaf = (value || "").trim().split(/[\\/]/).pop() || fallback;
  const safe = leaf.replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, "-").replace(/^\.+/, "").trim().slice(0, 160);
  return /\.pdf$/i.test(safe) ? safe : `${safe || fallback}.pdf`;
};
const safeDownloadFileName = (value: string | null, fallback: string, extension: "pdf" | "xlsx") => {
  const leaf = (value || "").trim().split(/[\\/]/).pop() || fallback;
  const safe = leaf.replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, "-").replace(/^\.+/, "").trim().slice(0, 160);
  return new RegExp(`\\.${extension}$`, "i").test(safe) ? safe : `${safe || fallback}.${extension}`;
};
const contentDispositionFileName = (header: string | null) => {
  if (!header) return null;
  const encoded = header.match(/filename\*\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  if (encoded) {
    try { return decodeURIComponent((encoded[1] ?? encoded[2] ?? "").replace(/^UTF-8''/i, "")); } catch { return encoded[1] ?? encoded[2] ?? null; }
  }
  return header.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ?? header.match(/filename\s*=\s*([^;]+)/i)?.[1] ?? null;
};

export function FinancialContractWorkspace() {
  const { token } = useAuthStore(), { language, tt } = useI18n();
  const lang = language;
  const [, params] = useRoute("/projects/:id/financial/contracts");
  const projectId = Number(params?.id);
  const [data, setData] = useState<any>(null), [budget, setBudget] = useState<any>(null), [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(""), [showCreate, setShowCreate] = useState(false);
  const [exportError, setExportError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [counterpartyFilter, setCounterpartyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [perspectiveFilter, setPerspectiveFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [dateField, setDateField] = useState("none");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [valueMin, setValueMin] = useState("");
  const [valueMax, setValueMax] = useState("");
  const [sort, setSort] = useState<ContractSort>("created_desc");
  const [selectedColumns, setSelectedColumns] = useState<ContractColumn[]>(defaultColumns);
  const [selectedSections, setSelectedSections] = useState<ContractSection[]>(defaultSections);
  const [form, setForm] = useState({ legalNumber: "", perspective: "downstream", contractType: "subcontract", counterpartyName: "", title: "", currency: "USD", originalValue: "", budgetSnapshotId: "", paymentTerms: "", reviewerId: "", approverId: "", executorId: "", managerId: "" });
  const [lines, setLines] = useState<SovDraft[]>([emptyLine()]);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const api = async (path: string, options?: RequestInit) => { const response = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers: { ...headers, ...(options?.headers ?? {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body?.error?.[language] ?? tt("Financial contract access was denied.", "Se denegó el acceso al contrato financiero.")); return body; };
  const load = async () => { setError(""); try { const [contracts, budgets] = await Promise.all([api(`/projects/${projectId}/financial/contracts`), api(`/projects/${projectId}/financial/workspace`)]); setData(contracts); setBudget(budgets); const selected = form.budgetSnapshotId || budgets.snapshots?.[0]?.id || ""; if (selected) { setForm((current) => ({ ...current, budgetSnapshotId: selected, currency: budgets.snapshots?.find((s: any) => s.id === selected)?.currency ?? current.currency })); setSnapshot(await api(`/projects/${projectId}/financial/snapshots/${selected}`)); } } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  useEffect(() => { if (projectId && token) void load(); }, [projectId, token, language]);
  const selectSnapshot = async (id: string) => { const meta = budget?.snapshots?.find((s: any) => s.id === id); setForm({ ...form, budgetSnapshotId: id, currency: meta?.currency ?? form.currency }); setLines([emptyLine()]); if (id) setSnapshot(await api(`/projects/${projectId}/financial/snapshots/${id}`)); };
  const chooseBudgetLine = (index: number, id: string) => { const item = snapshot?.snapshot?.lines?.find((line: any) => line.id === id); setLines(lines.map((line, i) => i === index ? { ...line, budgetSnapshotLineId: id, projectCostNodeId: item?.project_cost_node_id ?? "", description: line.description || item?.description || "" } : line)); };
  const initialGrants = () => [{ value: form.reviewerId, permission: "review" }, { value: form.approverId, permission: "approve" }, { value: form.executorId, permission: "execute" }, { value: form.managerId, permission: "manage" }, { value: form.reviewerId, permission: "view" }, { value: form.approverId, permission: "view" }, { value: form.executorId, permission: "view" }, { value: form.managerId, permission: "view" }].filter((item) => item.value).map((item) => ({ userId: Number(item.value), permission: item.permission }));
  const create = async () => { setBusy("create"); setError(""); try { await api(`/projects/${projectId}/financial/contracts`, { method: "POST", body: JSON.stringify({ ...form, initialGrants: initialGrants(), commercialMetadata: { retainage: null, tax: null, bond: null, insurance: null }, lines: lines.map((line, index) => ({ ...line, scheduleItemPlacementId: line.scheduleItemPlacementId || null, sortOrder: index })) }) }); setShowCreate(false); setLines([emptyLine()]); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); } };
  const act = async (contract: any, action: string) => { setBusy(contract.id); setError(""); try { let path = `/projects/${projectId}/financial/contracts/${contract.id}/versions/${contract.versionId}/actions`, body: any = { action, expectedRevision: contract.revision }; if (action === "approve") { path = `/projects/${projectId}/financial/contracts/${contract.id}/versions/${contract.versionId}/approve`; body = { expectedRevision: contract.revision, confirmationFingerprint: contract.contentFingerprint, overBudgetReason: window.prompt(tt("If this exceeds budget or aggregate limits, enter the required exception reason.", "Si esto excede el presupuesto o los límites agregados, indique el motivo obligatorio de la excepción.")) || undefined }; } else if (action === "execute") { const signedFileId = window.prompt(tt("Authenticated signed-document file ID", "ID del archivo firmado autenticado")); if (!signedFileId) return; path = `/projects/${projectId}/financial/contracts/${contract.id}/versions/${contract.versionId}/execute`; body = { expectedRevision: contract.revision, confirmationFingerprint: contract.contentFingerprint, signedFileId }; } else if (["return", "reject", "withdraw"].includes(action)) body.reason = window.prompt(tt("Controlled reason", "Motivo controlado")) || "Workflow decision recorded"; await api(path, { method: "POST", body: JSON.stringify(body) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); } };
  const download = async (contract: any, format: "pdf" | "xlsx") => { setBusy(`${contract.id}-${format}`); try { const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/contracts/${contract.id}/export.${format}`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(tt("Export was denied.", "Se denegó la exportación.")); const url = URL.createObjectURL(await response.blob()), link = document.createElement("a"); link.href = url; link.download = safeDownloadFileName(contentDispositionFileName(response.headers.get("Content-Disposition")), `contract-${contract.legalNumber}.${format}`, format); link.click(); URL.revokeObjectURL(url); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); } };
  const contracts = data?.contracts ?? [];
  const counterparties = Array.from(new Set(contracts.map((contract: any) => contract.counterpartyName).filter(Boolean))).sort();
  const currencies = Array.from(new Set(contracts.map((contract: any) => contract.currency).filter(Boolean))).sort();
  const filteredContracts = [...contracts].filter((contract: any) => {
    const dateValue = dateField === "approved" ? contract.approvedAt : dateField === "executed" ? contract.executedAt : "";
    const amount = contract.status === "executed" ? decimal(contract.currentCommitment) : decimal(contract.originalValue);
    const query = search.trim().toLowerCase();
    if (statusFilter !== "all" && contract.status !== statusFilter) return false;
    if (counterpartyFilter !== "all" && contract.counterpartyName !== counterpartyFilter) return false;
    if (typeFilter !== "all" && contract.contractType !== typeFilter) return false;
    if (perspectiveFilter !== "all" && contract.perspective !== perspectiveFilter) return false;
    if (currencyFilter !== "all" && contract.currency !== currencyFilter) return false;
    if (dateField !== "none" && (!dateValue || (dateFrom && dateValue.slice(0, 10) < dateFrom) || (dateTo && dateValue.slice(0, 10) > dateTo))) return false;
    if (valueMin && amount < Number(valueMin)) return false;
    if (valueMax && amount > Number(valueMax)) return false;
    if (!query) return true;
    return [contract.bimlogId, contract.legalNumber, contract.title, contract.counterpartyName, contract.status, contract.perspective, contract.contractType, contract.currency, contract.originalValue, contract.currentCommitment, contract.approvedAt?.slice(0, 10), contract.executedAt?.slice(0, 10)].filter(Boolean).join(" ").toLowerCase().includes(query);
  }).sort((a: any, b: any) => {
    if (sort === "legal_asc") return String(a.legalNumber).localeCompare(String(b.legalNumber));
    if (sort === "legal_desc") return String(b.legalNumber).localeCompare(String(a.legalNumber));
    if (sort === "counterparty_asc") return String(a.counterpartyName).localeCompare(String(b.counterpartyName));
    if (sort === "status_asc") return String(a.status).localeCompare(String(b.status)) || String(a.legalNumber).localeCompare(String(b.legalNumber));
    if (sort === "value_asc") return decimal(a.currentCommitment || a.originalValue) - decimal(b.currentCommitment || b.originalValue);
    if (sort === "value_desc") return decimal(b.currentCommitment || b.originalValue) - decimal(a.currentCommitment || a.originalValue);
    if (sort === "approved_desc") return String(b.approvedAt ?? "").localeCompare(String(a.approvedAt ?? ""));
    if (sort === "executed_desc") return String(b.executedAt ?? "").localeCompare(String(a.executedAt ?? ""));
    return 0;
  });
  const filteredExecutedTotal = filteredContracts.filter((contract: any) => contract.status === "executed").reduce((sum: number, contract: any) => sum + decimal(contract.currentCommitment), 0);
  const activeSummary = [
    `${tt("Status", "Estado")}: ${statusFilter === "all" ? tt("All", "Todos") : human(statusFilter)}`,
    `${tt("Counterparty", "Contraparte")}: ${counterpartyFilter === "all" ? tt("All", "Todas") : counterpartyFilter}`,
    `${tt("Type", "Tipo")}: ${typeFilter === "all" ? tt("All", "Todos") : human(typeFilter)}`,
    `${tt("Perspective", "Perspectiva")}: ${perspectiveFilter === "all" ? tt("All", "Todas") : human(perspectiveFilter)}`,
    `${tt("Currency", "Moneda")}: ${currencyFilter === "all" ? tt("All", "Todas") : currencyFilter}`,
    `${tt("Search", "Busqueda")}: ${search.trim() || tt("None", "Ninguna")}`,
    `${tt("Date", "Fecha")}: ${dateField === "none" ? tt("Not filtered", "Sin filtro") : `${human(dateField)} ${dateFrom || ".."} - ${dateTo || ".."}`}`,
    `${tt("Value", "Valor")}: ${valueMin || ".."} - ${valueMax || ".."}`,
    `${tt("Sort", "Orden")}: ${human(sort)}`,
    `${tt("Rows", "Filas")}: ${filteredContracts.length}/${contracts.length}`,
  ];
  const toggleColumn = (column: ContractColumn) => setSelectedColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  const toggleSection = (section: ContractSection) => setSelectedSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  const downloadCurrentView = async () => {
    setBusy("current-view-pdf"); setExportError("");
    if (!selectedColumns.length || !selectedSections.length) {
      setExportError(tt("Select at least one PDF field and one PDF section before exporting.", "Seleccione al menos un campo PDF y una seccion PDF antes de exportar."));
      setBusy("");
      return;
    }
    const params = new URLSearchParams({ lang: language, status: statusFilter, counterparty: counterpartyFilter, contract_type: typeFilter, perspective: perspectiveFilter, currency: currencyFilter, search: search.trim(), date_field: dateField, date_from: dateFrom, date_to: dateTo, value_min: valueMin, value_max: valueMax, sort, columns: selectedColumns.join(","), sections: selectedSections.join(",") });
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/contracts/current-view.pdf?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body?.error?.[language] ?? body?.error?.en ?? tt("Contracts current-view PDF export failed.", "Fallo la exportacion PDF de vista actual de contratos.")); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = safePdfFileName(contentDispositionFileName(response.headers.get("Content-Disposition")), "contracts-current-view.pdf"); link.click(); URL.revokeObjectURL(url);
    } catch (e) { setExportError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  };
  return <div className="fc-page"><style>{styles}</style>
    <header className="fc-header"><div><Link href={`/projects/${projectId}/financial/budget`}>← {tt("Project Budget", "Presupuesto del Proyecto")}</Link><h1>{tt("Contracts & Commitments", "Contratos y Compromisos")}</h1><p>{tt("Exact, versioned contract terms and schedules of values", "Términos y SOV exactos y versionados")}</p></div><button onClick={() => setShowCreate(!showCreate)}>{showCreate ? tt("Close", "Cerrar") : tt("New contract", "Nuevo contrato")}</button></header>
    <section className="fc-boundary">{tt("Operational project control only. Approval is separate from signed-document execution. No accounting posting, invoice payment, bank movement, external portal, or automatic AI.", "Solo control operativo del proyecto. La aprobación está separada de la ejecución con documento firmado. Sin asientos contables, pago de facturas, movimientos bancarios, portal externo ni IA automática.")}</section>
    {error && <div className="fc-error" role="alert">{error}</div>}
    {exportError && <div className="fc-error" role="alert">{exportError}</div>}
    {showCreate && <section className="fc-panel"><h2>{tt("Controlled contract draft", "Borrador de contrato controlado")}</h2><div className="fc-form">
      <label>{tt("Legal number", "Número legal")}<input value={form.legalNumber} onChange={(e) => setForm({ ...form, legalNumber: e.target.value })}/></label>
      <label>{tt("Perspective", "Perspectiva")}<select value={form.perspective} onChange={(e) => setForm({ ...form, perspective: e.target.value })}><option value="downstream">{tt("Downstream commitment", "Compromiso descendente")}</option><option value="upstream">{tt("Owner / prime", "Propietario / principal")}</option></select></label>
      <label>{tt("Type", "Tipo")}<select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}><option value="subcontract">{tt("Subcontract", "Subcontrato")}</option><option value="purchase_order">{tt("Purchase order", "Orden de compra")}</option><option value="consultant_agreement">{tt("Consultant agreement", "Acuerdo de consultoría")}</option><option value="owner_prime">{tt("Owner / prime contract", "Contrato propietario / principal")}</option><option value="other_commitment">{tt("Other commitment", "Otro compromiso")}</option></select></label>
      <label>{tt("Counterparty", "Contraparte")}<input value={form.counterpartyName} onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}/></label>
      <label>{tt("Title", "Título")}<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
      <label>{tt("Approved budget snapshot", "Instantánea de presupuesto aprobada")}<select value={form.budgetSnapshotId} onChange={(e) => void selectSnapshot(e.target.value)}><option value="">—</option>{budget?.snapshots?.map((s: any) => <option key={s.id} value={s.id}>v{s.budgetVersion} · {s.currentTotal} {s.currency}</option>)}</select></label>
      <label>{tt("Exact original value", "Valor original exacto")}<input inputMode="decimal" value={form.originalValue} onChange={(e) => setForm({ ...form, originalValue: e.target.value })}/></label>
      <label>{tt("ISO currency", "Moneda ISO")}<input value={form.currency} readOnly/></label>
      <label className="fc-wide">{tt("Payment terms (metadata only)", "Términos de pago (solo metadatos)")}<input value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}/></label>
    </div><h3>{tt("Internal record grants", "Permisos internos del registro")}</h3><p>{tt("Enter current project-member IDs. These grants never replace financial authority.", "Ingrese IDs de miembros vigentes. Estos permisos nunca sustituyen la autoridad financiera.")}</p><div className="fc-form"><label>{tt("Reviewer user ID", "ID del revisor")}<input inputMode="numeric" value={form.reviewerId} onChange={(e) => setForm({ ...form, reviewerId: e.target.value })}/></label><label>{tt("Approver user ID", "ID del aprobador")}<input inputMode="numeric" value={form.approverId} onChange={(e) => setForm({ ...form, approverId: e.target.value })}/></label><label>{tt("Executor user ID", "ID del ejecutor")}<input inputMode="numeric" value={form.executorId} onChange={(e) => setForm({ ...form, executorId: e.target.value })}/></label><label>{tt("Record manager user ID", "ID del administrador del registro")}<input inputMode="numeric" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}/></label></div>
      <h3>{tt("Schedule of Values", "Programa de Valores")}</h3>{lines.map((line, index) => <div className="fc-line" key={line.stableLineId}><label>{tt("Budget line", "Línea presupuestaria")}<select value={line.budgetSnapshotLineId} onChange={(e) => chooseBudgetLine(index, e.target.value)}><option value="">—</option>{snapshot?.snapshot?.lines?.map((item: any) => <option key={item.id} value={item.id}>{item.project_code} · {item.description} · {String(item.amount)}</option>)}</select></label><label>{tt("SOV line ID", "ID de línea SOV")}<input value={line.stableLineId} onChange={(e) => setLines(lines.map((x, i) => i === index ? { ...x, stableLineId: e.target.value } : x))}/></label><label>{tt("Description", "Descripción")}<input value={line.description} onChange={(e) => setLines(lines.map((x, i) => i === index ? { ...x, description: e.target.value } : x))}/></label><label>{tt("Exact amount", "Monto exacto")}<input inputMode="decimal" value={line.amount} onChange={(e) => setLines(lines.map((x, i) => i === index ? { ...x, amount: e.target.value } : x))}/></label><label>{tt("Optional Schedule item ID", "ID opcional del elemento de Schedule")}<input inputMode="numeric" value={line.scheduleItemPlacementId} onChange={(e) => setLines(lines.map((x, i) => i === index ? { ...x, scheduleItemPlacementId: e.target.value } : x))}/></label>{lines.length > 1 && <button onClick={() => setLines(lines.filter((_, i) => i !== index))}>{tt("Remove", "Quitar")}</button>}</div>)}
      <div className="fc-actions"><button onClick={() => setLines([...lines, emptyLine()])}>{tt("Add SOV line", "Agregar línea SOV")}</button><button className="primary" disabled={busy === "create"} onClick={() => void create()}>{tt("Create exact draft", "Crear borrador exacto")}</button></div>
    </section>}
    <section className="fc-export-view" aria-label={tt("Contracts current-view PDF controls", "Controles PDF de vista actual de contratos")}><div className="fc-export-top"><div><h2>{tt("Contracts current-view report", "Reporte de vista actual de contratos")}</h2><p>{tt("The PDF uses this screen's filters, sort order, selected fields, selected sections, and accessible contract records.", "El PDF usa los filtros, orden, campos, secciones y contratos accesibles de esta pantalla.")}</p></div><PrintPdfButton lang={lang} loading={busy === "current-view-pdf"} disabled={busy !== "" || !data || !selectedColumns.length || !selectedSections.length} disabledReason={!selectedColumns.length || !selectedSections.length ? tt("Select at least one PDF field and one PDF section.", "Seleccione al menos un campo PDF y una seccion PDF.") : undefined} onClick={() => void downloadCurrentView()} /></div>{(!selectedColumns.length || !selectedSections.length) && <p className="fc-validation" role="alert">{tt("Export requires at least one PDF field and one PDF section.", "La exportacion requiere al menos un campo PDF y una seccion PDF.")}</p>}<div className="fc-filter-grid"><label>{tt("Search", "Busqueda")}<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tt("Search number, title, company, status...", "Buscar numero, titulo, empresa, estado...")}/></label><label>{tt("Status", "Estado")}<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{statusOptions.map((item) => <option key={item} value={item}>{item === "all" ? tt("All statuses", "Todos los estados") : human(item)}</option>)}</select></label><label>{tt("Counterparty", "Contraparte")}<select value={counterpartyFilter} onChange={(e) => setCounterpartyFilter(e.target.value)}><option value="all">{tt("All counterparties", "Todas las contrapartes")}</option>{counterparties.map((item: any) => <option key={item} value={item}>{item}</option>)}</select></label><label>{tt("Type", "Tipo")}<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>{typeOptions.map((item) => <option key={item} value={item}>{item === "all" ? tt("All types", "Todos los tipos") : human(item)}</option>)}</select></label><label>{tt("Perspective", "Perspectiva")}<select value={perspectiveFilter} onChange={(e) => setPerspectiveFilter(e.target.value)}>{perspectiveOptions.map((item) => <option key={item} value={item}>{item === "all" ? tt("All perspectives", "Todas las perspectivas") : human(item)}</option>)}</select></label><label>{tt("Currency", "Moneda")}<select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}><option value="all">{tt("All currencies", "Todas las monedas")}</option>{currencies.map((item: any) => <option key={item} value={item}>{item}</option>)}</select></label><label>{tt("Date field", "Campo de fecha")}<select value={dateField} onChange={(e) => setDateField(e.target.value)}><option value="none">{tt("No date filter", "Sin filtro de fecha")}</option><option value="approved">{tt("Approved date", "Fecha de aprobacion")}</option><option value="executed">{tt("Executed date", "Fecha de ejecucion")}</option></select></label><label>{tt("From", "Desde")}<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={dateField === "none"}/></label><label>{tt("To", "Hasta")}<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={dateField === "none"}/></label><label>{tt("Minimum value", "Valor minimo")}<input inputMode="decimal" value={valueMin} onChange={(e) => setValueMin(e.target.value)} placeholder="0.00"/></label><label>{tt("Maximum value", "Valor maximo")}<input inputMode="decimal" value={valueMax} onChange={(e) => setValueMax(e.target.value)} placeholder="0.00"/></label><label>{tt("Sort", "Orden")}<select value={sort} onChange={(e) => setSort(e.target.value as ContractSort)}>{sortOptions.map((item) => <option key={item} value={item}>{human(item)}</option>)}</select></label></div><div className="fc-checks"><strong>{tt("PDF fields", "Campos PDF")}</strong>{(["legalNumber", "title", "counterparty", "status", "type", "perspective", "originalValue", "currentCommitment", "currency", "approvedAt", "executedAt"] as ContractColumn[]).map((column) => <label key={column}><input type="checkbox" checked={selectedColumns.includes(column)} onChange={() => toggleColumn(column)}/>{human(column)}</label>)}</div><div className="fc-checks"><strong>{tt("PDF sections", "Secciones PDF")}</strong>{(["summary", "filters", "contracts"] as ContractSection[]).map((section) => <label key={section}><input type="checkbox" checked={selectedSections.includes(section)} onChange={() => toggleSection(section)}/>{human(section)}</label>)}</div><p className="fc-active-summary">{activeSummary.join(" | ")}</p></section>
    <section className="fc-summary"><div><span>{tt("Visible contracts", "Contratos visibles")}</span><strong>{filteredContracts.length}/{contracts.length}</strong></div><div><span>{tt("Executed commitment in view", "Compromiso ejecutado en vista")}</span><strong>{filteredExecutedTotal.toFixed(2)}</strong></div><div><span>{tt("Currencies in view", "Monedas en vista")}</span><strong>{Array.from(new Set(filteredContracts.map((contract: any) => contract.currency))).join(", ") || "-"}</strong></div></section>
    <main className="fc-cards">{filteredContracts.map((contract: any) => <article key={contract.id} className="fc-card"><div className="fc-card-head"><div><small>{contract.bimlogId}</small><h2>{contract.legalNumber} · {contract.title}</h2><p>{contract.counterpartyName} · {contract.perspective} · {contract.contractType}</p></div><span className={`fc-status ${contract.status}`}>{contract.status}</span></div><div className="fc-money"><span>{tt("Original", "Original")}<b>{contract.originalValue} {contract.currency}</b></span><span>{tt("Executed amendments", "Enmiendas ejecutadas")}<b>{contract.executedAmendmentTotal}</b></span><span>{tt("Current commitment", "Compromiso actual")}<b>{contract.currentCommitment}</b></span></div><code>{contract.contentFingerprint}</code><div className="fc-actions">
      {contract.status === "draft" && <button disabled={busy === contract.id} onClick={() => void act(contract, "submit")}>{tt("Submit", "Enviar")}</button>}
      {contract.status === "submitted" && <><button disabled={busy === contract.id} onClick={() => void act(contract, "start_review")}>{tt("Start review", "Iniciar revisión")}</button><button disabled={busy === contract.id} onClick={() => void act(contract, "withdraw")}>{tt("Withdraw", "Retirar")}</button></>}
      {contract.status === "under_review" && <><button disabled={busy === contract.id} onClick={() => void act(contract, "approve")}>{tt("Confirm exact approval", "Confirmar aprobación exacta")}</button><button disabled={busy === contract.id} onClick={() => void act(contract, "return")}>{tt("Return", "Devolver")}</button><button disabled={busy === contract.id} onClick={() => void act(contract, "reject")}>{tt("Reject", "Rechazar")}</button></>}
      {contract.status === "approved" && <button disabled={busy === contract.id} onClick={() => void act(contract, "execute")}>{tt("Attest signed execution", "Atestar ejecución firmada")}</button>}
      <div className="fc-export-panel" aria-label={tt("Contract export actions", "Acciones de exportación del contrato")}>
        <div>
          <strong>{tt("Generate contract outputs", "Generar salidas del contrato")}</strong>
          <p>{tt("PDF is the formal contract report for sharing and record retention. XLSX is the workbook for analysis and reconciliation.", "PDF es el reporte formal del contrato para compartir y conservar el registro. XLSX es el libro para análisis y conciliación.")}</p>
        </div>
        <div className="fc-export-actions">
          <button
            disabled={busy !== ""}
            onClick={() => void download(contract, "pdf")}
            title={tt("Generate formal contract PDF report", "Generar reporte PDF formal del contrato")}
            aria-label={tt(`Generate PDF report for contract ${contract.legalNumber}`, `Generar reporte PDF para el contrato ${contract.legalNumber}`)}
          >
            {busy === `${contract.id}-pdf` ? tt("Generating PDF...", "Generando PDF...") : tt("Generate PDF Report", "Generar reporte PDF")}
          </button>
          <button
            disabled={busy !== ""}
            onClick={() => void download(contract, "xlsx")}
            title={tt("Download contract workbook for analysis", "Descargar libro del contrato para análisis")}
            aria-label={tt(`Download XLSX workbook for contract ${contract.legalNumber}`, `Descargar libro XLSX para el contrato ${contract.legalNumber}`)}
          >
            {busy === `${contract.id}-xlsx` ? tt("Preparing XLSX...", "Preparando XLSX...") : tt("Download XLSX Workbook", "Descargar libro XLSX")}
          </button>
        </div>
      </div>
    </div></article>)}{data && contracts.length === 0 && <div className="fc-empty">{tt("No accessible contract records. An authorized preparer may create one.", "No hay contratos accesibles. Un preparador autorizado puede crear uno.")}</div>}{data && contracts.length > 0 && filteredContracts.length === 0 && <div className="fc-empty">{tt("No contracts match the current filters.", "Ningun contrato coincide con los filtros actuales.")}</div>}</main>
  </div>;
}

const styles = `.fc-page{min-height:100vh;background:#f4f6f8;color:#17212b;padding:24px;overflow-x:hidden}.fc-page>*{max-width:1180px;margin-left:auto;margin-right:auto}.fc-header{display:flex;justify-content:space-between;align-items:end;gap:16px}.fc-header h1{margin:8px 0 4px;font-size:28px}.fc-header p,.fc-panel p,.fc-card p{color:#64707d}.fc-page button,.fc-page input,.fc-page select{font:inherit}.fc-page button{border:1px solid #c7d1dc;border-radius:7px;padding:8px 12px;background:#fff;color:#164e7a;cursor:pointer}.fc-page button.primary{background:#164e7a;color:#fff}.fc-page button:disabled{opacity:.5;cursor:not-allowed}.fc-boundary{margin-top:18px;padding:12px 14px;border-left:4px solid #bf7a13;background:#fff8e8}.fc-error,.fc-validation{margin-top:12px;padding:12px;background:#fff0f0;color:#9b2525;border-radius:8px}.fc-panel,.fc-export-view{margin-top:14px;padding:18px;background:#fff;border:1px solid #dce3ea;border-radius:10px}.fc-export-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.fc-export-top h2{margin:0 0 4px;font-size:18px}.fc-export-top p,.fc-active-summary{margin:0;color:#64707d;font-size:12px;line-height:1.45}.fc-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.fc-checks{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:#556170}.fc-checks strong{color:#17212b}.fc-checks label{display:inline-flex;align-items:center;gap:5px}.fc-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.fc-form label,.fc-line label,.fc-filter-grid label{display:grid;gap:4px;font-size:12px;color:#556170}.fc-form input,.fc-form select,.fc-line input,.fc-line select,.fc-filter-grid input,.fc-filter-grid select{min-width:0;padding:8px;border:1px solid #cbd4de;border-radius:6px;background:#fff}.fc-wide{grid-column:1/-1}.fc-line{display:grid;grid-template-columns:1.2fr .8fr 1.4fr .7fr .8fr auto;gap:8px;padding:10px 0;border-top:1px solid #edf0f3;align-items:end}.fc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.fc-export-panel{flex-basis:100%;display:grid;gap:10px;max-width:560px;margin-top:4px;padding:12px;border:1px solid #ccdff1;border-radius:10px;background:#f8fbff}.fc-export-panel strong{display:block;color:#123f68;font-size:13px}.fc-export-panel p{margin:4px 0 0;font-size:12px;line-height:1.45}.fc-export-actions{display:flex;gap:8px;flex-wrap:wrap}.fc-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}.fc-summary>div{padding:14px;background:#fff;border:1px solid #dce3ea;border-radius:9px}.fc-summary span{display:block;color:#65717e;font-size:12px}.fc-summary strong{display:block;margin-top:5px;font-size:20px;font-variant-numeric:tabular-nums}.fc-cards{display:grid;gap:12px;margin-top:14px}.fc-card{padding:17px;background:#fff;border:1px solid #dce3ea;border-radius:10px}.fc-card-head{display:flex;justify-content:space-between;gap:16px}.fc-card h2{margin:5px 0;font-size:18px}.fc-card small,.fc-card code{color:#6b7682;overflow-wrap:anywhere}.fc-status{align-self:start;padding:5px 9px;background:#eef2f6;border-radius:99px;font-size:11px;text-transform:uppercase}.fc-status.executed{background:#e7f5ec;color:#21633a}.fc-status.approved{background:#eaf2ff;color:#20578b}.fc-money{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.fc-money span{font-size:11px;color:#67727f}.fc-money b{display:block;font-size:16px;color:#17212b;margin-top:3px;font-variant-numeric:tabular-nums}.fc-empty{padding:40px;text-align:center;background:#fff;border:1px solid #dce3ea;border-radius:10px;color:#697582}@media(max-width:720px){.fc-page{padding:12px}.fc-header{display:block}.fc-header>button{margin-top:12px}.fc-export-top{display:block}.fc-export-top>button{margin-top:10px;width:100%}.fc-filter-grid,.fc-form,.fc-summary,.fc-money{grid-template-columns:1fr}.fc-wide{grid-column:auto}.fc-line{grid-template-columns:1fr;padding:14px 0}.fc-card-head{display:block}.fc-status{display:inline-block;margin-top:6px}.fc-actions button,.fc-export-actions button{flex:1 1 auto}.fc-export-panel{max-width:none}.fc-card code{display:block}.fc-page h1{font-size:23px}}`;
