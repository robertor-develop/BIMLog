import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";
import { FileCheck2, ShieldCheck, FileSpreadsheet, Users, ArrowRight, CheckCircle2, UserPlus, FolderPlus, Settings2, Upload, MessageSquare, BarChart2 } from "lucide-react";

export function Landing() {
  const { t, tt } = useI18n();

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/20 text-primary text-sm font-medium rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {t('landing.badge')}
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-foreground leading-[1.1] mb-6">
            {t('landing.hero.title')}
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base px-6">
                {t('landing.hero.cta')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base px-6">
                {t('auth.login')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: tt("Works with", "Compatible con"), label: tt("your existing tools", "tus herramientas actuales") },
              { value: "100%", label: tt("server-side validation", "validación del lado del servidor") },
              { value: tt("Real-time", "En tiempo real"), label: tt("audit trail", "registro de auditoría") },
              { value: "ISO 19650", label: tt("standards aligned", "alineado con estándar") },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-2xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {tt("Built for precision. Designed for teams.", "Construido para la precisión. Diseñado para equipos.")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {tt(
              "Every feature in BIMLog exists to eliminate coordination failures and establish clear accountability.",
              "Cada función de BIMLog existe para eliminar fallas de coordinación y establecer responsabilidad clara.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<FileCheck2 className="w-6 h-6 text-primary" />}
            title={t('landing.features.naming')}
            desc={t('landing.features.namingDesc')}
            color="blue"
          />
          <FeatureCard
            icon={<ShieldCheck className="w-6 h-6 text-accent" />}
            title={t('landing.features.audit')}
            desc={t('landing.features.auditDesc')}
            color="orange"
          />
          <FeatureCard
            icon={<FileSpreadsheet className="w-6 h-6 text-emerald-600" />}
            title={t('landing.features.rfi')}
            desc={t('landing.features.rfiDesc')}
            color="green"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6 text-violet-600" />}
            title={t('landing.features.rbac')}
            desc={t('landing.features.rbacDesc')}
            color="purple"
          />
        </div>
      </section>

      {/* User Guide — How It Works */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/20 text-primary text-sm font-medium rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {tt("Getting Started", "Empezar")}
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            {tt("Up and running in 6 steps", "En marcha en 6 pasos")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {tt(
              "From account creation to fully coordinated BIM project — here's the complete workflow.",
              "Desde la creación de la cuenta hasta un proyecto BIM totalmente coordinado — este es el flujo completo.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: <UserPlus className="w-5 h-5 text-blue-600" />,
              color: "bg-blue-50 border-blue-100",
              title: tt("Create your account", "Crea tu cuenta"),
              desc: tt(
                "Register with your name, email, and company. No email confirmation. No waiting. You are in immediately and assigned as Project Admin.",
                "Regístrate con tu nombre, correo y empresa. Sin confirmación de correo. Sin esperas. Entras de inmediato y se te asigna como Administrador del Proyecto.",
              ),
              tips: [
                tt("No email confirmation required", "No requiere confirmación de correo"),
                tt("Immediately assigned as Project Admin", "Asignado de inmediato como Administrador del Proyecto"),
              ],
            },
            {
              step: "02",
              icon: <FolderPlus className="w-5 h-5 text-violet-600" />,
              color: "bg-violet-50 border-violet-100",
              title: tt("Create a project", "Crea un proyecto"),
              desc: tt(
                "Click New Project on the dashboard. Give it a name and a short code like NYC-270. Review approved file exchange options from the Integrations tab.",
                "Haz clic en Nuevo Proyecto en el panel. Asigna un nombre y un código corto como NYC-270. Revisa las opciones aprobadas de intercambio de archivos en la pestaña Integraciones.",
              ),
              tips: [
                tt("Short code e.g. NYC-270", "Código corto, ej. NYC-270"),
                tt("Review approved integrations", "Revisa las integraciones aprobadas"),
              ],
            },
            {
              step: "03",
              icon: <Settings2 className="w-5 h-5 text-orange-600" />,
              color: "bg-orange-50 border-orange-100",
              title: tt("Set your naming convention", "Define tu convención de nomenclatura"),
              desc: tt(
                "Define your fields once in the Convention Builder. From that moment every file from every trade on every connected platform is validated automatically. No exceptions.",
                "Define tus campos una vez en el Constructor de Convenciones. A partir de ese momento todo archivo de toda disciplina en toda plataforma conectada se valida automáticamente. Sin excepciones.",
              ),
              tips: [
                tt("Every field has allowed values", "Cada campo tiene valores permitidos"),
                tt("No exceptions on any connected platform", "Sin excepciones en ninguna plataforma conectada"),
              ],
            },
            {
              step: "04",
              icon: <Upload className="w-5 h-5 text-emerald-600" />,
              color: "bg-emerald-50 border-emerald-100",
              title: tt("Upload through BIMLog", "Sube a través de BIMLog"),
              desc: tt(
                "Instead of uploading directly to your platform — upload through BIMLog first. We validate, log, and deliver your files to wherever they need to go. One step. Full accountability.",
                "En lugar de subir directamente a tu plataforma — sube primero a través de BIMLog. Validamos, registramos y entregamos tus archivos a donde deban ir. Un solo paso. Responsabilidad total.",
              ),
              tips: [
                tt("Files validated before delivery", "Archivos validados antes de la entrega"),
                tt("Full chain of custody recorded", "Cadena de custodia completa registrada"),
              ],
            },
            {
              step: "05",
              icon: <MessageSquare className="w-5 h-5 text-red-500" />,
              color: "bg-red-50 border-red-100",
              title: tt("Manage RFIs and Submittals", "Gestiona RFIs y Submittals"),
              desc: tt(
                "Track every information request and submission. BIMLog sends automatic escalation alerts up the chain when deadlines are missed. No chasing. No excuses.",
                "Rastrea cada solicitud de información y entrega. BIMLog envía alertas automáticas de escalamiento cuando se incumplen los plazos. Sin perseguir a nadie. Sin excusas.",
              ),
              tips: [
                tt("Automatic escalation alerts", "Alertas automáticas de escalamiento"),
                tt("All changes logged permanently", "Todos los cambios se registran de forma permanente"),
              ],
            },
            {
              step: "06",
              icon: <BarChart2 className="w-5 h-5 text-primary" />,
              color: "bg-blue-50 border-blue-100",
              title: tt("Monitor, report, and protect yourself", "Monitorea, reporta y protégete"),
              desc: tt(
                "Use the Analytics dashboard and AI Report Assistant to see who is causing delays, generate evidence-based reports, and protect your project from costs that are not yours.",
                "Usa el panel de Analítica y el Asistente de Reportes con IA para ver quién está causando retrasos, generar reportes basados en evidencia y proteger tu proyecto de costos que no te corresponden.",
              ),
              tips: [
                tt("AI Report Assistant included", "Asistente de Reportes con IA incluido"),
                tt("Evidence-based delay attribution", "Atribución de retrasos basada en evidencia"),
              ],
            },
          ].map((item) => (
            <div key={item.step} className="card p-6 relative">
              <div style={{
                position: "absolute", top: 20, right: 20,
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                color: "hsl(var(--muted-foreground))", opacity: 0.4,
                letterSpacing: "0.05em"
              }}>{item.step}</div>

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 border ${item.color}`}>
                {item.icon}
              </div>

              <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.desc}</p>

              <ul className="space-y-1.5">
                {item.tips.map(tip => (
                  <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Quick-start CTA strip */}
        <div className="mt-12 surface rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="font-display font-bold text-foreground text-lg mb-1">{tt("Ready to start?", "¿Listo para empezar?")}</div>
            <div className="text-sm text-muted-foreground">{tt("Create an account and build your first project in under 2 minutes.", "Crea una cuenta y arma tu primer proyecto en menos de 2 minutos.")}</div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link href="/login">
              <Button variant="outline" className="text-sm px-5">{tt("Sign In", "Iniciar Sesión")}</Button>
            </Link>
            <Link href="/register">
              <Button className="gap-2 text-sm px-5">
                {tt("Create Account", "Crear Cuenta")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Checklist section */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-4">
                {tt("Zero tolerance for naming chaos.", "Cero tolerancia al caos en nomenclatura.")}
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                {tt(
                  "BIMLog validates every file at the server the moment it is uploaded — not just on the client. Non-compliant files are rejected instantly with a precise breakdown of exactly which field failed and what the correct value should be.",
                  "BIMLog valida cada archivo en el servidor en el momento en que se sube — no solo en el cliente. Los archivos no conformes se rechazan al instante con un desglose preciso de qué campo falló y cuál debería ser el valor correcto.",
                )}
              </p>
              <ul className="space-y-3">
                {[
                  tt("Server-side rejection — no overrides possible", "Rechazo del lado del servidor — sin posibilidad de anulación"),
                  tt("Field-level error messages with allowed values", "Mensajes de error a nivel de campo con valores permitidos"),
                  tt("Dropdown-only Name Generator guarantees compliance", "Generador de Nombres solo con menús desplegables garantiza el cumplimiento"),
                  tt("Every event permanently recorded in the audit trail", "Cada evento queda registrado permanentemente en el registro de auditoría"),
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="surface p-6">
              <div className="font-mono text-xs text-muted-foreground space-y-2">
                <div className="text-destructive font-semibold mb-3">HTTP 422 — {tt("Naming Violation", "Violación de Nomenclatura")}</div>
                {[
                  { field: "originator", received: "XYZ", expected: ["ABC", "DEF", "GHI"] },
                  { field: "discipline", received: "AR", expected: ["ARC", "STR", "MEP"] },
                ].map(e => (
                  <div key={e.field} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <span className="text-destructive">{e.field}</span>
                    <span className="text-muted-foreground"> {tt("received", "recibió")} </span>
                    <span className="text-foreground">"{e.received}"</span>
                    <div className="mt-1 text-muted-foreground">
                      {tt("allowed", "permitidos")}: {e.expected.map(v => (
                        <span key={v} className="inline-block bg-secondary border border-border rounded px-1.5 py-0.5 mr-1">{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-24 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
          {tt("One project. Free. No credit card.", "Un proyecto. Gratis. Sin tarjeta de crédito.")}
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          {tt(
            "Start with one project for 3 months — full access, no limits. See exactly what BIMLog finds in your current workflow. Upgrade when you are ready.",
            "Empieza con un proyecto durante 3 meses — acceso total, sin límites. Mira exactamente qué encuentra BIMLog en tu flujo de trabajo actual. Actualiza cuando estés listo.",
          )}
        </p>
        <Link href="/register">
          <Button size="lg" className="gap-2 text-base px-8">
            {tt("Start for free", "Empieza gratis")}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({
  icon, title, desc, color
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: "blue" | "orange" | "green" | "purple";
}) {
  const bg: Record<string, string> = {
    blue:   "bg-blue-50 border-blue-100",
    orange: "bg-orange-50 border-orange-100",
    green:  "bg-emerald-50 border-emerald-100",
    purple: "bg-violet-50 border-violet-100",
  };

  return (
    <div className="card p-6 hover:-translate-y-0.5 transition-transform duration-200">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 border ${bg[color]}`}>
        {icon}
      </div>
      <h3 className="font-display font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
