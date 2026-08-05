import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router as WouterRouter } from "wouter";
import { FinancialApuWorkspace } from "@/pages/FinancialApuWorkspace";
import { I18nProvider } from "@/lib/i18n";
import { ConfigProvider } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import "@/index.css";

type HarnessState = "populated" | "empty" | "loading" | "denied" | "unsupported" | "error";

const params = new URLSearchParams(window.location.search);
const requestedState = params.get("state");
const states: HarnessState[] = ["populated", "empty", "loading", "denied", "unsupported", "error"];
const state: HarnessState = states.includes(requestedState as HarnessState)
  ? requestedState as HarnessState
  : "populated";
const language = params.get("lang") === "es" ? "es" : "en";

const harnessUser = {
  id: 2601,
  email: "project26.fixture@bimlog.test",
  fullName: "Project 26 Reviewer",
  companyName: "BIMLog Fixture Company",
  companyId: 26,
  createdAt: "2026-08-05T00:00:00.000Z",
};

localStorage.setItem("bimlog-lang", language);
useAuthStore.persist.setOptions({
  storage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
});
useAuthStore.getState().setAuth("project-26-harness-token", harnessUser);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const workspaceFixture = {
  data: {
    project: { id: 26, name: "Project 26", code: "P-026" },
    company: { id: "26", name: "BIMLog Fixture Company" },
    boundary: {
      en: "Project 26 is bound to the fixture company for isolated UI review.",
      es: "El Proyecto 26 está vinculado a la empresa de prueba para la revisión aislada de la interfaz.",
    },
    capabilities: {
      canCreate: false,
      canApply: false,
      canCommit: false,
      canApprove: false,
      canApproveOverrun: false,
      reason: {
        en: "The harness demonstrates the production read-only authority state.",
        es: "El entorno de prueba demuestra el estado de autoridad de solo lectura de producción.",
      },
    },
    applications: state === "empty" ? [] : [{
      id: "apu-26-001",
      status: "approved",
      currency: "USD",
      template: {
        id: "template-26-001",
        name: "Concrete footing analysis",
        version: "1.0.0",
        fingerprint: "fixture-project-26-template-fingerprint",
      },
      totals: {
        originalBudget: "12850.00",
        committed: "9800.00",
        approved: "9400.00",
        paidReleased: "4700.00",
        remaining: "3450.00",
        overrun: "0.00",
      },
    }],
    contract: {
      schemaVersion: "apu-workspace.v1",
      evaluatorVersion: state === "unsupported" ? null : "apu-evaluator.v1",
      evaluationSupported: state !== "unsupported",
    },
  },
  meta: { revision: "project-26-fixture-revision", fingerprint: "project-26-fixture-fingerprint" },
};

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const path = new URL(url, window.location.origin).pathname;
  if (path === "/api/v1/config") {
    return json({ member_role: [{ value: "member", label: "Member", labelEs: "Miembro", meta: { permission: "read" } }] });
  }
  if (path === "/api/v1/projects/26") {
    return json({ id: 26, name: "Project 26", description: "Generic APU UI evidence fixture", code: "P-026", status: "active", createdById: 2601, createdAt: "2026-08-05T00:00:00.000Z", updatedAt: "2026-08-05T00:00:00.000Z" });
  }
  if (path === "/api/v1/projects/26/members") {
    return json([{ id: 2601, projectId: 26, userId: 2601, userFullName: harnessUser.fullName, userEmail: harnessUser.email, userCompanyName: harnessUser.companyName, role: "member", joinedAt: "2026-08-05T00:00:00.000Z" }]);
  }
  if (path === "/api/v1/projects/26/financial/apu") {
    if (state === "loading") return new Promise<Response>(() => undefined);
    if (state === "denied") return json({ code: "FINANCE_AUTHORITY_REQUIRED", error: { en: "The fixture user is denied Finance access.", es: "Al usuario de prueba se le deniega el acceso financiero." }, correlationId: "project-26-denied-fixture" }, 403);
    if (state === "error") return json({ code: "APU_REQUEST_FAILED", error: { en: "The isolated fixture simulates a retryable request failure.", es: "La prueba aislada simula un error de solicitud que se puede reintentar." }, correlationId: "project-26-error-fixture" }, 500);
    return json(workspaceFixture);
  }
  return json({
    code: "PROJECT_26_HARNESS_UNHANDLED_REQUEST",
    error: {
      en: `The isolated Project 26 harness has no fixture for ${path}.`,
      es: `El entorno aislado del Proyecto 26 no tiene datos de prueba para ${path}.`,
    },
  }, 501);
};

history.replaceState(null, "", `/projects/26/financial/apu?state=${state}&lang=${language}&fixture=project-26`);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <ConfigProvider>
        <WouterRouter>
          <FinancialApuWorkspace />
        </WouterRouter>
      </ConfigProvider>
    </I18nProvider>
  </QueryClientProvider>,
);
