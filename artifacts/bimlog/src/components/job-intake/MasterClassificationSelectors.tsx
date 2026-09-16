import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type Entry = { id: string | number; code: string; name: string };
type Props = { data: any; setData: Dispatch<SetStateAction<any>>; projectId: number; request: (path: string, init?: RequestInit) => Promise<any>; tt: (en: string, es: string) => string };

export function MasterClassificationSelectors({ data, setData, projectId, request, tt }: Props) {
  const [catalogs, setCatalogs] = useState<Record<string, Entry[]>>({ disciplines: [] });
  const [error, setError] = useState("");
  useEffect(() => { let active = true; request(`/master-catalogs/disciplines?projectId=${projectId}`).then(response => { if (active) setCatalogs({ disciplines: response.entries ?? [] }); }).catch(() => { if (active) setError(tt("Master classifications could not be loaded.", "No se pudieron cargar las clasificaciones maestras.")); }); return () => { active = false; }; }, [projectId, request, tt]);
  const selected = data.classification ?? {};
  const choose = (kind: "discipline", id: string) => {
    const entry = catalogs[`${kind}s`]?.find(item => String(item.id) === id);
    setData((old: any) => ({ ...old, classification: { ...(old.classification ?? {}), [`${kind}Id`]: entry?.id ?? null, [`${kind}Code`]: entry?.code ?? "", [`${kind}Name`]: entry?.name ?? "" } }));
  };
  return <fieldset className="ji-master-classifications"><legend>{tt("Project discipline", "Disciplina del proyecto")}</legend><div className="ji-grid three"><label>{tt("Discipline", "Disciplina")}<select value={selected.disciplineId ?? ""} onChange={event => choose("discipline", event.target.value)}><option value="">{tt("Select discipline", "Seleccione disciplina")}</option>{catalogs.disciplines.map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}</option>)}</select></label></div>{error && <p className="ji-error" role="alert">{error}</p>}</fieldset>;
}
