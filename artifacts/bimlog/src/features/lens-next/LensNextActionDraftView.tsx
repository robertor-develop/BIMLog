import {
  AlertTriangle,
  CheckCircle2,
  MessageSquareText,
  Save,
  ShieldAlert,
  UserRoundCog,
  WifiOff,
  X,
} from "lucide-react";
import React from "react";
import type { CSSProperties } from "react";
import type {
  LensNextDraftStatus,
  LensNextActionDraftDecision,
} from "./lens-next-action-draft";
import type {
  LensNextPhase2Action,
  LensNextPhase2CapabilityDecision,
} from "./lens-next-phase2-capability";

export type LensNextActionDraftViewLocale = "en" | "es";
export type LensNextActionDraftViewState =
  | "valid"
  | "invalid"
  | "confirmation_required"
  | "executor_unbound"
  | "offline"
  | "conflict";

export interface LensNextAssignmentOption {
  id: string;
  label: string;
}

export interface LensNextActionDraftViewProps {
  action: LensNextPhase2Action;
  locale?: LensNextActionDraftViewLocale;
  viewState: LensNextActionDraftViewState;
  identity: {
    projectId: number;
    issueFamilyId: string;
    serverId: number;
    viewpointId: string;
    revisionNumber: number;
  };
  preconditions: {
    expectedStatus: LensNextDraftStatus;
    expectedVersion: number;
    expectedRevisionNumber: number;
  };
  capability: Pick<
    LensNextPhase2CapabilityDecision,
    | "contractReady"
    | "dispatchAllowed"
    | "mutationAllowed"
    | "serverExecutorBound"
  >;
  decision?: LensNextActionDraftDecision | null;
  statusValue?: LensNextDraftStatus;
  commentValue?: string;
  assigneeUserId?: string;
  responsibleCompanyId?: string;
  assignmentOptions?: readonly LensNextAssignmentOption[];
  companyOptions?: readonly LensNextAssignmentOption[];
  reasonValue?: string;
  onStatusChange?: (value: LensNextDraftStatus) => void;
  onCommentChange?: (value: string) => void;
  onAssigneeChange?: (value: string) => void;
  onCompanyChange?: (value: string) => void;
  onReasonChange?: (value: string) => void;
  onCreateDraft?: () => void;
  onConfirmDraft?: () => void;
  onCancelDraft?: () => void;
  className?: string;
}

const STATUSES: LensNextDraftStatus[] = [
  "open",
  "follow_up",
  "waiting_design",
  "approved",
  "resolved",
];
const MAX_OPTIONS = 100;

const COPY = {
  en: {
    title: "Prepare issue action",
    status: "Status",
    comment: "Comment",
    assignment: "Assignment",
    nextStatus: "Next status",
    commentBody: "Comment text",
    assignee: "Assignee",
    company: "Responsible company",
    reason: "Confirmation reason",
    create: "Create request draft",
    confirm: "Confirm request draft",
    cancel: "Cancel draft",
    identity: "Immutable identity",
    preconditions: "Expected server preconditions",
    capability: "Capability summary",
    contractReady: "Contract ready",
    executor: "Server executor bound",
    dispatch: "Draft dispatch eligible",
    mutation: "UI mutation authority",
    false: "False",
    true: "True",
    authority: "Authority granted: False",
    production: "Production write allowed: False",
    noSend:
      "This form creates and confirms drafts only. It never sends a request.",
    states: {
      valid: "The draft fields are valid and may be confirmed locally.",
      invalid: "The draft contains invalid or incomplete fields.",
      confirmation_required:
        "Explicit confirmation is required before the draft can leave this form.",
      executor_unbound:
        "No current server executor receipt is bound. The draft remains blocked.",
      offline: "Offline. The draft may remain in memory but cannot be sent.",
      conflict:
        "A stale or conflicting precondition was detected. Nothing was resolved automatically.",
    },
  },
  es: {
    title: "Preparar acción del asunto",
    status: "Estado",
    comment: "Comentario",
    assignment: "Asignación",
    nextStatus: "Estado siguiente",
    commentBody: "Texto del comentario",
    assignee: "Responsable",
    company: "Empresa responsable",
    reason: "Motivo de confirmación",
    create: "Crear borrador de solicitud",
    confirm: "Confirmar borrador de solicitud",
    cancel: "Cancelar borrador",
    identity: "Identidad inmutable",
    preconditions: "Precondiciones esperadas del servidor",
    capability: "Resumen de capacidad",
    contractReady: "Contrato listo",
    executor: "Ejecutor del servidor vinculado",
    dispatch: "Borrador apto para envío posterior",
    mutation: "Autoridad de mutación de la interfaz",
    false: "Falso",
    true: "Verdadero",
    authority: "Autoridad concedida: Falso",
    production: "Escritura en producción permitida: Falso",
    noSend:
      "Este formulario solo crea y confirma borradores. Nunca envía una solicitud.",
    states: {
      valid:
        "Los campos son válidos y el borrador puede confirmarse localmente.",
      invalid: "El borrador contiene campos no válidos o incompletos.",
      confirmation_required:
        "Se requiere confirmación explícita antes de que el borrador salga de este formulario.",
      executor_unbound:
        "No hay un recibo vigente del ejecutor del servidor. El borrador permanece bloqueado.",
      offline:
        "Sin conexión. El borrador puede permanecer en memoria, pero no puede enviarse.",
      conflict:
        "Se detectó una precondición desactualizada o conflictiva. Nada se resolvió automáticamente.",
    },
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
const controlStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: "2.25rem",
  padding: "0.375rem 0.5rem",
  font: "inherit",
};
const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.25rem",
  minHeight: "2.25rem",
  padding: "0.375rem 0.625rem",
  border: "1px solid currentColor",
  borderRadius: "0.5rem",
  background: "transparent",
  color: "inherit",
  font: "inherit",
};

function stateIcon(state: LensNextActionDraftViewState) {
  const props = { size: 18, "aria-hidden": true as const };
  if (state === "valid") return <CheckCircle2 {...props} />;
  if (state === "offline") return <WifiOff {...props} />;
  if (state === "executor_unbound") return <ShieldAlert {...props} />;
  return <AlertTriangle {...props} />;
}

export function LensNextActionDraftView({
  action,
  locale = "en",
  viewState,
  identity,
  preconditions,
  capability,
  decision,
  statusValue = "open",
  commentValue = "",
  assigneeUserId = "",
  responsibleCompanyId = "",
  assignmentOptions = [],
  companyOptions = [],
  reasonValue = "",
  onStatusChange,
  onCommentChange,
  onAssigneeChange,
  onCompanyChange,
  onReasonChange,
  onCreateDraft,
  onConfirmDraft,
  onCancelDraft,
  className,
}: LensNextActionDraftViewProps) {
  const copy = COPY[locale];
  const urgent = ["invalid", "executor_unbound", "conflict"].includes(
    viewState,
  );
  const actionLabel = copy[action];
  const assignees = assignmentOptions.slice(0, MAX_OPTIONS);
  const companies = companyOptions.slice(0, MAX_OPTIONS);
  const confirmedDraft = decision?.ok === true;

  return (
    <section
      className={className}
      aria-labelledby="lens-next-draft-heading"
      data-draft-action={action}
      data-draft-view-state={viewState}
      data-responsive-contract="mobile-280px-single-column"
      style={shellStyle}
    >
      <h2 id="lens-next-draft-heading" style={{ margin: 0, fontSize: "1rem" }}>
        {copy.title}: {actionLabel}
      </h2>
      <p
        role={urgent ? "alert" : "status"}
        aria-live={urgent ? "assertive" : "polite"}
        aria-atomic="true"
        style={{ display: "flex", gap: "0.5rem" }}
      >
        {stateIcon(viewState)}
        <span>
          {copy.states[viewState]} {copy.noSend}
        </span>
      </p>

      <fieldset>
        <legend>{actionLabel}</legend>
        {action === "status" && (
          <label>
            {copy.nextStatus}
            <select
              value={statusValue}
              onChange={(event) =>
                onStatusChange?.(event.target.value as LensNextDraftStatus)
              }
              style={controlStyle}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        )}
        {action === "comment" && (
          <label>
            {copy.commentBody}
            <textarea
              value={commentValue}
              maxLength={4000}
              rows={5}
              onChange={(event) => onCommentChange?.(event.target.value)}
              style={controlStyle}
            />
          </label>
        )}
        {action === "assignment" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
              gap: "0.625rem",
            }}
          >
            <label>
              {copy.assignee}
              <select
                value={assigneeUserId}
                onChange={(event) => onAssigneeChange?.(event.target.value)}
                style={controlStyle}
              >
                <option value="">—</option>
                {assignees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.company}
              <select
                value={responsibleCompanyId}
                onChange={(event) => onCompanyChange?.(event.target.value)}
                style={controlStyle}
              >
                <option value="">—</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {(action === "status" || action === "assignment") && (
          <label>
            {copy.reason}
            <textarea
              value={reasonValue}
              maxLength={500}
              rows={3}
              required
              onChange={(event) => onReasonChange?.(event.target.value)}
              style={controlStyle}
            />
          </label>
        )}
      </fieldset>

      <dl>
        <div>
          <dt>{copy.identity}</dt>
          <dd>
            {identity.projectId}:{identity.issueFamilyId}:{identity.serverId}:
            {identity.viewpointId}:{identity.revisionNumber}
          </dd>
        </div>
        <div>
          <dt>{copy.preconditions}</dt>
          <dd>
            {preconditions.expectedStatus}:{preconditions.expectedVersion}:
            {preconditions.expectedRevisionNumber}
          </dd>
        </div>
        <div>
          <dt>{copy.capability}</dt>
          <dd>
            {copy.contractReady}:{" "}
            {capability.contractReady ? copy.true : copy.false}; {copy.executor}
            : {capability.serverExecutorBound ? copy.true : copy.false};{" "}
            {copy.dispatch}:{" "}
            {capability.dispatchAllowed ? copy.true : copy.false};{" "}
            {copy.mutation}: {copy.false}
          </dd>
        </div>
      </dl>
      <p>
        <strong>
          {copy.authority}. {copy.production}.
        </strong>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" onClick={onCreateDraft} style={buttonStyle}>
          <Save size={15} aria-hidden="true" />
          {copy.create}
        </button>
        <button
          type="button"
          onClick={onConfirmDraft}
          disabled={!confirmedDraft || viewState !== "valid"}
          style={buttonStyle}
        >
          {action === "comment" ? (
            <MessageSquareText size={15} aria-hidden="true" />
          ) : (
            <UserRoundCog size={15} aria-hidden="true" />
          )}
          {copy.confirm}
        </button>
        <button type="button" onClick={onCancelDraft} style={buttonStyle}>
          <X size={15} aria-hidden="true" />
          {copy.cancel}
        </button>
      </div>
    </section>
  );
}

export const LENS_NEXT_ACTION_DRAFT_VIEW_INVARIANTS = Object.freeze({
  maximumCommentCharacters: 4000,
  maximumReasonCharacters: 500,
  maximumAssignmentOptions: 100,
  minimumWidthPx: 280,
  dispatchBehavior: false,
  networkBehavior: false,
  storageBehavior: false,
  writeBehavior: false,
  authorityGranted: false,
  productionWriteAllowed: false,
  mutationAllowed: false,
});
