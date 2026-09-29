import { useEffect, useState } from "react";

export function eligibleBudgetFiles(files: any[]) {
  return files.filter(file => Number.isSafeInteger(Number(file.id)) && Number(file.id) > 0 && /\.(csv|xlsx)$/i.test(file.fileName || ""));
}

/** Uses the existing authorized project-file register; the import API rechecks identity and bytes. */
export function BudgetSourcePicker({ projectId, token, value, onChange, tt }: {
  projectId: number; token: string; value: string; onChange: (id: string) => void; tt: (en: string, es: string) => string;
}) {
  const [files, setFiles] = useState<any[]>([]);
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading"); setFiles([]);
    fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1/projects/${projectId}/files`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error("unavailable"); const body = await response.json(); if (!Array.isArray(body)) throw new Error("invalid"); return eligibleBudgetFiles(body); })
      .then(rows => { if (!controller.signal.aborted) { setFiles(rows); setState("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [projectId, token, attempt]);
  return <div>
    <label>{tt("Project evidence file and version", "Archivo de evidencia y versión del proyecto")}
      <select value={value} disabled={state !== "ready"} onChange={event => onChange(event.target.value)}>
        <option value="">{state === "loading" ? tt("Loading project files…", "Cargando archivos del proyecto…") : tt("Select a CSV or XLSX version", "Seleccione una versión CSV o XLSX")}</option>
        {value && !files.some(file => String(file.id) === value) && <option value={value}>{tt("Previously selected file unavailable", "Archivo seleccionado no disponible")}</option>}
        {files.map(file => <option key={file.id} value={file.id}>{file.fileName} · v{file.version ?? 1} · {file.createdAt ? String(file.createdAt).slice(0, 10) : ""}</option>)}
      </select>
    </label>
    {state === "error" && <div role="alert">{tt("Project files could not be loaded. Check your access or retry.", "No se pudieron cargar los archivos. Revise su acceso o reintente.")} <button type="button" onClick={() => setAttempt(value => value + 1)}>{tt("Retry files", "Reintentar archivos")}</button></div>}
    {state === "ready" && !files.length && <p>{tt("No CSV/XLSX evidence is registered. Add the source to Project Files, then refresh this list.", "No hay evidencia CSV/XLSX registrada. Agregue el archivo en Archivos del Proyecto y actualice esta lista.")}</p>}
    <button type="button" disabled={state === "loading"} onClick={() => setAttempt(value => value + 1)}>{tt("Refresh file list", "Actualizar lista de archivos")}</button>
    <small>{tt("Choose the registered version matching the evidence file above. Preview verifies the source before creating any budget.", "Elija la versión registrada que corresponde al archivo anterior. La vista previa verifica el origen antes de crear un presupuesto.")}</small>
  </div>;
}
