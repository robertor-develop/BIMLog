import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  FileUp,
  HelpCircle,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";
import { FinancialProjectShell } from "@/components/layout/FinancialProjectShell";
import { ContractItemBulkEditor } from "@/components/job-intake/ContractItemBulkEditor";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const recoveryKey = (projectId: number) =>
  `bimlog:job-intake-recovery:${projectId}`;

function readRecovery(projectId: number) {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(recoveryKey(projectId)) || "null",
    );
    return parsed &&
      typeof parsed === "object" &&
      Number.isInteger(parsed.revision) &&
      parsed.data &&
      typeof parsed.data === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function preserveRecovery(projectId: number, revision: number, data: unknown) {
  try {
    window.localStorage.setItem(
      recoveryKey(projectId),
      JSON.stringify({ revision, data, preservedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

function clearMatchingRecovery(projectId: number, data: unknown) {
  const recovered = readRecovery(projectId);
  if (recovered && JSON.stringify(recovered.data) === JSON.stringify(data)) {
    try {
      window.localStorage.removeItem(recoveryKey(projectId));
    } catch {
      // A completed server save remains authoritative if browser storage is unavailable.
    }
  }
}

function removeRecovery(projectId: number) {
  try {
    window.localStorage.removeItem(recoveryKey(projectId));
  } catch {
    // The next load safely ignores unreadable browser storage.
  }
}
const stages = [
  "documents",
  "identity",
  "scope",
  "pricing",
  "contract",
  "delivery",
  "team",
  "review",
] as const;
const blank = {
  identity: {
    jobName: "",
    jobCode: "",
    clientName: "",
    clientCompany: "",
    location: "",
    currency: "USD",
    primaryContact: "",
    startDate: "",
    targetCompletionDate: "",
  },
  scopeItems: [] as any[],
  commercial: {
    contracts: [
      {
        id: "PRIMARY",
        quotationNumber: "",
        contractNumber: "",
        counterpartyName: "",
        perspective: "downstream",
        contractType: "subcontract",
        paymentTerms: "",
        effectiveDate: "",
        completionDate: "",
      },
    ],
    quotationNumber: "",
    contractNumber: "",
    counterpartyName: "",
    perspective: "downstream",
    contractType: "subcontract",
    budgetSnapshotId: "",
    paymentTerms: "",
    effectiveDate: "",
    completionDate: "",
  },
  delivery: {
    workflowTemplate: "bim-submittal",
    submittalStrategy: "",
    milestoneSummary: "",
  },
  team: {
    projectLeaderUserId: null as number | null,
    assignments: [] as any[],
  },
  review: {
    sourceConfirmed: false,
    scopeConfirmed: false,
    pricingConfirmed: false,
    contractConfirmed: false,
    deliveryConfirmed: false,
    teamConfirmed: false,
  },
};

const css = `
.ji-workspace{border:0;padding:0;margin:0;min-width:0}
.ji{max-width:1180px;margin:0 auto;padding:24px 0 80px}.ji *{box-sizing:border-box}.ji-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.ji h1{font-size:30px;margin:4px 0}.ji p{color:#536174}.ji-progress{min-width:260px;padding:16px;border:1px solid #d9e1ec;border-radius:14px;background:#fff}.ji-progress strong{font-size:26px}.ji-bar{height:9px;background:#e8edf5;border-radius:99px;overflow:hidden;margin-top:8px}.ji-bar span{display:block;height:100%;background:#2563eb}.ji-layout{display:grid;grid-template-columns:220px minmax(0,1fr);gap:18px}.ji-nav{position:sticky;top:16px;align-self:start;background:#fff;border:1px solid #d9e1ec;border-radius:14px;padding:10px}.ji-nav button{width:100%;border:0;background:transparent;padding:10px;border-radius:9px;text-align:left;display:flex;justify-content:space-between;cursor:pointer}.ji-nav button.on{background:#eaf1ff;color:#1649ad;font-weight:700}.ji-card{background:#fff;border:1px solid #d9e1ec;border-radius:14px;padding:20px;margin-bottom:16px;scroll-margin-top:20px}.ji-card h2{margin:0 0 4px;font-size:19px}.ji-guide{background:#eff6ff;border-left:4px solid #2563eb;padding:12px;margin:12px 0;border-radius:6px;color:#334155}.ji-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ji-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.ji label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.ji input,.ji select,.ji textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:10px;background:#fff;color:#0f172a}.ji textarea{min-height:78px;resize:vertical}.ji button{border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;background:#fff;cursor:pointer}.ji button.primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8;font-weight:700}.ji button.danger{color:#b42318}.ji button:disabled{opacity:.5;cursor:not-allowed}.ji-row{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-top:10px}.ji-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}.ji-rate{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin:12px 0}.ji-rate strong{display:block;color:#166534}.ji-total{font-size:15px;font-weight:800;color:#0f3f9f}.ji-missing{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px}.ji-check{display:flex!important;grid-template-columns:18px 1fr!important;align-items:flex-start;gap:8px!important;font-size:14px!important}.ji-check input{width:auto;margin-top:2px}.ji-doc{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #e2e8f0;padding:10px 0}.ji-footer{position:sticky;bottom:10px;display:flex;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid #cbd5e1;background:rgba(255,255,255,.96);border-radius:12px;box-shadow:0 8px 30px rgba(15,23,42,.12)}.ji-save-state{font-size:12px;font-weight:700;color:#475569}.ji-save-state.saving,.ji-save-state.unsaved{color:#9a3412}.ji-save-state.error{color:#b42318}.ji-error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;padding:12px;border-radius:10px;margin-bottom:12px}.ji-ok{background:#ecfdf5;color:#166534;padding:10px;border-radius:9px}.ji-small{font-size:12px;color:#64748b}.ji-upload{display:grid;grid-template-columns:1fr 160px 140px auto;gap:8px;align-items:end}.ji-paid{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;background:#fff7ed;color:#9a3412;font-size:10px;font-weight:800;margin-left:8px}.ji-lock{background:#f8fafc;border:1px dashed #94a3b8;border-radius:10px;padding:14px;color:#475569;margin:10px 0}.ji-activation{background:#ecfdf5;border:1px solid #86efac;border-radius:12px;padding:16px;margin-bottom:16px}.ji-activation-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.ji-stat{background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:10px}.ji-nav em{font-size:9px;color:#9a3412;font-style:normal}@media(max-width:900px){.ji-layout{grid-template-columns:1fr}.ji-nav{position:static;display:flex;overflow:auto}.ji-nav button{min-width:145px}.ji-grid,.ji-grid.three,.ji-activation-grid{grid-template-columns:1fr}.ji-upload{grid-template-columns:1fr}.ji-head{display:block}.ji-progress{margin-top:12px}}
.ji-mapper{margin:14px 0;padding:16px;border:1px solid #93c5fd;border-radius:12px;background:#f8fbff}.ji-mapper-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ji-mapper-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.ji-preview{overflow:auto;margin-top:12px}.ji-preview table{width:100%;border-collapse:collapse;font-size:12px}.ji-preview th,.ji-preview td{padding:7px;border:1px solid #dbe4f0;text-align:left}.ji-preview th{background:#eaf1ff}.ji-issues{color:#9f1239;font-weight:700}@media(max-width:900px){.ji-mapper-grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.ji-mapper-grid{grid-template-columns:1fr}.ji-mapper-head{display:block}}
`;

export function JobIntakeWorkspace() {
  const { token } = useAuthStore();
  const { language, tt } = useI18n();
  const [, route] = useRoute("/projects/:id/intake");
  const projectId = Number(route?.id);
  const [intake, setIntake] = useState<any>(null),
    [data, setData] = useState<any>(blank),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [guide, setGuide] = useState(true),
    [active, setActive] = useState<string>("documents"),
    [apu, setApu] = useState<any>(null),
    [workspace, setWorkspace] = useState<any>(null),
    [budgetLines, setBudgetLines] = useState<any[]>([]),
    [mappingDocument, setMappingDocument] = useState<any>(null),
    [mappingForm, setMappingForm] = useState({
      sheetName: "",
      headerRow: 1,
      nameColumn: 0,
      quantityColumn: 1,
    }),
    [mappingPreview, setMappingPreview] = useState<any>(null),
    [mappingBusy, setMappingBusy] = useState(false),
    [saveState, setSaveState] = useState<
      "saved" | "unsaved" | "saving" | "error"
    >("saved");
  const revisionRef = useRef(0),
    dataRef = useRef<any>(blank),
    intakeRef = useRef<any>(null),
    lastSavedRef = useRef(""),
    pendingSaveRef = useRef<any>(null),
    savePromiseRef = useRef<Promise<any> | null>(null),
    saveRetryRef = useRef(0),
    saveTimerRef = useRef<number | null>(null);
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );
  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(`${API_BASE}/api/v1${path}`, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          (language === "es" ? payload?.error?.es : payload?.error?.en) ||
            payload?.error?.en ||
            tt("The request failed.", "La solicitud falló."),
        );
      return payload;
    },
    [headers, language, tt],
  );
  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      const found = await api(`/projects/${projectId}/intake`);
      const current =
        found?.intake === null
          ? await api(`/projects/${projectId}/intake`, { method: "POST" })
          : found;
      const [plan, budget] = await Promise.all([
        current.capabilities?.costValuePlanner
          ? api(`/projects/${projectId}/financial/apu`)
          : Promise.resolve(null),
        current.capabilities?.budget
          ? api(`/projects/${projectId}/financial/workspace`)
          : Promise.resolve(null),
      ]);
      const recovered = readRecovery(projectId);
      const canRecover =
        recovered?.revision === current.revision &&
        JSON.stringify(recovered.data) !== JSON.stringify(current.data);
      const loadedData = canRecover ? recovered.data : current.data;
      revisionRef.current = current.revision;
      dataRef.current = loadedData;
      lastSavedRef.current = JSON.stringify(current.data);
      pendingSaveRef.current = null;
      intakeRef.current = current;
      setIntake(current);
      setData(loadedData);
      setSaveState(canRecover ? "unsaved" : "saved");
      if (canRecover)
        setNotice(
          tt(
            "Recovered unsaved Contract Items from this browser. Autosave is retrying now.",
            "Se recuperaron Partidas de Contrato no guardadas de este navegador. El guardado autom\u00e1tico se reintenta ahora.",
          ),
        );
      else if (recovered && recovered.revision < current.revision)
        removeRecovery(projectId);
      setApu(plan?.data?.plan ?? null);
      setWorkspace(budget);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [api, projectId, tt]);
  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    dataRef.current = data;
    saveRetryRef.current = 0;
  }, [data]);
  const persist = useCallback(
    async (snapshot: any, announce = false) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const currentIntake = intakeRef.current;
      if (
        !currentIntake ||
        (currentIntake.status === "activated" &&
          currentIntake.activatedContractId)
      )
        return currentIntake;
      pendingSaveRef.current = snapshot;
      if (!savePromiseRef.current) {
        savePromiseRef.current = (async () => {
          let lastResult = intakeRef.current;
          try {
            while (pendingSaveRef.current) {
              const next = pendingSaveRef.current;
              pendingSaveRef.current = null;
              setSaveState("saving");
              const result = await api(`/projects/${projectId}/intake`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  expectedRevision: revisionRef.current,
                  data: next,
                }),
              });
              revisionRef.current = result.revision;
              intakeRef.current = result;
              saveRetryRef.current = 0;
              lastSavedRef.current = JSON.stringify(result.data);
              clearMatchingRecovery(projectId, next);
              lastResult = result;
              setIntake(result);
              if (JSON.stringify(dataRef.current) === JSON.stringify(next)) {
                dataRef.current = result.data;
                setData(result.data);
                setSaveState("saved");
              } else {
                pendingSaveRef.current = dataRef.current;
                setSaveState("unsaved");
              }
            }
            return lastResult;
          } catch (cause) {
            pendingSaveRef.current = dataRef.current;
            setSaveState("error");
            setError(cause instanceof Error ? cause.message : String(cause));
            if (saveRetryRef.current < 2) {
              saveRetryRef.current += 1;
              saveTimerRef.current = window.setTimeout(
                () => void persist(dataRef.current).catch(() => undefined),
                2000,
              );
            }
            throw cause;
          } finally {
            savePromiseRef.current = null;
          }
        })();
      }
      const result = await savePromiseRef.current;
      if (announce) {
        setNotice(
          tt(
            "Intake saved. You can safely return later.",
            "Ingreso guardado. Puede regresar después con seguridad.",
          ),
        );
      }
      return result;
    },
    [api, projectId, tt],
  );
  useEffect(() => {
    if (
      !intake ||
      JSON.stringify(data) === lastSavedRef.current ||
      (intake.status === "activated" && intake.activatedContractId)
    )
      return;
    setSaveState("unsaved");
    if (!preserveRecovery(projectId, revisionRef.current, data)) {
      setSaveState("error");
      setError(
        tt(
          "This browser could not preserve a local recovery copy. Keep this page open while autosave retries.",
          "Este navegador no pudo conservar una copia local de recuperaci\u00f3n. Mantenga esta p\u00e1gina abierta mientras se reintenta el guardado autom\u00e1tico.",
        ),
      );
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(
      () => void persist(dataRef.current).catch(() => undefined),
      900,
    );
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [data, intake, persist, projectId, tt]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        saveState === "unsaved" ||
        saveState === "saving" ||
        saveState === "error"
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const change = (section: string, field: string, value: unknown) =>
    setData((old: any) => ({
      ...old,
      [section]: { ...old[section], [field]: value },
    }));
  const setScopeItems = (updater: (items: any[]) => any[]) =>
    setData((old: any) => ({
      ...old,
      scopeItems: updater(old.scopeItems),
      review: {
        ...old.review,
        scopeConfirmed: false,
        pricingConfirmed: false,
      },
    }));
  const setContracts = (updater: (contracts: any[]) => any[]) =>
    setData((old: any) => ({
      ...old,
      commercial: {
        ...old.commercial,
        contracts: updater(old.commercial.contracts || []),
      },
      review: { ...old.review, contractConfirmed: false },
    }));
  const changeContract = (index: number, field: string, value: unknown) =>
    setData((old: any) => {
      const contracts = (old.commercial.contracts || []).map(
        (contract: any, contractIndex: number) =>
          contractIndex === index ? { ...contract, [field]: value } : contract,
      );
      return {
        ...old,
        commercial: {
          ...old.commercial,
          ...(index === 0 ? { [field]: value } : {}),
          contracts,
        },
        review: { ...old.review, contractConfirmed: false },
      };
    });
  const addContract = () => {
    if ((data.commercial.contracts || []).length >= 50) {
      setError(
        tt(
          "An Intake accepts up to 50 contract profiles.",
          "Un Ingreso acepta hasta 50 perfiles de contrato.",
        ),
      );
      return;
    }
    setContracts((contracts) => [
      ...contracts,
      {
        id: `CONTRACT-${crypto.randomUUID()}`,
        quotationNumber: "",
        contractNumber: "",
        counterpartyName: "",
        perspective: "downstream",
        contractType: "subcontract",
        paymentTerms: "",
        effectiveDate: "",
        completionDate: "",
      },
    ]);
  };
  const removeContract = (contractId: string) => {
    if (data.scopeItems.some((item: any) => item.contractId === contractId)) {
      setError(
        tt(
          "Reassign this contract's Contract Items before removing it.",
          "Reasigne las Partidas de Contrato de este contrato antes de eliminarlo.",
        ),
      );
      return;
    }
    setContracts((contracts) =>
      contracts.filter((contract) => contract.id !== contractId),
    );
  };
  const assignmentChange = (index: number, field: string, value: unknown) =>
    setData((old: any) => ({
      ...old,
      team: {
        ...old.team,
        assignments: old.team.assignments.map((item: any, i: number) =>
          i === index ? { ...item, [field]: value } : item,
        ),
      },
    }));
  const latestRate = String(apu?.sellingPrice ?? "0.00"),
    latestApuVersion = apu?.version ?? null;
  const money = (quantity: unknown, rate: unknown) =>
    (Number(quantity || 0) * Number(rate || 0)).toFixed(2);
  const save = async () => {
    setError("");
    setNotice("");
    try {
      await persist(dataRef.current, true);
    } catch {
      // persist owns the visible error state.
    }
  };
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget,
      formData = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const saved = await persist(dataRef.current);
      if (!saved)
        throw new Error(
          tt(
            "The Intake is not ready to save.",
            "El ingreso no está listo para guardar.",
          ),
        );
      formData.set("expectedRevision", String(saved.revision));
      await api(`/projects/${projectId}/intake/documents`, {
        method: "POST",
        body: formData,
      });
      form.reset();
      await load();
      setNotice(
        tt(
          "Source document preserved and indexed.",
          "Documento fuente preservado e indexado.",
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };
  const selectSnapshot = async (id: string) => {
    change("commercial", "budgetSnapshotId", id);
    setBudgetLines([]);
    if (!id) return;
    try {
      const detail = await api(
        `/projects/${projectId}/financial/snapshots/${id}`,
      );
      setBudgetLines(detail.snapshot?.lines ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const openMapper = (doc: any) => {
    const sheet = doc.extractionSummary?.sheets?.[0];
    if (!sheet) return;
    setMappingDocument(doc);
    setMappingForm({
      sheetName: sheet.name,
      headerRow: 1,
      nameColumn: 0,
      quantityColumn: Math.min(1, Math.max(0, sheet.columnCount - 1)),
    });
    setMappingPreview(null);
    setError("");
  };
  const previewMapping = async () => {
    if (!mappingDocument) return;
    setMappingBusy(true);
    setError("");
    try {
      setMappingPreview(
        await api(
          `/projects/${projectId}/intake/documents/${mappingDocument.id}/mapping-preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mappingForm),
          },
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setMappingBusy(false);
    }
  };
  const applyMapping = async () => {
    if (!mappingDocument || !mappingPreview) return;
    setBusy(true);
    setMappingBusy(true);
    setError("");
    try {
      const saved = await persist(dataRef.current);
      if (!saved)
        throw new Error(
          tt(
            "The Intake is not ready to save.",
            "El ingreso no está listo para guardar.",
          ),
        );
      const result = await api(
        `/projects/${projectId}/intake/documents/${mappingDocument.id}/mapping-apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...mappingForm,
            expectedRevision: saved.revision,
            mappingFingerprint: mappingPreview.mappingFingerprint,
          }),
        },
      );
      revisionRef.current = result.revision;
      intakeRef.current = result;
      dataRef.current = result.data;
      lastSavedRef.current = JSON.stringify(result.data);
      pendingSaveRef.current = null;
      setIntake(result);
      setData(result.data);
      setSaveState("saved");
      setMappingDocument(null);
      setMappingPreview(null);
      setNotice(
        tt(
          `${mappingPreview.rows.length} Contract Items imported and saved.`,
          `Se importaron y guardaron ${mappingPreview.rows.length} Partidas de Contrato.`,
        ),
      );
      document
        .getElementById("ji-scope")
        ?.scrollIntoView({ behavior: "smooth" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
      setMappingBusy(false);
    }
  };
  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await persist(dataRef.current);
      if (!saved?.completion?.ready)
        throw new Error(
          tt(
            "Save and complete every required Intake item before activation.",
            "Guarde y complete cada requisito del ingreso antes de activar.",
          ),
        );
      const result = await api(`/projects/${projectId}/intake/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: saved.revision,
          confirmationFingerprint: saved.completion.fingerprint,
        }),
      });
      const createdContracts = Array.isArray(result.contractIds)
        ? result.contractIds.length
        : result.contractId
          ? 1
          : 0;
      setNotice(
        createdContracts > 0
          ? tt(
              `Job activated with ${createdContracts} Commercial contract(s).`,
              `Trabajo activado con ${createdContracts} contrato(s) comercial(es).`,
            )
          : tt(
              "Operational job activated with work items, tasks, and resource assignments.",
              "Trabajo operativo activado con partidas, tareas y asignaciones de recursos.",
            ),
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };
  if (!intake)
    return (
      <FinancialProjectShell projectId={projectId} activeTab="intake">
        <main className="ji">
          <p>
            {busy
              ? tt(
                  "Preparing Job Intake...",
                  "Preparando ingreso de trabajo...",
                )
              : error}
          </p>
        </main>
      </FinancialProjectShell>
    );
  const completion = intake.completion ?? {
    percent: 0,
    stages: [],
    missing: [],
    totals: {},
  };
  const capabilities = intake.capabilities ?? {
    package: false,
    budget: false,
    contracts: false,
    costValuePlanner: false,
    anyCommercial: false,
    fullCommercialActivation: false,
  };
  const canEnrich =
    intake.status === "activated" &&
    !intake.activatedContractId &&
    capabilities.fullCommercialActivation;
  const firstMissing = completion.missingItems?.[0]
    ? tt(completion.missingItems[0].en, completion.missingItems[0].es)
    : completion.missing?.[0];
  const stageLabel = (key: string) =>
    (
      ({
        documents: tt("Source documents", "Documentos fuente"),
        identity: tt("Job identity", "Identidad del trabajo"),
        scope: tt("Contract Items", "Partidas de Contrato"),
        pricing: tt("APU pricing", "Precios APU"),
        contract:
          !capabilities.contracts && capabilities.budget
            ? tt("Budget mapping", "Vinculación presupuestaria")
            : tt("Contract setup", "Configuración contractual"),
        delivery: tt("Delivery workflow", "Flujo de entrega"),
        team: tt("Team & resource plan", "Equipo y plan de recursos"),
        review: tt("Review & activate", "Revisar y activar"),
      }) as any
    )[key];
  const categoryLabel = (value: string) =>
    (
      ({
        quotation: tt("Quotation", "Cotización"),
        proposal: tt("Proposal", "Propuesta"),
        takeoff: tt("Takeoff", "Cómputo de cantidades"),
        estimate: tt("Estimate", "Estimado"),
        contract: tt("Contract", "Contrato"),
        supporting: tt("Supporting", "Documento de apoyo"),
      }) as Record<string, string>
    )[value] ?? value;
  const missingItems = completion.missingItems?.length
    ? completion.missingItems.map(
        (item: { code: string; en: string; es: string }) => ({
          key: item.code,
          label: tt(item.en, item.es),
        }),
      )
    : (completion.missing ?? []).map((item: string) => ({
        key: item,
        label: item,
      }));
  const reviewItems = [
    [
      "sourceConfirmed",
      tt(
        "Source documents are correct.",
        "Los documentos fuente son correctos.",
      ),
      (intake.documents?.filter((document: any) => !document.removedAt)
        .length ?? 0) > 0,
    ],
    [
      "scopeConfirmed",
      tt(
        "Scope and planned hours are correct.",
        "El alcance y las horas planificadas son correctos.",
      ),
      true,
    ],
    [
      "pricingConfirmed",
      tt(
        "APU and billing hourly rates are correct.",
        "El APU y las tarifas facturables son correctos.",
      ),
      capabilities.costValuePlanner,
    ],
    [
      "contractConfirmed",
      capabilities.budget
        ? tt(
            "Contract terms and budget mappings are correct.",
            "Los términos contractuales y vínculos presupuestarios son correctos.",
          )
        : tt(
            "Contract terms are correct.",
            "Los términos contractuales son correctos.",
          ),
      capabilities.contracts,
    ],
    [
      "deliveryConfirmed",
      tt("Delivery workflow is correct.", "El flujo de entrega es correcto."),
      true,
    ],
    [
      "teamConfirmed",
      capabilities.budget
        ? tt(
            "Assignments, hours, and internal hourly costs are correct.",
            "Las asignaciones, horas y costos horarios internos son correctos.",
          )
        : tt(
            "Assignments and planned hours are correct.",
            "Las asignaciones y horas planificadas son correctas.",
          ),
      true,
    ],
  ].filter(([, , visible]) => visible) as Array<[string, string, boolean]>;
  const mappingSheet = mappingDocument?.extractionSummary?.sheets?.find(
    (sheet: any) => sheet.name === mappingForm.sheetName,
  );
  const headerCells = mappingSheet?.rows?.[mappingForm.headerRow - 1] ?? [];
  const columnLabel = (index: number) => {
    let value = index + 1,
      label = "";
    while (value > 0) {
      value -= 1;
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26);
    }
    return `${label} · ${headerCells[index] || tt("Unnamed column", "Columna sin nombre")}`;
  };
  return (
    <FinancialProjectShell projectId={projectId} activeTab="intake">
      <style>{css}</style>
      <main className="ji">
        <div className="ji-head">
          <div>
            <Link href={`/projects/${projectId}/dashboard`}>
              <ArrowLeft size={14} />{" "}
              {tt("Back to project", "Volver al proyecto")}
            </Link>
            <h1>
              {tt("Job Intake & Setup", "Ingreso y configuración del trabajo")}
            </h1>
            <p>
              {tt(
                "Turn the negotiated job into an executable BIMLog project. Core operational activation is available to every project member; Commercial features appear only when enabled in Total Control.",
                "Convierta el trabajo negociado en un proyecto BIMLog ejecutable. La activación operativa básica está disponible para cada miembro del proyecto; las funciones comerciales aparecen solamente cuando están habilitadas en Control Total.",
              )}
            </p>
            <div className="ji-actions">
              <span className="ji-paid">
                {tt("Core included", "Funciones básicas incluidas")}
              </span>
              {capabilities.costValuePlanner && (
                <span className="ji-paid">
                  {tt("Cost & Value enabled", "Costo y valor habilitado")}
                </span>
              )}
              {capabilities.budget && (
                <span className="ji-paid">
                  {tt("Budget enabled", "Presupuesto habilitado")}
                </span>
              )}
              {capabilities.contracts && (
                <span className="ji-paid">
                  {tt("Contracts enabled", "Contratos habilitados")}
                </span>
              )}
            </div>
          </div>
          <div className="ji-progress">
            <strong>{completion.percent}%</strong> {tt("complete", "completo")}
            <div className="ji-bar">
              <span style={{ width: `${completion.percent}%` }} />
            </div>
            <div className="ji-small">
              {firstMissing || tt("Ready to activate", "Listo para activar")}
            </div>
          </div>
        </div>
        {error && (
          <div className="ji-error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="ji-ok" role="status" aria-live="polite">
            {notice}
          </div>
        )}
        {intake.activation && (
          <section className="ji-activation">
            <strong>
              {tt(
                "Activated operational foundation",
                "Base operativa activada",
              )}
            </strong>
            <div>
              {tt(
                "The saved Intake created reusable work items, delivery tasks, and resource assignments.",
                "El ingreso guardado creó partidas reutilizables, tareas de entrega y asignaciones de recursos.",
              )}
            </div>
            <div className="ji-activation-grid">
              <div className="ji-stat">
                <strong>{intake.activation.workItems?.length ?? 0}</strong>
                <div>{tt("Work items", "Partidas")}</div>
              </div>
              <div className="ji-stat">
                <strong>{intake.activation.tasks?.length ?? 0}</strong>
                <div>{tt("Tasks", "Tareas")}</div>
              </div>
              <div className="ji-stat">
                <strong>{intake.activation.assignments?.length ?? 0}</strong>
                <div>
                  {tt("Resource assignments", "Asignaciones de recursos")}
                </div>
              </div>
            </div>
            {intake.activatedContractId ? (
              <div className="ji-actions">
                <CheckCircle2 size={16} />
                {tt(
                  "Commercial contracts created",
                  "Contratos comerciales creados",
                )}
                : {intake.activationSummary?.contracts?.length || 1}
              </div>
            ) : (
              <div className="ji-small">
                {tt(
                  "No Commercial records were required for this activation. Enabling the complete Commercial package later will reuse this Intake.",
                  "No se requirieron registros Comerciales para esta activación. Si luego habilita el paquete Comercial completo, este mismo ingreso será reutilizado.",
                )}
              </div>
            )}
          </section>
        )}
        <fieldset className="ji-workspace" disabled={busy}>
          <div className="ji-layout">
            <aside className="ji-nav">
              {stages.map((key) => {
                const state = completion.stages?.find(
                  (s: any) => s.key === key,
                );
                return (
                  <button
                    key={key}
                    className={active === key ? "on" : ""}
                    onClick={() => {
                      setActive(key);
                      document
                        .getElementById(`ji-${key}`)
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {stageLabel(key)}{" "}
                    {!state?.required ? (
                      <em>{tt("Optional", "Opcional")}</em>
                    ) : (
                      state?.progress === 100 && <CheckCircle2 size={15} />
                    )}
                  </button>
                );
              })}
            </aside>
            <div>
              <div
                className="ji-actions"
                style={{
                  justifyContent: "flex-end",
                  marginTop: 0,
                  marginBottom: 10,
                }}
              >
                <button onClick={() => setGuide(!guide)}>
                  <HelpCircle size={15} />{" "}
                  {guide
                    ? tt("Hide guide", "Ocultar guía")
                    : tt("Show guide", "Mostrar guía")}
                </button>
              </div>
              <section className="ji-card" id="ji-documents">
                <h2>1. {stageLabel("documents")}</h2>
                {guide && (
                  <div className="ji-guide">
                    {tt(
                      "Optional: upload a quotation, proposal, contract, takeoff, or estimate when it helps. Originals remain preserved. Inspect and map Excel, XLSM, or CSV sheets before adding Contract Items; PDF and Word remain manual-review evidence only.",
                      "Opcional: cargue una cotización, propuesta, contrato, cómputo de cantidades o estimado cuando sea útil. Los originales quedan preservados. Inspeccione y mapee hojas de Excel, XLSM o CSV antes de agregar Partidas de Contrato; PDF y Word permanecen solamente como evidencia para revisión manual.",
                    )}
                  </div>
                )}
                <form className="ji-upload" onSubmit={upload}>
                  <label>
                    {tt("File", "Archivo")}
                    <input
                      required
                      type="file"
                      name="file"
                      accept=".pdf,.docx,.xlsx,.xlsm,.xls,.csv"
                    />
                  </label>
                  <label>
                    {tt("Category", "Categoría")}
                    <select name="category">
                      <option value="quotation">
                        {categoryLabel("quotation")}
                      </option>
                      <option value="proposal">
                        {categoryLabel("proposal")}
                      </option>
                      <option value="takeoff">
                        {categoryLabel("takeoff")}
                      </option>
                      <option value="estimate">
                        {categoryLabel("estimate")}
                      </option>
                      <option value="contract">
                        {categoryLabel("contract")}
                      </option>
                      <option value="supporting">
                        {categoryLabel("supporting")}
                      </option>
                    </select>
                  </label>
                  <label>
                    {tt("Revision", "Revisión")}
                    <input
                      name="revisionLabel"
                      placeholder={tt("Rev 1", "Rev. 1")}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    <FileUp size={15} /> {tt("Upload", "Cargar")}
                  </button>
                </form>
                {intake.documents?.map(
                  (doc: any) =>
                    !doc.removedAt && (
                      <div className="ji-doc" key={doc.id}>
                        <div>
                          <strong>{doc.fileName}</strong>
                          <div className="ji-small">
                            {categoryLabel(doc.category)} ·{" "}
                            {doc.revisionLabel || "—"} · SHA{" "}
                            {doc.sourceHash?.slice(0, 12)}…
                          </div>
                        </div>
                        <div className="ji-actions">
                          {doc.extractionSummary?.sheets?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openMapper(doc)}
                            >
                              {tt(
                                "Inspect & map Contract Items",
                                "Inspeccionar y mapear Partidas de Contrato",
                              )}
                            </button>
                          )}
                          <button
                            className="danger"
                            aria-label={tt(
                              "Remove document",
                              "Eliminar documento",
                            )}
                            title={tt("Remove document", "Eliminar documento")}
                            onClick={async () => {
                              setBusy(true);
                              setError("");
                              try {
                                const saved = await persist(dataRef.current);
                                if (!saved)
                                  throw new Error(
                                    tt(
                                      "The Intake is not ready to save.",
                                      "El ingreso no está listo para guardar.",
                                    ),
                                  );
                                await api(
                                  `/projects/${projectId}/intake/documents/${doc.id}?expectedRevision=${saved.revision}`,
                                  { method: "DELETE" },
                                );
                                await load();
                              } catch (cause) {
                                setError(
                                  cause instanceof Error
                                    ? cause.message
                                    : String(cause),
                                );
                                setBusy(false);
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ),
                )}
                {mappingDocument && mappingSheet && (
                  <div
                    className="ji-mapper"
                    role="region"
                    aria-label={tt(
                      "Spreadsheet import mapper",
                      "Mapeador de importación de hoja de cálculo",
                    )}
                  >
                    <div className="ji-mapper-head">
                      <div>
                        <strong>
                          {tt(
                            "Confirm the source mapping",
                            "Confirme el mapeo de origen",
                          )}
                        </strong>
                        <div className="ji-small">
                          {mappingDocument.fileName} · SHA{" "}
                          {mappingDocument.sourceHash?.slice(0, 12)}…
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMappingDocument(null);
                          setMappingPreview(null);
                        }}
                      >
                        {tt("Close", "Cerrar")}
                      </button>
                    </div>
                    <p>
                      {tt(
                        "Choose the sheet, header row, Contract Item Name column, and Quantity column. Previewing never creates financial records; confirmed rows append to this autosaved Intake draft.",
                        "Elija la hoja, la fila de encabezado, la columna Nombre de la Partida y la columna Cantidad. La vista previa nunca crea registros financieros; las filas confirmadas se agregan a este borrador de Ingreso con guardado automático.",
                      )}
                    </p>
                    <div className="ji-mapper-grid">
                      <label>
                        {tt("Sheet", "Hoja")}
                        <select
                          value={mappingForm.sheetName}
                          onChange={(event) => {
                            const sheetName = event.target.value;
                            const selectedSheet =
                              mappingDocument.extractionSummary.sheets.find(
                                (sheet: any) => sheet.name === sheetName,
                              );
                            setMappingForm((old) => ({
                              ...old,
                              sheetName,
                              headerRow: 1,
                              nameColumn: 0,
                              quantityColumn: Math.min(
                                1,
                                Math.max(
                                  0,
                                  Number(selectedSheet?.columnCount || 1) - 1,
                                ),
                              ),
                            }));
                            setMappingPreview(null);
                          }}
                        >
                          {mappingDocument.extractionSummary.sheets.map(
                            (sheet: any) => (
                              <option key={sheet.name} value={sheet.name}>
                                {sheet.name} · {sheet.rowCount} ×{" "}
                                {sheet.columnCount}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        {tt("Header row", "Fila de encabezado")}
                        <select
                          value={mappingForm.headerRow}
                          onChange={(event) => {
                            setMappingForm((old) => ({
                              ...old,
                              headerRow: Number(event.target.value),
                            }));
                            setMappingPreview(null);
                          }}
                        >
                          {mappingSheet.rows
                            .slice(0, 25)
                            .map((row: unknown[], index: number) => (
                              <option key={index} value={index + 1}>
                                {index + 1} ·{" "}
                                {row.filter(Boolean).slice(0, 3).join(" | ") ||
                                  tt("Blank", "Vacía")}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        {tt(
                          "Contract Item Name column",
                          "Columna Nombre de la Partida",
                        )}
                        <select
                          value={mappingForm.nameColumn}
                          onChange={(event) => {
                            setMappingForm((old) => ({
                              ...old,
                              nameColumn: Number(event.target.value),
                            }));
                            setMappingPreview(null);
                          }}
                        >
                          {Array.from(
                            { length: mappingSheet.columnCount },
                            (_, index) => (
                              <option key={index} value={index}>
                                {columnLabel(index)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        {tt("Quantity column", "Columna Cantidad")}
                        <select
                          value={mappingForm.quantityColumn}
                          onChange={(event) => {
                            setMappingForm((old) => ({
                              ...old,
                              quantityColumn: Number(event.target.value),
                            }));
                            setMappingPreview(null);
                          }}
                        >
                          {Array.from(
                            { length: mappingSheet.columnCount },
                            (_, index) => (
                              <option key={index} value={index}>
                                {columnLabel(index)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                    <div className="ji-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={
                          mappingBusy ||
                          mappingForm.nameColumn === mappingForm.quantityColumn
                        }
                        onClick={() => void previewMapping()}
                      >
                        {mappingBusy
                          ? tt("Inspecting…", "Inspeccionando…")
                          : tt(
                              "Preview mapped rows",
                              "Previsualizar filas mapeadas",
                            )}
                      </button>
                    </div>
                    {mappingPreview && (
                      <div className="ji-preview">
                        <p>
                          <strong>
                            {tt(
                              `${mappingPreview.rows.length} valid rows`,
                              `${mappingPreview.rows.length} filas válidas`,
                            )}
                          </strong>
                        </p>
                        {mappingPreview.issues?.length > 0 && (
                          <div className="ji-issues" role="alert">
                            {mappingPreview.issues.map(
                              (issue: any, index: number) => (
                                <div key={index}>
                                  {tt("Row", "Fila")} {issue.sourceRow}:{" "}
                                  {tt(issue.en, issue.es)}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                        <table>
                          <thead>
                            <tr>
                              <th>{tt("Source row", "Fila fuente")}</th>
                              <th>
                                {tt(
                                  "Contract Item Name",
                                  "Nombre de la Partida",
                                )}
                              </th>
                              <th>{tt("Quantity", "Cantidad")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {mappingPreview.rows
                              .slice(0, 25)
                              .map((row: any) => (
                                <tr key={row.id}>
                                  <td>{row.provenance.sourceRow}</td>
                                  <td>{row.name}</td>
                                  <td>{row.quantity}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {mappingPreview.rows.length > 25 && (
                          <p className="ji-small">
                            {tt(
                              `Showing 25 of ${mappingPreview.rows.length} rows.`,
                              `Mostrando 25 de ${mappingPreview.rows.length} filas.`,
                            )}
                          </p>
                        )}
                        <div className="ji-actions">
                          <button
                            type="button"
                            className="primary"
                            disabled={
                              busy ||
                              mappingPreview.issues?.length > 0 ||
                              mappingPreview.rows.length === 0
                            }
                            onClick={() => void applyMapping()}
                          >
                            {tt(
                              "Confirm and append to draft",
                              "Confirmar y agregar al borrador",
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
              <section className="ji-card" id="ji-identity">
                <h2>2. {stageLabel("identity")}</h2>
                {guide && (
                  <div className="ji-guide">
                    {tt(
                      "Confirm what this job is, who contracted it, and the dates the delivery team must work against.",
                      "Confirme qué trabajo es, quién lo contrató y las fechas que debe cumplir el equipo de entrega.",
                    )}
                  </div>
                )}
                <div className="ji-grid three">
                  {[
                    ["jobName", tt("Job name", "Nombre del trabajo")],
                    ["jobCode", tt("Job code", "Código del trabajo")],
                    ["clientName", tt("Client", "Cliente")],
                    ["clientCompany", tt("Client company", "Empresa cliente")],
                    ["location", tt("Location", "Ubicación")],
                    [
                      "primaryContact",
                      tt("Primary contact", "Contacto principal"),
                    ],
                  ].map(([field, label]) => (
                    <label key={field}>
                      {label}
                      <input
                        value={data.identity[field]}
                        onChange={(e) =>
                          change("identity", field, e.target.value)
                        }
                      />
                    </label>
                  ))}
                  <label>
                    {tt("Currency", "Moneda")}
                    <select
                      value={data.identity.currency}
                      onChange={(e) =>
                        change("identity", "currency", e.target.value)
                      }
                    >
                      <option>USD</option>
                      <option>CAD</option>
                      <option>EUR</option>
                    </select>
                  </label>
                  <label>
                    {tt("Start date", "Fecha de inicio")}
                    <input
                      type="date"
                      value={data.identity.startDate}
                      onChange={(e) =>
                        change("identity", "startDate", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    {tt("Target completion", "Fecha prevista de terminación")}
                    <input
                      type="date"
                      value={data.identity.targetCompletionDate}
                      onChange={(e) =>
                        change(
                          "identity",
                          "targetCompletionDate",
                          e.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </section>
              <section className="ji-card" id="ji-scope">
                <h2>
                  3–4. {stageLabel("scope")} + {stageLabel("pricing")}
                </h2>
                <div className="ji-rate">
                  <strong>
                    {tt(
                      "Quantity connects each Contract Item to its inherited unit, staffing plan, and Commercial value.",
                      "La Cantidad conecta cada Partida de Contrato con su unidad heredada, el plan de personal y el valor comercial.",
                    )}
                  </strong>
                  {capabilities.costValuePlanner
                    ? tt(
                        "Quantity × inherited APU/unit rate = calculated value. The latest compatible saved Cost & Value plan supplies the default rate.",
                        "Cantidad × tarifa APU/unitaria heredada = valor calculado. El último plan compatible de costo y valor guardado suministra la tarifa predeterminada.",
                      )
                    : tt(
                        "Every user can define Contract Item Name and Quantity. Rates and APU links are optional Commercial features.",
                        "Todo usuario puede definir Nombre y Cantidad de la Partida de Contrato. Las tarifas y los vínculos APU son funciones comerciales opcionales.",
                      )}
                </div>
                {guide && (
                  <div className="ji-guide">
                    {capabilities.costValuePlanner
                      ? tt(
                          "Each draft row has a stable Contract Item ID. Activation creates the shared operational item and, when entitled, its APU-backed Commercial snapshot without a duplicate Intake store.",
                          "Cada fila del borrador tiene un ID estable de Partida de Contrato. La activación crea la partida operativa compartida y, cuando corresponde, su instantánea Comercial respaldada por APU sin duplicar el almacén de Ingreso.",
                        )
                      : tt(
                          "Add one Contract Item per deliverable or work package. Activation creates operational work items even without paid Commercial features.",
                          "Agregue una Partida de Contrato por cada entregable o paquete de trabajo. La activación crea partidas operativas aun sin funciones comerciales pagadas.",
                        )}
                  </div>
                )}
                <ContractItemBulkEditor
                  items={data.scopeItems}
                  setItems={setScopeItems}
                  currency={data.identity.currency}
                  defaultRate={capabilities.costValuePlanner ? latestRate : "0"}
                  defaultApuVersion={
                    capabilities.costValuePlanner ? latestApuVersion : null
                  }
                  defaultWorkflow={data.delivery.workflowTemplate}
                  capabilities={capabilities}
                  contracts={data.commercial.contracts || []}
                  defaultContractId={
                    data.commercial.contracts?.[0]?.id || "PRIMARY"
                  }
                  budgetSnapshotId={data.commercial.budgetSnapshotId}
                  budgetLines={budgetLines}
                  onBudgetSnapshotChange={(id) => void selectSnapshot(id)}
                  snapshots={workspace?.snapshots ?? []}
                  tt={tt}
                  onError={setError}
                  onNotice={setNotice}
                />
              </section>
              <section className="ji-card" id="ji-contract">
                <h2>
                  5. {stageLabel("contract")}
                  {!capabilities.contracts && (
                    <span className="ji-paid">
                      {tt(
                        "Optional Commercial feature",
                        "Función comercial opcional",
                      )}
                    </span>
                  )}
                </h2>
                {capabilities.contracts ? (
                  <>
                    {guide && (
                      <div className="ji-guide">
                        {tt(
                          "Capture one profile per negotiated contract or purchase order. Activation groups each assigned Contract Item into its canonical draft contract without overwriting source documents.",
                          "Registre un perfil por cada contrato u orden de compra negociado. La activaci\u00f3n agrupa cada Partida de Contrato asignada en su contrato borrador can\u00f3nico sin sobrescribir los documentos fuente.",
                        )}
                      </div>
                    )}
                    <p className="ji-small">
                      {tt(
                        "Primary contract profile",
                        "Perfil de contrato principal",
                      )}
                    </p>
                    <div className="ji-grid three">
                      {[
                        [
                          "quotationNumber",
                          tt("Quotation number", "Número de cotización"),
                        ],
                        [
                          "contractNumber",
                          tt(
                            "Contract / PO number",
                            "Número de contrato / orden de compra",
                          ),
                        ],
                        ["counterpartyName", tt("Counterparty", "Contraparte")],
                        [
                          "paymentTerms",
                          tt("Payment terms", "Términos de pago"),
                        ],
                      ].map(([field, label]) => (
                        <label key={field}>
                          {label}
                          <input
                            value={data.commercial[field]}
                            onChange={(e) =>
                              changeContract(0, field, e.target.value)
                            }
                          />
                        </label>
                      ))}
                      <label>
                        {tt("Perspective", "Perspectiva")}
                        <select
                          value={data.commercial.perspective}
                          onChange={(e) =>
                            changeContract(0, "perspective", e.target.value)
                          }
                        >
                          <option value="downstream">
                            {tt(
                              "Commitment / subcontract",
                              "Compromiso / subcontrato",
                            )}
                          </option>
                          <option value="upstream">
                            {tt(
                              "Owner / prime contract",
                              "Cliente / contrato principal",
                            )}
                          </option>
                        </select>
                      </label>
                      <label>
                        {tt("Contract type", "Tipo de contrato")}
                        <select
                          value={data.commercial.contractType}
                          onChange={(e) =>
                            changeContract(0, "contractType", e.target.value)
                          }
                        >
                          <option value="subcontract">
                            {tt("Subcontract", "Subcontrato")}
                          </option>
                          <option value="purchase_order">
                            {tt("Purchase order", "Orden de compra")}
                          </option>
                          <option value="consultant_agreement">
                            {tt(
                              "Consultant agreement",
                              "Contrato de consultoría",
                            )}
                          </option>
                          <option value="owner_prime">
                            {tt(
                              "Owner prime contract",
                              "Contrato principal con el cliente",
                            )}
                          </option>
                          <option value="other_commitment">
                            {tt("Other commitment", "Otro compromiso")}
                          </option>
                        </select>
                      </label>
                    </div>
                    {(data.commercial.contracts || [])
                      .slice(1)
                      .map((contract: any, offset: number) => {
                        const index = offset + 1;
                        return (
                          <div className="ji-row" key={contract.id}>
                            <div className="ji-actions">
                              <strong>
                                {tt(
                                  `Additional contract ${index + 1}`,
                                  `Contrato adicional ${index + 1}`,
                                )}
                              </strong>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => removeContract(contract.id)}
                              >
                                <Trash2 size={14} /> {tt("Remove", "Eliminar")}
                              </button>
                            </div>
                            <div className="ji-grid three">
                              {[
                                [
                                  "quotationNumber",
                                  tt(
                                    "Quotation number",
                                    "N\u00famero de cotizaci\u00f3n",
                                  ),
                                ],
                                [
                                  "contractNumber",
                                  tt(
                                    "Contract / PO number",
                                    "N\u00famero de contrato / orden de compra",
                                  ),
                                ],
                                [
                                  "counterpartyName",
                                  tt("Counterparty", "Contraparte"),
                                ],
                                [
                                  "paymentTerms",
                                  tt("Payment terms", "T\u00e9rminos de pago"),
                                ],
                              ].map(([field, label]) => (
                                <label key={field}>
                                  {label}
                                  <input
                                    value={contract[field] || ""}
                                    onChange={(event) =>
                                      changeContract(
                                        index,
                                        field,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                              ))}
                              <label>
                                {tt("Perspective", "Perspectiva")}
                                <select
                                  value={contract.perspective}
                                  onChange={(event) =>
                                    changeContract(
                                      index,
                                      "perspective",
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="downstream">
                                    {tt(
                                      "Commitment / subcontract",
                                      "Compromiso / subcontrato",
                                    )}
                                  </option>
                                  <option value="upstream">
                                    {tt(
                                      "Owner / prime contract",
                                      "Cliente / contrato principal",
                                    )}
                                  </option>
                                </select>
                              </label>
                              <label>
                                {tt("Contract type", "Tipo de contrato")}
                                <select
                                  value={contract.contractType}
                                  onChange={(event) =>
                                    changeContract(
                                      index,
                                      "contractType",
                                      event.target.value,
                                    )
                                  }
                                >
                                  <option value="subcontract">
                                    {tt("Subcontract", "Subcontrato")}
                                  </option>
                                  <option value="purchase_order">
                                    {tt("Purchase order", "Orden de compra")}
                                  </option>
                                  <option value="consultant_agreement">
                                    {tt(
                                      "Consultant agreement",
                                      "Contrato de consultor\u00eda",
                                    )}
                                  </option>
                                  <option value="owner_prime">
                                    {tt(
                                      "Owner prime contract",
                                      "Contrato principal con el cliente",
                                    )}
                                  </option>
                                  <option value="other_commitment">
                                    {tt("Other commitment", "Otro compromiso")}
                                  </option>
                                </select>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    <div className="ji-actions">
                      <button type="button" onClick={addContract}>
                        <Plus size={14} />
                        {tt(
                          "Add contract profile",
                          "Agregar perfil de contrato",
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="ji-lock">
                    {tt(
                      "Contracts & Commitments is not enabled for this user. The operational Intake can still be completed and activated.",
                      "Contratos y compromisos no está habilitado para este usuario. El ingreso operativo todavía puede completarse y activarse.",
                    )}
                  </div>
                )}
              </section>
              <section className="ji-card" id="ji-delivery">
                <h2>6. {stageLabel("delivery")}</h2>
                {guide && (
                  <div className="ji-guide">
                    {tt(
                      "Describe how scope becomes shop drawings, submittals, reviews, distribution, and milestones. Activation preserves this workflow on every operational work item.",
                      "Describa cómo el alcance se convierte en planos de taller, submittals, revisiones, distribución e hitos. La activación conserva este flujo en cada partida operativa.",
                    )}
                  </div>
                )}
                <div className="ji-grid">
                  <label>
                    {tt("Workflow template", "Plantilla del flujo")}
                    <select
                      value={data.delivery.workflowTemplate}
                      onChange={(e) =>
                        change("delivery", "workflowTemplate", e.target.value)
                      }
                    >
                      <option value="bim-submittal">
                        {tt(
                          "BIM shop drawing / submittal",
                          "Plano de taller BIM / submittal",
                        )}
                      </option>
                      <option value="coordination-delivery">
                        {tt("Coordination delivery", "Entrega de coordinación")}
                      </option>
                      <option value="document-control">
                        {tt("Document control", "Control de documentos")}
                      </option>
                    </select>
                  </label>
                  <label>
                    {tt("Submittal strategy", "Estrategia de submittals")}
                    <textarea
                      value={data.delivery.submittalStrategy}
                      onChange={(e) =>
                        change("delivery", "submittalStrategy", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    {tt("Milestones and distribution", "Hitos y distribución")}
                    <textarea
                      value={data.delivery.milestoneSummary}
                      onChange={(e) =>
                        change("delivery", "milestoneSummary", e.target.value)
                      }
                    />
                  </label>
                </div>
              </section>
              <section className="ji-card" id="ji-team">
                <h2>7. {stageLabel("team")}</h2>
                <div className="ji-rate">
                  <strong>
                    {tt(
                      "Planned hours connect each person to the work they will deliver.",
                      "Las horas planificadas conectan a cada persona con el trabajo que entregará.",
                    )}
                  </strong>
                  {capabilities.budget
                    ? tt(
                        "Assigned hours × internal hourly cost = planned labor cost. This connects workload, staffing cost, margin, and future performance.",
                        "Horas asignadas × costo horario interno = costo laboral planificado. Así se conectan la carga de trabajo, el costo del personal, el margen y el desempeño futuro.",
                      )
                    : tt(
                        "Assign members, roles, scope, and planned hours. Internal hourly costs are an optional Budget feature.",
                        "Asigne miembros, roles, alcance y horas planificadas. Los costos horarios internos son una función opcional de Presupuesto.",
                      )}
                </div>
                <label>
                  {tt("Project leader", "Líder del proyecto")}
                  <select
                    value={data.team.projectLeaderUserId ?? ""}
                    onChange={(e) =>
                      change(
                        "team",
                        "projectLeaderUserId",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">
                      {tt("Select leader", "Seleccione un líder")}
                    </option>
                    {intake.members?.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName || m.email}
                      </option>
                    ))}
                  </select>
                </label>
                {data.team.assignments.map((assignment: any, index: number) => (
                  <div className="ji-row" key={assignment.id}>
                    <div className="ji-grid three">
                      <label>
                        {tt("Team member", "Miembro del equipo")}
                        <select
                          value={assignment.userId ?? ""}
                          onChange={(e) => {
                            const m = intake.members.find(
                              (x: any) => String(x.id) === e.target.value,
                            );
                            assignmentChange(
                              index,
                              "userId",
                              e.target.value ? Number(e.target.value) : null,
                            );
                            assignmentChange(
                              index,
                              "personName",
                              m?.fullName || m?.email || "",
                            );
                          }}
                        >
                          <option value="">
                            {tt("Select member", "Seleccione un miembro")}
                          </option>
                          {intake.members?.map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName || m.email}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {tt("Role", "Rol")}
                        <input
                          value={assignment.role}
                          onChange={(e) =>
                            assignmentChange(index, "role", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        {tt("Scope item", "Partida de alcance")}
                        <select
                          value={assignment.scopeItemId}
                          onChange={(e) =>
                            assignmentChange(
                              index,
                              "scopeItemId",
                              e.target.value,
                            )
                          }
                        >
                          <option value="">
                            {tt("Select scope", "Seleccione el alcance")}
                          </option>
                          {data.scopeItems.map((s: any) => (
                            <option key={s.id} value={s.id}>
                              {s.name || s.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {tt("Assigned hours", "Horas asignadas")}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={assignment.plannedHours}
                          onChange={(e) =>
                            assignmentChange(
                              index,
                              "plannedHours",
                              e.target.value,
                            )
                          }
                        />
                      </label>
                      {capabilities.budget && (
                        <>
                          <label>
                            {tt(
                              "Internal hourly cost",
                              "Costo horario interno",
                            )}
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={assignment.internalHourlyRate}
                              onChange={(e) =>
                                assignmentChange(
                                  index,
                                  "internalHourlyRate",
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                          <label>
                            {tt(
                              "Planned labor cost",
                              "Costo laboral planificado",
                            )}
                            <input
                              readOnly
                              value={money(
                                assignment.plannedHours,
                                assignment.internalHourlyRate,
                              )}
                            />
                          </label>
                        </>
                      )}
                    </div>
                    <button
                      className="danger"
                      onClick={() =>
                        setData((old: any) => ({
                          ...old,
                          team: {
                            ...old.team,
                            assignments: old.team.assignments.filter(
                              (_: any, i: number) => i !== index,
                            ),
                          },
                        }))
                      }
                    >
                      <Trash2 size={14} /> {tt("Remove", "Eliminar")}
                    </button>
                  </div>
                ))}
                {!capabilities.budget && (
                  <div className="ji-lock">
                    {tt(
                      "Project Budget is not enabled. Team assignments and hours remain available; internal cost fields stay hidden.",
                      "Presupuesto del proyecto no está habilitado. Las asignaciones y horas permanecen disponibles; los campos de costo interno quedan ocultos.",
                    )}
                  </div>
                )}
                <div className="ji-actions">
                  <button
                    onClick={() =>
                      setData((old: any) => ({
                        ...old,
                        team: {
                          ...old.team,
                          assignments: [
                            ...old.team.assignments,
                            {
                              id: crypto.randomUUID(),
                              userId: null,
                              personName: "",
                              role: "",
                              employmentType: "employee",
                              scopeItemId: "",
                              plannedHours: "0.00",
                              internalHourlyRate: "0.00",
                            },
                          ],
                        },
                      }))
                    }
                  >
                    <Plus size={14} />{" "}
                    {tt("Add assignment", "Agregar asignación")}
                  </button>
                  <span className="ji-total">
                    {tt("Planned", "Planificadas")}:{" "}
                    {completion.totals.plannedHours}h ·{" "}
                    {tt("Assigned", "Asignadas")}:{" "}
                    {completion.totals.assignedHours}h ·{" "}
                    {tt("Unassigned", "Sin asignar")}:{" "}
                    {completion.totals.unassignedHours}h
                  </span>
                </div>
              </section>
              <section className="ji-card" id="ji-review">
                <h2>8. {stageLabel("review")}</h2>
                {guide && (
                  <div className="ji-guide">
                    {tt(
                      "Save first, review each applicable statement, then activate. Core activation creates operational work items, delivery tasks, and resource assignments. With the complete Commercial package it creates one controlled draft per contract profile and its assigned Contract Items; it never approves or executes contracts.",
                      "Guarde primero, revise cada declaraci\u00f3n aplicable y luego active. La activaci\u00f3n b\u00e1sica crea partidas operativas, tareas de entrega y asignaciones de recursos. Con el paquete Comercial completo crea un borrador controlado por perfil de contrato y sus Partidas de Contrato asignadas; nunca aprueba ni ejecuta contratos.",
                    )}
                  </div>
                )}
                <div className="ji-grid">
                  {reviewItems.map(([field, label]) => (
                    <label className="ji-check" key={field}>
                      <input
                        type="checkbox"
                        checked={data.review[field]}
                        onChange={(e) =>
                          change("review", field, e.target.checked)
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {missingItems.length > 0 && (
                  <div className="ji-missing">
                    <strong>{tt("Still required", "Aún falta")}</strong>
                    <ul>
                      {missingItems.map(
                        (item: { key: string; label: string }) => (
                          <li key={item.key}>{item.label}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
                <div className="ji-actions">
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !completion.ready ||
                      (intake.status === "activated" && !canEnrich)
                    }
                    onClick={activate}
                  >
                    <Zap size={15} />{" "}
                    {intake.status === "activated"
                      ? canEnrich
                        ? tt(
                            "Create Commercial records",
                            "Crear registros comerciales",
                          )
                        : tt("Job activated", "Trabajo activado")
                      : tt(
                          "Activate operational job",
                          "Activar trabajo operativo",
                        )}
                  </button>
                  {(
                    intake.activationSummary?.contracts || [
                      { contractId: intake.activatedContractId },
                    ]
                  )
                    .filter((contract: any) => contract.contractId)
                    .map((contract: any, index: number) => (
                      <Link
                        key={contract.contractId}
                        href={`/projects/${projectId}/financial/contracts?contractId=${contract.contractId}`}
                      >
                        {tt(
                          `Open created contract ${index + 1}`,
                          `Abrir contrato creado ${index + 1}`,
                        )}
                      </Link>
                    ))}
                </div>
              </section>
              <div className="ji-footer">
                <span>
                  <strong>{completion.percent}%</strong> ·{" "}
                  {firstMissing || tt("Ready", "Listo")} ·{" "}
                  <span
                    className={`ji-save-state ${saveState}`}
                    role="status"
                    aria-live="polite"
                  >
                    {saveState === "saving"
                      ? tt("Saving...", "Guardando...")
                      : saveState === "unsaved"
                        ? tt("Changes pending", "Cambios pendientes")
                        : saveState === "error"
                          ? tt(
                              "Save needs attention",
                              "El guardado requiere atención",
                            )
                          : tt(
                              "All changes saved",
                              "Todos los cambios guardados",
                            )}
                  </span>
                </span>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    saveState === "saving" ||
                    (intake.status === "activated" && !canEnrich)
                  }
                  onClick={save}
                >
                  <Save size={15} /> {tt("Save now", "Guardar ahora")}
                </button>
              </div>
            </div>
          </div>
        </fieldset>
      </main>
    </FinancialProjectShell>
  );
}
