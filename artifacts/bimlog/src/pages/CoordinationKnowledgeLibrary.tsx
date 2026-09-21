import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, GitPullRequest, Lightbulb, Route, Search, ShieldCheck } from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import "./CoordinationKnowledgeLibrary.css";

type WorkspaceSection = "conflict-types" | "rules" | "methods" | "lessons";
type KnowledgeStatus = "draft" | "under_review" | "approved" | "retired";
type ConflictTypeRecord = {
  id: string; code: string; revision: number; status: KnowledgeStatus; name: string; description: string;
  discipline_a: string; discipline_b: string; element_type_a: string; element_type_b: string;
  conflict_category: string; coordination_stage: string; tags: string[];
};
type CapabilityResponse = { capabilities: string[]; companyId: number; isCompanyPmo: boolean; isSuperAdmin: boolean };
type ConflictFilters = { search: string; discipline: string; element: string; category: string; status: string; tag: string };
type RuleRecord = { id: string; rule_id: string; code: string; revision: number; status: KnowledgeStatus; title: string; guidance: string; applicability: Record<string, unknown>; rationale: string; exceptions: unknown[]; references: unknown[]; approved_by_id?: number | null; approved_at?: string | null };
type RuleFilters = { search: string; applicability: string; status: string };
type ResolutionMethodRecord = { id: string; resolution_method_id: string; code: string; revision: number; status: KnowledgeStatus; name: string; description: string; applicability: Record<string, unknown>; responsible_trade?: string | null; constraints: unknown[]; advantages: unknown[]; disadvantages: unknown[]; required_approvals: unknown[]; rfi_requirement: "yes" | "no" | "conditional"; details: Record<string, unknown>; conflict_type_ids: string[]; rule_revision_ids: string[] };
type MethodFilters = { search: string; conflictType: string; trade: string; discipline: string; rfi: string; approval: string; status: string };

const emptyConflictFilters: ConflictFilters = { search: "", discipline: "", element: "", category: "", status: "", tag: "" };
const emptyRuleFilters: RuleFilters = { search: "", applicability: "", status: "" };
const emptyMethodFilters: MethodFilters = { search: "", conflictType: "", trade: "", discipline: "", rfi: "", approval: "", status: "" };
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const values = (items: string[]) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const normalized = (value: unknown) => String(value ?? "").toLocaleLowerCase();

const sections: Array<{ id: WorkspaceSection; en: string; es: string; icon: typeof BookOpen }> = [
  { id: "conflict-types", en: "Conflict Types", es: "Tipos de Conflicto", icon: GitPullRequest },
  { id: "rules", en: "Coordination Rules", es: "Reglas de Coordinación", icon: ShieldCheck },
  { id: "methods", en: "Resolution Methods", es: "Métodos de Resolución", icon: Route },
  { id: "lessons", en: "Lessons Learned", es: "Lecciones Aprendidas", icon: Lightbulb },
];

export function CoordinationKnowledgeLibrary() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const es = lang === "es";
  const t = (en: string, spanish: string) => es ? spanish : en;
  const [active, setActive] = useState<WorkspaceSection>("conflict-types");
  const [capability, setCapability] = useState<CapabilityResponse | null>(null);
  const [conflictTypes, setConflictTypes] = useState<ConflictTypeRecord[]>([]);
  const [conflictFilters, setConflictFilters] = useState<ConflictFilters>(emptyConflictFilters);
  const [conflictState, setConflictState] = useState<"loading" | "ready" | "error">("loading");
  const [conflictError, setConflictError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [ruleFilters, setRuleFilters] = useState<RuleFilters>(emptyRuleFilters);
  const [ruleState, setRuleState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [ruleError, setRuleError] = useState("");
  const [ruleReloadKey, setRuleReloadKey] = useState(0);
  const [ruleHistory, setRuleHistory] = useState<Record<string, RuleRecord[] | "loading" | "error">>({});
  const [methods, setMethods] = useState<ResolutionMethodRecord[]>([]);
  const [methodFilters, setMethodFilters] = useState<MethodFilters>(emptyMethodFilters);
  const [methodState, setMethodState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [methodError, setMethodError] = useState("");
  const [methodReloadKey, setMethodReloadKey] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setConflictState("loading"); setConflictError("");
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/api/v1/coordination-knowledge/capabilities`, { headers, signal: controller.signal }),
      fetch(`${API_BASE}/api/v1/coordination-knowledge/conflict-types`, { headers, signal: controller.signal }),
    ]).then(async ([capabilitiesResponse, conflictsResponse]) => {
      const capabilityPayload = await capabilitiesResponse.json().catch(() => ({}));
      const conflictsPayload = await conflictsResponse.json().catch(() => ({}));
      if (!capabilitiesResponse.ok) throw new Error(capabilityPayload.code || `KNOWLEDGE_CAPABILITIES_${capabilitiesResponse.status}`);
      if (!conflictsResponse.ok) throw new Error(conflictsPayload.code || `KNOWLEDGE_CONFLICT_TYPES_${conflictsResponse.status}`);
      setCapability(capabilityPayload as CapabilityResponse);
      setConflictTypes(Array.isArray(conflictsPayload.items) ? conflictsPayload.items as ConflictTypeRecord[] : []);
      setConflictState("ready");
    }).catch(error => {
      if (controller.signal.aborted) return;
      setConflictTypes([]); setCapability(null); setConflictState("error"); setConflictError(String(error instanceof Error ? error.message : error));
    });
    return () => controller.abort();
  }, [token, reloadKey]);

  useEffect(() => {
    if (!token || active !== "rules") return;
    const controller = new AbortController(); setRuleState("loading"); setRuleError("");
    fetch(`${API_BASE}/api/v1/coordination-knowledge/rules`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.code || `KNOWLEDGE_RULES_${response.status}`); return payload; })
      .then(payload => { setRules(Array.isArray(payload.items) ? payload.items : []); setRuleState("ready"); })
      .catch(error => { if (!controller.signal.aborted) { setRules([]); setRuleState("error"); setRuleError(String(error instanceof Error ? error.message : error)); } });
    return () => controller.abort();
  }, [token, active, ruleReloadKey]);

  const filteredRules = useMemo(() => rules.filter(item => {
    const query = normalized(ruleFilters.search).trim(), applicability = normalized(ruleFilters.applicability).trim();
    const referenceText = JSON.stringify(item.references ?? []), applicationText = JSON.stringify(item.applicability ?? {});
    return (!query || normalized([item.code, item.title, item.guidance, item.rationale, referenceText].join(" ")).includes(query))
      && (!applicability || normalized(applicationText).includes(applicability))
      && (!ruleFilters.status || item.status === ruleFilters.status);
  }), [rules, ruleFilters]);

  const loadRuleHistory = async (item: RuleRecord) => {
    const stableId = item.rule_id;
    if (!token || !stableId) return;
    setRuleHistory(current => ({ ...current, [stableId]: "loading" }));
    try {
      const response = await fetch(`${API_BASE}/api/v1/coordination-knowledge/rules/${encodeURIComponent(stableId)}/history`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.code || `KNOWLEDGE_RULE_HISTORY_${response.status}`);
      setRuleHistory(current => ({ ...current, [stableId]: Array.isArray(payload.items) ? payload.items : [] }));
    } catch { setRuleHistory(current => ({ ...current, [stableId]: "error" })); }
  };

  useEffect(() => {
    if (!token || active !== "methods") return;
    const controller = new AbortController(); setMethodState("loading"); setMethodError("");
    fetch(`${API_BASE}/api/v1/coordination-knowledge/resolution-methods`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.code || `KNOWLEDGE_METHODS_${response.status}`); return payload; })
      .then(payload => { setMethods(Array.isArray(payload.items) ? payload.items : []); setMethodState("ready"); })
      .catch(error => { if (!controller.signal.aborted) { setMethods([]); setMethodState("error"); setMethodError(String(error instanceof Error ? error.message : error)); } });
    return () => controller.abort();
  }, [token, active, methodReloadKey]);

  const methodOptions = useMemo(() => ({
    trades: values(methods.map(item => item.responsible_trade ?? "")),
    disciplines: values(methods.flatMap(item => {
      const candidate = item.applicability?.disciplines;
      return Array.isArray(candidate) ? candidate.map(String) : candidate ? [String(candidate)] : [];
    })),
  }), [methods]);
  const filteredMethods = useMemo(() => methods.filter(item => {
    const query = normalized(methodFilters.search).trim(), applicationText = normalized(JSON.stringify(item.applicability ?? {}));
    const previousCases = item.details?.previousCases ?? item.details?.previousCaseIds ?? [];
    const approvalRequired = Array.isArray(item.required_approvals) && item.required_approvals.length > 0;
    return (!query || normalized([item.code, item.name, item.description, item.responsible_trade, JSON.stringify(item.constraints), JSON.stringify(previousCases)].join(" ")).includes(query))
      && (!methodFilters.conflictType || item.conflict_type_ids?.includes(methodFilters.conflictType))
      && (!methodFilters.trade || item.responsible_trade === methodFilters.trade)
      && (!methodFilters.discipline || applicationText.includes(normalized(methodFilters.discipline)))
      && (!methodFilters.rfi || item.rfi_requirement === methodFilters.rfi)
      && (!methodFilters.approval || (methodFilters.approval === "required") === approvalRequired)
      && (!methodFilters.status || item.status === methodFilters.status);
  }), [methods, methodFilters]);

  const conflictOptions = useMemo(() => ({
    disciplines: values(conflictTypes.flatMap(item => [item.discipline_a, item.discipline_b])),
    elements: values(conflictTypes.flatMap(item => [item.element_type_a, item.element_type_b])),
    categories: values(conflictTypes.map(item => item.conflict_category)),
    tags: values(conflictTypes.flatMap(item => Array.isArray(item.tags) ? item.tags : [])),
  }), [conflictTypes]);
  const filteredConflictTypes = useMemo(() => conflictTypes.filter(item => {
    const query = normalized(conflictFilters.search).trim();
    const searchable = [item.code, item.name, item.description, item.discipline_a, item.discipline_b, item.element_type_a, item.element_type_b, ...(item.tags ?? [])].map(normalized).join(" ");
    return (!query || searchable.includes(query))
      && (!conflictFilters.discipline || [item.discipline_a, item.discipline_b].includes(conflictFilters.discipline))
      && (!conflictFilters.element || [item.element_type_a, item.element_type_b].includes(conflictFilters.element))
      && (!conflictFilters.category || item.conflict_category === conflictFilters.category)
      && (!conflictFilters.status || item.status === conflictFilters.status)
      && (!conflictFilters.tag || item.tags?.includes(conflictFilters.tag));
  }), [conflictTypes, conflictFilters]);

  const changeTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    setActive(sections[next].id);
    tabRefs.current[next]?.focus();
  };

  const selected = sections.find(section => section.id === active)!;
  const statusText = (status: KnowledgeStatus) => status === "under_review" ? t("Under review", "En revisión")
    : status === "approved" ? t("Approved", "Aprobado") : status === "retired" ? t("Retired", "Retirado") : t("Draft", "Borrador");
  const filterSelect = (label: string, key: keyof ConflictFilters, options: string[]) => <label>{label}<select value={conflictFilters[key]} onChange={event => setConflictFilters(current => ({ ...current, [key]: event.target.value }))}>
    <option value="">{t("All", "Todos")}</option>{options.map(option => <option value={option} key={option}>{option}</option>)}
  </select></label>;
  return <div className="knowledge-page">
    <MasterSidebar />
    <main className="knowledge-main">
      <header className="knowledge-header">
        <div>
          <p className="knowledge-eyebrow">BIMLog · {t("Company knowledge", "Conocimiento de la empresa")}</p>
          <h1>{t("Coordination Knowledge Library", "Biblioteca de Conocimiento de Coordinación")}</h1>
          <p>{t("Reusable company guidance, governed resolution methods and reviewed project experience.", "Guía reutilizable de la empresa, métodos de resolución gobernados y experiencia de proyectos revisada.")}</p>
        </div>
        <span className="knowledge-scope"><BookOpen aria-hidden />{t("Organization workspace", "Espacio de la organización")}</span>
      </header>

      <nav className="knowledge-tabs" role="tablist" aria-label={t("Knowledge library sections", "Secciones de la biblioteca de conocimiento")}>
        {sections.map((section, index) => {
          const Icon = section.icon;
          const selectedTab = active === section.id;
          return <button
            ref={node => { tabRefs.current[index] = node; }}
            key={section.id}
            id={`knowledge-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={selectedTab}
            aria-controls={`knowledge-panel-${section.id}`}
            tabIndex={selectedTab ? 0 : -1}
            onClick={() => setActive(section.id)}
            onKeyDown={event => changeTab(event, index)}
          ><Icon aria-hidden /><span>{es ? section.es : section.en}</span></button>;
        })}
      </nav>

      <section
        id={`knowledge-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`knowledge-tab-${active}`}
        className="knowledge-panel"
      >
        <div className="knowledge-panel-heading">
          <div><h2>{es ? selected.es : selected.en}</h2><p>{t("This governed catalog is being loaded from BIMLog's company-scoped knowledge authority.", "Este catálogo gobernado se carga desde la autoridad de conocimiento de empresa de BIMLog.")}</p></div>
        </div>
        {active === "conflict-types" ? <div className="knowledge-catalog" aria-busy={conflictState === "loading"}>
          {capability && <p className="knowledge-access-note"><ShieldCheck aria-hidden />{capability.capabilities.includes("view_draft") ? t("Authorized company view: approved and in-progress revisions", "Vista autorizada de empresa: revisiones aprobadas y en progreso") : t("Approved company knowledge only", "Solo conocimiento aprobado de la empresa")}</p>}
          <div className="knowledge-filters" role="search" aria-label={t("Filter Conflict Types", "Filtrar Tipos de Conflicto")}>
            <label className="knowledge-search"><span>{t("Search", "Buscar")}</span><span className="knowledge-input-icon"><Search aria-hidden /><input value={conflictFilters.search} onChange={event => setConflictFilters(current => ({ ...current, search: event.target.value }))} placeholder={t("Code, title, description…", "Código, título, descripción…")} /></span></label>
            {filterSelect(t("Discipline", "Disciplina"), "discipline", conflictOptions.disciplines)}
            {filterSelect(t("Element", "Elemento"), "element", conflictOptions.elements)}
            {filterSelect(t("Category", "Categoría"), "category", conflictOptions.categories)}
            {filterSelect(t("Status", "Estado"), "status", ["draft", "under_review", "approved", "retired"])}
            {filterSelect(t("Tag", "Etiqueta"), "tag", conflictOptions.tags)}
            <button type="button" onClick={() => setConflictFilters(emptyConflictFilters)}>{t("Reset filters", "Restablecer filtros")}</button>
          </div>
          {conflictState === "loading" && <div className="knowledge-placeholder" role="status"><span className="knowledge-spinner" aria-hidden /><strong>{t("Loading Conflict Types…", "Cargando Tipos de Conflicto…")}</strong></div>}
          {conflictState === "error" && <div className="knowledge-error" role="alert"><strong>{t("Conflict Types could not be loaded.", "No se pudieron cargar los Tipos de Conflicto.")}</strong><span>{conflictError}</span><button type="button" onClick={() => setReloadKey(value => value + 1)}>{t("Try again", "Reintentar")}</button></div>}
          {conflictState === "ready" && !filteredConflictTypes.length && <div className="knowledge-placeholder" role="status"><GitPullRequest aria-hidden /><strong>{conflictTypes.length ? t("No Conflict Types match these filters", "Ningún Tipo de Conflicto coincide con estos filtros") : t("No Conflict Types yet", "Aún no hay Tipos de Conflicto")}</strong><span>{conflictTypes.length ? t("Change or reset the filters to continue.", "Cambie o restablezca los filtros para continuar.") : t("An authorized BIM Manager can create the first governed draft in the authoring milestone.", "Un BIM Manager autorizado podrá crear el primer borrador gobernado en el hito de autoría.")}</span></div>}
          {conflictState === "ready" && filteredConflictTypes.length > 0 && <><p className="knowledge-result-count" role="status">{filteredConflictTypes.length} {t("Conflict Types", "Tipos de Conflicto")}</p><div className="knowledge-card-grid">
            {filteredConflictTypes.map(item => <article className="knowledge-card" key={item.id}>
              <div className="knowledge-card-top"><span className="knowledge-code">{item.code}</span><span className={`knowledge-status knowledge-status-${item.status}`}><span aria-hidden>●</span>{statusText(item.status)}</span></div>
              <h3>{item.name}</h3><p>{item.description}</p>
              <dl><div><dt>{t("Disciplines", "Disciplinas")}</dt><dd>{item.discipline_a} · {item.discipline_b}</dd></div><div><dt>{t("Elements", "Elementos")}</dt><dd>{item.element_type_a} · {item.element_type_b}</dd></div><div><dt>{t("Category", "Categoría")}</dt><dd>{item.conflict_category}</dd></div><div><dt>{t("Stage", "Etapa")}</dt><dd>{item.coordination_stage}</dd></div></dl>
              <div className="knowledge-card-footer"><span>v{item.revision}</span><div>{item.tags?.map(tag => <span className="knowledge-tag" key={tag}>{tag}</span>)}</div></div>
            </article>)}
          </div></>}
        </div> : active === "rules" ? <div className="knowledge-catalog" aria-busy={ruleState === "loading"}>
          {capability && <p className="knowledge-access-note"><ShieldCheck aria-hidden />{capability.capabilities.includes("view_draft") ? t("Draft visibility is enabled by your governed company capability.", "La visibilidad de borradores está habilitada por su capacidad gobernada de empresa.") : t("Only approved guidance is visible in this role.", "Solo la guía aprobada es visible para este rol.")}</p>}
          <div className="knowledge-filters knowledge-rule-filters" role="search" aria-label={t("Filter Coordination Rules", "Filtrar Reglas de Coordinación")}>
            <label className="knowledge-search"><span>{t("Search rules", "Buscar reglas")}</span><span className="knowledge-input-icon"><Search aria-hidden /><input value={ruleFilters.search} onChange={event => setRuleFilters(current => ({ ...current, search: event.target.value }))} placeholder={t("Code, guidance, rationale or reference…", "Código, guía, justificación o referencia…")} /></span></label>
            <label>{t("Applicability", "Aplicabilidad")}<input value={ruleFilters.applicability} onChange={event => setRuleFilters(current => ({ ...current, applicability: event.target.value }))} placeholder={t("Discipline, element or Conflict Type", "Disciplina, elemento o Tipo de Conflicto")} /></label>
            <label>{t("Status", "Estado")}<select value={ruleFilters.status} onChange={event => setRuleFilters(current => ({ ...current, status: event.target.value }))}><option value="">{t("All", "Todos")}</option>{["draft", "under_review", "approved", "retired"].map(option => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></label>
            <button type="button" onClick={() => setRuleFilters(emptyRuleFilters)}>{t("Reset filters", "Restablecer filtros")}</button>
          </div>
          {ruleState === "loading" && <div className="knowledge-placeholder" role="status"><span className="knowledge-spinner" aria-hidden /><strong>{t("Loading Coordination Rules…", "Cargando Reglas de Coordinación…")}</strong></div>}
          {ruleState === "error" && <div className="knowledge-error" role="alert"><strong>{t("Coordination Rules could not be loaded.", "No se pudieron cargar las Reglas de Coordinación.")}</strong><span>{ruleError}</span><button type="button" onClick={() => setRuleReloadKey(value => value + 1)}>{t("Try again", "Reintentar")}</button></div>}
          {ruleState === "ready" && !filteredRules.length && <div className="knowledge-placeholder" role="status"><ShieldCheck aria-hidden /><strong>{rules.length ? t("No rules match these filters", "Ninguna regla coincide con estos filtros") : t("No Coordination Rules yet", "Aún no hay Reglas de Coordinación")}</strong><span>{t("Approved guidance will appear here without changing existing issue workflows.", "La guía aprobada aparecerá aquí sin cambiar los flujos existentes de incidencias.")}</span></div>}
          {ruleState === "ready" && filteredRules.length > 0 && <><p className="knowledge-result-count" role="status">{filteredRules.length} {t("Coordination Rules", "Reglas de Coordinación")}</p><div className="knowledge-card-grid">
            {filteredRules.map(item => { const history = ruleHistory[item.rule_id]; const conflicts = ((item.applicability?.conflictTypeIds ?? item.applicability?.conflict_type_ids ?? []) as unknown[]).map(String); const attachments = (item.references ?? []).filter(reference => typeof reference === "object" && reference !== null && ("fileId" in reference || "attachmentId" in reference)); return <article className="knowledge-card knowledge-rule-card" key={item.rule_id || item.id}>
              <div className="knowledge-card-top"><span className="knowledge-code">{item.code}</span><span className={`knowledge-status knowledge-status-${item.status}`}><span aria-hidden>●</span>{statusText(item.status)}</span></div>
              <h3>{item.title}</h3><p className="knowledge-guidance"><strong>{t("Guidance", "Guía")}:</strong> {item.guidance}</p>
              <dl><div><dt>{t("Revision", "Revisión")}</dt><dd>v{item.revision}</dd></div><div><dt>{t("Approved by", "Aprobado por")}</dt><dd>{item.approved_by_id ? `#${item.approved_by_id}` : t("Not approved", "No aprobado")}</dd></div><div><dt>{t("Linked Conflict Types", "Tipos de Conflicto vinculados")}</dt><dd>{conflicts.length ? conflicts.join(", ") : t("Defined by applicability", "Definidos por aplicabilidad")}</dd></div><div><dt>{t("References / attachments", "Referencias / adjuntos")}</dt><dd>{(item.references ?? []).length} / {attachments.length}</dd></div></dl>
              <details className="knowledge-structured"><summary>{t("Applicability and references", "Aplicabilidad y referencias")}</summary><pre>{JSON.stringify({ applicability: item.applicability, references: item.references }, null, 2)}</pre></details>
              <button className="knowledge-history-button" type="button" onClick={() => void loadRuleHistory(item)} disabled={history === "loading"}>{history === "loading" ? t("Loading history…", "Cargando historial…") : t("View revision history", "Ver historial de revisiones")}</button>
              {history === "error" && <p className="knowledge-inline-error" role="alert">{t("History is unavailable. Try again.", "El historial no está disponible. Intente nuevamente.")}</p>}
              {Array.isArray(history) && <ol className="knowledge-history">{history.map(version => <li key={version.id}>v{version.revision} · {statusText(version.status)}</li>)}</ol>}
            </article>; })}
          </div></>}
        </div> : active === "methods" ? <div className="knowledge-catalog" aria-busy={methodState === "loading"}>
          <p className="knowledge-precedent-note"><Route aria-hidden /><span><strong>{t("Options, not instructions.", "Opciones, no instrucciones.")}</strong> {t("Resolution Methods describe reviewed possibilities. The project team remains responsible for each decision and required approval.", "Los Métodos de Resolución describen posibilidades revisadas. El equipo del proyecto sigue siendo responsable de cada decisión y aprobación requerida.")}</span></p>
          <div className="knowledge-filters knowledge-method-filters" role="search" aria-label={t("Filter Resolution Methods", "Filtrar Métodos de Resolución")}>
            <label className="knowledge-search"><span>{t("Search methods", "Buscar métodos")}</span><span className="knowledge-input-icon"><Search aria-hidden /><input value={methodFilters.search} onChange={event => setMethodFilters(current => ({ ...current, search: event.target.value }))} placeholder={t("Code, method, constraint or case…", "Código, método, restricción o caso…")} /></span></label>
            <label>{t("Conflict Type", "Tipo de Conflicto")}<select value={methodFilters.conflictType} onChange={event => setMethodFilters(current => ({ ...current, conflictType: event.target.value }))}><option value="">{t("All", "Todos")}</option>{conflictTypes.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
            <label>{t("Responsible trade", "Empresa responsable")}<select value={methodFilters.trade} onChange={event => setMethodFilters(current => ({ ...current, trade: event.target.value }))}><option value="">{t("All", "Todos")}</option>{methodOptions.trades.map(option => <option key={option}>{option}</option>)}</select></label>
            <label>{t("Discipline", "Disciplina")}<select value={methodFilters.discipline} onChange={event => setMethodFilters(current => ({ ...current, discipline: event.target.value }))}><option value="">{t("All", "Todas")}</option>{methodOptions.disciplines.map(option => <option key={option}>{option}</option>)}</select></label>
            <label>{t("RFI", "RFI")}<select value={methodFilters.rfi} onChange={event => setMethodFilters(current => ({ ...current, rfi: event.target.value }))}><option value="">{t("All", "Todos")}</option><option value="yes">{t("Typically required", "Generalmente requerido")}</option><option value="no">{t("Typically not required", "Generalmente no requerido")}</option><option value="conditional">{t("Depends", "Depende")}</option></select></label>
            <label>{t("Approvals", "Aprobaciones")}<select value={methodFilters.approval} onChange={event => setMethodFilters(current => ({ ...current, approval: event.target.value }))}><option value="">{t("All", "Todas")}</option><option value="required">{t("Required", "Requeridas")}</option><option value="not-required">{t("Not specified", "No especificadas")}</option></select></label>
            <label>{t("Status", "Estado")}<select value={methodFilters.status} onChange={event => setMethodFilters(current => ({ ...current, status: event.target.value }))}><option value="">{t("All", "Todos")}</option>{["draft", "under_review", "approved", "retired"].map(option => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></label>
            <button type="button" onClick={() => setMethodFilters(emptyMethodFilters)}>{t("Reset filters", "Restablecer filtros")}</button>
          </div>
          {methodState === "loading" && <div className="knowledge-placeholder" role="status"><span className="knowledge-spinner" aria-hidden /><strong>{t("Loading Resolution Methods…", "Cargando Métodos de Resolución…")}</strong></div>}
          {methodState === "error" && <div className="knowledge-error" role="alert"><strong>{t("Resolution Methods could not be loaded.", "No se pudieron cargar los Métodos de Resolución.")}</strong><span>{methodError}</span><button type="button" onClick={() => setMethodReloadKey(value => value + 1)}>{t("Try again", "Reintentar")}</button></div>}
          {methodState === "ready" && !filteredMethods.length && <div className="knowledge-placeholder" role="status"><Route aria-hidden /><strong>{methods.length ? t("No methods match these filters", "Ningún método coincide con estos filtros") : t("No Resolution Methods yet", "Aún no hay Métodos de Resolución")}</strong><span>{t("Methods remain optional and require project-specific professional judgment.", "Los métodos siguen siendo opcionales y requieren criterio profesional específico del proyecto.")}</span></div>}
          {methodState === "ready" && filteredMethods.length > 0 && <><p className="knowledge-result-count" role="status">{filteredMethods.length} {t("Resolution Methods", "Métodos de Resolución")}</p><div className="knowledge-card-grid">
            {filteredMethods.map(item => { const cases = (item.details?.previousCases ?? item.details?.previousCaseIds ?? []) as unknown[]; return <article className={`knowledge-card knowledge-method-card${item.status === "retired" ? " is-retired" : ""}`} key={item.resolution_method_id || item.id}>
              <div className="knowledge-card-top"><span className="knowledge-code">{item.code}</span><span className={`knowledge-status knowledge-status-${item.status}`}><span aria-hidden>●</span>{statusText(item.status)}</span></div>
              <h3>{item.name}</h3><p>{item.description}</p>
              {item.status === "retired" && <p className="knowledge-retired-warning"><strong>{t("Historical reference only.", "Solo referencia histórica.")}</strong> {t("This method cannot be selected for a new resolution.", "Este método no puede seleccionarse para una nueva resolución.")}</p>}
              <dl><div><dt>{t("Responsible trade", "Empresa responsable")}</dt><dd>{item.responsible_trade || t("Project decision", "Decisión del proyecto")}</dd></div><div><dt>{t("RFI requirement", "Requisito de RFI")}</dt><dd>{item.rfi_requirement}</dd></div><div><dt>{t("Conflict Types", "Tipos de Conflicto")}</dt><dd>{item.conflict_type_ids?.length || 0}</dd></div><div><dt>{t("Related Rules", "Reglas relacionadas")}</dt><dd>{item.rule_revision_ids?.length || 0}</dd></div><div><dt>{t("Required approvals", "Aprobaciones requeridas")}</dt><dd>{item.required_approvals?.length || 0}</dd></div><div><dt>{t("Previous cases", "Casos anteriores")}</dt><dd>{cases.length}</dd></div></dl>
              <details className="knowledge-structured"><summary>{t("Constraints, benefits and references", "Restricciones, beneficios y referencias")}</summary><pre>{JSON.stringify({ applicability: item.applicability, constraints: item.constraints, advantages: item.advantages, disadvantages: item.disadvantages, conflictTypeIds: item.conflict_type_ids, ruleRevisionIds: item.rule_revision_ids, previousCases: cases }, null, 2)}</pre></details>
              <div className="knowledge-card-footer"><span>v{item.revision}</span><span>{t("Informational catalog", "Catálogo informativo")}</span></div>
            </article>; })}
          </div></>}
        </div> : <div className="knowledge-placeholder" role="status">
          <selected.icon aria-hidden />
          <strong>{t("Workspace ready", "Espacio listo")}</strong>
          <span>{t("Catalog content becomes available in the following builds of this block.", "El contenido del catálogo se habilita en los siguientes builds de este bloque.")}</span>
        </div>}
      </section>
    </main>
  </div>;
}
