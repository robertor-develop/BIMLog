import React from "react";
import { createServer } from "node:http";
import { renderToStaticMarkup } from "react-dom/server";
import { SimpleJobIntakeExperience } from "./SimpleJobIntakeExperience";

const data = {
  identity: { jobName: "River Avenue", jobCode: "RA-01", clientCompany: "General Contractor", primaryContact: "Ruben", location: "New York, NY", currency: "USD" },
  commercial: { contracts: [{ id: "PRIMARY", counterpartyName: "General Contractor", agreementKind: "base", contractType: "consultant_agreement" }] },
  scopeItems: [{ id: "CI-1", name: "HVAC shop drawings", plannedHours: "80", billingHourlyRate: "35.47", contractId: "PRIMARY" }],
  delivery: { workflowTemplate: "bim-submittal" },
  team: { projectLeaderUserId: 7, assignments: [{ id: "A-1", userId: 7, personName: "Ana", role: "BIM Coordinator", scopeItemId: "CI-1", plannedHours: "80" }] },
  review: { scopeConfirmed: false, teamConfirmed: false },
};
const css = `*{box-sizing:border-box}body{margin:0;background:#eef3f8;color:#0f172a;font:14px Inter,Arial,sans-serif}.shell{max-width:1180px;margin:auto;padding:28px}.ji-simple{background:linear-gradient(145deg,#f8fbff,#fff);border:1px solid #bfd4f5;border-radius:18px;padding:22px}.ji-simple-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.ji-simple-top h2{font-size:24px;margin:4px 0}.ji-simple-top p{color:#536174}.ji-simple-kicker{color:#1d4ed8;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}button,input{border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;background:#fff;color:#0f172a}.ji-simple-steps{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;list-style:none;padding:0;margin:22px 0}.ji-simple-steps button{width:100%;border:0;background:transparent;padding:6px;font-size:11px}.ji-simple-steps button span{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#e2e8f0;margin:0 auto 5px}.ji-simple-steps li.on button span{background:#1d4ed8;color:#fff}.ji-simple-steps li.done button span{background:#dcfce7;color:#166534}.ji-simple-question{min-height:270px;padding:20px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}.ji-simple-question h3{font-size:21px;margin:0 0 6px}.ji-simple-question p{color:#536174}.ji-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.ji-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}label{display:grid;gap:5px;font-size:12px;font-weight:700;color:#475569}.ji-simple-nav{display:flex;justify-content:space-between;align-items:center;margin-top:14px}.primary{background:#1d4ed8;color:#fff;border-color:#1d4ed8;font-weight:700}@media(max-width:700px){.shell{padding:10px}.ji-simple{padding:14px}.ji-simple-top{display:block}.ji-simple-steps{display:flex;overflow:auto}.ji-simple-steps li{min-width:76px}.ji-grid,.ji-grid.three{grid-template-columns:1fr}.ji-simple-question{min-height:0}.ji-simple-nav span{display:none}}`;
const server = createServer((request, response) => {
  const spanish = new URL(request.url || "/", "http://127.0.0.1").searchParams.get("lang") === "es";
  const tt = (en: string, es: string) => spanish ? es : en;
  const body = renderToStaticMarkup(<SimpleJobIntakeExperience data={data} setData={() => undefined} members={[{ id: 7, name: "Ana" }]} defaultRate="35.47" tt={tt} onAdvanced={() => undefined}/>);
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="${spanish ? "es" : "en"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simple Job Intake QA</title><style>${css}</style></head><body><main class="shell">${body}</main></body></html>`);
});
server.listen(Number(process.env.PORT || 4179), "127.0.0.1", () => console.log(`Simple Job Intake visual fixture: http://127.0.0.1:${process.env.PORT || 4179}`));
