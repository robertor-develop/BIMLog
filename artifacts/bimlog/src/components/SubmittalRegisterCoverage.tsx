import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { submittalStatusLabel } from "@/lib/submittal-status-presentation";

type Requirement = { id: number; specSection: string; description: string; requiredByDate: string | null };
type Package = { id: number; number: string; title: string; status: string; revisionNumber: number | null; parentSubmittalId: number | null };
export type RegisterCoverage = {
  requirements: Requirement[]; packages: Package[];
  links: { requirementId: number; packageId: number }[];
};

export function SubmittalRegisterCoverage({ projectId, lang, canWrite, onOpenPackage, onGoRegister }: {
  projectId: number; lang: string; canWrite: boolean;
  onOpenPackage: (id: number) => void; onGoRegister: () => void;
}) {
  const { token, user, changedAt } = useAuthStore();
  const queryClient = useQueryClient();
  const es = lang === "es";
  const text = (en: string, spanish: string) => es ? spanish : en;
  // Both project and session partition the read cache; no previous tenant's data is retained.
  const queryKey = ["submittal-register-coverage", projectId, user?.id, changedAt];
  const coverage = useQuery<RegisterCoverage>({ queryKey, queryFn: async ({ signal }) => {
    const response = await fetch(`/api/v1/projects/${projectId}/submittal-register-coverage`, {
      signal, headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("coverage_unavailable");
    return response.json();
  }, staleTime: 0 });
  const [requirementId, setRequirementId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"saved" | "error" | null>(null);
  const data = coverage.data;
  const linkedIds = new Set(data?.links.map(link => link.packageId));
  const missing = data?.requirements.filter(item => !data.links.some(link => link.requirementId === item.id)) ?? [];
  const unmatched = data?.packages.filter(item => !linkedIds.has(item.id)) ?? [];
  const visible = missingOnly ? missing : data?.requirements ?? [];
  const packageLabel = (pkg: Package) => `${pkg.number} · ${pkg.title} · R${pkg.revisionNumber ?? 0}`;
  const linkExists = data?.links.some(link => link.requirementId === Number(requirementId) && link.packageId === Number(packageId));
  const saveLink = async (reqId: number, pkgId: number, linked: boolean) => {
    if (busy || !canWrite) return;
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/submittal-register/${reqId}/packages/${pkgId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ linked }),
      });
      if (!response.ok) throw new Error("link_failed");
      await queryClient.invalidateQueries({ queryKey });
      setPackageId("");
      setNotice("saved");
    } catch {
      setNotice("error");
    } finally { setBusy(false); }
  };

  return <section aria-label={text("Required and received submittals", "Entregables requeridos y recibidos")}
    className="mb-6 rounded-lg border p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{text("Required and received submittals", "Entregables requeridos y recibidos")}</h3>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onGoRegister}>{text("Open register", "Abrir registro")}</Button>
        <Button size="sm" variant="outline" disabled={coverage.isFetching || busy} onClick={() => { setNotice(null); void coverage.refetch(); }}>{text("Refresh coverage", "Actualizar cobertura")}</Button>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">{text(
      "Link each register requirement to its actual package revisions. A link records coverage, not approval or receipt: check each package's status. Names and specification sections are not automatic matches.",
      "Vincula cada requisito del registro con las revisiones reales de sus paquetes. Un vínculo indica cobertura, no aprobación ni recepción: verifica el estado de cada paquete. Los nombres y secciones de especificación no generan coincidencias automáticas.")}</p>
    {coverage.isPending && <p role="status">{text("Loading coverage…", "Cargando cobertura…")}</p>}
    {coverage.isError && <p role="alert" className="text-destructive">{text("Coverage could not be refreshed. Do not rely on these counts; retry using Refresh coverage.", "No se pudo actualizar la cobertura. No uses estos totales; reintenta con Actualizar cobertura.")}</p>}
    {notice && <p role={notice === "error" ? "alert" : "status"} className={notice === "error" ? "text-destructive" : "text-sm"}>{notice === "error"
      ? text("The link could not be saved. Refresh and check your access before retrying.", "No se pudo guardar el vínculo. Actualiza y verifica tu acceso antes de reintentar.")
      : text("Link saved. No requirement or package was duplicated.", "Vínculo guardado. No se duplicó ningún requisito ni paquete.")}</p>}
    {data && !coverage.isError && <>
      <p className="text-sm">{text("Requirements", "Requisitos")}: {data.requirements.length} · {text("Without a linked package", "Sin paquete vinculado")}: {missing.length} · {text("Unmatched packages", "Paquetes sin vincular")}: {unmatched.length}</p>
      {canWrite && <fieldset disabled={busy || coverage.isFetching} className="flex flex-wrap items-end gap-2">
        <legend className="text-sm font-medium mb-2">{text("Link existing records", "Vincular registros existentes")}</legend>
        <label className="flex flex-col gap-1 text-sm min-w-0 max-w-full flex-1 basis-64">{text("Requirement", "Requisito")}
          <select className="border rounded p-2 w-full" value={requirementId} onChange={event => setRequirementId(event.target.value)}>
            <option value="">{text("Select a requirement", "Selecciona un requisito")}</option>
            {data.requirements.map(item => <option key={item.id} value={item.id}>#{item.id} · {item.specSection} · {item.description}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm min-w-0 max-w-full flex-1 basis-64">{text("Package revision", "Revisión del paquete")}
          <select className="border rounded p-2 w-full" value={packageId} onChange={event => setPackageId(event.target.value)}>
            <option value="">{text("Select a package", "Selecciona un paquete")}</option>
            {data.packages.map(pkg => <option key={pkg.id} value={pkg.id}>{packageLabel(pkg)} · {submittalStatusLabel(pkg.status, lang)}</option>)}
          </select>
        </label>
        <Button size="sm" disabled={!requirementId || !packageId || linkExists} onClick={() => void saveLink(Number(requirementId), Number(packageId), true)}>{text("Link package", "Vincular paquete")}</Button>
        <Button size="sm" variant="outline" onClick={() => { setRequirementId(""); setPackageId(""); setNotice(null); }}>{text("Cancel", "Cancelar")}</Button>
      </fieldset>}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={missingOnly} onChange={event => setMissingOnly(event.target.checked)} />{text("Only requirements without a package", "Solo requisitos sin paquete")}</label>
      {visible.length === 0 && <p className="text-sm">{data.requirements.length === 0
        ? text("No requirements exist. Add them in the register; existing packages remain separate.", "No hay requisitos. Agrégalos en el registro; los paquetes existentes permanecen separados.")
        : text("Every requirement has a linked package. This does not mean every package is approved.", "Cada requisito tiene un paquete vinculado. Esto no significa que todos los paquetes estén aprobados.")}</p>}
      <ul className="space-y-3">
        {visible.map(item => {
          const ids = new Set(data.links.filter(link => link.requirementId === item.id).map(link => link.packageId));
          const packages = data.packages.filter(pkg => ids.has(pkg.id));
          return <li key={item.id} className="border rounded p-3 space-y-2">
            <p className="font-medium break-words">#{item.id} · {item.specSection} · {item.description}</p>
            <p className="text-sm">{text("Required by", "Fecha requerida")}: {item.requiredByDate ?? text("Not set", "Sin definir")}</p>
            {!packages.length && <p className="text-sm">{text("No package linked", "Sin paquete vinculado")}</p>}
            {packages.map(pkg => <div key={pkg.id} className="flex flex-wrap items-center gap-2 text-sm">
              <button className="text-blue-700 underline text-left break-words" onClick={() => onOpenPackage(pkg.id)}>{packageLabel(pkg)}</button>
              <span>{submittalStatusLabel(pkg.status, lang)}</span>
              {canWrite && <Button size="sm" variant="outline" disabled={busy || coverage.isFetching} onClick={() => void saveLink(item.id, pkg.id, false)}
                aria-label={`${text("Unlink", "Desvincular")} ${pkg.number} · #${item.id}`}>{text("Unlink", "Desvincular")}</Button>}
            </div>)}
          </li>;
        })}
      </ul>
      <details><summary className="cursor-pointer text-sm font-medium">{text("Packages without a register link", "Paquetes sin vínculo al registro")} ({unmatched.length})</summary>
        <ul className="space-y-2 mt-2">{unmatched.map(pkg => <li key={pkg.id} className="text-sm">
          <button className="text-blue-700 underline text-left break-words" onClick={() => onOpenPackage(pkg.id)}>{packageLabel(pkg)}</button> · {submittalStatusLabel(pkg.status, lang)}
        </li>)}</ul>
      </details>
      <p className="text-xs text-muted-foreground">{text("The exports below cover the package table, not this requirement coverage panel.", "Las exportaciones de abajo incluyen la tabla de paquetes, no este panel de cobertura de requisitos.")}</p>
    </>}
  </section>;
}
