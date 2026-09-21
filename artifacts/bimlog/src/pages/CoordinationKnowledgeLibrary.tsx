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

const emptyConflictFilters: ConflictFilters = { search: "", discipline: "", element: "", category: "", status: "", tag: "" };
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
        </div> : <div className="knowledge-placeholder" role="status">
          <selected.icon aria-hidden />
          <strong>{t("Workspace ready", "Espacio listo")}</strong>
          <span>{t("Catalog content becomes available in the following builds of this block.", "El contenido del catálogo se habilita en los siguientes builds de este bloque.")}</span>
        </div>}
      </section>
    </main>
  </div>;
}
