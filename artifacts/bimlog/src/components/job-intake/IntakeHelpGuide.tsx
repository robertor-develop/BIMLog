import React from "react";
import { BookOpen, ChevronRight, CircleHelp, Network, ShieldCheck } from "lucide-react";

type Props = { tt: (en: string, es: string) => string };

const css = `
.ihg{margin:18px 0;border:1px solid #b9cbe3;border-radius:18px;background:#fff;color:#10233f;overflow:hidden}.ihg *{box-sizing:border-box}.ihg summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:17px 20px;font-weight:800;font-size:16px;background:#f1f7ff}.ihg summary::-webkit-details-marker{display:none}.ihg summary span{flex:1}.ihg summary svg:last-child{transition:transform .2s}.ihg[open] summary svg:last-child{transform:rotate(90deg)}.ihg summary:focus-visible,.ihg a:focus-visible{outline:3px solid #f59e0b;outline-offset:3px}.ihg-body{padding:20px}.ihg-intro{margin:0 0 16px;color:#42536b;max-width:78ch}.ihg-path{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 18px}.ihg-step{position:relative;padding:12px;border:1px solid #d9e3ef;border-radius:12px;background:#fbfdff}.ihg-step strong,.ihg-step span{display:block}.ihg-step strong{font-size:13px}.ihg-step span{font-size:11px;color:#5d6b7d;margin-top:4px}.ihg-step:not(:last-child)::after{content:'›';position:absolute;right:-8px;top:25px;z-index:1;color:#2563eb;font-size:19px;font-weight:900}.ihg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ihg-card{padding:14px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}.ihg-card h3{display:flex;gap:7px;align-items:center;font-size:14px;margin:0 0 7px}.ihg-card p{font-size:12px;line-height:1.45;color:#475569;margin:0}.ihg-boundary{margin-top:14px;padding:12px;border-left:4px solid #0f766e;background:#ecfdf5;color:#134e4a}.ihg-links{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}.ihg-links a{color:#1649ad;font-weight:800;text-decoration:none}@media(max-width:760px){.ihg-path{grid-template-columns:1fr}.ihg-step:not(:last-child)::after{content:'↓';right:18px;top:auto;bottom:-14px}.ihg-grid{grid-template-columns:1fr}.ihg summary{padding:15px}.ihg-body{padding:15px}}
`;

export function IntakeHelpGuide({ tt }: Props) {
  const steps = [
    [tt("Companies", "Empresas"), tt("Who participates", "Quién participa")],
    [tt("Agreements", "Acuerdos"), tt("Who hired whom", "Quién contrató a quién")],
    ["APU", tt("How each service is priced", "Cómo se cotiza cada servicio")],
    [tt("Packages", "Paquetes"), tt("How work is divided", "Cómo se divide el trabajo")],
    [tt("Resources", "Recursos"), tt("Who does what", "Quién hace qué")],
  ];
  return <details className="ihg" id="job-intake-help">
    <summary aria-controls="job-intake-help-content"><CircleHelp aria-hidden="true"/><span>{tt("Help me understand this screen", "Ayúdeme a entender esta pantalla")}</span><ChevronRight aria-hidden="true"/></summary>
    <div className="ihg-body" id="job-intake-help-content">
      <p className="ihg-intro">{tt("Start with only what you know. BIMLog keeps one job and connects the companies, agreements, prices, work and people beneath it. Blank optional details can be completed later.", "Empiece solo con lo que sabe. BIMLog mantiene un solo trabajo y conecta debajo sus empresas, acuerdos, precios, trabajo y personas. Los datos opcionales en blanco pueden completarse después.")}</p>
      <div className="ihg-path" aria-label={tt("Job setup order", "Orden de configuración del trabajo")}>{steps.map(([name, meaning])=><div className="ihg-step" key={name}><strong>{name}</strong><span>{meaning}</span></div>)}</div>
      <div className="ihg-grid">
        <article className="ihg-card"><h3><Network aria-hidden="true"/>{tt("What falls under what?", "¿Qué depende de qué?")}</h3><p>{tt("An agreement belongs to a company relationship. An APU belongs to an agreement. Packages belong to an APU. Resources belong to packages.", "Un acuerdo pertenece a una relación entre empresas. Un APU pertenece a un acuerdo. Los paquetes pertenecen a un APU. Los recursos pertenecen a paquetes.")}</p></article>
        <article className="ihg-card"><h3><BookOpen aria-hidden="true"/>{tt("What am I approving?", "¿Qué estoy aprobando?")}</h3><p>{tt("Nothing on this draft screen is approved automatically. Draft planning becomes authoritative only through the named review and activation actions.", "Nada en esta pantalla de borrador se aprueba automáticamente. La planificación solo se vuelve autoritativa mediante las acciones identificadas de revisión y activación.")}</p></article>
        <article className="ihg-card"><h3><ShieldCheck aria-hidden="true"/>{tt("What stays outside?", "¿Qué queda fuera?")}</h3><p>{tt("Payroll, payments, taxes, invoices, legal approval and accounting remain in their authorized systems. This screen does not create them.", "Nómina, pagos, impuestos, facturas, aprobación legal y contabilidad permanecen en sus sistemas autorizados. Esta pantalla no los crea.")}</p></article>
      </div>
      <div className="ihg-boundary" role="note"><strong>{tt("Simple rule: one real-world fact, one owning record.", "Regla simple: un hecho real, un registro responsable.")}</strong> {tt("The command center summarizes; the guided sections edit.", "El centro de control resume; las secciones guiadas editan.")}</div>
      <nav className="ihg-links" aria-label={tt("Jump to job setup sections", "Ir a las secciones del trabajo")}><a href="#company-job-map">{tt("Companies", "Empresas")}</a><a href="#agreement-lifecycle">{tt("Agreements", "Acuerdos")}</a><a href="#apu-builder-title">APU</a><a href="#wp-title">{tt("Packages", "Paquetes")}</a><a href="#rp-title">{tt("Resources", "Recursos")}</a></nav>
    </div>
    <style>{css}</style>
  </details>;
}
