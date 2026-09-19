import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type Entry = { id: string | number; code: string; name: string; aliases?: string[] };
type Props = { data: any; setData: Dispatch<SetStateAction<any>>; projectId: number; request: (path: string, init?: RequestInit) => Promise<any>; tt: (en: string, es: string) => string };

export function MasterClassificationSelectors({ data, setData, projectId, request, tt }: Props) {
  const [catalogs, setCatalogs] = useState<Record<string, Entry[]>>({ disciplines: [], services: [], phases: [] });
  const [error, setError] = useState("");
  useEffect(() => { let active = true; Promise.all(["disciplines", "services", "phases"].map(async kind => [kind, (await request(`/master-catalogs/${kind}?projectId=${projectId}`)).entries ?? []] as const)).then(rows => { if (active) { setCatalogs(Object.fromEntries(rows)); setError(""); } }).catch(() => { if (active) setError(tt("Master classifications could not be loaded.", "No se pudieron cargar las clasificaciones maestras.")); }); return () => { active = false; }; }, [projectId, request, tt]);
  const selected = data.classification ?? {};
  const choose = (kind: "discipline" | "service" | "phase", id: string) => {
    const entry = catalogs[`${kind}s`]?.find(item => String(item.id) === id);
    setData((old: any) => ({ ...old, classification: { ...(old.classification ?? {}), [`${kind}Id`]: entry?.id ?? null, [`${kind}Code`]: entry?.code ?? "", [`${kind}Name`]: entry?.name ?? "" } }));
  };
  const options = (kind: "discipline" | "service" | "phase") => catalogs[`${kind}s`].map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}{entry.aliases?.length ? ` (${entry.aliases.join(", ")})` : ""}</option>);
  return <fieldset className="ji-master-classifications"><legend>{tt("Project classifications", "Clasificaciones del proyecto")}</legend><div className="ji-grid three"><label>{tt("Discipline", "Disciplina")}<select value={selected.disciplineId ?? ""} onChange={event => choose("discipline", event.target.value)}><option value="">{tt("Select discipline", "Seleccione disciplina")}</option>{options("discipline")}</select></label><label>{tt("Service", "Servicio")}<select value={selected.serviceId ?? ""} onChange={event => choose("service", event.target.value)}><option value="">{tt("Select service", "Seleccione servicio")}</option>{options("service")}</select></label><label>{tt("Phase", "Fase")}<select value={selected.phaseId ?? ""} onChange={event => choose("phase", event.target.value)}><option value="">{tt("Select phase", "Seleccione fase")}</option>{options("phase")}</select></label></div>{error && <p className="ji-error" role="alert">{error}</p>}</fieldset>;
}
