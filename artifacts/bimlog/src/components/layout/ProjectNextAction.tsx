import { ArrowRight, CheckCircle2, CircleDot, PlayCircle } from "lucide-react";
import { Link } from "wouter";
import type { ProjectJourneyAction } from "@/lib/project-journey";
import { useI18n } from "@/lib/i18n";

export function ProjectNextAction({ action }: { action: ProjectJourneyAction }) {
  const { lang } = useI18n();
  const Icon = action.state === "active" ? PlayCircle : action.state === "ready_to_start" ? CheckCircle2 : CircleDot;
  return (
    <section className="project-home-next" aria-labelledby="project-next-action-title">
      <div className="project-home-next-icon" aria-hidden="true"><Icon /></div>
      <div className="project-home-next-copy">
        <span className="project-home-kicker">{lang === "es" ? "SIGUIENTE ACCIÓN" : "NEXT ACTION"}</span>
        <h2 id="project-next-action-title">{lang === "es" ? action.titleEs : action.titleEn}</h2>
        <p>{lang === "es" ? action.detailEs : action.detailEn}</p>
      </div>
      <Link className="project-home-primary" href={action.href}>
        {lang === "es" ? action.labelEs : action.labelEn}<ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
