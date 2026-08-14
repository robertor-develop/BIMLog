import {
  Activity,
  CloudOff,
  FileWarning,
  Gauge,
  MessageSquareText,
  Workflow,
} from "lucide-react";
import React, { type ComponentProps, type CSSProperties } from "react";

import { LensNextActionDraftView } from "./LensNextActionDraftView";
import { LensNextActivityTimelineView } from "./LensNextActivityTimelineView";
import { LensNextConflictReviewView } from "./LensNextConflictReviewView";
import { LensNextConnectionTelemetryView } from "./LensNextConnectionTelemetryView";
import { LensNextOfflineQueueView } from "./LensNextOfflineQueueView";
import { LensNextWorkflowStateBanner } from "./LensNextWorkflowStateBanner";

export type LensNextPhase2WorkflowSection =
  | "connection"
  | "workflow"
  | "draft"
  | "activity"
  | "queue"
  | "conflict";

type WithShellLocale<T> = Omit<T, "locale">;

export interface LensNextPhase2WorkflowShellProps {
  locale: "en" | "es";
  activeSection: LensNextPhase2WorkflowSection;
  onSectionChange: (section: LensNextPhase2WorkflowSection) => void;
  identity: {
    projectId: number;
    issueFamilyId: string;
    serverId: number;
    viewpointId: string;
    revisionNumber: number;
    modelId: string;
    modelVersionFingerprint: string;
  };
  connection: WithShellLocale<
    ComponentProps<typeof LensNextConnectionTelemetryView>
  >;
  workflow: WithShellLocale<ComponentProps<typeof LensNextWorkflowStateBanner>>;
  draft: WithShellLocale<ComponentProps<typeof LensNextActionDraftView>>;
  activity: WithShellLocale<
    ComponentProps<typeof LensNextActivityTimelineView>
  >;
  queue: WithShellLocale<ComponentProps<typeof LensNextOfflineQueueView>>;
  conflict: WithShellLocale<ComponentProps<typeof LensNextConflictReviewView>>;
}

const sections: readonly LensNextPhase2WorkflowSection[] = [
  "connection",
  "workflow",
  "draft",
  "activity",
  "queue",
  "conflict",
];

const copy = {
  en: {
    heading: "Lens Next issue workflow",
    identity: "Immutable project, model, and issue identity",
    limits: "In-memory draft limit: 100. Read-only activity limit: 500.",
    section: {
      connection: "Connection",
      workflow: "Workflow state",
      draft: "Request draft",
      activity: "Activity",
      queue: "Offline drafts",
      conflict: "Conflict review",
    },
    invariant:
      "This shell presents read-only state and local request drafts only. It has no token display, network dispatch, storage, write, conflict resolution, or visual mutation behavior.",
  },
  es: {
    heading: "Flujo de asuntos de Lens Next",
    identity: "Identidad inmutable del proyecto, modelo y asunto",
    limits:
      "Límite de borradores en memoria: 100. Límite de actividad de solo lectura: 500.",
    section: {
      connection: "Conexión",
      workflow: "Estado del flujo",
      draft: "Borrador de solicitud",
      activity: "Actividad",
      queue: "Borradores sin conexión",
      conflict: "Revisión del conflicto",
    },
    invariant:
      "Este contenedor solo presenta estado de lectura y borradores locales. No muestra tokens ni realiza envíos de red, almacenamiento, escrituras, resolución de conflictos o cambios visuales.",
  },
} as const;

const shellStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  padding: "0.75rem",
  containerType: "inline-size",
};

const tabStyle: CSSProperties = {
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

function sectionIcon(section: LensNextPhase2WorkflowSection) {
  const props = { size: 15, "aria-hidden": true as const };
  if (section === "connection") return <Gauge {...props} />;
  if (section === "workflow") return <Workflow {...props} />;
  if (section === "draft") return <MessageSquareText {...props} />;
  if (section === "activity") return <Activity {...props} />;
  if (section === "queue") return <CloudOff {...props} />;
  return <FileWarning {...props} />;
}

function bounded(value: string, maximum = 160) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1)}…`;
}

export function LensNextPhase2WorkflowShell({
  locale,
  activeSection,
  onSectionChange,
  identity,
  connection,
  workflow,
  draft,
  activity,
  queue,
  conflict,
}: LensNextPhase2WorkflowShellProps) {
  const text = copy[locale];
  const panelId = `lens-next-phase2-${activeSection}-panel`;
  const activeTabId = `lens-next-phase2-${activeSection}-tab`;

  return (
    <section
      aria-labelledby="lens-next-phase2-workflow-heading"
      data-lens-next-phase2-shell
      data-active-section={activeSection}
      data-responsive-contract="mobile-280px-tab-wrap"
      style={shellStyle}
    >
      <h1 id="lens-next-phase2-workflow-heading">{text.heading}</h1>
      <dl aria-label={text.identity}>
        <div>
          <dt>{text.identity}</dt>
          <dd>
            {identity.projectId}:{identity.issueFamilyId}:{identity.serverId}:
            {bounded(identity.viewpointId)}:{identity.revisionNumber}
          </dd>
        </div>
        <div>
          <dt>{text.section.connection}</dt>
          <dd>
            {bounded(identity.modelId)} /{" "}
            {bounded(identity.modelVersionFingerprint, 64)}
          </dd>
        </div>
      </dl>
      <p>{text.limits}</p>
      <nav aria-label={text.heading}>
        <div
          role="tablist"
          aria-orientation="horizontal"
          style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}
        >
          {sections.map((section) => (
            <button
              key={section}
              id={`lens-next-phase2-${section}-tab`}
              type="button"
              role="tab"
              aria-selected={activeSection === section}
              aria-controls={`lens-next-phase2-${section}-panel`}
              tabIndex={activeSection === section ? 0 : -1}
              onClick={() => onSectionChange(section)}
              style={tabStyle}
            >
              {sectionIcon(section)}
              {text.section[section]}
            </button>
          ))}
        </div>
      </nav>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={activeTabId}
        tabIndex={0}
        data-phase2-section={activeSection}
        style={{ marginTop: "0.75rem", minWidth: 0 }}
      >
        {activeSection === "connection" && (
          <LensNextConnectionTelemetryView {...connection} locale={locale} />
        )}
        {activeSection === "workflow" && (
          <LensNextWorkflowStateBanner {...workflow} locale={locale} />
        )}
        {activeSection === "draft" && (
          <LensNextActionDraftView {...draft} locale={locale} />
        )}
        {activeSection === "activity" && (
          <LensNextActivityTimelineView {...activity} locale={locale} />
        )}
        {activeSection === "queue" && (
          <LensNextOfflineQueueView {...queue} locale={locale} />
        )}
        {activeSection === "conflict" && (
          <LensNextConflictReviewView {...conflict} locale={locale} />
        )}
      </div>
      <p>
        <strong>{text.invariant}</strong>
      </p>
    </section>
  );
}

export const LENS_NEXT_PHASE2_WORKFLOW_SHELL_INVARIANTS = Object.freeze({
  sections,
  minimumWidthPx: 280,
  maximumQueuedDrafts: 100,
  maximumActivityEvents: 500,
  tokenDisplayAllowed: false as const,
  nativeBridgeBehavior: false as const,
  networkBehavior: false as const,
  storageBehavior: false as const,
  writeBehavior: false as const,
  automaticConflictResolutionAllowed: false as const,
  visualMutationAllowed: false as const,
});
