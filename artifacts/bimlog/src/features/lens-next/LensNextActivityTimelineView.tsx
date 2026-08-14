import {
  AlertTriangle,
  CircleDot,
  CloudOff,
  History,
  LoaderCircle,
  MessageSquareText,
  ShieldAlert,
  UserRoundCog,
} from "lucide-react";
import React from "react";
import type { CSSProperties } from "react";
import {
  toLensNextTimelineItems,
  type LensNextTimelineLocale,
  type LensNextTimelineState,
} from "./lens-next-activity-timeline";

export interface LensNextActivityTimelineViewProps {
  state: LensNextTimelineState;
  locale?: LensNextTimelineLocale;
  loading?: boolean;
  visibleLimit?: number;
  className?: string;
}

const COPY = {
  en: {
    heading: "Issue activity",
    loading: "Loading issue history",
    empty: "No status, comment, or assignment activity is available.",
    offline: "History is unavailable while offline.",
    error: "Issue history could not be loaded.",
    blocked:
      "History is blocked because its identity or version could not be verified.",
    more: "More verified history is available on the next page.",
    bounded: (hidden: number) =>
      `${hidden} older events are not rendered in this compact view.`,
    identity: "Immutable issue identity",
    historyVersion: "History version",
    revision: "Issue revision",
  },
  es: {
    heading: "Actividad del asunto",
    loading: "Cargando el historial del asunto",
    empty: "No hay actividad disponible de estado, comentarios o asignaciones.",
    offline: "El historial no está disponible sin conexión.",
    error: "No se pudo cargar el historial del asunto.",
    blocked:
      "El historial está bloqueado porque no se pudo verificar su identidad o versión.",
    more: "Hay más historial verificado disponible en la página siguiente.",
    bounded: (hidden: number) =>
      `${hidden} eventos anteriores no se muestran en esta vista compacta.`,
    identity: "Identidad inmutable del asunto",
    historyVersion: "Versión del historial",
    revision: "Revisión del asunto",
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

const listStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: "0.625rem",
  margin: "0.75rem 0 0",
  padding: 0,
  listStyle: "none",
};

const itemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "start",
  gap: "0.625rem",
  minWidth: 0,
  padding: "0.625rem",
  borderInlineStart: "3px solid currentColor",
  background: "color-mix(in srgb, currentColor 5%, transparent)",
};

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

function activityIcon(type: "status" | "comment" | "assignment") {
  const props = { size: 17, "aria-hidden": true as const };
  if (type === "comment") return <MessageSquareText {...props} />;
  if (type === "assignment") return <UserRoundCog {...props} />;
  return <CircleDot {...props} />;
}

function StateMessage({
  kind,
  message,
}: {
  kind: "loading" | "empty" | "offline" | "error" | "blocked";
  message: string;
}) {
  const props = { size: 18, "aria-hidden": true as const };
  const icon =
    kind === "loading" ? (
      <LoaderCircle {...props} />
    ) : kind === "offline" ? (
      <CloudOff {...props} />
    ) : kind === "blocked" ? (
      <ShieldAlert {...props} />
    ) : kind === "error" ? (
      <AlertTriangle {...props} />
    ) : (
      <History {...props} />
    );
  const urgent = kind === "error" || kind === "blocked";
  return (
    <p
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
      data-timeline-state={kind}
      style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
    >
      {icon}
      <span>{message}</span>
    </p>
  );
}

export function LensNextActivityTimelineView({
  state,
  locale = "en",
  loading = false,
  visibleLimit = 100,
  className,
}: LensNextActivityTimelineViewProps) {
  const copy = COPY[locale];
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(visibleLimit)));
  const items = toLensNextTimelineItems(state, locale);
  const visibleItems = items.slice(-boundedLimit);
  const hiddenCount = items.length - visibleItems.length;
  const identityText = `${state.identity.projectId}:${state.identity.issueFamilyId}:${state.identity.serverId}:${state.identity.viewpointId}`;

  return (
    <section
      className={className}
      aria-labelledby="lens-next-activity-heading"
      data-responsive-contract="mobile-280px-single-column"
      data-render-limit={boundedLimit}
      style={shellStyle}
    >
      <header style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <History size={19} aria-hidden="true" />
        <h2
          id="lens-next-activity-heading"
          style={{ margin: 0, fontSize: "1rem" }}
        >
          {copy.heading}
        </h2>
      </header>
      <p style={visuallyHidden}>
        {copy.identity}: {identityText}. {copy.historyVersion}:{" "}
        {state.historyVersion}. {copy.revision}: {state.identity.revisionNumber}
        .
      </p>

      {loading ? (
        <StateMessage kind="loading" message={copy.loading} />
      ) : state.mode === "empty" ? (
        <StateMessage kind="empty" message={copy.empty} />
      ) : state.mode === "offline" ? (
        <StateMessage kind="offline" message={copy.offline} />
      ) : state.mode === "error" ? (
        <StateMessage kind="error" message={copy.error} />
      ) : state.mode === "blocked" ? (
        <StateMessage kind="blocked" message={copy.blocked} />
      ) : (
        <>
          <ol aria-label={copy.heading} style={listStyle}>
            {visibleItems.map((item) => (
              <li key={item.key} data-activity-id={item.key} style={itemStyle}>
                <span aria-hidden="true">{activityIcon(item.type)}</span>
                <article style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <h3 style={{ margin: 0, fontSize: "0.875rem" }}>
                    {item.label}
                  </h3>
                  <p style={{ margin: "0.25rem 0" }}>{item.summary}</p>
                  <footer style={{ fontSize: "0.75rem" }}>
                    <span>{item.actorLabel}</span>
                    {" · "}
                    <time dateTime={item.timeLabel}>{item.timeLabel}</time>
                    {" · "}
                    <span>{item.versionLabel}</span>
                  </footer>
                </article>
              </li>
            ))}
          </ol>
          {hiddenCount > 0 && (
            <p data-bounded-history>{copy.bounded(hiddenCount)}</p>
          )}
          {state.nextCursor && (
            <p role="status" aria-live="polite" data-more-history-available>
              {copy.more}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export const LENS_NEXT_ACTIVITY_VIEW_INVARIANTS = Object.freeze({
  maximumRenderedEvents: 100,
  maximumModelEvents: 500,
  minimumWidthPx: 280,
  actionControls: 0,
  networkBehavior: false,
  persistenceBehavior: false,
  writeBehavior: false,
});
