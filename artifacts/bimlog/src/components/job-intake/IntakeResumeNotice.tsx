import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { parseIntakeResume } from "@/lib/return-context";

const labels = {
  documents: ["Source documents", "Documentos fuente"],
  identity: ["Job identity", "Identidad del trabajo"],
  contract: ["Contract setup", "Configuración contractual"],
  scope: ["Contract Items", "Partidas de Contrato"],
  delivery: ["Delivery workflow", "Flujo de entrega"],
  team: ["Resource budget", "Presupuesto de recursos"],
  review: ["Review & activate", "Revisar y activar"],
} as const;

export function IntakeResumeNotice({ projectId }: { projectId: number }) {
  const context = parseIntakeResume(useSearch(), projectId);
  const { language, tt } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  if (!context || dismissed) return null;
  const stage = labels[context.stage][language === "es" ? 1 : 0];
  return (
    <section className="ji-resume" role="status" aria-labelledby="ji-resume-title">
      <CheckCircle2 aria-hidden="true" size={20} />
      <div>
        <strong id="ji-resume-title">{tt("Returned to your saved Job Intake", "Regresó a su Ingreso del Trabajo guardado")}</strong>
        <p>{tt(`Continue in ${stage}. Your saved draft and exact place were preserved.`, `Continúe en ${stage}. Se conservaron su borrador guardado y el lugar exacto.`)}</p>
      </div>
      <button type="button" aria-label={tt("Dismiss return confirmation", "Cerrar confirmación de regreso")} onClick={() => {
        window.history.replaceState(window.history.state, "", context.href);
        setDismissed(true);
      }}><X aria-hidden="true" size={16} /></button>
    </section>
  );
}
