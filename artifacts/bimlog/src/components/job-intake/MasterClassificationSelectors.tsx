import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type Entry = { id: string | number; code: string; name: string; aliases?: string[] };
type Props = { data: any; setData: Dispatch<SetStateAction<any>>; projectId: number; request: (path: string, init?: RequestInit) => Promise<any>; tt: (en: string, es: string) => string };

export function MasterClassificationSelectors({ data, setData, projectId, request, tt }: Props) {
  const [disciplines, setDisciplines] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; request(`/master-catalogs/disciplines?projectId=${projectId}`).then(result => { if (active) { setDisciplines(result.entries ?? []); setError(""); } }).catch(() => { if (active) setError(tt("Project disciplines could not be loaded.", "No se pudieron cargar las disciplinas del proyecto.")); }); return () => { active = false; }; }, [projectId, request, tt]);
  const selected = data.classification ?? {};
  const choose = (id: string) => {
    const entry = disciplines.find(item => String(item.id) === id);
    setData((old: any) => ({ ...old, classification: { ...(old.classification ?? {}), disciplineId: entry?.id ?? null, disciplineCode: entry?.code ?? "", disciplineName: entry?.name ?? "" } }));
  };
  return <fieldset className="ji-master-classifications"><legend>{tt("Project discipline", "Disciplina del proyecto")}</legend><p>{tt("Choose a default discipline for this project. Services and phases belong to work packages and tasks in Advanced setup.", "Seleccione una disciplina predeterminada para este proyecto. Los servicios y las fases corresponden a paquetes y tareas en Configuración avanzada.")}</p><div className="ji-grid three"><label>{tt("Discipline", "Disciplina")}<select value={selected.disciplineId ?? ""} onChange={event => choose(event.target.value)}><option value="">{tt("Select discipline", "Seleccione disciplina")}</option>{disciplines.map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}{entry.aliases?.length ? ` (${entry.aliases.join(", ")})` : ""}</option>)}</select></label></div>{error && <p className="ji-error" role="alert">{error}</p>}</fieldset>;
}
