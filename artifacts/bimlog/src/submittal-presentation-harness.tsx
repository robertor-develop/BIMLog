import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ConfigProvider } from "./lib/config-context";
import { SubmittalsTab } from "./pages/project/SubmittalsTab";
import "./index.css";

if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
const sample = { id: 10, projectId: 1, number: "TEST-SUB-1", title: "TEST calendar and labels", status: "pending", submittalType: "shop_drawing", dateSubmitted: "2026-09-26", createdAt: "2026-09-26T12:00:00Z" };
window.fetch = async (input) => {
  const path = String(input);
  if (path.endsWith("/submittals")) return Response.json([sample]);
  if (path.endsWith("/submittal-register-coverage")) return Response.json({ requirements: [], packages: [], links: [] });
  if (path.endsWith("/config")) return Response.json({});
  if (path.startsWith("/api/")) return Response.json([]);
  throw new Error(`Unexpected fixture request: ${path}`);
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Harness() {
  const { lang, setLang } = useI18n();
  return <main className="p-4"><h1>Local actual-component test; synthetic transport, not deployed acceptance</h1>
    <button onClick={() => setLang(lang === "es" ? "en" : "es")}>English / Español</button>
    <SubmittalsTab projectId={1} initialView="tracking" />
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><I18nProvider><ConfigProvider><Harness /></ConfigProvider></I18nProvider></QueryClientProvider>);
