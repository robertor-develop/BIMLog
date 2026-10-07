import { Check } from "lucide-react";
import { projectHomePhases } from "@/lib/project-home-model";
import { useI18n } from "@/lib/i18n";

export function ProjectJourneyProgress({ status }: { status?: string }) {
  const { lang } = useI18n();
  const phases = projectHomePhases(status);
  return <section className="project-home-progress" aria-labelledby="project-progress-title">
    <div className="project-home-section-heading"><h2 id="project-progress-title">{lang === "es" ? "Etapa del proyecto" : "Project stage"}</h2><p>{lang === "es" ? "La configuración conduce al trabajo y sus resultados." : "Setup leads into project work and its results."}</p></div>
    <ol>{phases.map((phase, index) => <li key={phase.key} className={phase.state} aria-current={phase.state === "current" ? "step" : undefined}>
      <span className="project-home-step-marker" aria-hidden="true">{phase.state === "complete" ? <Check /> : index + 1}</span>
      <span>{lang === "es" ? phase.labelEs : phase.labelEn}</span>
    </li>)}</ol>
  </section>;
}
