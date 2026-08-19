import {
  AlertTriangle,
  FileWarning,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  WifiOff,
} from "lucide-react";
import React, { type CSSProperties } from "react";

import type { LensNextRefreshIdentity } from "./lens-next-auto-refresh";

export type LensNextConflictReviewKind =
  | "stale_identity"
  | "divergent_revision_version"
  | "receipt_expired"
  | "offline_queue_mismatch"
  | "visual_digest_mismatch";

export interface LensNextConflictSnapshot {
  identity: LensNextRefreshIdentity;
  status: string;
  version: number;
  visualStateDigest: string;
  executorReceiptSha256: string | null;
  executorReceiptExpiresAt: string | null;
  queueFingerprint: string | null;
}

export interface LensNextConflictReviewViewProps {
  locale: "en" | "es";
  kind: LensNextConflictReviewKind;
  expected: LensNextConflictSnapshot;
  current: LensNextConflictSnapshot;
  onRequestRefresh: () => void;
  onDiscardDraft: () => void;
}

const copy = {
  en: {
    title: "Manual conflict review",
    summary: {
      stale_identity:
        "The current immutable identity does not match the draft identity.",
      divergent_revision_version:
        "The current revision or version diverges from the draft preconditions.",
      receipt_expired:
        "The bound executor receipt is expired or no longer current.",
      offline_queue_mismatch:
        "The offline queue item does not match the reviewed draft.",
      visual_digest_mismatch:
        "The visual-state digest changed after the draft was prepared.",
    },
    expected: "Expected draft binding",
    current: "Current server binding",
    identity: "Immutable identity",
    preconditions: "Status / version / revision",
    visualDigest: "Visual-state digest",
    receipt: "Executor receipt / expiry",
    queue: "Offline queue fingerprint",
    unavailable: "Not bound",
    invariant:
      "No visual state is changed. This review never accepts, merges, overwrites, resolves, or sends a draft.",
    refresh: "Request a read-only refresh",
    discard: "Discard local draft",
  },
  es: {
    title: "Revisión manual del conflicto",
    summary: {
      stale_identity:
        "La identidad inmutable actual no coincide con la identidad del borrador.",
      divergent_revision_version:
        "La revisión o versión actual diverge de las precondiciones del borrador.",
      receipt_expired:
        "El recibo de ejecución vinculado venció o ya no es vigente.",
      offline_queue_mismatch:
        "El elemento de la cola sin conexión no coincide con el borrador revisado.",
      visual_digest_mismatch:
        "El resumen del estado visual cambió después de preparar el borrador.",
    },
    expected: "Vinculación esperada del borrador",
    current: "Vinculación actual del servidor",
    identity: "Identidad inmutable",
    preconditions: "Estado / versión / revisión",
    visualDigest: "Resumen del estado visual",
    receipt: "Recibo de ejecución / vencimiento",
    queue: "Huella de la cola sin conexión",
    unavailable: "Sin vincular",
    invariant:
      "No se cambia el estado visual. Esta revisión nunca acepta, combina, sobrescribe, resuelve ni envía un borrador.",
    refresh: "Solicitar actualización de solo lectura",
    discard: "Descartar borrador local",
  },
} as const;

const panelStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0.75rem",
  border: "1px solid currentColor",
  borderRadius: "0.875rem",
  containerType: "inline-size",
};

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  minHeight: "2.25rem",
  padding: "0.375rem 0.625rem",
  border: "1px solid currentColor",
  borderRadius: "0.5rem",
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

function bounded(value: string | null, fallback: string, limit = 160) {
  if (!value) return fallback;
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function identity(snapshot: LensNextConflictSnapshot) {
  const value = snapshot.identity;
  return bounded(
    [
      value.projectId,
      value.issueFamilyId,
      value.serverId,
      value.viewpointId,
      value.lifecycleStatus,
      value.revisionNumber,
    ].join(":"),
    "—",
  );
}

function icon(kind: LensNextConflictReviewKind) {
  if (kind === "receipt_expired") return ShieldAlert;
  if (kind === "offline_queue_mismatch") return WifiOff;
  if (kind === "visual_digest_mismatch") return FileWarning;
  return AlertTriangle;
}

export function LensNextConflictReviewView({
  locale,
  kind,
  expected,
  current,
  onRequestRefresh,
  onDiscardDraft,
}: LensNextConflictReviewViewProps) {
  const text = copy[locale];
  const ConflictIcon = icon(kind);

  const snapshot = (
    label: string,
    value: LensNextConflictSnapshot,
    prefix: string,
  ) => (
    <section aria-labelledby={`${prefix}-heading`}>
      <h3 id={`${prefix}-heading`}>{label}</h3>
      <dl>
        <div>
          <dt>{text.identity}</dt>
          <dd>{identity(value)}</dd>
        </div>
        <div>
          <dt>{text.preconditions}</dt>
          <dd>
            {bounded(value.status, "—", 64)} / {value.version} /{" "}
            {value.identity.revisionNumber}
          </dd>
        </div>
        <div>
          <dt>{text.visualDigest}</dt>
          <dd>{bounded(value.visualStateDigest, "—", 64)}</dd>
        </div>
        <div>
          <dt>{text.receipt}</dt>
          <dd>
            {bounded(value.executorReceiptSha256, text.unavailable, 64)} /{" "}
            {bounded(value.executorReceiptExpiresAt, text.unavailable, 40)}
          </dd>
        </div>
        <div>
          <dt>{text.queue}</dt>
          <dd>{bounded(value.queueFingerprint, text.unavailable, 80)}</dd>
        </div>
      </dl>
    </section>
  );

  return (
    <section
      aria-labelledby="lens-next-conflict-review-heading"
      data-conflict-kind={kind}
      data-responsive-contract="mobile-280px-single-column"
      style={panelStyle}
    >
      <h2 id="lens-next-conflict-review-heading">{text.title}</h2>
      <p role="alert" aria-live="assertive" aria-atomic="true">
        <ConflictIcon aria-hidden="true" size={18} />
        <span>{text.summary[kind]}</span>
      </p>
      <div
        data-layout="single-column-below-560px"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr))",
          gap: "0.75rem",
        }}
      >
        {snapshot(text.expected, expected, "lens-next-conflict-expected")}
        {snapshot(text.current, current, "lens-next-conflict-current")}
      </div>
      <p>
        <strong>{text.invariant}</strong>
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" onClick={onRequestRefresh} style={buttonStyle}>
          <RefreshCcw aria-hidden="true" size={15} />
          {text.refresh}
        </button>
        <button type="button" onClick={onDiscardDraft} style={buttonStyle}>
          <Trash2 aria-hidden="true" size={15} />
          {text.discard}
        </button>
      </div>
    </section>
  );
}

export const LENS_NEXT_CONFLICT_REVIEW_VIEW_INVARIANTS = Object.freeze({
  minimumWidthPx: 280,
  maximumBoundValueCharacters: 160,
  automaticResolutionAllowed: false as const,
  acceptMergeOverwriteControlsAllowed: false as const,
  sendBehavior: false as const,
  networkBehavior: false as const,
  storageBehavior: false as const,
  writeBehavior: false as const,
  visualMutationAllowed: false as const,
});
