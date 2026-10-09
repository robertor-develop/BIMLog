import { operationalPulse, type OperationalPulseCounts } from "@/lib/operational-pulse";

const QUEUE_COLORS = { rfis: "#2563eb", submittals: "#d97706", files: "#7c3aed" } as const;

export function OperationalPulse({ counts, lang, onOpen }: { counts: OperationalPulseCounts; lang: string; onOpen: (href: string) => void }) {
  const es = lang === "es";
  const pulse = operationalPulse(counts);
  const labels = {
    rfis: es ? "RFI abiertos" : "Open RFIs",
    submittals: es ? "Submittals pendientes" : "Pending submittals",
    files: es ? "Archivos por revisar" : "Files to review",
  };
  return <section className="operational-pulse" aria-labelledby="operational-pulse-title">
    <div className="operational-pulse__intro">
      <p className="operational-pulse__eyebrow">{es ? "Pulso operativo" : "Operational pulse"}</p>
      <h2 id="operational-pulse-title" aria-live="polite">{pulse.total === 0
        ? (es ? "No hay colas de atención pendientes" : "No attention queues are pending")
        : (es ? `${pulse.total} elementos necesitan revisión` : `${pulse.total} items need review`)}</h2>
      <p>{es ? "Carga actual verificada en los proyectos a los que tiene acceso." : "Current verified workload across the projects you can access."}</p>
      {pulse.recommended && <div className="operational-pulse__next" aria-labelledby="operational-pulse-next-title">
        <span>{es ? "Siguiente recomendado" : "Recommended next"}</span>
        <strong id="operational-pulse-next-title">{labels[pulse.recommended.key]}</strong>
        <p>{es
          ? `${pulse.recommended.count} de ${pulse.total} elementos pendientes están en esta cola, la carga verificada más grande en este momento.`
          : `${pulse.recommended.count} of ${pulse.total} pending items are in this queue, the largest verified workload right now.`}</p>
        <button type="button" onClick={() => onOpen(pulse.recommended!.href)}>
          {es ? `Revisar ${labels[pulse.recommended.key].toLowerCase()}` : `Review ${labels[pulse.recommended.key].toLowerCase()}`}
          <span aria-hidden="true">→</span>
        </button>
        <small>{es
          ? "Recomendación basada solo en los conteos actuales; no implica prioridad contractual ni fecha de vencimiento."
          : "Recommendation uses current counts only; it does not imply contractual priority or a due date."}</small>
      </div>}
    </div>
    <div className="operational-pulse__queues" aria-label={es ? "Distribución de la atención" : "Attention distribution"}>
      {pulse.queues.map(queue => <button className="operational-pulse__queue" type="button" key={queue.key} onClick={() => onOpen(queue.href)} aria-label={`${labels[queue.key]}: ${queue.count}. ${es ? "Abrir cola" : "Open queue"}`}>
        <span><strong>{queue.count}</strong> {labels[queue.key]}</span>
        <span>{queue.share}% <span aria-hidden="true">→</span></span>
        <div className="operational-pulse__track" aria-hidden="true"><span style={{ width: `${queue.share}%`, background: QUEUE_COLORS[queue.key] }} /></div>
      </button>)}
    </div>
  </section>;
}
