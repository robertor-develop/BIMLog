import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Router } from "wouter";
import { I18nProvider, useI18n } from "./lib/i18n";
import { useAuthStore } from "./store/auth";
import { IntegrationsTab } from "./pages/project/IntegrationsTab";
import { LegacyIntegrationsTab } from "./pages/project/LegacyIntegrationsTab";
import "./index.css";

if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
useAuthStore.setState({ token: "synthetic-local-fixture-only" });
let failRead = false;
const providers = [
  { key: "files", label: { en: "TEST documents", es: "TEST documentos" }, category: "open_format", availability: "available", route: "files", oauthParam: null },
  { key: "ready", label: { en: "TEST ready account", es: "TEST cuenta disponible" }, category: "file_source", availability: "available", route: null, oauthParam: "ready" },
  { key: "setup", label: { en: "TEST setup account", es: "TEST cuenta sin configurar" }, category: "file_source", availability: "setup_required", route: null, oauthParam: "setup" },
  { key: "review", label: { en: "TEST governed", es: "TEST gobernada" }, category: "governed", availability: "review_required", route: null, oauthParam: null },
].map(provider => ({ ...provider, description: { en: "Synthetic capability, not a real provider", es: "Capacidad sintética, no es un proveedor real" } }));
window.fetch = async (input) => {
  const url = String(input);
  if (url === "/api/v1/me/provider-catalog") return Response.json(failRead ? {} : { providers }, { status: failRead ? 503 : 200 });
  if (url === "/api/v1/me/connections") return Response.json([{ provider: "setup", status: "connected" }]);
  if (url.endsWith("/destination")) return Response.json({ canConfigure: false, credentials: [], current: null });
  if (url.endsWith("/publishing-readiness")) return Response.json({ ready: false, blockers: ["IMPORT_MISSING"], providerError: null });
  if (url.endsWith("/publishing-jobs")) return Response.json({ jobs: [] });
  if (url.endsWith("/folder-wizard")) return Response.json({ current: null });
  return Response.json({ error: "Local fixture blocks all unmodeled requests" }, { status: 403 });
};
function Harness() {
  const { lang, setLang } = useI18n();
  const [legacy, setLegacy] = useState(false), [narrow, setNarrow] = useState(false), [revision, setRevision] = useState(0);
  const [destination, setDestination] = useState("/projects/1/integrations");
  const Component = legacy ? LegacyIntegrationsTab : IntegrationsTab;
  return <main style={{ width: narrow ? 390 : "100%", maxWidth: "100%" }}>
    <h1>C005 actual-component fixture — synthetic transport, not deployed acceptance</h1>
    <div className="flex flex-wrap gap-3 p-4">
      <button onClick={() => setLang(lang === "es" ? "en" : "es")}>English / Español</button>
      <label><input type="checkbox" checked={legacy} onChange={event => setLegacy(event.target.checked)} />Compatibility export</label>
      <label><input type="checkbox" checked={narrow} onChange={event => setNarrow(event.target.checked)} />390px container</label>
      <label><input type="checkbox" onChange={event => { failRead = event.target.checked; setRevision(value => value + 1); }} />Fail catalog</label>
    </div>
    <output>TEST navigation: {destination}</output>
    <Router hook={() => [destination, setDestination]}><Component key={revision} projectId={1} /></Router>
  </main>;
}
createRoot(document.getElementById("root")!).render(<I18nProvider><Harness /></I18nProvider>);
