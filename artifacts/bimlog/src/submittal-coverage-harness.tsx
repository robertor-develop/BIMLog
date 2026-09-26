import { createRoot } from "react-dom/client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubmittalRegisterCoverage, type RegisterCoverage } from "./components/SubmittalRegisterCoverage";
import "./index.css";

if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
const key = "bimlog-c004-synthetic-fixture";
const initial: RegisterCoverage = {
  requirements: [
    { id: 1, specSection: "23 00", description: "TEST duct requirement", requiredByDate: "2026-10-15" },
    { id: 2, specSection: "23 00", description: "TEST duct requirement", requiredByDate: null },
  ],
  packages: [
    { id: 10, number: "TEST-SUB-1", title: "TEST duct shop drawings", status: "draft", revisionNumber: 0, parentSubmittalId: null },
    { id: 11, number: "TEST-SUB-1-R1", title: "TEST revised duct shop drawings", status: "approved", revisionNumber: 1, parentSubmittalId: 10 },
    { id: 12, number: "TEST-SUB-2", title: "TEST unmatched sleeve package", status: "submitted", revisionNumber: 0, parentSubmittalId: null },
  ], links: [],
};
let data: RegisterCoverage = JSON.parse(sessionStorage.getItem(key) ?? JSON.stringify(initial));
let failRead = false, failWrite = false;
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = String(input);
  if (path === "/api/v1/projects/1/submittal-register-coverage") {
    return Response.json(failRead ? { error: "TEST failure" } : data, { status: failRead ? 503 : 200 });
  }
  const match = path.match(/^\/api\/v1\/projects\/1\/submittal-register\/(\d+)\/packages\/(\d+)$/);
  if (match && init?.method === "PUT") {
    if (failWrite) return Response.json({ error: "TEST denied" }, { status: 403 });
    const requirementId = Number(match[1]), packageId = Number(match[2]);
    data.links = data.links.filter(link => link.requirementId !== requirementId || link.packageId !== packageId);
    if (JSON.parse(String(init.body)).linked) data.links.push({ requirementId, packageId });
    sessionStorage.setItem(key, JSON.stringify(data));
    return Response.json({ changed: true });
  }
  return originalFetch(input, init);
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Harness() {
  const [lang, setLang] = useState("en"), [readOnly, setReadOnly] = useState(false);
  const [narrow, setNarrow] = useState(false), [navigation, setNavigation] = useState("");
  return <main className="p-4" style={{ width: narrow ? 390 : "100%", maxWidth: "100%" }}>
    <h1>C004 local production-component fixture — synthetic data, not deployed acceptance</h1>
    <div className="flex flex-wrap gap-3 my-4">
      <button onClick={() => setLang(lang === "en" ? "es" : "en")}>English / Español</button>
      <label><input type="checkbox" checked={readOnly} onChange={event => setReadOnly(event.target.checked)} />Read-only fixture</label>
      <label><input type="checkbox" onChange={event => { failRead = event.target.checked; }} />Fail reads</label>
      <label><input type="checkbox" onChange={event => { failWrite = event.target.checked; }} />Fail writes</label>
      <label><input type="checkbox" checked={narrow} onChange={event => setNarrow(event.target.checked)} />390px container</label>
    </div>
    <output>{navigation}</output>
    <SubmittalRegisterCoverage projectId={1} lang={lang} canWrite={!readOnly}
      onGoRegister={() => setNavigation("TEST callback: existing register")}
      onOpenPackage={id => setNavigation(`TEST callback: package ${id}`)} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
