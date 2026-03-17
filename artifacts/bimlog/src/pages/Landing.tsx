import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { FileCheck2, ShieldCheck, FileSpreadsheet, Users, ArrowRight, CheckCircle2, UserPlus, FolderPlus, Settings2, Upload, MessageSquare, BarChart2 } from "lucide-react";

export function Landing() {
  const { t } = useI18n();

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
              { value: "Works with", label: "your existing tools" },
              { value: "100%", label: "server-side validation" },
              { value: "Real-time", label: "audit trail" },
              { value: "ISO 19650", label: "standards aligned" },
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
            Built for precision. Designed for teams.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every feature in BIMLog exists to eliminate coordination failures and establish clear accountability.
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
            Getting Started
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Up and running in 6 steps
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From account creation to fully coordinated BIM project — here's the complete workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: <UserPlus className="w-5 h-5 text-blue-600" />,
              color: "bg-blue-50 border-blue-100",
              title: "Create your account",
              desc: "Register with your name, email, and company. Your account is immediately ready — no email confirmation required.",
              tips: ["Use your company email", "Company name appears in reports"],
            },
            {
              step: "02",
              icon: <FolderPlus className="w-5 h-5 text-violet-600" />,
              color: "bg-violet-50 border-violet-100",
              title: "Create a project",
              desc: "Click '+ New Project' on the dashboard. Give it a name and a short code (e.g. NYC-270). You are automatically assigned Project Admin.",
              tips: ["Code must be uppercase alphanumeric", "Invite team from the Team tab"],
            },
            {
              step: "03",
              icon: <Settings2 className="w-5 h-5 text-orange-600" />,
              color: "bg-orange-50 border-orange-100",
              title: "Define naming conventions",
              desc: "Go to Convention Builder (admin only). Add fields like Originator, Discipline, Phase. Activate when ready — all uploads validate against it instantly.",
              tips: ["Set allowed values per field", "Activate/deactivate without deleting"],
            },
            {
              step: "04",
              icon: <Upload className="w-5 h-5 text-emerald-600" />,
              color: "bg-emerald-50 border-emerald-100",
              title: "Upload & validate files",
              desc: "Open the Files tab and upload BIM files. The server validates the filename against the active convention. Non-compliant files are rejected with field-level errors.",
              tips: ["Use Name Generator for compliant names", "See exact field violations on rejection"],
            },
            {
              step: "05",
              icon: <MessageSquare className="w-5 h-5 text-red-500" />,
              color: "bg-red-50 border-red-100",
              title: "Manage RFIs & Submittals",
              desc: "Create and track Requests for Information and Submittals from their dedicated tabs. Assign status, reference files, and keep the full coordination trail.",
              tips: ["Status follows ISO 19650 workflow", "All changes logged automatically"],
            },
            {
              step: "06",
              icon: <BarChart2 className="w-5 h-5 text-primary" />,
              color: "bg-blue-50 border-blue-100",
              title: "Monitor & report",
              desc: "Use the Analytics dashboard for a live overview of files, RFIs, and team activity. The Activity Log is immutable — every action is permanently recorded.",
              tips: ["Activity log cannot be deleted", "Switch language EN / ES anytime"],
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
            <div className="font-display font-bold text-foreground text-lg mb-1">Ready to start?</div>
            <div className="text-sm text-muted-foreground">Create an account and build your first project in under 2 minutes.</div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link href="/login">
              <Button variant="outline" className="text-sm px-5">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button className="gap-2 text-sm px-5">
                Create Account
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
                Zero tolerance for naming chaos.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                BIMLog enforces your naming conventions at the server — not just the client. Every upload is validated against the active convention. Non-compliant files are rejected with detailed feedback.
              </p>
              <ul className="space-y-3">
                {[
                  "422 response on convention mismatch",
                  "Field-level error messages",
                  "Dropdown-only Name Generator",
                  "Immutable activity log",
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
                <div className="text-destructive font-semibold mb-3">HTTP 422 — Naming Violation</div>
                {[
                  { field: "originator", received: "XYZ", expected: ["ABC", "DEF", "GHI"] },
                  { field: "discipline", received: "AR", expected: ["ARC", "STR", "MEP"] },
                ].map(e => (
                  <div key={e.field} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <span className="text-destructive">{e.field}</span>
                    <span className="text-muted-foreground"> received </span>
                    <span className="text-foreground">"{e.received}"</span>
                    <div className="mt-1 text-muted-foreground">
                      allowed: {e.expected.map(v => (
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
          Ready to bring order to your BIM workflow?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          Join teams using BIMLog to enforce standards and maintain accountability across every project.
        </p>
        <Link href="/register">
          <Button size="lg" className="gap-2 text-base px-8">
            Start for free
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-foreground">BIMLog</span>
            <span className="text-muted-foreground text-sm">by IgniteSmart</span>
          </div>
          <div className="text-sm text-muted-foreground">
            ignitesmart.ai
          </div>
        </div>
      </footer>
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
