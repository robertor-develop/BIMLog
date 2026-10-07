import { ArrowLeft } from "lucide-react";
import { Link, useSearch } from "wouter";
import { parseIntakeReturn } from "@/lib/return-context";
import { useI18n } from "@/lib/i18n";

const stageLabels = {
  documents: ["Documents", "Documentos"],
  identity: ["Job identity", "Identidad del trabajo"],
  contract: ["Contract setup", "Configuración del contrato"],
  scope: ["Contract Items", "Partidas de Contrato"],
  delivery: ["Delivery workflow", "Flujo de entrega"],
  team: ["Resource budget", "Presupuesto de recursos"],
  review: ["Review & activate", "Revisar y activar"],
} as const;

export function IntakeReturnBanner({ projectId }: { projectId?: number }) {
  const context = parseIntakeReturn(useSearch());
  const { language, tt } = useI18n();
  if (!context || (projectId !== undefined && context.projectId !== projectId)) return null;
  const stage = stageLabels[context.stage][language === "es" ? 1 : 0];

  return (
    <aside className="intake-return-banner" aria-label={tt("Return to Job Intake", "Volver al Ingreso del Trabajo")}>
      <div>
        <strong>{tt("You came here from Job Intake", "Llegó aquí desde Ingreso del Trabajo")}</strong>
        <span>{tt("Complete this prerequisite, then continue the same saved Intake draft.", "Complete este requisito y luego continúe el mismo borrador guardado del Ingreso.")}</span>
      </div>
      <Link href={context.href} className="intake-return-action">
        <ArrowLeft aria-hidden="true" size={16} />
        {tt(`Return to ${stage}`, `Volver a ${stage}`)}
      </Link>
    </aside>
  );
}

