import {
  Ban,
  CheckCircle2,
  CircleAlert,
  CloudOff,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import React from "react";
import type { CSSProperties } from "react";

export type LensNextWorkflowBannerState =
  | "saving"
  | "saved"
  | "offline"
  | "refreshing"
  | "conflict"
  | "action_blocked";
export type LensNextWorkflowBannerLocale = "en" | "es";

export interface LensNextWorkflowStateBannerProps {
  state: LensNextWorkflowBannerState;
  locale?: LensNextWorkflowBannerLocale;
  detail?: string | null;
  retryAvailable?: boolean;
  cancelAvailable?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

const COPY = {
  saving: {
    en: ["Saving", "Your request is being prepared."],
    es: ["Guardando", "Se está preparando su solicitud."],
  },
  saved: {
    en: ["Saved", "The latest platform state is current."],
    es: [
      "Guardado",
      "El estado más reciente de la plataforma está actualizado.",
    ],
  },
  offline: {
    en: ["Offline", "Refresh is paused until the connection returns."],
    es: [
      "Sin conexión",
      "La actualización está pausada hasta recuperar la conexión.",
    ],
  },
  refreshing: {
    en: ["Refreshing", "Checking the latest BIMLog issue state."],
    es: [
      "Actualizando",
      "Verificando el estado más reciente del asunto de BIMLog.",
    ],
  },
  conflict: {
    en: [
      "Conflict detected",
      "Review the latest state. Nothing was resolved automatically.",
    ],
    es: [
      "Conflicto detectado",
      "Revise el estado más reciente. Nada se resolvió automáticamente.",
    ],
  },
  action_blocked: {
    en: [
      "Action blocked for safety",
      "The request was stopped without changing the issue or visual state.",
    ],
    es: [
      "Acción bloqueada por seguridad",
      "La solicitud se detuvo sin cambiar el asunto ni el estado visual.",
    ],
  },
} as const;

const containerStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "0.625rem",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0.625rem 0.75rem",
  border: "1px solid currentColor",
  borderRadius: "0.75rem",
  fontSize: "0.8125rem",
  lineHeight: 1.35,
};

const actionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  minHeight: "2rem",
  padding: "0.25rem 0.5rem",
  border: "1px solid currentColor",
  borderRadius: "0.5rem",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
};

function icon(state: LensNextWorkflowBannerState) {
  const props = { size: 18, "aria-hidden": true as const };
  if (state === "saving" || state === "refreshing")
    return <LoaderCircle {...props} />;
  if (state === "saved") return <CheckCircle2 {...props} />;
  if (state === "offline") return <CloudOff {...props} />;
  if (state === "conflict") return <CircleAlert {...props} />;
  return <Ban {...props} />;
}

export function LensNextWorkflowStateBanner({
  state,
  locale = "en",
  detail,
  retryAvailable = false,
  cancelAvailable = false,
  onRetry,
  onCancel,
  className,
}: LensNextWorkflowStateBannerProps) {
  const [title, message] = COPY[state][locale];
  const urgent = state === "conflict" || state === "action_blocked";
  const busy = state === "saving" || state === "refreshing";
  const retryLabel = locale === "es" ? "Reintentar" : "Retry";
  const cancelLabel = locale === "es" ? "Cancelar" : "Cancel";

  return (
    <section
      className={className}
      data-lens-next-workflow-state={state}
      data-responsive-contract="narrow-280px-wrap"
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
      aria-busy={busy}
      style={containerStyle}
    >
      <span aria-hidden="true">{icon(state)}</span>
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <strong style={{ display: "block" }}>{title}</strong>
        <span>{detail?.trim() || message}</span>
      </span>
      {(retryAvailable || cancelAvailable) && (
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: "0.375rem",
          }}
        >
          {retryAvailable && (
            <button type="button" onClick={onRetry} style={actionStyle}>
              <RefreshCw size={14} aria-hidden="true" />
              {retryLabel}
            </button>
          )}
          {cancelAvailable && (
            <button type="button" onClick={onCancel} style={actionStyle}>
              <X size={14} aria-hidden="true" />
              {cancelLabel}
            </button>
          )}
        </span>
      )}
    </section>
  );
}

export const LENS_NEXT_WORKFLOW_BANNER_INVARIANTS = Object.freeze({
  minimumSupportedWidthPx: 280,
  networkBehavior: false,
  storageBehavior: false,
  writeBehavior: false,
  automaticConflictResolution: false,
  visualStateMutation: false,
});
