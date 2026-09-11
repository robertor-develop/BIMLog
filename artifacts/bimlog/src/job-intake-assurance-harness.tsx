import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { QuickJobIntake } from "./components/job-intake/QuickJobIntake";
import "./index.css";

const projectId = Number(new URLSearchParams(location.search).get("project") || "101");
const dataKey = `bimlog:job-intake-assurance-data:${projectId}`;
const empty = {
  identity: { jobName: "", jobCode: "", location: "", clientCompanyId: null, clientCompany: "", primaryContactId: null, primaryContact: "" },
  commercial: { contracts: [{ id: "PRIMARY", counterpartyName: "" }] },
  scopeItems: [], delivery: {}, review: {},
};

function Harness() {
  const [data, setData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(dataKey) || "null") || empty; } catch { return empty; }
  });
  useEffect(() => { localStorage.setItem(dataKey, JSON.stringify(data)); }, [data]);
  return <main style={{ maxWidth: 1200, margin: "32px auto", padding: 16 }}>
    <QuickJobIntake
      data={data}
      setData={setData}
      companies={[{ id: 11, name: "BIMTech Corp" }, { id: 22, name: "Ruben Mechanical" }]}
      contacts={[{ id: 31, companyId: 11, fullName: "Lorena Choquevillca", email: "lorena@example.test" }]}
      defaultRate="35.47"
      defaultApuVersion={1}
      projectId={projectId}
      tt={(en) => en}
      onAdvanced={() => { document.body.dataset.advanced = "opened"; }}
      request={async () => ({})}
      onCompanyCreated={() => undefined}
      onContactCreated={() => undefined}
    />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
