import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import type { ActionItem } from "./CoordinatorCommandCenter";

type Meeting = {
  id: number;
  title: string;
  meetingDate: string;
  updatedAt: string;
  scheduleBuckets?: Array<{
    id: number;
    bucketId: number;
    bucketName: string;
  }>;
};

type Outcome = {
  sourceModule: ActionItem["sourceModule"];
  sourceId: number;
  outcome:
    | "added"
    | "already_linked"
    | "updated"
    | "unsupported"
    | "unauthorized"
    | "stale"
    | "failed";
  reason: string;
  meetingLinkId: number | null;
  meetingLinkPath: string | null;
};

type MeetingResult = {
  preview: boolean;
  idempotent: boolean;
  outcomes: Outcome[];
  summary: Record<Outcome["outcome"], number>;
};

type SchedulePreview = {
  summary: {
    selected: number;
    create: number;
    link: number;
    update: number;
    skipped: number;
    conflicts: number;
  };
  rows: Array<{
    meetingSubmittalLinkId: number;
    submittalId: number;
    number: string;
    title: string;
    action: string;
  }>;
};

const outcomeLabel = (
  outcome: Outcome["outcome"],
  tr: (en: string, es: string) => string,
) =>
  ({
    added: tr("Added", "Agregado"),
    already_linked: tr("Already linked", "Ya vinculado"),
    updated: tr("Updated", "Actualizado"),
    unsupported: tr("Unsupported", "No compatible"),
    unauthorized: tr("Unauthorized", "No autorizado"),
    stale: tr("Stale", "Desactualizado"),
    failed: tr("Failed", "Falló"),
  })[outcome];

export function CoordinatorBulkActions({
  projectId,
  selected,
  onClear,
  onRefresh,
  lang,
}: {
  projectId: number;
  selected: ActionItem[];
  onClear: () => void;
  onRefresh: () => void;
  lang: "en" | "es";
}) {
  const { token } = useAuthStore();
  const tr = (en: string, es: string) => (lang === "es" ? es : en);
  const [open, setOpen] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingId, setMeetingId] = useState("");
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<MeetingResult | null>(null);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [operationKey, setOperationKey] = useState("");
  const [schedulePreview, setSchedulePreview] =
    useState<SchedulePreview | null>(null);
  const [scheduleResult, setScheduleResult] = useState<Record<string, any> | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [scheduleDeadline, setScheduleDeadline] = useState("");
  const [scheduleBucketName, setScheduleBucketName] = useState("");
  const [scheduleMode, setScheduleMode] = useState("create");
  const [scheduleKey, setScheduleKey] = useState("");

  const selectedMeeting = meetings.find(
    (meeting) => String(meeting.id) === meetingId,
  );
  const selectedLinkIds = useMemo(
    () =>
      (result?.outcomes ?? [])
        .filter(
          (row) =>
            row.sourceModule === "submittal" &&
            ["added", "already_linked"].includes(row.outcome) &&
            row.meetingLinkId,
        )
        .map((row) => row.meetingLinkId as number),
    [result],
  );

  const resetFlow = () => {
    setError("");
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setOperationKey(window.crypto.randomUUID());
    setSchedulePreview(null);
    setScheduleResult(null);
    setScheduleError("");
    setScheduleConfirmed(false);
    setScheduleMode("create");
    setScheduleKey(window.crypto.randomUUID());
  };

  const loadMeetings = async () => {
    if (!token) return;
    setLoadingMeetings(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/meetings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body.message || tr("Meetings could not be loaded.", "No se pudieron cargar las reuniones."),
        );
      const rows = (Array.isArray(body) ? body : []) as Meeting[];
      setMeetings(rows);
      setMeetingId((current) => current || String(rows[0]?.id ?? ""));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : tr("Meetings could not be loaded.", "No se pudieron cargar las reuniones."),
      );
    } finally {
      setLoadingMeetings(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    resetFlow();
    void loadMeetings();
  }, [open, projectId]);

  useEffect(() => {
    if (!selectedMeeting) return;
    const date = new Date(selectedMeeting.meetingDate);
    setScheduleDeadline(
      Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10),
    );
    setScheduleBucketName(
      `${tr("Meeting Follow-Up", "Seguimiento de Reunión")} – ${date.toLocaleDateString(
        lang === "es" ? "es-US" : "en-US",
      )}`,
    );
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    setSchedulePreview(null);
    setScheduleResult(null);
    setScheduleKey(window.crypto.randomUUID());
  }, [meetingId]);

  const meetingPayload = (execute: boolean) => ({
    meetingId: selectedMeeting?.id,
    expectedMeetingUpdatedAt: selectedMeeting
      ? new Date(selectedMeeting.updatedAt).toISOString()
      : "",
    items: selected.map((item) => ({
      sourceModule: item.sourceModule,
      sourceId: item.sourceId,
      sourceUpdatedAt: item.sourceUpdatedAt,
    })),
    ...(execute
      ? { confirmed: true, idempotencyKey: operationKey }
      : {}),
  });

  const runMeetingLinks = async (execute: boolean) => {
    if (!token || !selectedMeeting) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/coordinator-actions/meeting-links/${
          execute ? "execute" : "preview"
        }`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(meetingPayload(execute)),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          (lang === "es" ? body.messageEs : body.message) ||
            tr("The controlled action failed.", "La acción controlada falló."),
        );
      if (execute) {
        setResult(body as MeetingResult);
        setPreview(body as MeetingResult);
        onRefresh();
      } else {
        setPreview(body as MeetingResult);
        setConfirmed(false);
      }
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : tr("The controlled action failed.", "La acción controlada falló."),
      );
    } finally {
      setBusy(false);
    }
  };

  const schedulePayload = (execute: boolean) => ({
    idempotency_key: execute ? scheduleKey : undefined,
    bucket_name: scheduleBucketName,
    general_deadline: scheduleDeadline,
    include_mode: "selected",
    selected_meeting_submittal_link_ids: selectedLinkIds,
    create_missing_tasks: true,
    link_existing_tasks: true,
    update_existing_tasks: false,
  });

  const runSchedule = async (execute: boolean) => {
    if (!token || !selectedMeeting || !selectedLinkIds.length) return;
    setScheduleBusy(true);
    setScheduleError("");
    try {
      const syncLink = selectedMeeting.scheduleBuckets?.find(
        (bucket) => String(bucket.id) === scheduleMode,
      );
      const path = execute
        ? syncLink
          ? `/api/v1/projects/${projectId}/meetings/${selectedMeeting.id}/schedule-bucket/${syncLink.id}/sync`
          : `/api/v1/projects/${projectId}/meetings/${selectedMeeting.id}/schedule-bucket`
        : `/api/v1/projects/${projectId}/meetings/${selectedMeeting.id}/schedule-bucket/preview`;
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(schedulePayload(execute && !syncLink)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body.message ||
            tr("The M4 Schedule action failed.", "La acción de Cronograma M4 falló."),
        );
      if (execute) {
        setScheduleResult(body);
        setScheduleConfirmed(false);
        onRefresh();
      } else {
        setSchedulePreview(body as SchedulePreview);
        setScheduleConfirmed(false);
      }
    } catch (runError) {
      setScheduleError(
        runError instanceof Error
          ? runError.message
          : tr("The M4 Schedule action failed.", "La acción de Cronograma M4 falló."),
      );
    } finally {
      setScheduleBusy(false);
    }
  };

  return (
    <>
      <div className="ccc-bulk-bar" aria-live="polite">
        <div>
          <strong>
            {selected.length} {tr("selected", "seleccionados")}
          </strong>
          <span>
            {tr(
              "Controlled Meeting and Schedule actions; originals stay authoritative.",
              "Acciones controladas de Reunión y Cronograma; los originales mantienen la autoridad.",
            )}
          </span>
        </div>
        <div>
          <button type="button" onClick={onClear}>
            {tr("Clear", "Limpiar")}
          </button>
          <button
            type="button"
            className="ccc-bulk-primary"
            disabled={!selected.length}
            onClick={() => setOpen(true)}
          >
            <CalendarPlus size={14} /> {tr("Bulk actions", "Acciones masivas")}
          </button>
        </div>
      </div>

      {open && (
        <div className="ccc-bulk-overlay" role="presentation">
          <section
            className="ccc-bulk-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ccc-bulk-title"
          >
            <header>
              <div>
                <h2 id="ccc-bulk-title">
                  {tr("Controlled bulk actions", "Acciones masivas controladas")}
                </h2>
                <p>
                  {tr(
                    "Preview exact per-item outcomes, confirm Meeting links, then optionally use the accepted M4 Schedule workflow.",
                    "Revise los resultados exactos por elemento, confirme los vínculos de Reunión y luego use opcionalmente el flujo aceptado M4 del Cronograma.",
                  )}
                </p>
              </div>
              <button
                type="button"
                className="ccc-bulk-close"
                aria-label={tr("Close", "Cerrar")}
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="ccc-bulk-content">
              <section className="ccc-bulk-step">
                <h3>1. {tr("Canonical Meeting links", "Vínculos canónicos de Reunión")}</h3>
                <label>
                  <span>{tr("Existing accessible Meeting", "Reunión existente accesible")}</span>
                  <select
                    value={meetingId}
                    disabled={loadingMeetings || !!result}
                    onChange={(event) => setMeetingId(event.target.value)}
                  >
                    {!meetings.length && <option value="">{tr("No Meetings available", "No hay reuniones disponibles")}</option>}
                    {meetings.map((meeting) => (
                      <option key={meeting.id} value={meeting.id}>
                        {meeting.title} · {new Date(meeting.meetingDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </label>
                {error && (
                  <div className="ccc-bulk-error" role="alert">
                    <AlertTriangle size={15} /> <span>{error}</span>
                    <button type="button" onClick={() => (preview ? void runMeetingLinks(false) : void loadMeetings())}>
                      <RefreshCw size={12} /> {tr("Retry", "Reintentar")}
                    </button>
                  </div>
                )}
                {preview && (
                  <div className="ccc-bulk-outcomes">
                    {preview.outcomes.map((row) => {
                      const item = selected.find(
                        (entry) =>
                          entry.sourceModule === row.sourceModule &&
                          entry.sourceId === row.sourceId,
                      );
                      return (
                        <div key={`${row.sourceModule}:${row.sourceId}`}>
                          <span className={`ccc-bulk-result ccc-bulk-result-${row.outcome}`}>
                            {outcomeLabel(row.outcome, tr)}
                          </span>
                          <strong>{item?.displayIdentifier ?? row.sourceId}</strong>
                          <small>{row.reason}</small>
                          {row.meetingLinkPath && result && (
                            <a href={row.meetingLinkPath}>
                              <ExternalLink size={11} /> {tr("Open Meeting", "Abrir Reunión")}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!result && preview && (
                  <label className="ccc-bulk-confirm">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    <span>
                      {tr(
                        "I confirm adding only the supported canonical RFI/Submittal Meeting links shown above.",
                        "Confirmo agregar solo los vínculos canónicos compatibles de RFI/Submittal mostrados arriba.",
                      )}
                    </span>
                  </label>
                )}
                <div className="ccc-bulk-buttons">
                  {!result && (
                    <button
                      type="button"
                      disabled={busy || !selectedMeeting}
                      onClick={() => void runMeetingLinks(false)}
                    >
                      {busy ? tr("Working…", "Procesando…") : tr("Preview outcomes", "Revisar resultados")}
                    </button>
                  )}
                  {!result && preview && (
                    <button
                      type="button"
                      className="ccc-bulk-primary"
                      disabled={busy || !confirmed}
                      onClick={() => void runMeetingLinks(true)}
                    >
                      {tr("Confirm Meeting links", "Confirmar vínculos de Reunión")}
                    </button>
                  )}
                  {result && (
                    <span className="ccc-bulk-success">
                      <CheckCircle2 size={15} /> {tr("Meeting-link operation recorded", "Operación de vínculos registrada")}
                    </span>
                  )}
                </div>
              </section>

              {result && selectedLinkIds.length > 0 && (
                <section className="ccc-bulk-step">
                  <h3>2. {tr("Accepted M4 Schedule workflow", "Flujo aceptado M4 del Cronograma")}</h3>
                  <p>
                    {tr(
                      "Only the selected, meeting-linked Submittals below are eligible. M4 rechecks canonical tasks and reports create, link, update, skip, or conflict counts.",
                      "Solo los Submittals seleccionados y vinculados a la Reunión son elegibles. M4 vuelve a verificar las tareas canónicas e informa conteos de crear, vincular, actualizar, omitir o conflicto.",
                    )}
                  </p>
                  <div className="ccc-bulk-grid">
                    <label>
                      <span>{tr("Action", "Acción")}</span>
                      <select value={scheduleMode} onChange={(event) => { setScheduleMode(event.target.value); setSchedulePreview(null); setScheduleResult(null); }}>
                        <option value="create">{tr("Create/link Schedule bucket", "Crear/vincular grupo del Cronograma")}</option>
                        {(selectedMeeting?.scheduleBuckets ?? []).map((bucket) => (
                          <option key={bucket.id} value={bucket.id}>
                            {tr("Sync", "Sincronizar")}: {bucket.bucketName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{tr("General deadline", "Fecha límite general")}</span>
                      <input type="date" value={scheduleDeadline} onChange={(event) => { setScheduleDeadline(event.target.value); setSchedulePreview(null); }} />
                    </label>
                    {scheduleMode === "create" && (
                      <label>
                        <span>{tr("Bucket name", "Nombre del grupo")}</span>
                        <input value={scheduleBucketName} maxLength={120} onChange={(event) => { setScheduleBucketName(event.target.value); setSchedulePreview(null); }} />
                      </label>
                    )}
                  </div>
                  {scheduleError && (
                    <div className="ccc-bulk-error" role="alert">
                      <AlertTriangle size={15} /> <span>{scheduleError}</span>
                      <button type="button" onClick={() => void runSchedule(false)}>
                        <RefreshCw size={12} /> {tr("Retry", "Reintentar")}
                      </button>
                    </div>
                  )}
                  {schedulePreview && (
                    <div className="ccc-bulk-schedule-preview">
                      <strong>{schedulePreview.summary.selected} {tr("selected", "seleccionados")}</strong>
                      <span>{schedulePreview.summary.create} {tr("new", "nuevas")}</span>
                      <span>{schedulePreview.summary.link} {tr("linked", "vinculadas")}</span>
                      <span>{schedulePreview.summary.update} {tr("updated", "actualizadas")}</span>
                      <span>{schedulePreview.summary.skipped} {tr("existing", "existentes")}</span>
                      <span>{schedulePreview.summary.conflicts} {tr("conflicts", "conflictos")}</span>
                    </div>
                  )}
                  {schedulePreview && !scheduleResult && (
                    <label className="ccc-bulk-confirm">
                      <input type="checkbox" checked={scheduleConfirmed} onChange={(event) => setScheduleConfirmed(event.target.checked)} />
                      <span>{tr("I confirm the exact M4 Schedule actions in this preview.", "Confirmo las acciones exactas M4 del Cronograma en esta vista previa.")}</span>
                    </label>
                  )}
                  <div className="ccc-bulk-buttons">
                    {!scheduleResult && (
                      <button type="button" disabled={scheduleBusy || !scheduleDeadline} onClick={() => void runSchedule(false)}>
                        {scheduleBusy ? tr("Working…", "Procesando…") : tr("Preview M4 counts", "Revisar conteos M4")}
                      </button>
                    )}
                    {schedulePreview && !scheduleResult && (
                      <button type="button" className="ccc-bulk-primary" disabled={scheduleBusy || !scheduleConfirmed} onClick={() => void runSchedule(true)}>
                        {scheduleMode === "create" ? tr("Confirm Schedule action", "Confirmar acción del Cronograma") : tr("Confirm sync", "Confirmar sincronización")}
                      </button>
                    )}
                    {scheduleResult && (
                      <span className="ccc-bulk-success">
                        <CheckCircle2 size={15} /> {tr("M4 Schedule operation completed", "Operación M4 del Cronograma completada")}
                      </span>
                    )}
                  </div>
                </section>
              )}

              {result && selectedLinkIds.length === 0 && (
                <div className="ccc-bulk-note">
                  {tr(
                    "No selected Submittal has an eligible canonical Meeting link, so Schedule actions remain unavailable.",
                    "Ningún Submittal seleccionado tiene un vínculo canónico elegible con la Reunión, por lo que las acciones del Cronograma no están disponibles.",
                  )}
                </div>
              )}
            </div>
            <footer>
              <button type="button" onClick={() => { setOpen(false); if (result) onClear(); }}>
                {tr("Close", "Cerrar")}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
