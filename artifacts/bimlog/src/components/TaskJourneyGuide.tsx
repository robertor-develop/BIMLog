import { useState } from "react";
import { TASK_JOURNEYS, journeyDestination, journeySelection, projectContext } from "../lib/task-journeys";
import "./task-journey-guide.css";

export function TaskJourneyGuide({ language, from }: { language: "en" | "es"; from: string }) {
  const initial = journeySelection(window.location.search);
  const [journeyId, setJourneyId] = useState(initial.journey.id);
  const [index, setIndex] = useState(initial.index);
  const journey = TASK_JOURNEYS.find(j => j.id === journeyId)!;
  const step = journey.steps[index];
  const tx = (en: string, es: string) => language === "es" ? es : en;
  const project = projectContext(from);
  function select(id: string, nextIndex: number) {
    setJourneyId(id); setIndex(nextIndex);
    const params = new URLSearchParams(window.location.search);
    params.set("view", "guides"); params.set("journey", id); params.set("step", String(nextIndex));
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}`);
  }
  const manual = new URLSearchParams({ view: "manual", topic: step.topic });
  if (project) manual.set("from", from);
  return <section className="task-journey" aria-labelledby="task-journey-title">
    <header><p className="tj-eyebrow">{tx("A path through your work", "Una ruta para su trabajo")}</p><h2 id="task-journey-title">{tx("What do you need to do?", "¿Qué necesita hacer?")}</h2>
      <p>{tx("Choose a goal to see the next action, what to verify, and how to recover. This guide does not read or change your project's progress.", "Elija un objetivo para ver la siguiente acción, qué verificar y cómo retomar el trabajo. Esta guía no lee ni modifica el avance del proyecto.")}</p></header>
    <div className="tj-goals" aria-label={tx("Work goals", "Objetivos de trabajo")}>{TASK_JOURNEYS.map(j => <button type="button" key={j.id} aria-pressed={j.id === journeyId} onClick={() => select(j.id, 0)}><strong>{j.title[language]}</strong><span>{j.audience[language]}</span></button>)}</div>
    <p className="tj-context">{project ? tx("Links keep the project you opened Help from. Each destination checks your access.", "Los enlaces conservan el proyecto desde el que abrió Ayuda. Cada destino verifica su acceso.") : tx("No project context: choose a project from the Dashboard, then open Help from that project to use direct links.", "Sin contexto de proyecto: elija un proyecto en el Panel y abra Ayuda desde ese proyecto para usar enlaces directos.")}</p>
    <div className="tj-layout"><nav aria-label={tx("Journey steps", "Pasos del recorrido")}><ol>{journey.steps.map((s, n) => <li key={s.title.en}><button type="button" aria-current={index === n ? "step" : undefined} onClick={() => select(journey.id, n)}><span>{n + 1}</span>{s.title[language]}</button></li>)}</ol></nav>
      <article aria-live="polite" aria-atomic="true"><p className="tj-eyebrow">{tx("Guide step", "Paso de la guía")} {index + 1} / {journey.steps.length}</p><h3>{step.title[language]}</h3><p>{step.action[language]}</p>
        <h4>{tx("Before moving on", "Antes de continuar")}</h4><p>{step.completion[language]}</p>
        <div className="tj-recovery"><h4>{tx("If you get stuck", "Si no puede continuar")}</h4><p>{step.recovery[language]}</p></div>
        <div className="tj-actions"><a className="tj-primary" href={journeyDestination(from, step.destination)}>{project ? tx("Open this workspace", "Abrir este espacio") : tx("Choose a project", "Elegir un proyecto")}</a><a href={`/help?${manual}`}>{tx("Detailed instructions", "Instrucciones detalladas")}</a>{project && journey.id === "setup" && <a href={journeyDestination(from, "intake")}>{tx("Return to Job Intake", "Volver a la preparación")}</a>}</div>
        <p className="tj-footnote">{tx("Save in the workspace before leaving. Browser Back returns to this guide step; the guide itself saves no project data.", "Guarde en el espacio de trabajo antes de salir. Atrás del navegador vuelve a este paso; la guía no guarda datos del proyecto.")}</p>
      </article></div>
  </section>;
}
