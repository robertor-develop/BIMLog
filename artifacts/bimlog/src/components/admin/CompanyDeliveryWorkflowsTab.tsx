import { useCallback, useEffect, useState } from "react";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Task = {
  id: string;
  code: string;
  name: string;
  order: number;
  requiredDocuments: string[];
};
type Phase = {
  id: string;
  code: string;
  name: string;
  order: number;
  tasks: Task[];
  completionRule: "all_tasks_complete" | "all_tasks_reviewed";
  qcRequired: boolean;
  approvalRequired: boolean;
};
type Definition = {
  schemaVersion: 1;
  deliverableTypes: string[];
  roles: { execute: string; review: string; approve: string };
  phases: Phase[];
  transitions: Array<{
    from: string;
    to: string;
    gate: "tasks_complete" | "qc_approved" | "approval_granted";
    requiredDocuments: string[];
  }>;
  reopen: { role: "review" | "approve"; reasonRequired: true };
};
type Version = {
  templateId: string;
  code: string;
  name: string;
  versionId: string;
  version: number;
  state: string;
  revision: number;
  definition: Definition;
  fingerprint?: string;
  createdAt: string;
};
const starter = (type: string): Definition => ({
  schemaVersion: 1,
  deliverableTypes: [type],
  roles: { execute: "PRODUCER", review: "REVIEWER", approve: "APPROVER" },
  phases: [
    {
      id: "production",
      code: "PRODUCTION",
      name: "Production",
      order: 1,
      tasks: [
        {
          id: "produce",
          code: "PRODUCE",
          name: "Prepare deliverable",
          order: 1,
          requiredDocuments: [],
        },
      ],
      completionRule: "all_tasks_complete",
      qcRequired: false,
      approvalRequired: false,
    },
  ],
  transitions: [],
  reopen: { role: "approve", reasonRequired: true },
});
const reflow = (
  phases: Phase[],
  previous: Definition["transitions"],
): Definition["transitions"] =>
  phases.slice(0, -1).map((phase, index) => {
    const to = phases[index + 1].id,
      prior = previous.find(
        (entry) => entry.from === phase.id && entry.to === to,
      );
    const supported =
      prior &&
      (prior.gate === "tasks_complete" ||
        (prior.gate === "qc_approved" && phase.qcRequired) ||
        (prior.gate === "approval_granted" && phase.approvalRequired));
    return {
      from: phase.id,
      to,
      gate: supported
        ? prior.gate
        : phase.approvalRequired
          ? "approval_granted"
          : phase.qcRequired
            ? "qc_approved"
            : "tasks_complete",
      requiredDocuments: prior?.requiredDocuments ?? [],
    };
  });
const documentCodes = (value: string) =>
  value
    .toUpperCase()
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

export function CompanyDeliveryWorkflowsTab({
  token,
  spanish,
}: {
  token: string;
  spanish: boolean;
}) {
  const t = (en: string, es: string) => (spanish ? es : en);
  const [list, setList] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      versionId: string;
      version: number;
      state: string;
    }>
  >([]);
  const [canManage, setCanManage] = useState(false);
  const [mode, setMode] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [draft, setDraft] = useState<Definition | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("GENERAL");
  const [preview, setPreview] = useState<{
    fingerprint: string;
    phaseCount: number;
    taskCount: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${base}/api/v1${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          body?.error?.en ?? body?.code ?? `HTTP ${response.status}`,
        );
      return body;
    },
    [token],
  );
  const load = useCallback(
    async (id?: string) => {
      const [listing, options] = await Promise.all([
        request("/company/delivery-workflows"),
        request("/company/delivery-workflows/options"),
      ]);
      setList(listing.versions ?? []);
      setCanManage(listing.canManage === true);
      setMode(options.mode);
      const target = id ?? selectedId;
      if (target) {
        const detail = await request(`/company/delivery-workflows/${target}`);
        setVersions(detail.versions ?? []);
        setHistory(detail.history ?? []);
        const open = detail.versions?.find(
          (row: Version) => row.state === "draft",
        );
        setDraft(open?.definition ?? null);
      } else {
        setVersions([]);
        setHistory([]);
        setDraft(null);
      }
      setError("");
    },
    [request, selectedId],
  );
  useEffect(() => {
    setLoading(true);
    void load()
      .catch((cause) => setError(String(cause)))
      .finally(() => setLoading(false));
  }, [load]);
  const selected = versions.find((row) => row.state === "draft") ?? versions[0];
  const draftDirty =
    !!draft &&
    !!selected &&
    JSON.stringify(draft) !== JSON.stringify(selected.definition);
  const updateDraft = (next: Definition) => {
    setDraft(next);
    setPreview(null);
    setNotice("");
  };
  const changePhases = (next: Phase[]) =>
    updateDraft({
      ...draft!,
      phases: next,
      transitions: reflow(next, draft!.transitions),
    });
  const action = async (
    path: string,
    method: string,
    body?: object,
    afterId?: string,
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      const id = afterId ?? result.templateId ?? selectedId;
      if (id) setSelectedId(id);
      await load(id);
      setPreview(null);
      setNotice(
        t(
          "Saved. Existing activated Work Items retain their frozen version.",
          "Guardado. Las partidas activadas conservan su versión congelada.",
        ),
      );
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  const previewDraft = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(
        await request("/company/delivery-workflows/preview", {
          method: "POST",
          body: JSON.stringify({ definition: draft }),
        }),
      );
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };
  const newPhase = () => {
    if (!draft) return;
    const n = draft.phases.length + 1,
      id = `phase_${n}_${crypto.randomUUID().slice(0, 6)}`;
    changePhases([
      ...draft.phases,
      {
        id,
        code: `PHASE_${n}`,
        name: `Phase ${n}`,
        order: n,
        tasks: [
          {
            id: `task_${n}_${crypto.randomUUID().slice(0, 6)}`,
            code: `TASK_${n}`,
            name: "Task",
            order: 1,
            requiredDocuments: [],
          },
        ],
        completionRule: "all_tasks_complete",
        qcRequired: false,
        approvalRequired: false,
      },
    ]);
  };
  return (
    <section style={{ display: "grid", gap: 16, minWidth: 0 }}>
      <div>
        <h1>
          {t("Company Delivery Workflows", "Flujos de entrega de la empresa")}
        </h1>
        <p>
          {t(
            "Publish reusable, versioned workflows for Work Items. BIMLog defaults remain available unless company policy requires approved-only configurations. APU pricing stays in Commercial.",
            "Publique flujos reutilizables y versionados para las partidas de trabajo. Los valores predeterminados de BIMLog siguen disponibles salvo que la política exija solo configuraciones aprobadas. Los precios APU permanecen en Comercial.",
          )}
        </p>
      </div>
      {loading && (
        <p role="status">{t("Loading workflows…", "Cargando flujos…")}</p>
      )}
      {error && (
        <div role="alert" style={{ color: "#991b1b" }}>
          {error}{" "}
          <button
            type="button"
            onClick={() =>
              void load().catch((cause) => setError(String(cause)))
            }
          >
            {t("Retry", "Reintentar")}
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!loading && (
        <p>
          {mode === "approved_only"
            ? t(
                "Approved company workflows only",
                "Solo flujos de empresa aprobados",
              )
            : t(
                "Company workflows and BIMLog defaults",
                "Flujos de empresa y predeterminados de BIMLog",
              )}{" "}
          ·{" "}
          {canManage
            ? t("PMO editing enabled", "Edición PMO habilitada")
            : t("Read-only", "Solo lectura")}
        </p>
      )}
      {canManage && (
        <section
          style={{
            border: "1px solid #cbd5e1",
            padding: 14,
            borderRadius: 10,
            display: "grid",
            gap: 8,
          }}
        >
          <h2>{t("Create company template", "Crear plantilla de empresa")}</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 8,
            }}
          >
            <label>
              {t("Code", "Código")}
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={64}
              />
            </label>
            <label>
              {t("Name", "Nombre")}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
              />
            </label>
            <label>
              {t("Deliverable type", "Tipo de entregable")}
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                <option value="GENERAL">General</option>
                <option value="SHOP_DRAWING">
                  {t("Shop drawing", "Plano de taller")}
                </option>
                <option value="SLEEVE">Sleeve</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !code || !name}
            onClick={() =>
              void action("/company/delivery-workflows", "POST", {
                code,
                name,
                definition: starter(type),
              })
            }
          >
            {t("Create draft", "Crear borrador")}
          </button>
        </section>
      )}
      {!loading && list.length === 0 && (
        <p>
          {t(
            "No company workflow has been created. BIMLog defaults can still be used when policy allows them.",
            "No hay flujos de empresa. Los predeterminados de BIMLog pueden utilizarse si la política lo permite.",
          )}
        </p>
      )}
      <label>
        {t("Company template", "Plantilla de empresa")}
        <select
          value={selectedId}
          onChange={(event) => {
            setSelectedId(event.target.value);
            setPreview(null);
          }}
        >
          <option value="">
            {t("Select a template", "Seleccione una plantilla")}
          </option>
          {Array.from(new Map(list.map((row) => [row.id, row])).values()).map(
            (row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
              </option>
            ),
          )}
        </select>
      </label>
      {selected && (
        <section
          style={{
            border: "1px solid #cbd5e1",
            padding: 14,
            borderRadius: 10,
            display: "grid",
            gap: 12,
            minWidth: 0,
          }}
        >
          <h2>
            {selected.name} · v{selected.version} · {selected.state}
          </h2>
          <p>
            {t(
              "Every published version is immutable. Clone a published version to edit a new draft.",
              "Cada versión publicada es inmutable. Clone una versión publicada para editar un nuevo borrador.",
            )}
          </p>
          {versions.map((row) => (
            <div
              key={row.versionId}
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <strong>
                v{row.version} · {row.state}
              </strong>
              <small>{row.fingerprint?.slice(0, 16) || "—"}</small>
              {canManage && row.state === "draft" && (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !preview ||
                    draftDirty ||
                    row.versionId !== selected.versionId
                  }
                  onClick={() =>
                    void action(
                      `/company/delivery-workflows/${row.templateId}/versions/${row.versionId}/approve`,
                      "POST",
                      { expectedRevision: row.revision },
                    )
                  }
                >
                  {t(
                    "Approve validated saved draft",
                    "Aprobar borrador guardado y validado",
                  )}
                </button>
              )}
              {canManage && row.state === "approved" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      `/company/delivery-workflows/${row.templateId}/versions/${row.versionId}/publish`,
                      "POST",
                      { expectedRevision: row.revision },
                    )
                  }
                >
                  {t("Publish", "Publicar")}
                </button>
              )}
              {canManage && ["published", "superseded"].includes(row.state) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      `/company/delivery-workflows/${row.templateId}/versions/${row.versionId}/retire`,
                      "POST",
                      { expectedRevision: row.revision },
                    )
                  }
                >
                  {t(
                    "Retire for new selections",
                    "Retirar para nuevas selecciones",
                  )}
                </button>
              )}
            </div>
          ))}
          {canManage &&
            !versions.some((row) =>
              ["draft", "approved"].includes(row.state),
            ) && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/company/delivery-workflows/${selected.templateId}/versions`,
                    "POST",
                  )
                }
              >
                {t("Clone new draft version", "Clonar nueva versión borrador")}
              </button>
            )}
          {draft && selected.state === "draft" && canManage && (
            <div style={{ display: "grid", gap: 14 }}>
              <h3>
                {t("Edit draft definition", "Editar definición borrador")}
              </h3>
              <label>
                {t("Deliverable types", "Tipos de entregable")}
                <select
                  multiple
                  value={draft.deliverableTypes}
                  onChange={(event) =>
                    updateDraft({
                      ...draft,
                      deliverableTypes: Array.from(
                        event.currentTarget.selectedOptions,
                        (option) => option.value,
                      ),
                    })
                  }
                >
                  <option value="GENERAL">General</option>
                  <option value="SHOP_DRAWING">
                    {t("Shop drawing", "Plano de taller")}
                  </option>
                  <option value="SLEEVE">Sleeve</option>
                </select>
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 8,
                }}
              >
                {(["execute", "review", "approve"] as const).map((role) => (
                  <label key={role}>
                    {role}
                    <input
                      value={draft.roles[role]}
                      onChange={(event) =>
                        updateDraft({
                          ...draft,
                          roles: {
                            ...draft.roles,
                            [role]: event.target.value.toUpperCase(),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              {draft.phases.map((phase, index) => (
                <fieldset
                  key={phase.id}
                  style={{ minWidth: 0, display: "grid", gap: 8 }}
                >
                  <legend>
                    {t("Phase", "Fase")} {index + 1}
                  </legend>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                      gap: 8,
                    }}
                  >
                    <label>
                      {t("Phase code", "Código de fase")}
                      <input
                        value={phase.code}
                        onChange={(event) =>
                          changePhases(
                            draft.phases.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    code: event.target.value.toUpperCase(),
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      {t("Phase name", "Nombre de fase")}
                      <input
                        value={phase.name}
                        onChange={(event) =>
                          changePhases(
                            draft.phases.map((row, i) =>
                              i === index
                                ? { ...row, name: event.target.value }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      {t("Completion", "Finalización")}
                      <select
                        value={phase.completionRule}
                        onChange={(event) =>
                          changePhases(
                            draft.phases.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    completionRule: event.target
                                      .value as Phase["completionRule"],
                                  }
                                : row,
                            ),
                          )
                        }
                      >
                        <option value="all_tasks_complete">
                          {t(
                            "All tasks complete",
                            "Todas las tareas completas",
                          )}
                        </option>
                        <option value="all_tasks_reviewed">
                          {t(
                            "All tasks reviewed",
                            "Todas las tareas revisadas",
                          )}
                        </option>
                      </select>
                    </label>
                  </div>
                  <label>
                    <input
                      type="checkbox"
                      checked={phase.qcRequired}
                      onChange={(event) =>
                        changePhases(
                          draft.phases.map((row, i) =>
                            i === index
                              ? { ...row, qcRequired: event.target.checked }
                              : row,
                          ),
                        )
                      }
                    />
                    {t("QC gate", "Control de calidad")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={phase.approvalRequired}
                      onChange={(event) =>
                        changePhases(
                          draft.phases.map((row, i) =>
                            i === index
                              ? {
                                  ...row,
                                  approvalRequired: event.target.checked,
                                }
                              : row,
                          ),
                        )
                      }
                    />
                    {t("Approval gate", "Aprobación")}
                  </label>
                  {phase.tasks.map((task, taskIndex) => (
                    <div
                      key={task.id}
                      style={{
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: 8,
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(150px,1fr))",
                        gap: 8,
                      }}
                    >
                      <label>
                        {t("Task code", "Código de tarea")}
                        <input
                          value={task.code}
                          onChange={(event) =>
                            changePhases(
                              draft.phases.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      tasks: row.tasks.map((entry, j) =>
                                        j === taskIndex
                                          ? {
                                              ...entry,
                                              code: event.target.value.toUpperCase(),
                                            }
                                          : entry,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        {t("Task name", "Nombre de tarea")}
                        <input
                          value={task.name}
                          onChange={(event) =>
                            changePhases(
                              draft.phases.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      tasks: row.tasks.map((entry, j) =>
                                        j === taskIndex
                                          ? {
                                              ...entry,
                                              name: event.target.value,
                                            }
                                          : entry,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        {t(
                          "Required document codes (comma separated)",
                          "Códigos de documentos requeridos (separados por coma)",
                        )}
                        <input
                          value={task.requiredDocuments.join(", ")}
                          onChange={(event) =>
                            changePhases(
                              draft.phases.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      tasks: row.tasks.map((entry, j) =>
                                        j === taskIndex
                                          ? {
                                              ...entry,
                                              requiredDocuments: documentCodes(
                                                event.target.value,
                                              ),
                                            }
                                          : entry,
                                      ),
                                    }
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        disabled={phase.tasks.length === 1}
                        onClick={() =>
                          changePhases(
                            draft.phases.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    tasks: row.tasks
                                      .filter((_, j) => j !== taskIndex)
                                      .map((entry, j) => ({
                                        ...entry,
                                        order: j + 1,
                                      })),
                                  }
                                : row,
                            ),
                          )
                        }
                      >
                        {t("Remove task", "Quitar tarea")}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      changePhases(
                        draft.phases.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                tasks: [
                                  ...row.tasks,
                                  {
                                    id: `task_${crypto.randomUUID().slice(0, 8)}`,
                                    code: `TASK_${row.tasks.length + 1}`,
                                    name: "Task",
                                    order: row.tasks.length + 1,
                                    requiredDocuments: [],
                                  },
                                ],
                              }
                            : row,
                        ),
                      )
                    }
                  >
                    {t("Add task", "Agregar tarea")}
                  </button>
                  <button
                    type="button"
                    disabled={draft.phases.length === 1}
                    onClick={() =>
                      changePhases(
                        draft.phases
                          .filter((_, i) => i !== index)
                          .map((row, i) => ({ ...row, order: i + 1 })),
                      )
                    }
                  >
                    {t("Remove phase", "Quitar fase")}
                  </button>
                </fieldset>
              ))}
              <button type="button" onClick={newPhase}>
                {t("Add phase", "Agregar fase")}
              </button>
              {draft.transitions.map((transition, index) => (
                <fieldset
                  key={`${transition.from}-${transition.to}`}
                  style={{ display: "grid", gap: 8 }}
                >
                  <legend>
                    {t("Transition gate", "Control de transición")}:{" "}
                    {draft.phases[index].name} → {draft.phases[index + 1].name}
                  </legend>
                  <label>
                    {t("Gate", "Control")}
                    <select
                      value={transition.gate}
                      onChange={(event) =>
                        updateDraft({
                          ...draft,
                          transitions: draft.transitions.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  gate: event.target.value as typeof entry.gate,
                                }
                              : entry,
                          ),
                        })
                      }
                    >
                      <option value="tasks_complete">
                        {t("Tasks complete", "Tareas completas")}
                      </option>
                      {draft.phases[index].qcRequired && (
                        <option value="qc_approved">
                          {t("QC approved", "Control de calidad aprobado")}
                        </option>
                      )}
                      {draft.phases[index].approvalRequired && (
                        <option value="approval_granted">
                          {t("Approval granted", "Aprobación concedida")}
                        </option>
                      )}
                    </select>
                  </label>
                  <label>
                    {t(
                      "Required phase documents (comma separated)",
                      "Documentos requeridos para la fase (separados por coma)",
                    )}
                    <input
                      value={transition.requiredDocuments.join(", ")}
                      onChange={(event) =>
                        updateDraft({
                          ...draft,
                          transitions: draft.transitions.map((entry, i) =>
                            i === index
                              ? {
                                  ...entry,
                                  requiredDocuments: documentCodes(
                                    event.target.value,
                                  ),
                                }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                </fieldset>
              ))}
              <label>
                {t("Reopen authority", "Autoridad para reabrir")}
                <select
                  value={draft.reopen.role}
                  onChange={(event) =>
                    updateDraft({
                      ...draft,
                      reopen: {
                        role: event.target.value as "review" | "approve",
                        reasonRequired: true,
                      },
                    })
                  }
                >
                  <option value="review">{t("Reviewer", "Revisor")}</option>
                  <option value="approve">{t("Approver", "Aprobador")}</option>
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void previewDraft()}
                >
                  {t("Validate and preview", "Validar y previsualizar")}
                </button>
                <button
                  type="button"
                  disabled={busy || !preview}
                  onClick={() =>
                    void action(
                      `/company/delivery-workflows/${selected.templateId}/versions/${selected.versionId}`,
                      "PATCH",
                      {
                        expectedRevision: selected.revision,
                        definition: draft,
                      },
                    )
                  }
                >
                  {t("Save draft", "Guardar borrador")}
                </button>
              </div>
            </div>
          )}
          {preview && draft && (
            <section
              aria-label={t("Workflow preview", "Vista previa del flujo")}
              style={{ background: "#eff6ff", padding: 12 }}
            >
              <h3>{t("Validated preview", "Vista previa validada")}</h3>
              <p>
                {preview.phaseCount} {t("phases", "fases")} ·{" "}
                {preview.taskCount} {t("tasks", "tareas")} · SHA-256{" "}
                {preview.fingerprint.slice(0, 16)}
              </p>
              {draft.phases.map((phase) => (
                <p key={phase.id}>
                  <strong>{phase.name}</strong>:{" "}
                  {phase.tasks.map((task) => task.name).join(" → ")} · QC{" "}
                  {phase.qcRequired ? t("yes", "sí") : t("no", "no")} ·{" "}
                  {t("Approval", "Aprobación")}{" "}
                  {phase.approvalRequired ? t("yes", "sí") : t("no", "no")}
                </p>
              ))}
            </section>
          )}
          {history.length > 0 && (
            <details>
              <summary>
                {t("Audit history", "Historial de auditoría")} ({history.length}
                )
              </summary>
              {history.map((row) => (
                <p key={`${row.versionId}-${row.createdAt}-${row.action}`}>
                  {row.createdAt} · {row.action} · {row.versionId}
                </p>
              ))}
            </details>
          )}
        </section>
      )}
    </section>
  );
}
