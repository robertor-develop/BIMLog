import { useCallback, useState } from "react";
import { useAuthStore } from "@/store/auth";

type Translate = (en: string, es: string) => string;
type Runtime = {
  workItemId: string;
  templateCode: string;
  templateVersion: number;
  source: string;
  selection: string;
  status: string;
  phaseIndex: number;
  revision: number;
  canManage: boolean;
  fingerprint: string;
  definition: {
    phases: Array<{
      id: string;
      name: string;
      tasks: Array<{ id: string; name: string; requiredDocuments: string[] }>;
      completionRule: string;
      qcRequired: boolean;
      approvalRequired: boolean;
    }>;
    transitions: Array<{ gate: string; requiredDocuments: string[] }>;
    reopen: { role: "review" | "approve" };
  };
  roles: Array<{ role: string; userId: number }>;
  steps: Array<{ phaseId: string; taskId: string; status: string }>;
  evidence: Array<{
    id: string;
    phaseId: string;
    taskId: string;
    documentCode: string;
    fileId: number;
  }>;
  checks: Array<{
    phaseId: string;
    qcApprovedAt: string | null;
    approvedAt: string | null;
  }>;
  events: Array<{
    id: string;
    action: string;
    actorId: number;
    phaseId: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export function WorkItemDeliveryWorkflowPanel({
  projectId,
  workItemId,
  members,
  files,
  api,
  tt,
}: {
  projectId: number;
  workItemId: string;
  members: any[];
  files: any[];
  api: (path: string, init?: RequestInit) => Promise<any>;
  tt: Translate;
}) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [checkpointReason, setCheckpointReason] = useState("");
  const [reopenPhase, setReopenPhase] = useState("");
  const [fileId, setFileId] = useState("");
  const path = `/projects/${projectId}/operations/work-items/${workItemId}/delivery-workflow`;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRuntime(await api(path));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  }, [api, path]);
  const act = async (
    suffix: string,
    method: string,
    data: object,
    label: string,
  ) => {
    if (!runtime) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`${path}${suffix}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, expectedRevision: runtime.revision }),
      });
      await load();
      setNotice(label);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  const current = runtime?.definition.phases[runtime.phaseIndex - 1];
  const role = (name: string) =>
    runtime?.roles.find((entry) => entry.role === name)?.userId;
  const actor = Number(user?.id);
  const canExecute = actor === role("execute");
  const canReview = actor === role("review");
  const canApprove = actor === role("approve");
  const canReopen =
    runtime?.definition && actor === role(runtime.definition.reopen.role);
  const check = runtime?.checks.find((entry) => entry.phaseId === current?.id);
  return (
    <section
      style={{
        margin: "12px 0",
        border: "1px solid #bfdbfe",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        {open
          ? tt("Hide Delivery Workflow", "Ocultar flujo de entrega")
          : tt("Open Delivery Workflow", "Abrir flujo de entrega")}
      </button>
      {open && (
        <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            {tt("Refresh workflow", "Actualizar flujo")}
          </button>
          {loading && (
            <p role="status">{tt("Loading workflow…", "Cargando flujo…")}</p>
          )}
          {error && (
            <p role="alert" style={{ color: "#991b1b" }}>
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {runtime && (
            <>
              <div>
                <strong>
                  {runtime.templateCode} · v{runtime.templateVersion}
                </strong>{" "}
                ·{" "}
                {runtime.source === "bimlog"
                  ? "BIMLog"
                  : tt("Company", "Empresa")}{" "}
                · {runtime.status} ·{" "}
                {tt(
                  "Frozen activation snapshot",
                  "Instantánea congelada de activación",
                )}{" "}
                {runtime.fingerprint.slice(0, 16)}
              </div>
              <p>
                {runtime.definition.phases
                  .map((phase, index) => `${index + 1}. ${phase.name}`)
                  .join(" → ")}
              </p>
              {runtime.canManage && (
                <fieldset style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <legend>
                    {tt("Role assignments", "Asignaciones de funciones")}
                  </legend>
                  {(["execute", "review", "approve"] as const).map((name) => (
                    <label key={name}>
                      {name}
                      <select
                        disabled={busy}
                        value={role(name) ?? ""}
                        onChange={(event) =>
                          void act(
                            `/roles/${name}`,
                            "PATCH",
                            { userId: Number(event.target.value) },
                            tt(
                              "Role assigned with history.",
                              "Función asignada con historial.",
                            ),
                          )
                        }
                      >
                        <option value="">
                          {tt("Unassigned", "Sin asignar")}
                        </option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName || member.email}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </fieldset>
              )}
              {current && (
                <fieldset style={{ minWidth: 0, display: "grid", gap: 10 }}>
                  <legend>
                    {tt("Current phase", "Fase actual")}: {current.name} (
                    {runtime.phaseIndex}/{runtime.definition.phases.length})
                  </legend>
                  {current.tasks.map((task) => {
                    const step = runtime.steps.find(
                      (entry) =>
                        entry.phaseId === current.id &&
                        entry.taskId === task.id,
                    );
                    return (
                      <div
                        key={task.id}
                        style={{
                          borderTop: "1px solid #e2e8f0",
                          paddingTop: 8,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <strong>
                          {task.name} · {step?.status}
                        </strong>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <button
                            type="button"
                            disabled={
                              busy ||
                              !canExecute ||
                              step?.status === "complete" ||
                              runtime.status !== "active"
                            }
                            onClick={() =>
                              void act(
                                `/steps/${current.id}/${task.id}`,
                                "PATCH",
                                { status: "complete" },
                                tt(
                                  "Checkpoint completed.",
                                  "Punto de control completado.",
                                ),
                              )
                            }
                          >
                            {tt(
                              "Complete checkpoint",
                              "Completar punto de control",
                            )}
                          </button>
                          {task.requiredDocuments.map((code) => (
                            <label key={code}>
                              {tt("Required evidence", "Evidencia requerida")}:{" "}
                              {code}{" "}
                              <select
                                value={fileId}
                                onChange={(event) =>
                                  setFileId(event.target.value)
                                }
                                disabled={busy || !canExecute}
                              >
                                <option value="">
                                  {tt(
                                    "Choose project file",
                                    "Seleccione archivo del proyecto",
                                  )}
                                </option>
                                {files.map((file) => (
                                  <option key={file.id} value={file.id}>
                                    {file.fileName}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={!fileId || busy || !canExecute}
                                onClick={() =>
                                  void act(
                                    "/evidence",
                                    "POST",
                                    {
                                      phaseId: current.id,
                                      taskId: task.id,
                                      documentCode: code,
                                      fileId: Number(fileId),
                                    },
                                    tt(
                                      "Evidence linked.",
                                      "Evidencia vinculada.",
                                    ),
                                  )
                                }
                              >
                                {tt("Link", "Vincular")}
                              </button>
                              <small>
                                {
                                  runtime.evidence.filter(
                                    (entry) =>
                                      entry.phaseId === current.id &&
                                      entry.taskId === task.id &&
                                      entry.documentCode === code,
                                  ).length
                                }{" "}
                                {tt("linked", "vinculados")}
                              </small>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {runtime.status === "active" &&
                    canReopen &&
                    current.tasks.some(
                      (task) =>
                        runtime.steps.find(
                          (step) =>
                            step.phaseId === current.id &&
                            step.taskId === task.id,
                        )?.status === "complete",
                    ) && (
                      <div style={{ display: "grid", gap: 6 }}>
                        <label>
                          {tt(
                            "Reason to reopen a completed checkpoint",
                            "Motivo para reabrir un punto de control",
                          )}
                          <input
                            value={checkpointReason}
                            onChange={(event) =>
                              setCheckpointReason(event.target.value)
                            }
                          />
                        </label>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          {current.tasks
                            .filter(
                              (task) =>
                                runtime.steps.find(
                                  (step) =>
                                    step.phaseId === current.id &&
                                    step.taskId === task.id,
                                )?.status === "complete",
                            )
                            .map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                disabled={busy || !checkpointReason.trim()}
                                onClick={() =>
                                  void act(
                                    `/steps/${current.id}/${task.id}`,
                                    "PATCH",
                                    {
                                      status: "pending",
                                      reason: checkpointReason,
                                    },
                                    tt(
                                      "Checkpoint reopened with history.",
                                      "Punto de control reabierto con historial.",
                                    ),
                                  )
                                }
                              >
                                {tt("Reopen", "Reabrir")}: {task.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  {(
                    runtime.definition.transitions[runtime.phaseIndex - 1]
                      ?.requiredDocuments ?? []
                  ).map((code) => (
                    <label key={code}>
                      {tt(
                        "Required phase evidence",
                        "Evidencia requerida de fase",
                      )}
                      : {code}
                      <select
                        value={fileId}
                        onChange={(event) => setFileId(event.target.value)}
                        disabled={busy || !canExecute}
                      >
                        <option value="">
                          {tt(
                            "Choose project file",
                            "Seleccione archivo del proyecto",
                          )}
                        </option>
                        {files.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.fileName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!fileId || busy || !canExecute}
                        onClick={() =>
                          void act(
                            "/evidence",
                            "POST",
                            {
                              phaseId: current.id,
                              taskId: current.tasks[0].id,
                              documentCode: code,
                              fileId: Number(fileId),
                            },
                            tt(
                              "Phase evidence linked.",
                              "Evidencia de fase vinculada.",
                            ),
                          )
                        }
                      >
                        {tt("Link", "Vincular")}
                      </button>
                      <small>
                        {
                          runtime.evidence.filter(
                            (entry) =>
                              entry.phaseId === current.id &&
                              entry.documentCode === code,
                          ).length
                        }{" "}
                        {tt("linked", "vinculados")}
                      </small>
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(current.qcRequired ||
                      current.completionRule === "all_tasks_reviewed") && (
                      <button
                        type="button"
                        disabled={busy || !canReview || !!check?.qcApprovedAt}
                        onClick={() =>
                          void act(
                            "/qc",
                            "POST",
                            {},
                            tt("QC approved.", "Control de calidad aprobado."),
                          )
                        }
                      >
                        {tt("Approve QC", "Aprobar control de calidad")}
                      </button>
                    )}
                    {current.approvalRequired && (
                      <button
                        type="button"
                        disabled={busy || !canApprove || !!check?.approvedAt}
                        onClick={() =>
                          void act(
                            "/approval",
                            "POST",
                            {},
                            tt("Phase approved.", "Fase aprobada."),
                          )
                        }
                      >
                        {tt("Approve phase", "Aprobar fase")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={
                        busy || !canApprove || runtime.status !== "active"
                      }
                      onClick={() =>
                        void act(
                          "/advance",
                          "POST",
                          {},
                          tt("Workflow advanced.", "Flujo avanzado."),
                        )
                      }
                    >
                      {runtime.phaseIndex === runtime.definition.phases.length
                        ? tt("Complete workflow", "Completar flujo")
                        : tt("Advance phase", "Avanzar fase")}
                    </button>
                  </div>
                </fieldset>
              )}
              {canReopen && (
                <fieldset style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <legend>
                    {tt("Controlled reopening", "Reapertura controlada")}
                  </legend>
                  <select
                    value={reopenPhase}
                    onChange={(event) => setReopenPhase(event.target.value)}
                  >
                    <option value="">
                      {tt("Choose earlier phase", "Seleccione fase anterior")}
                    </option>
                    {runtime.definition.phases
                      .slice(
                        0,
                        runtime.status === "complete"
                          ? runtime.definition.phases.length
                          : runtime.phaseIndex - 1,
                      )
                      .map((phase) => (
                        <option key={phase.id} value={phase.id}>
                          {phase.name}
                        </option>
                      ))}
                  </select>
                  <input
                    aria-label={tt(
                      "Reason for reopening",
                      "Motivo de reapertura",
                    )}
                    value={reopenReason}
                    onChange={(event) => setReopenReason(event.target.value)}
                    placeholder={tt("Required reason", "Motivo obligatorio")}
                  />
                  <button
                    type="button"
                    disabled={busy || !reopenPhase || !reopenReason.trim()}
                    onClick={() =>
                      void act(
                        "/reopen",
                        "POST",
                        { targetPhaseId: reopenPhase, reason: reopenReason },
                        tt(
                          "Phase reopened; audit history preserved.",
                          "Fase reabierta; historial conservado.",
                        ),
                      )
                    }
                  >
                    {tt("Reopen", "Reabrir")}
                  </button>
                </fieldset>
              )}
              <details>
                <summary>
                  {tt("Transition history", "Historial de transiciones")} (
                  {runtime.events.length})
                </summary>
                {runtime.events.map((event) => (
                  <p key={event.id}>
                    {event.createdAt} · {event.action} · {event.phaseId || "—"}{" "}
                    · {event.reason || ""}
                  </p>
                ))}
              </details>
            </>
          )}
        </div>
      )}
    </section>
  );
}
