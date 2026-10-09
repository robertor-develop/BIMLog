import { operationalPulse, type OperationalPulseCounts } from "@/lib/operational-pulse";
import { formatOperationalPulseCheckedAt, operationalPulseRefreshState } from "@/lib/operational-pulse-refresh";
import { operationalPulseChange } from "@/lib/operational-pulse-change";

const QUEUE_COLORS = { rfis: "#2563eb", submittals: "#d97706", files: "#7c3aed" } as const;

export function OperationalPulse({ counts, previousCounts = null, lang, onOpen, onRefresh = () => undefined, isFetching = false, hasError = false, checkedAt = 0 }: {
  counts: OperationalPulseCounts;
  previousCounts?: OperationalPulseCounts | null;
  lang: string;
  onOpen: (href: string) => void;
  onRefresh?: () => void;
  isFetching?: boolean;
  hasError?: boolean;
  checkedAt?: number;
}) {
  const es = lang === "es";
  const pulse = operationalPulse(counts);
  const refreshState = operationalPulseRefreshState({ isFetching, hasError, hasVerifiedData: checkedAt > 0 });
  const checkedTime = formatOperationalPulseCheckedAt(checkedAt, lang);
  const change = previousCounts ? operationalPulseChange(previousCounts, counts) : null;
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
      <div className={`operational-pulse__freshness operational-pulse__freshness--${refreshState}`} role="status" aria-live="polite">
        <span>{refreshState === "refreshing"
          ? (es ? "Actualizando conteos verificados…" : "Refreshing verified counts…")
          : refreshState === "unavailable"
            ? (es ? "No se pudieron actualizar los conteos. Se conserva la última vista verificada." : "Counts could not refresh. The last verified view remains visible.")
            : (es ? `Verificado a las ${checkedTime}` : `Checked at ${checkedTime}`)}</span>
        <button type="button" onClick={onRefresh} disabled={isFetching}>
          {isFetching ? (es ? "Actualizando…" : "Refreshing…") : (es ? "Actualizar" : "Refresh")}
        </button>
      </div>
      {change && <div className={`operational-pulse__movement operational-pulse__movement--${change.direction}`} role="status" aria-live="polite">
        <strong>{change.direction === "unchanged"
          ? (es ? "Sin cambios desde la última verificación" : "No change since the last check")
          : change.direction === "decreased"
            ? (es ? `${Math.abs(change.total)} elemento(s) menos desde la última verificación` : `${Math.abs(change.total)} fewer item(s) since the last check`)
            : (es ? `${change.total} elemento(s) más desde la última verificación` : `${change.total} more item(s) since the last check`)}</strong>
        <span>{es ? "Compara únicamente los dos últimos conteos verificados." : "Compares only the two latest verified counts."}</span>
        <ul className="operational-pulse__movement-queues" aria-label={es ? "Cambios por cola" : "Changes by queue"}>
          {change.queues.map(queue => <li className={`operational-pulse__movement-queue operational-pulse__movement-queue--${queue.direction}`} key={queue.key}>
            <span>{labels[queue.key]}</span>
            <strong>{queue.delta > 0 ? `+${queue.delta}` : queue.delta}</strong>
          </li>)}
        </ul>
      </div>}
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
