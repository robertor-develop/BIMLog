import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { adoptionStageLabel } from "@/lib/adoption-journey";
import { deriveAdoptionProgress, type AdoptionProgressInput } from "@/lib/adoption-progress";

export function SetupProgressCard({ lang, state, onResume }: { lang: string; state: AdoptionProgressInput; onResume: () => void }) {
  const locale = lang === "es" ? "es" : "en";
  const progress = deriveAdoptionProgress(state);
  if (progress.completed) return null;
  return <section className="setup-progress-card" aria-labelledby="setup-progress-title">
    <div className="setup-progress-card__icon"><Sparkles aria-hidden size={18}/></div>
    <div className="setup-progress-card__body">
      <p>{locale === "es" ? "CONFIGURACIÓN GUIADA" : "GUIDED SETUP"}</p>
      <h2 id="setup-progress-title">{locale === "es" ? "Termine de preparar su espacio" : "Finish preparing your workspace"}</h2>
      <div className="setup-progress-card__meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} aria-label={locale === "es" ? "Progreso de configuración" : "Setup progress"}><span style={{width:`${progress.percent}%`}}/></div>
      <span className="setup-progress-card__next"><CheckCircle2 aria-hidden size={14}/>{progress.completedCount}/6 · {locale === "es" ? "Siguiente" : "Next"}: {progress.nextStage ? adoptionStageLabel(progress.nextStage, locale) : ""}</span>
    </div>
    <button type="button" onClick={onResume}>{locale === "es" ? "Continuar configuración" : "Continue setup"}<ArrowRight aria-hidden size={16}/></button>
  </section>;
}
