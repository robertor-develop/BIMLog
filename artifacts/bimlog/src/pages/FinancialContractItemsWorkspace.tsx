import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ContractItemWorkflowPanel } from "@/components/commercial/ContractItemWorkflowPanel";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const human = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function FinancialContractItemsWorkspace() {
  const { token } = useAuthStore();
  const { language, tt } = useI18n();
  const [, params] = useRoute("/projects/:id/financial/contracts/:contractId/items");
  const projectId = Number(params?.id);
  const contractId = params?.contractId ? decodeURIComponent(params.contractId) : "";
  const [contract, setContract] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workflowItemId, setWorkflowItemId] = useState("");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = async () => {
    setLoading(true);
    setError("");
    setContract(null);
    setDetail(null);
    try {
      if (!Number.isSafeInteger(projectId) || projectId <= 0 || !contractId) throw new Error(tt("This contract-items link is invalid.", "Este enlace de partidas del contrato no es válido."));
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/financial/contracts/${encodeURIComponent(contractId)}`, { headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.[language] ?? body?.error?.en ?? tt("The requested contract is unavailable or you do not have access.", "El contrato solicitado no está disponible o no tiene acceso."));
      if (!body?.detail || String(body.detail.id) !== contractId) throw new Error(tt("The requested contract could not be verified. No other contract was substituted.", "No se pudo verificar el contrato solicitado. No se sustituyó por otro contrato."));
      setContract(body.detail);
      setDetail(body.detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) void load(); }, [projectId, contractId, token, language]);

  return <FinancialProjectShell projectId={projectId} activeTab="contracts"><main className="fci-page">
    <style>{styles}</style>
    <header className="fci-header">
      <div><Link href={`/projects/${projectId}/financial/contracts`}>← {tt("Contracts & Commitments", "Contratos y Compromisos")}</Link><h1>{tt("Contract Items", "Partidas de Contrato")}</h1><p>{tt("A focused table for the exact selected contract", "Una tabla enfocada para el contrato seleccionado exacto")}</p></div>
    </header>
    {loading && <section className="fci-state" role="status"><h2>{tt("Loading contract items", "Cargando partidas del contrato")}</h2><p>{tt("Verifying the project, contract, and your access.", "Verificando el proyecto, el contrato y su acceso.")}</p></section>}
    {!loading && error && <section className="fci-state fci-error" role="alert"><h2>{tt("Contract items unavailable", "Partidas del contrato no disponibles")}</h2><p>{error}</p><div className="fci-actions"><button type="button" onClick={() => void load()}>{tt("Retry", "Reintentar")}</button><Link href={`/projects/${projectId}/financial/contracts`}>{tt("Return to contract register", "Volver al registro de contratos")}</Link></div></section>}
    {!loading && contract && detail && <>
      <section className="fci-contract" aria-labelledby="contract-items-title"><div><small>{contract.bimlogId}</small><h2 id="contract-items-title">{contract.legalNumber} · {contract.title}</h2><p>{contract.counterpartyName} · {human(contract.status)} · {contract.currentCommitment} {contract.currency}</p></div><span>{detail.lines.length} {detail.lines.length === 1 ? tt("item", "partida") : tt("items", "partidas")}</span></section>
      {detail.lines.length === 0 ? <section className="fci-state"><h2>{tt("No Contract Items", "Sin Partidas de Contrato")}</h2><p>{tt("This exact contract does not contain line items.", "Este contrato exacto no contiene partidas.")}</p></section> : <section className="fci-table-card" aria-label={tt("Contract Items table", "Tabla de Partidas de Contrato")}><div className="fci-table-wrap"><table><thead><tr><th>{tt("Code", "Código")}</th><th>{tt("Contract Item", "Partida de Contrato")}</th><th>{tt("Trade", "Trade")}</th><th>{tt("Service", "Service")}</th><th>{tt("Quantity × Rate", "Cantidad × Tarifa")}</th><th>{tt("Contract value", "Valor contractual")}</th><th>{tt("APU snapshot", "Instantánea APU")}</th><th>{tt("Workflow", "Flujo")}</th></tr></thead><tbody>{detail.lines.map((line: any) => <tr key={line.stableLineId}><td>{line.projectCode}<small>{line.projectName}</small></td><td><strong>{line.contractItem?.displayName || line.description}</strong><small>{line.stableLineId}</small></td><td>{line.contractItem?.classification?.disciplineName || line.contractItem?.classification?.disciplineCode || "—"}</td><td>{line.contractItem?.classification?.serviceName || line.contractItem?.classification?.serviceCode || "—"}</td><td>{line.contractItem?.quantity ?? "1"} {line.contractItem?.unit ?? "LS"} × {line.contractItem?.unitRate ?? line.amount} {contract.currency}</td><td>{line.amount} {contract.currency}<small>{tt("Approved budget", "Presupuesto aprobado")}: {line.budgetAmount}</small></td><td>{line.contractItem?.apuPlanVersion ? `v${line.contractItem.apuPlanVersion}` : tt("Legacy line", "Línea heredada")}<small>{line.contractItem?.apuFingerprint?.slice(0, 12) ?? "—"}</small></td><td>{human(line.contractItem?.workflowTemplate ?? "legacy")}<small>{line.schedule ? `${line.schedule.sourceType} #${line.schedule.sourceId}` : tt("Not linked", "Sin vínculo")}</small><button type="button" aria-expanded={workflowItemId === line.stableLineId} onClick={() => setWorkflowItemId(workflowItemId === line.stableLineId ? "" : line.stableLineId)}>{workflowItemId === line.stableLineId ? tt("Close workflow", "Cerrar flujo") : tt("Open workflow", "Abrir flujo")}</button></td></tr>)}</tbody></table></div></section>}
      {detail.lines.map((line: any) => workflowItemId === line.stableLineId && <ContractItemWorkflowPanel key={line.stableLineId} projectId={projectId} contractId={contract.id} stableLineId={line.stableLineId} displayName={line.contractItem?.displayName || line.description} token={token!} language={language} tt={tt}/>)}
    </>}
  </main></FinancialProjectShell>;
}

const styles = `.fci-page{min-height:100vh;background:#f4f6f8;color:#17212b;padding:24px;overflow-x:hidden}.fci-page>*{max-width:1180px;margin-left:auto;margin-right:auto}.fci-header h1{margin:8px 0 4px;font-size:28px}.fci-header p,.fci-contract p,.fci-state p{color:#64707d}.fci-contract{display:flex;justify-content:space-between;gap:16px;margin-top:18px;padding:18px;border:1px solid #dce3ea;border-radius:10px;background:#fff}.fci-contract h2{margin:5px 0}.fci-contract p{margin:0}.fci-contract>span{align-self:start;padding:6px 10px;border-radius:99px;background:#eaf2ff;color:#20578b;font-size:12px;font-weight:700}.fci-table-card,.fci-state{margin-top:14px;padding:18px;border:1px solid #dce3ea;border-radius:10px;background:#fff}.fci-state h2{margin-top:0}.fci-error{border-color:#f0b4b4;background:#fff7f7;color:#9b2525}.fci-actions{display:flex;gap:12px;align-items:center}.fci-actions button,.fci-page table button{border:1px solid #c7d1dc;border-radius:7px;padding:7px 10px;background:#fff;color:#164e7a;cursor:pointer}.fci-table-wrap{overflow-x:auto}.fci-page table{width:100%;min-width:1040px;border-collapse:collapse}.fci-page th,.fci-page td{padding:10px;text-align:left;border-bottom:1px solid #e4e9ef;font-size:12px;vertical-align:top}.fci-page th{background:#edf4fa;color:#405162}.fci-page td small{display:block;margin-top:4px;color:#64707d}.fci-page td button{display:block;margin-top:7px}@media(max-width:720px){.fci-page{padding:12px}.fci-header h1{font-size:23px}.fci-contract{display:block}.fci-contract>span{display:inline-block;margin-top:10px}.fci-table-card{padding:10px}.fci-actions{align-items:stretch;flex-direction:column}}`;
