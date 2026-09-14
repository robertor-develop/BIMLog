import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type Entry = { id: string | number; code: string; name: string };
type Props = { data: any; setData: Dispatch<SetStateAction<any>>; request: (path: string, init?: RequestInit) => Promise<any>; tt: (en: string, es: string) => string };

export function MasterClassificationSelectors({ data, setData, request, tt }: Props) {
  const [catalogs, setCatalogs] = useState<Record<string, Entry[]>>({ disciplines: [], services: [], phases: [] });
  const [error, setError] = useState("");
  useEffect(() => { let active = true; Promise.all(["disciplines", "services", "phases"].map(async kind => [kind, (await request(`/master-catalogs/${kind}`)).entries ?? []] as const)).then(rows => { if (active) setCatalogs(Object.fromEntries(rows)); }).catch(() => { if (active) setError(tt("Master classifications could not be loaded.", "No se pudieron cargar las clasificaciones maestras.")); }); return () => { active = false; }; }, [request, tt]);
  const selected = data.classification ?? {};
  const choose = (kind: "discipline" | "service" | "phase", id: string) => {
    const entry = catalogs[`${kind}s`]?.find(item => String(item.id) === id);
    setData((old: any) => ({ ...old, classification: { ...(old.classification ?? {}), [`${kind}Id`]: entry?.id ?? null, [`${kind}Code`]: entry?.code ?? "", [`${kind}Name`]: entry?.name ?? "" } }));
  };
  return <fieldset className="ji-master-classifications"><legend>{tt("Standard project classifications", "Clasificaciones estándar del proyecto")}</legend><div className="ji-grid three">{(["discipline", "service", "phase"] as const).map(kind => <label key={kind}>{tt(kind[0]!.toUpperCase()+kind.slice(1), ({discipline:"Disciplina",service:"Servicio",phase:"Fase"} as const)[kind])}<select value={selected[`${kind}Id`] ?? ""} onChange={event => choose(kind, event.target.value)}><option value="">{tt(`Select ${kind}`, `Seleccione ${({discipline:"disciplina",service:"servicio",phase:"fase"} as const)[kind]}`)}</option>{catalogs[`${kind}s`].map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}</option>)}</select></label>)}</div>{error && <p className="ji-error" role="alert">{error}</p>}</fieldset>;
}
