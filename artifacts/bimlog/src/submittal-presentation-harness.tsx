import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ConfigProvider } from "./lib/config-context";
import { SubmittalsTab } from "./pages/project/SubmittalsTab";
import { Toaster } from "./components/ui/toaster";
import "./index.css";

if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
const initial = { id: 10, projectId: 1, number: "TEST-SUB-1", title: "TEST calendar and labels", status: "pending", submittalType: "shop_drawing", dateSubmitted: "2026-09-26T00:00:00.000Z", dateRequired: "2026-09-30T00:00:00.000Z", createdAt: "2026-09-26T12:00:00Z", updatedAt: "2026-09-26T12:00:00Z", attachmentsJson: [] };
let sample = JSON.parse(localStorage.getItem("ux-b02-fixture") || "null") || initial;
let failSave = false;
window.fetch = async (input, init) => {
  const path = typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
  if (path.endsWith("/submittals/10") && init?.method === "PATCH") {
    if (failSave) return Response.json({ error: "Synthetic save failure" }, { status: 409 });
    sample = { ...sample, ...JSON.parse(String(init.body)), updatedAt: new Date().toISOString() };
    localStorage.setItem("ux-b02-fixture", JSON.stringify(sample));
    return Response.json(sample);
  }
  if (path.endsWith("/submittals")) return Response.json([sample]);
  if (path.endsWith("/submittal-register-coverage")) return Response.json({ requirements: [], packages: [], links: [] });
  if (path.endsWith("/config")) return Response.json({});
  if (path.includes("/api/")) return Response.json([]);
  throw new Error(`Unexpected fixture request: ${path}`);
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Harness() {
  const { lang, setLang } = useI18n();
  const [canWrite, setCanWrite] = useState(true);
  const [failure, setFailure] = useState(false);
  return <main className="p-4"><h1>Local actual-component test; synthetic transport, not deployed acceptance</h1>
    <button onClick={() => setLang(lang === "es" ? "en" : "es")}>English / Español</button>{" | "}
    <button onClick={() => setCanWrite(!canWrite)}>Fixture permission: {canWrite ? "write" : "read"}</button>{" | "}
    <button onClick={() => { failSave = !failure; setFailure(!failure); }}>Fixture save: {failure ? "fail" : "pass"}</button>
    <SubmittalsTab projectId={1} canWrite={canWrite} initialView="submittals" /><Toaster />
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><I18nProvider><ConfigProvider><Harness /></ConfigProvider></I18nProvider></QueryClientProvider>);
