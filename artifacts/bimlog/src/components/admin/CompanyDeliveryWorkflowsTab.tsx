import { useCallback, useEffect, useRef, useState } from "react";
import { workflowApprovalError } from "@/lib/workflow-approval-error";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

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
type AllocationPhase = { phaseId: string; code: string; name: string; percent: string };
type AllocationProposal =
  | { method: "apu_default" }
  | { method: "proportional"; additions: AllocationPhase[] }
  | { method: "deduct_specific"; additions: AllocationPhase[]; deductions: Array<{ phaseId: string; percent: string }> }
  | { method: "custom"; phases: AllocationPhase[]; approvalReason: string };
type PricingOption = { versionId: string; name: string; version: number; currency: string;
  provenance?: { definition?: { economicAllocation?: { phases: AllocationPhase[]; directProductionNodeIds: string[] } } } };
type AllocationPreview = { currency: string; directProductionAmount: string; method: string; fingerprint: string;
  rows: Array<{ phaseId: string; name: string; apuDefaultPercent: string; workflowPercent: string; deltaPercent: string; deltaDirection: number; amount: string }> };
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
  economicAllocation?: { sourceVersionId: string; proposal: AllocationProposal };
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
  reviewEligibility?: { eligible: boolean; code: string };
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
  const [apuOptions, setApuOptions] = useState<PricingOption[]>([]);
  const [apuError, setApuError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [draft, setDraft] = useState<Definition | null>(null);
  const draftRef = useRef<Definition | null>(null);
  const previewRequest = useRef(0);
  draftRef.current = draft;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("GENERAL");
  const [preview, setPreview] = useState<{
    fingerprint: string;
    phaseCount: number;
    taskCount: number;
    allocation: AllocationPreview | null;
    governance: { code: string; version: number; versionId: string; fingerprint: string } | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [notice, setNotice] = useState("");
  const [retireTarget, setRetireTarget] = useState<{ templateId: string; versionId: string; revision: number } | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [confirmApuAlignment, setConfirmApuAlignment] = useState(false);
  const alignApuButton = useRef<HTMLButtonElement>(null);
  const templateSelect = useRef<HTMLSelectElement>(null);
  const selectTemplate = (id: string) => {
    setSelectedId(id);
    setPreview(null);
    setRetireTarget(null);
    setRetireReason("");
    setPendingTemplate(null);
  };
  useEffect(() => { setPendingTemplate(null); setConfirmApuAlignment(false); }, [token, spanish, selectedId]);
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
          body?.code ? workflowApprovalError(body.code, spanish, body.field) : body?.error?.[spanish ? "es" : "en"] ?? `HTTP ${response.status}`,
        );
      return body;
    },
    [token, spanish],
  );
  const load = useCallback(
    async (id?: string) => {
      setPreview(null);
      const [listing, options] = await Promise.all([
        request("/company/delivery-workflows"),
        request("/company/delivery-workflows/options"),
      ]);
      setList(listing.versions ?? []);
      setCanManage(listing.canManage === true);
      setMode(options.mode);
      if (listing.canManage === true) {
        try {
          const pricing = await request("/company/pricing-templates/options");
          setApuOptions(pricing.options ?? []);
          setApuError("");
        } catch (cause) {
          setApuOptions([]);
          setApuError(String(cause));
        }
      } else {
        setApuOptions([]);
        setApuError("");
      }
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
    setLoadFailed(false);
    void load()
      .catch((cause) => { setLoadFailed(true); setError(String(cause)); })
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    previewRequest.current += 1;
    setPreview(null);
    setBusy(false);
    return () => { previewRequest.current += 1; };
  }, [selectedId, token, spanish]);
  const selected = versions.find((row) => row.state === "draft") ?? versions[0];
  const draftDirty =
    !!draft &&
    !!selected &&
    JSON.stringify(draft) !== JSON.stringify(selected.definition);
  useEffect(() => {
    if (!draftDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftDirty]);
  const updateDraft = (next: Definition) => {
    setDraft(next);
    setPreview(null);
    setNotice("");
  };
  const changePhases = (next: Phase[]) => {
    const allocation = draft!.economicAllocation;
    let nextAllocation = allocation;
    if (allocation?.proposal.method === "custom") {
      nextAllocation = { ...allocation, proposal: { ...allocation.proposal,
        phases: next.map((phase) => ({
          phaseId: phase.id, code: phase.code, name: phase.name,
          percent: allocation.proposal.method === "custom"
            ? allocation.proposal.phases.find((row) => row.phaseId === phase.id)?.percent ?? "0.00"
            : "0.00",
        })) } };
    } else if (allocation && "additions" in allocation.proposal) {
      const prior = allocation.proposal;
      const additions = next.filter((phase) => !apuPhases.some((source) => source.phaseId === phase.id))
        .map((phase) => ({ phaseId: phase.id, code: phase.code, name: phase.name,
          percent: prior.additions.find((row) => row.phaseId === phase.id)?.percent ?? "0.00" }));
      nextAllocation = { ...allocation, proposal: { ...prior, additions } };
    }
    updateDraft({ ...draft!, phases: next, transitions: reflow(next, draft!.transitions),
      ...(nextAllocation ? { economicAllocation: nextAllocation } : {}) });
  };
  const selectedApu = apuOptions.find((option) => option.versionId === draft?.economicAllocation?.sourceVersionId);
  const apuPhases = selectedApu?.provenance?.definition?.economicAllocation?.phases ?? [];
  const allocationAligned = !!draft?.economicAllocation &&
    apuPhases.length > 0 &&
    (draft.economicAllocation.proposal.method === "apu_default"
      ? draft.phases.length === apuPhases.length
      : true) &&
    (draft.economicAllocation.proposal.method === "apu_default"
      ? draft.phases.every((phase, index) => phase.id === apuPhases[index]?.phaseId && phase.code === apuPhases[index]?.code)
      : draft.phases.slice(0, apuPhases.length).every((phase, index) => phase.id === apuPhases[index]?.phaseId && phase.code === apuPhases[index]?.code));
  const allocationAdditions = (): AllocationPhase[] => {
    if (!draft) return [];
    const prior = draft.economicAllocation?.proposal;
    const previous = prior && "additions" in prior ? prior.additions : [];
    return draft.phases.filter((phase) => !apuPhases.some((source) => source.phaseId === phase.id))
      .map((phase) => previous.find((row) => row.phaseId === phase.id) ??
        { phaseId: phase.id, code: phase.code, name: phase.name, percent: "0.00" });
  };
  const changeAllocationMethod = (method: AllocationProposal["method"]) => {
    if (!draft?.economicAllocation) return;
    const additions = allocationAdditions();
    const current = draft.economicAllocation.proposal;
    const proposal: AllocationProposal = method === "apu_default" ? { method }
      : method === "proportional" ? { method, additions }
      : method === "deduct_specific" ? { method, additions,
        deductions: apuPhases.map((phase) => ({
          phaseId: phase.phaseId,
          percent: current.method === "deduct_specific"
            ? current.deductions.find((row) => row.phaseId === phase.phaseId)?.percent ?? "0.00" : "0.00",
        })) }
      : { method, phases: draft.phases.map((phase) => ({
        phaseId: phase.id, code: phase.code, name: phase.name,
        percent: current.method === "custom"
          ? current.phases.find((row) => row.phaseId === phase.id)?.percent ?? "0.00"
          : apuPhases.find((row) => row.phaseId === phase.id)?.percent ?? "0.00",
      })), approvalReason: current.method === "custom" ? current.approvalReason : "" };
    updateDraft({ ...draft, economicAllocation: { ...draft.economicAllocation, proposal } });
  };
  const updateAllocationProposal = (proposal: AllocationProposal) => {
    if (!draft?.economicAllocation) return;
    updateDraft({ ...draft, economicAllocation: { ...draft.economicAllocation, proposal } });
  };
  const updateAddition = (phaseId: string, percent: string) => {
    const proposal = draft?.economicAllocation?.proposal;
    if (!proposal || !("additions" in proposal)) return;
    updateAllocationProposal({ ...proposal, additions: proposal.additions.map((row) =>
      row.phaseId === phaseId ? { ...row, percent } : row) });
  };
  const updateDeduction = (phaseId: string, percent: string) => {
    const proposal = draft?.economicAllocation?.proposal;
    if (proposal?.method !== "deduct_specific") return;
    updateAllocationProposal({ ...proposal, deductions: proposal.deductions.map((row) =>
      row.phaseId === phaseId ? { ...row, percent } : row) });
  };
  const updateCustom = (phaseId: string, percent: string) => {
    const proposal = draft?.economicAllocation?.proposal;
    if (proposal?.method !== "custom") return;
    updateAllocationProposal({ ...proposal, phases: proposal.phases.map((row) =>
      row.phaseId === phaseId ? { ...row, percent } : row) });
  };
  const alignApuPhases = (confirmed = false) => {
    if (!draft || !apuPhases.length) return;
    if (draft.phases.some((phase) => !apuPhases.some((source) => source.phaseId === phase.id)) &&
      !confirmed) { setConfirmApuAlignment(true); return; }
    setConfirmApuAlignment(false);
    const next = apuPhases.map((source, index): Phase => draft.phases.find((phase) => phase.id === source.phaseId)
      ? { ...draft.phases.find((phase) => phase.id === source.phaseId)!, code: source.code, name: source.name, order: index + 1 }
      : { id: source.phaseId, code: source.code, name: source.name, order: index + 1,
        tasks: [{ id: `task_${source.phaseId}`, code: "PRODUCE", name: "Prepare deliverable", order: 1, requiredDocuments: [] }],
        completionRule: "all_tasks_complete", qcRequired: false, approvalRequired: false });
    updateDraft({ ...draft, phases: next, transitions: reflow(next, draft.transitions),
      economicAllocation: { ...draft.economicAllocation!, proposal: { method: "apu_default" } } });
  };
  const action = async (
    path: string,
    method: string,
    body?: object,
    afterId?: string,
  ) => {
    setBusy(true);
    setLoadFailed(false);
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
      if (path.endsWith("/retire")) { setRetireTarget(null); setRetireReason(""); }
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
    if (!draft || busy) return;
    const requestId = ++previewRequest.current;
    const submitted = JSON.stringify(draft);
    setBusy(true);
    setLoadFailed(false);
    setError("");
    setPreview(null);
    try {
      const result = await request("/company/delivery-workflows/preview", {
        method: "POST",
        body: JSON.stringify({ definition: draft, ...(selected ? { templateId:selected.templateId, versionId:selected.versionId } : {}) }),
      });
      if (requestId === previewRequest.current && JSON.stringify(draftRef.current) === submitted) setPreview(result);
    } catch (cause) {
      if (requestId === previewRequest.current && JSON.stringify(draftRef.current) === submitted) setError(String(cause));
    } finally {
      if (requestId === previewRequest.current) setBusy(false);
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
    <section className="company-workflow-editor" style={{ display: "grid", gap: 16, minWidth: 0 }}>
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
            onClick={() => {
              if (!loadFailed) { setError(""); return; }
              void load().then(() => setLoadFailed(false)).catch((cause) => setError(String(cause)));
            }}
          >
            {loadFailed ? t("Retry loading", "Reintentar carga") : t("Dismiss message", "Cerrar mensaje")}
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
          ref={templateSelect}
          disabled={busy || loading}
          value={selectedId}
          onChange={(event) => {
            if (draftDirty) setPendingTemplate(event.target.value);
            else selectTemplate(event.target.value);
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
      <AlertDialog open={pendingTemplate !== null} onOpenChange={(open) => { if (!open) setPendingTemplate(null); }}>
        <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); templateSelect.current?.focus(); }}>
          <AlertDialogTitle>{t("Discard unsaved workflow changes?", "¿Descartar los cambios del flujo sin guardar?")}</AlertDialogTitle>
          <AlertDialogDescription>{t("Your saved version will not change. Stay here to keep editing, or discard only the unsaved changes and switch templates.", "La versión guardada no cambiará. Permanezca aquí para seguir editando o descarte solo los cambios sin guardar y cambie de plantilla.")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep editing", "Seguir editando")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingTemplate !== null) selectTemplate(pendingTemplate); }}>{t("Discard and switch", "Descartar y cambiar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmApuAlignment} onOpenChange={setConfirmApuAlignment}>
        <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); alignApuButton.current?.focus(); }}>
          <AlertDialogTitle>{t("Replace workflow phases?", "¿Reemplazar las fases del flujo?")}</AlertDialogTitle>
          <AlertDialogDescription>{t("Applying APU defaults removes the draft phases and tasks that do not match the APU. Matching tasks are kept. This changes only the draft; validate and save separately.", "Aplicar los valores del APU elimina las fases y tareas del borrador que no coinciden con el APU. Se conservan las tareas coincidentes. Solo cambia el borrador; valide y guarde por separado.")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep current phases", "Conservar fases actuales")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => alignApuPhases(true)}>{t("Apply APU phases", "Aplicar fases del APU")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          <p>{t(
            "Approval requires a different company PMO administrator from the creator and last editor. Economic allocation also requires that checker to hold Finance cost-approver authority.",
            "La aprobación requiere otro administrador PMO distinto del creador y último editor. Si hay asignación económica, ese revisor también necesita autorización financiera para aprobar costos.",
          )}</p>
          {selected.state === "draft" && canManage && <p role="status">
            {selected.reviewEligibility?.eligible === true
              ? t("You may review this saved draft. Validate it first; approval rechecks the current policy and your authority.", "Puede revisar este borrador guardado. Valídelo primero; la aprobación verifica nuevamente la política y su autorización.")
              : selected.reviewEligibility?.code
                ? workflowApprovalError(selected.reviewEligibility.code, spanish)
                : t("Reviewer eligibility is unavailable. Reload before approving; no approval is enabled without current eligibility.", "La elegibilidad del revisor no está disponible. Recargue antes de aprobar; no se habilita la aprobación sin elegibilidad vigente.")}
          </p>}
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
              {row.state !== "draft" && <details style={{ flexBasis:"100%", minWidth:0 }}>
                <summary>{t("View saved definition", "Ver definición guardada")} · v{row.version}</summary>
                <section aria-label={`${t("Saved workflow definition", "Definición guardada del flujo")} v${row.version}`} style={{ display:"grid",gap:8,padding:12 }}>
                  <p>{t("Read-only version. This view does not change activated Work Items.", "Versión de solo lectura. Esta vista no modifica las partidas activadas.")}</p>
                  <p>{t("Deliverable types", "Tipos de entregable")}: {row.definition.deliverableTypes.join(", ")}</p>
                  <p>{t("Execution / Review / Approval roles", "Roles de ejecución / revisión / aprobación")}: {row.definition.roles.execute} / {row.definition.roles.review} / {row.definition.roles.approve}</p>
                  {row.definition.phases.map(phase => <section key={phase.id}>
                    <h3>{phase.order}. {phase.name} ({phase.code})</h3>
                    <p>{t("QC required", "Control de calidad requerido")}: {phase.qcRequired ? t("Yes", "Sí") : t("No", "No")} · {t("Approval required", "Aprobación requerida")}: {phase.approvalRequired ? t("Yes", "Sí") : t("No", "No")}</p>
                    <p>{t("Completion", "Finalización")}: {phase.completionRule === "all_tasks_reviewed" ? t("All tasks reviewed", "Todas las tareas revisadas") : t("All tasks complete", "Todas las tareas completas")}</p>
                    <ol>{phase.tasks.map(task => <li key={task.id}>{task.order}. {task.name} ({task.code}) — {t("Required documents", "Documentos requeridos")}: {task.requiredDocuments.join(", ") || t("None", "Ninguno")}</li>)}</ol>
                  </section>)}
                  {row.definition.transitions.map(transition => <p key={`${transition.from}-${transition.to}`}>
                    {row.definition.phases.find(phase => phase.id === transition.from)?.name} → {row.definition.phases.find(phase => phase.id === transition.to)?.name}: {transition.gate === "qc_approved" ? t("QC approved", "Control de calidad aprobado") : transition.gate === "approval_granted" ? t("Approval granted", "Aprobación otorgada") : t("Tasks complete", "Tareas completas")} · {t("Required documents", "Documentos requeridos")}: {transition.requiredDocuments.join(", ") || t("None", "Ninguno")}
                  </p>)}
                  <p>{t("Reopen authority", "Autoridad para reabrir")}: {row.definition.reopen.role === "approve" ? t("Approver", "Aprobador") : t("Reviewer", "Revisor")} · {t("Reason required", "Motivo obligatorio")}</p>
                  <p style={{ overflowWrap:"anywhere" }}>SHA-256: {row.fingerprint || "—"}</p>
                </section>
              </details>}
              {canManage && row.state === "draft" && (
                <button
                  type="button"
                  disabled={
                    busy ||
                    !preview ||
                    draftDirty ||
                    row.reviewEligibility?.eligible !== true ||
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
                  onClick={() => { setRetireTarget({ templateId: row.templateId, versionId: row.versionId, revision: row.revision }); setRetireReason(""); }}
                >
                  {t(
                    "Retire for new selections",
                    "Retirar para nuevas selecciones",
                  )}
                </button>
              )}
            </div>
          ))}
          {retireTarget && <section aria-label={t("Retire workflow version", "Retirar versión del flujo")} style={{ border: "1px solid #cbd5e1", padding: 12, display: "grid", gap: 8 }}>
            <strong>{t("Retire version", "Retirar versión")} {versions.find(row => row.versionId === retireTarget.versionId)?.version}</strong>
            <label>{t("Reason for retirement (recorded in audit history)", "Motivo del retiro (registrado en el historial de auditoría)")}
              <textarea value={retireReason} maxLength={500} onChange={event => setRetireReason(event.target.value)} />
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" disabled={busy || retireReason.trim().length < 5} onClick={() => void action(
                `/company/delivery-workflows/${retireTarget.templateId}/versions/${retireTarget.versionId}/retire`,
                "POST", { expectedRevision: retireTarget.revision, reason: retireReason.trim() },
              )}>{t("Confirm retirement", "Confirmar retiro")}</button>
              <button type="button" disabled={busy} onClick={() => { setRetireTarget(null); setRetireReason(""); }}>{t("Cancel", "Cancelar")}</button>
            </div>
          </section>}
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
                    {role === "execute" ? t("Execution role", "Rol de ejecución") : role === "review" ? t("Review role", "Rol de revisión") : t("Approval role", "Rol de aprobación")}
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
              <fieldset className="company-workflow-economic" style={{ display: "grid", gap: 10, minWidth: 0, border: "1px solid #94a3b8", borderRadius: 10, padding: 14 }}>
                <legend>{t("Economic allocation (optional)", "Asignación económica (opcional)")}</legend>
                <p>{t("Link this workflow to a published Commercial APU. The APU remains the price authority; this workflow only allocates its Direct Production amount across matching phases. A separate Finance-authorized PMO checker must approve economic changes.", "Vincule el flujo a un APU Comercial publicado. El APU sigue siendo la autoridad de precios; este flujo solo distribuye su producción directa entre fases coincidentes. Otro PMO con autorización financiera debe aprobar los cambios económicos.")}</p>
                {apuError && <p role="alert">{t("Could not load published APUs:", "No se pudieron cargar los APU publicados:")} {apuError}</p>}
                {!apuError && apuOptions.length === 0 && <p role="status">{t("No published company APU with economic defaults is available. Configure and publish one in Commercial first.", "No hay un APU publicado con fases económicas. Configure y publique uno en Comercial primero.")}</p>}
                <label>{t("Published Commercial APU", "APU Comercial publicado")}
                  <select value={draft.economicAllocation?.sourceVersionId ?? ""} disabled={!!apuError}
                    onChange={(event) => updateDraft({ ...draft, economicAllocation: event.target.value
                      ? { sourceVersionId: event.target.value, proposal: { method: "apu_default" } }
                      : undefined })}>
                    <option value="">{t("No economic allocation", "Sin asignación económica")}</option>
                    {apuOptions.filter((option) => !!option.provenance?.definition?.economicAllocation).map((option) =>
                      <option key={option.versionId} value={option.versionId}>{option.name} · v{option.version} · {option.currency}</option>)}
                  </select>
                </label>
                {draft.economicAllocation && !selectedApu && <p role="alert">{t("The referenced APU is unavailable or no longer published. Select a current APU; this draft cannot be approved with a stale source.", "El APU de referencia no está disponible o ya no está publicado. Seleccione uno vigente; este borrador no puede aprobarse con una fuente obsoleta.")}</p>}
                {draft.economicAllocation && selectedApu && <>
                  <p>{t("APU default phases", "Fases predeterminadas del APU")}: {apuPhases.map((phase) => `${phase.name} ${phase.percent}%`).join(" · ")}</p>
                  {!allocationAligned && <div role="status" style={{ padding: 10, background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8 }}>
                    <p>{t("Workflow phase identities/order do not match this allocation. Apply APU defaults, or add matching new phases after those defaults for a redistribution method.", "Las identidades o el orden de fases del flujo no coinciden con la asignación. Aplique los valores del APU o agregue fases nuevas después de las predeterminadas para redistribuir.")}</p>
                    <button ref={alignApuButton} type="button" disabled={busy} onClick={() => alignApuPhases()}>{t("Apply APU default phases to draft", "Aplicar fases predeterminadas del APU al borrador")}</button>
                  </div>}
                  <label>{t("Allocation method", "Método de asignación")}
                    <select value={draft.economicAllocation.proposal.method}
                      onChange={(event) => changeAllocationMethod(event.target.value as AllocationProposal["method"])}>
                      <option value="apu_default">{t("Use APU defaults", "Usar valores del APU")}</option>
                      <option value="proportional">{t("Redistribute proportionally", "Redistribuir proporcionalmente")}</option>
                      <option value="deduct_specific">{t("Deduct from selected phases", "Deducir de fases específicas")}</option>
                      <option value="custom">{t("Custom allocation (Finance approval)", "Asignación personalizada (aprobación financiera)")}</option>
                    </select>
                  </label>
                  {("additions" in draft.economicAllocation.proposal) && <>
                    <p>{t("Add workflow phases after the APU defaults, then enter the share for each new phase.", "Agregue fases del flujo despues de las predeterminadas del APU e indique el porcentaje de cada fase nueva.")}</p>
                    {allocationAdditions().map((phase) => <label key={phase.phaseId}>{phase.name} ({phase.code}) - {t("New phase percent", "Porcentaje de fase nueva")}
                      <input inputMode="decimal" value={phase.percent} onChange={(event) => updateAddition(phase.phaseId, event.target.value)} />
                    </label>)}
                    {allocationAdditions().length === 0 && <p role="status">{t("Add a new workflow phase to use this method.", "Agregue una fase nueva al flujo para usar este metodo.")}</p>}
                  </>}
                  {draft.economicAllocation.proposal.method === "deduct_specific" && <>
                    <p>{t("Deduct exactly the new-phase total from the APU phases. No phase may become negative.", "Deducir exactamente el total de fases nuevas de las fases del APU. Ninguna fase puede quedar negativa.")}</p>
                    {draft.economicAllocation.proposal.deductions.map((row) => <label key={row.phaseId}>
                      {apuPhases.find((phase) => phase.phaseId === row.phaseId)?.name ?? row.phaseId} - {t("Deduction percent", "Porcentaje a deducir")}
                      <input inputMode="decimal" value={row.percent} onChange={(event) => updateDeduction(row.phaseId, event.target.value)} />
                    </label>)}
                  </>}
                  {draft.economicAllocation.proposal.method === "custom" && <>
                    <p>{t("Enter the final percentage for every workflow phase. The total must be exactly 100%.", "Indique el porcentaje final de cada fase del flujo. El total debe ser exactamente 100 %.")}</p>
                    {draft.economicAllocation.proposal.phases.map((row) => <label key={row.phaseId}>{row.name} ({row.code})
                      <input inputMode="decimal" value={row.percent} onChange={(event) => updateCustom(row.phaseId, event.target.value)} />
                    </label>)}
                    <button type="button" onClick={() => changeAllocationMethod("custom")}>{t("Match rows to current workflow phases", "Actualizar filas segun las fases actuales")}</button>
                    <label>{t("Reason for Finance approval", "Motivo para aprobacion financiera")}
                      <textarea value={draft.economicAllocation.proposal.approvalReason}
                        onChange={(event) => updateAllocationProposal({ ...draft.economicAllocation!.proposal as Extract<AllocationProposal, { method: "custom" }>, approvalReason: event.target.value })} />
                    </label>
                  </>}
                </>}
              </fieldset>
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
              <div className="company-workflow-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              <p>{preview.governance
                ? `${t("Governance Policy checked", "Política de gobernanza verificada")}: ${preview.governance.code} · v${preview.governance.version}`
                : t("No published company Governance Policy applies to this preview.", "Ninguna política de gobernanza publicada de la empresa aplica a esta vista previa.")}</p>
              <p>{t("Preview is not approval. The current policy and permissions are checked again when approving and publishing.", "La vista previa no es una aprobación. La política vigente y los permisos se verifican nuevamente al aprobar y publicar.")}</p>
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
              {preview.allocation && <div className="company-workflow-economic-preview" style={{ overflowX: "auto" }}>
                <h4>{t("Direct Production allocation", "Distribucion de produccion directa")}</h4>
                <p>{t("Commercial APU pool", "Fondo del APU Comercial")}: {preview.allocation.directProductionAmount} {preview.allocation.currency} - {t("Method", "Metodo")}: {preview.allocation.method}</p>
                <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
                  <thead><tr><th>{t("Phase", "Fase")}</th><th>{t("APU default", "APU original")}</th><th>{t("Workflow", "Flujo")}</th><th>{t("Change", "Cambio")}</th><th>{t("Amount", "Monto")}</th></tr></thead>
                  <tbody>{preview.allocation.rows.map((row) => <tr key={row.phaseId}>
                    <td>{row.name}</td><td>{row.apuDefaultPercent}%</td><td>{row.workflowPercent}%</td>
                    <td>{row.deltaDirection > 0 ? "+" : row.deltaDirection < 0 ? "-" : ""}{row.deltaPercent}%</td>
                    <td>{row.amount} {preview.allocation!.currency}</td>
                  </tr>)}</tbody>
                </table>
                <small>SHA-256 {preview.allocation.fingerprint.slice(0, 16)}</small>
              </div>}
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
                  {row.createdAt} · {row.action} · {row.versionId} · {row.actorName || `#${row.actorId}`}
                  {typeof row.details?.reason === "string" ? ` · ${row.details.reason}` : ""}
                </p>
              ))}
            </details>
          )}
        </section>
      )}
    </section>
  );
}
