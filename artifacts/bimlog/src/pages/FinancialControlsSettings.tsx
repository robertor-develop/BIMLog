import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ChevronLeft,
  CircleDollarSign,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const authorities = [
  "financial_viewer",
  "cost_preparer",
  "cost_reviewer",
  "cost_approver",
  "financial_administrator",
  "auditor",
];
type OwnState = {
  scope: { companyId: number; projectId: number | null; scopeType: string };
  status: string;
  commercial: { decision: string; code: string; state: string };
  context: null | {
    baseCurrency: string;
    reportingCurrency: string;
    permittedTransactionCurrencies: string[];
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  authorities: Array<{
    grantId: string;
    authority: string;
    scopeType: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
  projectScopes: Array<{ id: number; name: string }>;
  approvalLimits: Array<{
    transactionCategory: string;
    currency: string;
    maxAmount: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  }>;
  canManage: boolean;
  canAudit: boolean;
  canBootstrapControlPlane: boolean;
  explanation: { en: string; es: string };
};
type AdminState = {
  contexts: any[];
  grants: any[];
  policies: any[];
  suspensions: any[];
  users: Array<{ id: number; full_name: string; email: string }>;
  projects: Array<{ id: number; name: string }>;
  journal: any[];
};
const inputStyle = {
  width: "100%",
  padding: "8px 9px",
  border: "1px solid hsl(var(--border))",
  borderRadius: 7,
  background: "hsl(var(--background))",
} as const;
const card = {
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  padding: 14,
  background: "hsl(var(--card))",
} as const;

export function FinancialControlsSettings() {
  const { token } = useAuthStore(),
    { tt } = useI18n(),
    { toast } = useToast();
  const [state, setState] = useState<OwnState | null>(null),
    [admin, setAdmin] = useState<AdminState | null>(null),
    [auditJournal, setAuditJournal] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [projectId, setProjectId] = useState("");
  const [context, setContext] = useState({
    baseCurrency: "USD",
    reportingCurrency: "USD",
    permittedCurrencies: "USD",
    effectiveFrom: "",
    effectiveTo: "",
    reason: "",
  });
  const [grant, setGrant] = useState({
    userId: "",
    authority: "financial_viewer",
    effectiveFrom: "",
    effectiveTo: "",
    reason: "",
  });
  const [policy, setPolicy] = useState({
    transactionCategory: "",
    currency: "USD",
    maxAmount: "",
    effectiveFrom: "",
    effectiveTo: "",
    reason: "",
  });
  const [suspensionReason, setSuspensionReason] = useState("");
  const [bootstrap, setBootstrap] = useState({
    administratorUserId: "",
    baseCurrency: "USD",
    reportingCurrency: "USD",
    permittedCurrencies: "USD",
    reason: "",
  });
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );
  const authorityLabel = (value: string) => {
    const labels: Record<string, [string, string]> = {
      financial_viewer: ["Financial Viewer", "Visualizador Financiero"],
      cost_preparer: ["Cost Preparer", "Preparador de Costos"],
      cost_reviewer: ["Cost Reviewer", "Revisor de Costos"],
      cost_approver: ["Cost Approver", "Aprobador de Costos"],
      financial_administrator: [
        "Financial Administrator",
        "Administrador Financiero",
      ],
      auditor: ["Auditor", "Auditor"],
    };
    const label = labels[value];
    return label ? tt(label[0], label[1]) : value;
  };
  const scopeLabel = (value: string) =>
    value === "company" ? tt("company", "empresa") : tt("project", "proyecto");
  const eventLabel = (value: string) =>
    value === "authority_granted"
      ? tt("Authority granted", "Autoridad concedida")
      : value === "authority_revoked"
        ? tt("Authority revoked", "Autoridad revocada")
        : value.replaceAll("_", " ");
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const scopeBody = projectId ? { projectId: Number(projectId) } : {};
  async function request(path: string, init?: RequestInit) {
    const response = await fetch(`${API}/api/v1${path}`, {
        ...init,
        headers: { ...headers, ...init?.headers },
      }),
      body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        body?.error?.en ||
          tt(
            "The financial control request was denied.",
            "La solicitud de control financiero fue denegada.",
          ),
      );
    return body;
  }
  async function load() {
    setLoading(true);
    try {
      const own = (await request(
        `/financial-controls/state${query}`,
      )) as OwnState;
      setState(own);
      setAdmin(
        own.canManage
          ? ((await request(`/financial-controls/admin${query}`)) as AdminState)
          : null,
      );
      setAuditJournal(
        own.canAudit && !own.canManage
          ? (
              (await request(`/financial-controls/audit${query}`)) as {
                journal: any[];
              }
            ).journal
          : [],
      );
    } catch (error) {
      setState(null);
      setAdmin(null);
      setAuditJournal([]);
      toast({
        title: tt(
          "Financial controls unavailable",
          "Controles financieros no disponibles",
        ),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [projectId]);
  async function mutate(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await request(path, { method: "POST", body: JSON.stringify(body) });
      toast({
        title: tt("Control recorded", "Control registrado"),
        description: tt(
          "The immutable financial control history was updated. No financial transaction was created.",
          "Se actualizó el historial inmutable del control financiero. No se creó ninguna transacción financiera.",
        ),
      });
      await load();
    } catch (error) {
      toast({
        title: tt("Request denied", "Solicitud denegada"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }
  const dt = (value: string) => value || undefined;
  return (
    <div className="app-shell financial-controls-page">
      <style>{`@media(max-width:720px){.financial-controls-page>.sidebar{display:none}.financial-controls-page>.main-area{width:100%;min-width:0}.financial-grid{grid-template-columns:1fr!important}.financial-controls-page .page-content{padding-left:12px!important;padding-right:12px!important}.financial-row{grid-template-columns:1fr!important}}`}</style>
      <MasterSidebar />
      <div className="main-area">
        <div className="topbar">
          <div className="breadcrumb">
            <Link
              href="/profile"
              style={{ display: "flex", gap: 4, alignItems: "center" }}
            >
              <ChevronLeft size={14} />
              {tt("Profile", "Perfil")}
            </Link>
            <span>/</span>
            <span className="breadcrumb-active">
              {tt("Financial Controls", "Controles Financieros")}
            </span>
          </div>
        </div>
        <main
          className="page-content"
          style={{
            padding: "20px clamp(14px,3vw,32px) 60px",
            maxWidth: 1180,
            margin: "0 auto",
          }}
        >
          <header
            style={{
              display: "flex",
              gap: 11,
              alignItems: "flex-start",
              marginBottom: 18,
            }}
          >
            <CircleDollarSign color="#1D4ED8" />
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                {tt("Cost & Financial Control", "Control de Costos y Finanzas")}
              </h1>
              <p style={{ fontSize: 12, color: "#64748B", margin: "4px 0 0" }}>
                {tt(
                  "Authority, currency, approval-limit, and suspension controls only. This foundation does not create financial records or move money.",
                  "Solo controles de autoridad, moneda, límites de aprobación y suspensión. Esta base no crea registros financieros ni mueve dinero.",
                )}
              </p>
            </div>
          </header>
          <section style={{ ...card, marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              {tt("Scope", "Alcance")}
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ ...inputStyle, marginTop: 5 }}
              >
                <option value="">
                  {tt("Current company", "Empresa actual")}
                </option>
                {state?.projectScopes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          {loading ? (
            <p>
              {tt(
                "Loading financial controls…",
                "Cargando controles financieros…",
              )}
            </p>
          ) : (
            state && (
              <>
                <div
                  className="financial-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <section style={card}>
                    <b>{tt("Control status", "Estado del control")}</b>
                    <div style={{ marginTop: 8 }}>
                      <Badge variant="outline">
                        {state.status === "suspended"
                          ? tt("Suspended", "Suspendido")
                          : tt("Active", "Activo")}
                      </Badge>
                    </div>
                  </section>
                  <section style={card}>
                    <b>{tt("Commercial gate", "Control comercial")}</b>
                    <div style={{ marginTop: 8 }}>
                      <Badge variant="outline">
                        {state.commercial.decision === "allow"
                          ? tt("Available", "Disponible")
                          : tt("Unavailable", "No disponible")}
                      </Badge>
                      <div
                        style={{ fontSize: 11, color: "#64748B", marginTop: 5 }}
                      >
                        {state.commercial.code}
                      </div>
                    </div>
                  </section>
                  <section style={card}>
                    <b>{tt("Currency context", "Contexto monetario")}</b>
                    <div style={{ fontSize: 12, marginTop: 8 }}>
                      {state.context
                        ? `${state.context.baseCurrency} · ${state.context.reportingCurrency} · v${state.context.version} · ${new Date(state.context.effectiveFrom).toLocaleDateString()}${state.context.effectiveTo ? ` – ${new Date(state.context.effectiveTo).toLocaleDateString()}` : ""}`
                        : tt("Not configured", "No configurado")}
                    </div>
                    {state.context && (
                      <div
                        style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}
                      >
                        {tt("Permitted", "Permitidas")}:{" "}
                        {state.context.permittedTransactionCurrencies.join(
                          ", ",
                        )}
                      </div>
                    )}
                  </section>
                </div>
                <section
                  style={{
                    ...card,
                    marginBottom: 12,
                    borderColor: state.authorities.length
                      ? "#86EFAC"
                      : "#FCA5A5",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    {state.authorities.length ? (
                      <ShieldCheck size={18} color="#15803D" />
                    ) : (
                      <ShieldAlert size={18} color="#B91C1C" />
                    )}
                    <b>
                      {tt(
                        "My effective financial authorities",
                        "Mis autoridades financieras vigentes",
                      )}
                    </b>
                  </div>
                  <p style={{ fontSize: 12, color: "#475569" }}>
                    {tt(state.explanation.en, state.explanation.es)}
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {state.authorities.length ? (
                      state.authorities.map((a) => (
                        <Badge key={a.grantId} variant="outline">
                          {authorityLabel(a.authority)} ·{" "}
                          {scopeLabel(a.scopeType)} ·{" "}
                          {new Date(a.effectiveFrom).toLocaleDateString()}
                          {a.effectiveTo
                            ? ` – ${new Date(a.effectiveTo).toLocaleDateString()}`
                            : ""}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">
                        {tt(
                          "No financial authority",
                          "Sin autoridad financiera",
                        )}
                      </Badge>
                    )}
                  </div>
                  {state.approvalLimits.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11 }}>
                      <b>
                        {tt("My approval limits", "Mis límites de aprobación")}
                      </b>
                      {state.approvalLimits.map((limit) => (
                        <div
                          key={`${limit.transactionCategory}:${limit.currency}`}
                        >
                          {limit.transactionCategory} · {limit.maxAmount}{" "}
                          {limit.currency} · v{limit.version}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                {state.canAudit && !state.canManage && (
                  <section style={{ ...card, marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>
                      {tt(
                        "Authorized audit journal",
                        "Diario de auditoría autorizado",
                      )}
                    </h2>
                    <p style={{ fontSize: 11, color: "#64748B" }}>
                      {tt(
                        "Audit reads remain available during suspension. This view contains authority decisions, not financial records.",
                        "Las lecturas de auditoría permanecen disponibles durante la suspensión. Esta vista contiene decisiones de autoridad, no registros financieros.",
                      )}
                    </p>
                    {auditJournal.slice(0, 20).map((entry, index) => (
                      <div
                        key={`${entry.entity_id}-${index}`}
                        style={{
                          fontSize: 11,
                          borderTop: "1px solid hsl(var(--border))",
                          paddingTop: 6,
                        }}
                      >
                        <b>{eventLabel(entry.event_type)}</b> ·{" "}
                        {entry.reason_code} ·{" "}
                        {new Date(entry.occurred_at).toLocaleString()}
                        <div style={{ color: "#64748B" }}>
                          {tt(entry.explanation_en, entry.explanation_es)}
                        </div>
                      </div>
                    ))}
                  </section>
                )}
                {state.canBootstrapControlPlane && !state.canManage && (
                  <section
                    style={{
                      ...card,
                      marginBottom: 12,
                      borderColor: "#F59E0B",
                    }}
                  >
                    <h2 style={{ fontSize: 15, margin: "0 0 4px" }}>
                      {tt("Explicit bootstrap", "Inicio explícito")}
                    </h2>
                    <p style={{ fontSize: 11, color: "#64748B" }}>
                      {tt(
                        "Super Administrator may create only the initial context and Financial Administrator grant. A reason is mandatory and the action is audited.",
                        "El Superadministrador solo puede crear el contexto inicial y la concesión de Administrador Financiero. El motivo es obligatorio y la acción se audita.",
                      )}
                    </p>
                    <div
                      className="financial-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: 8,
                      }}
                    >
                      <input
                        style={inputStyle}
                        placeholder={tt(
                          "Administrator user ID",
                          "ID de usuario administrador",
                        )}
                        value={bootstrap.administratorUserId}
                        onChange={(e) =>
                          setBootstrap({
                            ...bootstrap,
                            administratorUserId: e.target.value,
                          })
                        }
                      />
                      <input
                        style={inputStyle}
                        aria-label={tt("Base currency", "Moneda base")}
                        value={bootstrap.baseCurrency}
                        onChange={(e) =>
                          setBootstrap({
                            ...bootstrap,
                            baseCurrency: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      <input
                        style={inputStyle}
                        aria-label={tt(
                          "Reporting currency",
                          "Moneda de reporte",
                        )}
                        value={bootstrap.reportingCurrency}
                        onChange={(e) =>
                          setBootstrap({
                            ...bootstrap,
                            reportingCurrency: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <input
                      style={{ ...inputStyle, marginTop: 8 }}
                      placeholder={tt(
                        "Permitted currencies, comma separated",
                        "Monedas permitidas, separadas por comas",
                      )}
                      value={bootstrap.permittedCurrencies}
                      onChange={(e) =>
                        setBootstrap({
                          ...bootstrap,
                          permittedCurrencies: e.target.value,
                        })
                      }
                    />
                    <textarea
                      style={{ ...inputStyle, marginTop: 8 }}
                      placeholder={tt("Required reason", "Motivo obligatorio")}
                      value={bootstrap.reason}
                      onChange={(e) =>
                        setBootstrap({ ...bootstrap, reason: e.target.value })
                      }
                    />
                    <Button
                      disabled={
                        busy ||
                        !bootstrap.reason ||
                        !bootstrap.administratorUserId
                      }
                      style={{ marginTop: 8 }}
                      onClick={() =>
                        mutate("/financial-controls/bootstrap", {
                          companyId: state.scope.companyId,
                          ...scopeBody,
                          administratorUserId: Number(
                            bootstrap.administratorUserId,
                          ),
                          baseCurrency: bootstrap.baseCurrency,
                          reportingCurrency: bootstrap.reportingCurrency,
                          permittedCurrencies: bootstrap.permittedCurrencies
                            .split(",")
                            .map((x) => x.trim()),
                          reason: bootstrap.reason,
                        })
                      }
                    >
                      {tt(
                        "Create initial controls",
                        "Crear controles iniciales",
                      )}
                    </Button>
                  </section>
                )}
                {state.canManage && admin && (
                  <div style={{ display: "grid", gap: 12 }}>
                    <section style={card}>
                      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>
                        {tt(
                          "Financial context version",
                          "Versión del contexto financiero",
                        )}
                      </h2>
                      <div
                        className="financial-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3,1fr)",
                          gap: 8,
                        }}
                      >
                        <input
                          style={inputStyle}
                          value={context.baseCurrency}
                          onChange={(e) =>
                            setContext({
                              ...context,
                              baseCurrency: e.target.value.toUpperCase(),
                            })
                          }
                          aria-label={tt("Base currency", "Moneda base")}
                        />
                        <input
                          style={inputStyle}
                          value={context.reportingCurrency}
                          onChange={(e) =>
                            setContext({
                              ...context,
                              reportingCurrency: e.target.value.toUpperCase(),
                            })
                          }
                          aria-label={tt(
                            "Reporting currency",
                            "Moneda de reporte",
                          )}
                        />
                        <input
                          style={inputStyle}
                          value={context.permittedCurrencies}
                          onChange={(e) =>
                            setContext({
                              ...context,
                              permittedCurrencies: e.target.value,
                            })
                          }
                          aria-label={tt(
                            "Permitted currencies",
                            "Monedas permitidas",
                          )}
                        />
                      </div>
                      <div
                        className="financial-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <label style={{ fontSize: 11 }}>
                          {tt("Effective from", "Vigente desde")}
                          <input
                            style={inputStyle}
                            type="datetime-local"
                            value={context.effectiveFrom}
                            onChange={(e) =>
                              setContext({
                                ...context,
                                effectiveFrom: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label style={{ fontSize: 11 }}>
                          {tt(
                            "Effective to (optional)",
                            "Vigente hasta (opcional)",
                          )}
                          <input
                            style={inputStyle}
                            type="datetime-local"
                            value={context.effectiveTo}
                            onChange={(e) =>
                              setContext({
                                ...context,
                                effectiveTo: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <textarea
                        style={{ ...inputStyle, marginTop: 8 }}
                        placeholder={tt(
                          "Required reason",
                          "Motivo obligatorio",
                        )}
                        value={context.reason}
                        onChange={(e) =>
                          setContext({ ...context, reason: e.target.value })
                        }
                      />
                      <Button
                        disabled={busy || !context.reason}
                        style={{ marginTop: 8 }}
                        onClick={() =>
                          mutate("/financial-controls/contexts", {
                            ...scopeBody,
                            baseCurrency: context.baseCurrency,
                            reportingCurrency: context.reportingCurrency,
                            permittedCurrencies: context.permittedCurrencies
                              .split(",")
                              .map((x) => x.trim()),
                            effectiveFrom: dt(context.effectiveFrom),
                            effectiveTo: dt(context.effectiveTo),
                            reason: context.reason,
                          })
                        }
                      >
                        {tt(
                          "Add context version",
                          "Agregar versión de contexto",
                        )}
                      </Button>
                      <div
                        style={{
                          fontSize: 11,
                          marginTop: 10,
                          color: "#64748B",
                        }}
                      >
                        {admin.contexts.map((item) => (
                          <div key={item.id}>
                            v{item.version} · {item.base_currency}/
                            {item.reporting_currency} ·{" "}
                            {new Date(item.effective_from).toLocaleDateString()}
                            {item.effective_to
                              ? ` – ${new Date(item.effective_to).toLocaleDateString()}`
                              : ""}{" "}
                            · {item.reason}
                          </div>
                        ))}
                      </div>
                    </section>
                    <section style={card}>
                      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>
                        {tt("Authority grants", "Concesiones de autoridad")}
                      </h2>
                      <div
                        className="financial-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 2fr 1fr 1fr",
                          gap: 8,
                        }}
                      >
                        <select
                          style={inputStyle}
                          value={grant.userId}
                          onChange={(e) =>
                            setGrant({ ...grant, userId: e.target.value })
                          }
                        >
                          <option value="">
                            {tt("Select user", "Seleccionar usuario")}
                          </option>
                          {admin.users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name} · {u.email}
                            </option>
                          ))}
                        </select>
                        <select
                          style={inputStyle}
                          value={grant.authority}
                          onChange={(e) =>
                            setGrant({ ...grant, authority: e.target.value })
                          }
                        >
                          {authorities.map((a) => (
                            <option key={a} value={a}>
                              {authorityLabel(a)}
                            </option>
                          ))}
                        </select>
                        <input
                          style={inputStyle}
                          type="datetime-local"
                          value={grant.effectiveFrom}
                          onChange={(e) =>
                            setGrant({
                              ...grant,
                              effectiveFrom: e.target.value,
                            })
                          }
                        />
                        <input
                          style={inputStyle}
                          type="datetime-local"
                          value={grant.effectiveTo}
                          onChange={(e) =>
                            setGrant({ ...grant, effectiveTo: e.target.value })
                          }
                        />
                      </div>
                      <textarea
                        style={{ ...inputStyle, marginTop: 8 }}
                        placeholder={tt(
                          "Required reason",
                          "Motivo obligatorio",
                        )}
                        value={grant.reason}
                        onChange={(e) =>
                          setGrant({ ...grant, reason: e.target.value })
                        }
                      />
                      <Button
                        disabled={busy || !grant.userId || !grant.reason}
                        style={{ marginTop: 8 }}
                        onClick={() =>
                          mutate("/financial-controls/grants", {
                            ...scopeBody,
                            userId: Number(grant.userId),
                            authority: grant.authority,
                            effectiveFrom: dt(grant.effectiveFrom),
                            effectiveTo: dt(grant.effectiveTo),
                            reason: grant.reason,
                          })
                        }
                      >
                        {tt("Grant authority", "Conceder autoridad")}
                      </Button>
                      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                        {admin.grants.map((g) => (
                          <div
                            key={g.id}
                            style={{
                              fontSize: 11,
                              borderTop: "1px solid hsl(var(--border))",
                              paddingTop: 7,
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                            }}
                          >
                            <span>
                              {g.full_name} ·{" "}
                              {authorityLabel(String(g.authority))} · v
                              {g.version}
                              {g.revoked_at
                                ? ` · ${tt("revoked", "revocada")}`
                                : ""}
                            </span>
                            {!g.revoked_at && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  const reason = window.prompt(
                                    tt(
                                      "Reason for immediate revocation",
                                      "Motivo de la revocación inmediata",
                                    ),
                                  );
                                  if (reason)
                                    void mutate(
                                      `/financial-controls/grants/${g.id}/revoke`,
                                      { reason },
                                    );
                                }}
                              >
                                {tt("Revoke", "Revocar")}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                    <section style={card}>
                      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>
                        {tt(
                          "Approval limit policy",
                          "Política de límite de aprobación",
                        )}
                      </h2>
                      <div
                        className="financial-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 2fr",
                          gap: 8,
                        }}
                      >
                        <input
                          style={inputStyle}
                          placeholder={tt(
                            "Transaction category",
                            "Categoría de transacción",
                          )}
                          value={policy.transactionCategory}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              transactionCategory: e.target.value,
                            })
                          }
                        />
                        <input
                          style={inputStyle}
                          value={policy.currency}
                          onChange={(e) =>
                            setPolicy({
                              ...policy,
                              currency: e.target.value.toUpperCase(),
                            })
                          }
                        />
                        <input
                          style={inputStyle}
                          inputMode="decimal"
                          placeholder={tt(
                            "Exact decimal limit",
                            "Límite decimal exacto",
                          )}
                          value={policy.maxAmount}
                          onChange={(e) =>
                            setPolicy({ ...policy, maxAmount: e.target.value })
                          }
                        />
                      </div>
                      <div
                        className="financial-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <label style={{ fontSize: 11 }}>
                          {tt("Effective from", "Vigente desde")}
                          <input
                            style={inputStyle}
                            type="datetime-local"
                            value={policy.effectiveFrom}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                effectiveFrom: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label style={{ fontSize: 11 }}>
                          {tt(
                            "Effective to (optional)",
                            "Vigente hasta (opcional)",
                          )}
                          <input
                            style={inputStyle}
                            type="datetime-local"
                            value={policy.effectiveTo}
                            onChange={(e) =>
                              setPolicy({
                                ...policy,
                                effectiveTo: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>
                      <textarea
                        style={{ ...inputStyle, marginTop: 8 }}
                        placeholder={tt(
                          "Required reason",
                          "Motivo obligatorio",
                        )}
                        value={policy.reason}
                        onChange={(e) =>
                          setPolicy({ ...policy, reason: e.target.value })
                        }
                      />
                      <Button
                        disabled={
                          busy ||
                          !policy.transactionCategory ||
                          !policy.maxAmount ||
                          !policy.reason
                        }
                        style={{ marginTop: 8 }}
                        onClick={() =>
                          mutate("/financial-controls/approval-policies", {
                            ...scopeBody,
                            transactionCategory: policy.transactionCategory,
                            currency: policy.currency,
                            maxAmount: policy.maxAmount,
                            effectiveFrom: dt(policy.effectiveFrom),
                            effectiveTo: dt(policy.effectiveTo),
                            reason: policy.reason,
                          })
                        }
                      >
                        {tt(
                          "Add policy version",
                          "Agregar versión de política",
                        )}
                      </Button>
                      <div
                        style={{ fontSize: 11, marginTop: 8, color: "#64748B" }}
                      >
                        {admin.policies
                          .map(
                            (p) =>
                              `${p.transaction_category} · ${p.max_amount} ${p.currency} · v${p.version} · ${new Date(p.effective_from).toLocaleDateString()}${p.effective_to ? ` – ${new Date(p.effective_to).toLocaleDateString()}` : ""}`,
                          )
                          .join(" | ") ||
                          tt(
                            "No approval policies",
                            "Sin políticas de aprobación",
                          )}
                      </div>
                    </section>
                    <section
                      style={{
                        ...card,
                        borderColor:
                          state.status === "suspended"
                            ? "#FCA5A5"
                            : "hsl(var(--border))",
                      }}
                    >
                      <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>
                        {tt("Financial suspension", "Suspensión financiera")}
                      </h2>
                      <p style={{ fontSize: 11, color: "#64748B" }}>
                        {tt(
                          "Suspension blocks mutations, approvals, exports, integrations, and financial AI. Authorized audit reads remain available.",
                          "La suspensión bloquea mutaciones, aprobaciones, exportaciones, integraciones e IA financiera. Las lecturas de auditoría autorizadas permanecen disponibles.",
                        )}
                      </p>
                      <textarea
                        style={inputStyle}
                        placeholder={tt(
                          "Required reason",
                          "Motivo obligatorio",
                        )}
                        value={suspensionReason}
                        onChange={(e) => setSuspensionReason(e.target.value)}
                      />
                      <Button
                        disabled={busy || !suspensionReason}
                        variant={
                          state.status === "suspended"
                            ? "default"
                            : "destructive"
                        }
                        style={{ marginTop: 8 }}
                        onClick={() =>
                          mutate("/financial-controls/suspension", {
                            ...scopeBody,
                            action:
                              state.status === "suspended"
                                ? "release"
                                : "activate",
                            reason: suspensionReason,
                          })
                        }
                      >
                        {state.status === "suspended"
                          ? tt("Release suspension", "Liberar suspensión")
                          : tt(
                              "Suspend financial operations",
                              "Suspender operaciones financieras",
                            )}
                      </Button>
                    </section>
                    <section style={card}>
                      <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>
                        {tt(
                          "Immutable authority journal",
                          "Diario inmutable de autoridad",
                        )}
                      </h2>
                      <div style={{ display: "grid", gap: 6 }}>
                        {admin.journal.slice(0, 20).map((j, i) => (
                          <div
                            key={`${j.entity_id}-${i}`}
                            style={{
                              fontSize: 11,
                              borderTop: "1px solid hsl(var(--border))",
                              paddingTop: 6,
                            }}
                          >
                            <b>{eventLabel(j.event_type)}</b> · {j.reason_code}{" "}
                            · {new Date(j.occurred_at).toLocaleString()}
                            <div style={{ color: "#64748B" }}>
                              {tt(j.explanation_en, j.explanation_es)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </>
            )
          )}
        </main>
      </div>
    </div>
  );
}
