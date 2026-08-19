import {
  AlertTriangle,
  CheckCheck,
  Clock3,
  CloudOff,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import React from "react";
import type { CSSProperties } from "react";
import type {
  LensNextOfflineQueueItem,
  LensNextOfflineQueueState,
} from "./lens-next-offline-queue";

export type LensNextQueueViewLocale = "en" | "es";
export type LensNextQueueViewMode =
  | "idle"
  | "queued"
  | "reconnect_confirmation_required"
  | "retry_wait"
  | "blocked"
  | "overflow";

export interface LensNextOfflineQueueViewProps {
  state: LensNextOfflineQueueState;
  locale?: LensNextQueueViewLocale;
  nowMs: number;
  onReconfirm?: (idempotencyId: string) => void;
  onDiscard?: (idempotencyId: string) => void;
  className?: string;
}

const COPY = {
  en: {
    heading: "Offline request drafts",
    idle: "No request drafts are queued.",
    queued: "Request drafts are held locally in memory while offline.",
    reconnect:
      "Connection restored. Explicit confirmation is required before any later dispatch.",
    retry: "The first draft is waiting for its bounded retry window.",
    blocked: "The queue is blocked for safety. No draft was sent.",
    overflow: "Queue capacity was reached. No additional draft was accepted.",
    reconfirm: "Reconfirm draft",
    discard: "Discard draft",
    count: "Queued drafts",
    bytes: "In-memory bytes",
    retries: "Retry attempts",
    identity: "Immutable queue identity",
    noSend: "Nothing is sent by this view.",
  },
  es: {
    heading: "Borradores de solicitudes sin conexión",
    idle: "No hay borradores de solicitudes en cola.",
    queued:
      "Los borradores permanecen temporalmente en memoria mientras no hay conexión.",
    reconnect:
      "Se recuperó la conexión. Se requiere confirmación explícita antes de un envío posterior.",
    retry: "El primer borrador espera su ventana limitada de reintento.",
    blocked:
      "La cola está bloqueada por seguridad. No se envió ningún borrador.",
    overflow: "Se alcanzó la capacidad de la cola. No se aceptó otro borrador.",
    reconfirm: "Volver a confirmar borrador",
    discard: "Descartar borrador",
    count: "Borradores en cola",
    bytes: "Bytes en memoria",
    retries: "Intentos de reintento",
    identity: "Identidad inmutable de la cola",
    noSend: "Esta vista no envía nada.",
  },
} as const;

const shellStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0.75rem",
  border: "1px solid currentColor",
  borderRadius: "0.875rem",
  containerType: "inline-size",
};

const itemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "0.625rem",
  alignItems: "start",
  padding: "0.625rem",
  borderInlineStart: "3px solid currentColor",
  minWidth: 0,
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  minHeight: "2rem",
  padding: "0.25rem 0.5rem",
  border: "1px solid currentColor",
  borderRadius: "0.5rem",
  background: "transparent",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
};

const hiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
};

export function lensNextQueueViewMode(
  state: LensNextOfflineQueueState,
  nowMs: number,
): LensNextQueueViewMode {
  if (state.mode === "blocked")
    return state.reason === "QUEUE_CAPACITY_EXCEEDED" ? "overflow" : "blocked";
  const head = state.items[0];
  if (!head) return "idle";
  if (head.nextRetryAtMs !== null && head.nextRetryAtMs > nowMs)
    return "retry_wait";
  if (state.connectivity === "online" && head.reconfirmedAtMs === null)
    return "reconnect_confirmation_required";
  return "queued";
}

function statusIcon(mode: LensNextQueueViewMode) {
  const props = { size: 18, "aria-hidden": true as const };
  if (mode === "idle") return <CheckCheck {...props} />;
  if (mode === "queued") return <CloudOff {...props} />;
  if (mode === "reconnect_confirmation_required")
    return <RotateCcw {...props} />;
  if (mode === "retry_wait") return <Clock3 {...props} />;
  if (mode === "overflow") return <AlertTriangle {...props} />;
  return <ShieldAlert {...props} />;
}

function immutableDescription(item: LensNextOfflineQueueItem) {
  const { draft } = item;
  return `${draft.actorId}:${draft.action}:${draft.identity.projectId}:${draft.identity.serverId}:${draft.identity.revisionNumber}:${draft.idempotencyId}`;
}

export function LensNextOfflineQueueView({
  state,
  locale = "en",
  nowMs,
  onReconfirm,
  onDiscard,
  className,
}: LensNextOfflineQueueViewProps) {
  const copy = COPY[locale];
  const mode = lensNextQueueViewMode(state, nowMs);
  const messages = {
    idle: copy.idle,
    queued: copy.queued,
    reconnect_confirmation_required: copy.reconnect,
    retry_wait: copy.retry,
    blocked: copy.blocked,
    overflow: copy.overflow,
  } as const;
  const urgent = mode === "blocked" || mode === "overflow";
  const items = state.items.slice(0, 100);

  return (
    <section
      className={className}
      aria-labelledby="lens-next-offline-queue-heading"
      data-queue-view-mode={mode}
      data-responsive-contract="mobile-280px-single-column"
      data-render-limit="100"
      style={shellStyle}
    >
      <header style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <ListChecks size={19} aria-hidden="true" />
        <h2
          id="lens-next-offline-queue-heading"
          style={{ margin: 0, fontSize: "1rem" }}
        >
          {copy.heading}
        </h2>
      </header>
      <p
        role={urgent ? "alert" : "status"}
        aria-live={urgent ? "assertive" : "polite"}
        aria-atomic="true"
        style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
      >
        {statusIcon(mode)}
        <span>
          {messages[mode]} {copy.noSend}
        </span>
      </p>
      <dl
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          margin: "0.5rem 0",
        }}
      >
        <div>
          <dt>{copy.count}</dt>
          <dd>{state.items.length}</dd>
        </div>
        <div>
          <dt>{copy.bytes}</dt>
          <dd>{state.totalBytes}</dd>
        </div>
        <div>
          <dt>{copy.retries}</dt>
          <dd>{state.items[0]?.attempts ?? 0}</dd>
        </div>
      </dl>
      {items.length > 0 && (
        <ol
          aria-label={copy.heading}
          style={{
            display: "grid",
            gap: "0.5rem",
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {items.map((item) => {
            const id = item.draft.idempotencyId;
            const canReconfirm =
              mode === "reconnect_confirmation_required" && item === items[0];
            return (
              <li key={id} data-idempotency-id={id} style={itemStyle}>
                <article style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <h3 style={{ margin: 0, fontSize: "0.875rem" }}>
                    {item.draft.action}
                  </h3>
                  <p style={{ margin: "0.25rem 0" }}>
                    {copy.retries}: {item.attempts}. {copy.bytes}:{" "}
                    {item.byteLength}.
                  </p>
                  <p style={hiddenStyle}>
                    {copy.identity}: {immutableDescription(item)}
                  </p>
                </article>
                <span
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}
                >
                  {canReconfirm && (
                    <button
                      type="button"
                      onClick={() => onReconfirm?.(id)}
                      style={buttonStyle}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      {copy.reconfirm}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDiscard?.(id)}
                    style={buttonStyle}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {copy.discard}
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export const LENS_NEXT_OFFLINE_QUEUE_VIEW_INVARIANTS = Object.freeze({
  maximumRenderedItems: 100,
  minimumWidthPx: 280,
  dispatchBehavior: false,
  networkBehavior: false,
  storageBehavior: false,
  serviceWorkerBehavior: false,
  automaticConflictResolution: false,
  visualStateMutation: false,
});
