import { Link } from "wouter";
import { BookOpenCheck, Building2, CheckCircle2, ExternalLink, GraduationCap, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STEPS = [
  { key: "catalogs", href: "/company-catalogs", en: "Confirm canonical company catalogs", es: "Confirmar catálogos canónicos de empresa" },
  { key: "templates", href: "/company-workflows", en: "Review published delivery workflows", es: "Revisar flujos de entrega publicados" },
  { key: "governance", href: "/company-workflow-governance", en: "Review role and approval governance", es: "Revisar gobernanza de roles y aprobaciones" },
  { key: "pricing", href: "/company-pricing-templates", en: "Review pricing templates when Commercial is in scope", es: "Revisar plantillas de precios cuando Comercial aplique" },
  { key: "help", href: "/help?topic=lens-next&view=manual", en: "Rehearse Lens Next fallback and responsible-company rules", es: "Ensayar respaldo de Lens Next y reglas de empresa responsable" },
] as const;

export function ProjectSetupTraining() {
  const { lang } = useI18n();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  return (
    <main id="main-content" tabIndex={-1} className="training-page" data-training-classification="synthetic">
      <style>{`
        .training-page{min-height:100vh;background:#f4f7fb;color:#172033;padding:28px}.training-shell{max-width:980px;margin:0 auto}.training-hero{background:linear-gradient(135deg,#102749,#2459a8);color:#fff;border-radius:18px;padding:28px;box-shadow:0 18px 45px rgba(16,39,73,.18)}.training-kicker{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#cfe0ff}.training-hero h1{margin:8px 0;font-size:30px}.training-hero p{max-width:760px;line-height:1.65;color:#e8f0ff}.training-warning{margin:18px 0 0;border:1px solid rgba(255,255,255,.35);border-radius:10px;padding:12px 14px;font-size:13px}.training-grid{display:grid;gap:12px;margin-top:18px}.training-step{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:14px;align-items:center;background:#fff;border:1px solid #dce4ef;border-radius:13px;padding:16px}.training-number{width:38px;height:38px;border-radius:50%;background:#eaf1ff;color:#174da8;display:grid;place-items:center;font-weight:850}.training-step h2{font-size:15px;margin:0 0 5px}.training-step p{font-size:12px;color:#607087;margin:0;line-height:1.5}.training-link{display:inline-flex;align-items:center;gap:6px;text-decoration:none;background:#174da8;color:#fff;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:750}.training-footer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.training-note{background:#fff;border:1px solid #dce4ef;border-radius:13px;padding:16px;display:flex;gap:10px;font-size:12px;line-height:1.6;color:#4f6078}.training-note svg{flex:none;color:#2563eb}@media(max-width:700px){.training-page{padding:14px}.training-step{grid-template-columns:38px 1fr}.training-link{grid-column:1/-1;justify-content:center}.training-footer{grid-template-columns:1fr}}
      `}</style>
      <div className="training-shell">
        <header className="training-hero">
          <div className="training-kicker"><GraduationCap size={18}/>{t("Synthetic training workspace", "Espacio de capacitación sintético")}</div>
          <h1>{t("Project setup rehearsal", "Ensayo de configuración de proyecto")}</h1>
          <p>{t("Walk through the real BIMLog workspaces with a clearly synthetic scenario before configuring customer work.", "Recorra los espacios reales de BIMLog con un escenario claramente sintético antes de configurar trabajo de clientes.")}</p>
          <div className="training-warning"><strong>{t("Training boundary:", "Límite de capacitación:")}</strong> {t("This page does not create, approve, publish, activate, or modify templates, projects, customer records, or Navisworks installations.", "Esta página no crea, aprueba, publica, activa ni modifica plantillas, proyectos, registros de clientes o instalaciones de Navisworks.")}</div>
        </header>
        <section className="training-grid" aria-label={t("Training steps", "Pasos de capacitación")}>
          {STEPS.map((step, index) => <article className="training-step" key={step.key}>
            <div className="training-number">{index + 1}</div>
            <div><h2>{t(step.en, step.es)}</h2><p>{t("Open the live workspace in read/review mode. Perform changes only under your current BIMLog permissions and normal approval workflow.", "Abra el espacio real en modo de lectura/revisión. Haga cambios solo bajo sus permisos actuales y el flujo normal de aprobación.")}</p></div>
            <Link className="training-link" href={step.href}>{t("Open workspace", "Abrir espacio")}<ExternalLink size={14}/></Link>
          </article>)}
        </section>
        <footer className="training-footer">
          <div className="training-note"><ShieldCheck size={20}/><span><strong>{t("No autoapproval.", "Sin autoaprobación.")}</strong> {t("Draft templates remain unavailable until the existing authorized review and publication steps complete.", "Las plantillas en borrador no están disponibles hasta completar la revisión y publicación autorizadas existentes.")}</span></div>
          <div className="training-note"><Building2 size={20}/><span><strong>{t("Canonical identity.", "Identidad canónica.")}</strong> {t("Company aliases never merge tenants; ambiguous names require explicit identity resolution.", "Los alias de empresa nunca fusionan inquilinos; los nombres ambiguos exigen resolución explícita.")}</span></div>
          <div className="training-note"><BookOpenCheck size={20}/><span><strong>{t("Actual UI.", "Interfaz real.")}</strong> {t("Each step opens the same governed workspace used in normal operation.", "Cada paso abre el mismo espacio gobernado usado en operación normal.")}</span></div>
          <div className="training-note"><CheckCircle2 size={20}/><span><strong>{t("Lens fallback protected.", "Respaldo de Lens protegido.")}</strong> {t("The walkthrough changes no Lens Native binaries, installers, or Ruben's workstation.", "El recorrido no cambia binarios de Lens Native, instaladores ni la estación de Rubén.")}</span></div>
        </footer>
      </div>
    </main>
  );
}
