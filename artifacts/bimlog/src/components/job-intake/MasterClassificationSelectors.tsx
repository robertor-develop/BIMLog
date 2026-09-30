import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type Entry = { id: string | number; code: string; name: string; aliases?: string[] };
type Props = { data: any; setData: Dispatch<SetStateAction<any>>; projectId: number; request: (path: string, init?: RequestInit) => Promise<any>; tt: (en: string, es: string) => string };

export function MasterClassificationSelectors({ data, setData, projectId, request, tt }: Props) {
  const [disciplines, setDisciplines] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [governed, setGoverned] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loadedProject, setLoadedProject] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    setState("loading"); setDisciplines([]); setError(""); setShowAll(false); setQuery("");
    request(`/master-catalogs/disciplines?projectId=${projectId}`).then(result => {
      if (!Array.isArray(result.entries)) throw new Error("Invalid discipline catalog");
      if (active) { setDisciplines(result.entries); setGoverned(result.governed === true); setLoadedProject(projectId); setState("ready"); }
    }).catch(() => { if (active) { setError("catalog_unavailable"); setState("error"); } });
    return () => { active = false; };
  }, [projectId, request, retry]);
  const selected = data.classification ?? {};
  const needle = query.trim().toLocaleLowerCase();
  const matching = needle ? disciplines.filter(entry => [entry.code, entry.name, ...(entry.aliases ?? [])].some(value => value.toLocaleLowerCase().includes(needle))) : disciplines;
  const preferredIds = new Set<string>([String(selected.disciplineId ?? ""), ...disciplines.slice(0, 8).map(entry => String(entry.id))].filter(Boolean));
  const visibleDisciplines = showAll || needle ? matching : matching.filter(entry => preferredIds.has(String(entry.id)));
  const choose = (id: string) => {
    if (state !== "ready" || loadedProject !== projectId) return;
    const entry = disciplines.find(item => String(item.id) === id);
    setData((old: any) => ({ ...old, classification: { ...(old.classification ?? {}), disciplineId: entry?.id ?? null, disciplineCode: entry?.code ?? "", disciplineName: entry?.name ?? "" } }));
  };
  return <fieldset className="ji-master-classifications"><legend>{tt("Project discipline", "Disciplina del proyecto")}</legend><p>{tt("Choose a default discipline for this project. Services and phases belong to work packages and tasks in Advanced setup.", "Seleccione una disciplina predeterminada para este proyecto. Los servicios y las fases corresponden a paquetes y tareas en Configuración avanzada.")}</p><div className="ji-grid three"><label>{tt("Discipline", "Disciplina")}<select disabled={state !== "ready" || loadedProject !== projectId} value={selected.disciplineId ?? ""} onChange={event => choose(event.target.value)}><option value="">{tt("Select discipline", "Seleccione disciplina")}</option>{selected.disciplineId && !disciplines.some(entry => String(entry.id) === String(selected.disciplineId)) && <option value={selected.disciplineId}>{selected.disciplineName || selected.disciplineCode || selected.disciplineId} - {tt("Saved selection; not currently available", "Selección guardada; no disponible actualmente")}</option>}{visibleDisciplines.map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}{entry.aliases?.length ? ` (${entry.aliases.join(", ")})` : ""}</option>)}</select></label>{state === "ready" && disciplines.length > 8 && <div><label>{tt("Search disciplines", "Buscar disciplinas")}<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" aria-expanded={showAll} onClick={() => { setShowAll(value => !value); if (showAll) setQuery(""); }}>{showAll ? tt("Show preferred", "Mostrar preferidas") : tt("Show all disciplines", "Mostrar todas las disciplinas")}</button></div>}</div>{state === "loading" && <p role="status">{tt("Loading project disciplines...", "Cargando disciplinas del proyecto...")}</p>}{state === "ready" && <p>{governed ? tt("This project uses its company's approved discipline catalog.", "Este proyecto usa el catálogo de disciplinas aprobado de su empresa.") : tt("Company disciplines and active BIMLog defaults are available.", "Están disponibles las disciplinas de la empresa y las predeterminadas activas de BIMLog.")}</p>}{error && <p className="ji-error" role="alert">{tt("Project disciplines could not be loaded.", "No se pudieron cargar las disciplinas del proyecto.")} <button type="button" onClick={() => setRetry(value => value + 1)}>{tt("Retry", "Reintentar")}</button></p>}{state === "ready" && !error && disciplines.length === 0 && <p className="ji-error" role="status">{tt("No active disciplines are available for this company. A company PMO administrator must add one in Company Catalogs before this job can be activated.", "No hay disciplinas activas disponibles para esta empresa. Un administrador PMO de la empresa debe agregar una en Catálogos de Empresa antes de activar este trabajo.")}</p>}</fieldset>;
}
