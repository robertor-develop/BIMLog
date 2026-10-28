import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Grid3X3, LockKeyhole, RefreshCw, Search, X } from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { useI18n } from "@/lib/i18n";
import { loadAccessProfile, type AccessProfile } from "@/lib/access-profile";
import { capabilityGroups, resolveCapabilityDirectoryViews, searchCapabilities } from "@/lib/capability-directory";
import { useAuthStore } from "@/store/auth";
import "./AllTools.css";

export function AllTools() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const tt = (en: string, es: string) => lang === "es" ? es : en;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setProfile(null);
    setError(false);
    loadAccessProfile(token, controller.signal).then(setProfile).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [token, retry]);

  const entries = useMemo(() => profile ? searchCapabilities(resolveCapabilityDirectoryViews(profile), query, lang) : [], [profile, query, lang]);
  const groups = capabilityGroups.filter(group => entries.some(entry => entry.group === group.id));

  return (
    <div className="app-shell">
      <MasterSidebar />
      <main id="main-content" tabIndex={-1} className="all-tools-page" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "28px clamp(18px, 4vw, 48px)" }}>
        <header style={{ maxWidth: 1120, margin: "0 auto 28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Grid3X3 aria-hidden style={{ width: 24, height: 24, color: "#2563EB" }} /><h1 style={{ margin: 0, fontSize: 28 }}>{tt("All Tools", "Todas las herramientas")}</h1></div>
          <p style={{ color: "hsl(var(--muted-foreground))", maxWidth: 760 }}>{tt("Use daily navigation for routine work, or open any authorized BIMLog capability directly here.", "Use la navegación diaria para el trabajo habitual o abra directamente aquí cualquier capacidad autorizada de BIMLog.")}</p>
          <div role="search" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 640, border: "1px solid hsl(var(--border))", borderRadius: 9, padding: "9px 12px", background: "hsl(var(--card))" }}>
            <Search aria-hidden style={{ width: 17, height: 17 }} />
            <label htmlFor="all-tools-search" className="sr-only">{tt("Search tools, tasks, and purposes", "Buscar herramientas, tareas y propósitos")}</label>
            <input id="all-tools-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={tt("Search modules, tasks, or purpose…", "Buscar módulos, tareas o propósito…")} style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: "inherit" }} />
            {query && <button type="button" aria-label={tt("Clear search", "Limpiar búsqueda")} onClick={() => setQuery("")} style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit", display: "grid", placeItems: "center" }}><X aria-hidden style={{ width: 16, height: 16 }} /></button>}
          </div>
        </header>
        {error && <div role="alert" style={{ maxWidth: 1120, margin: "0 auto", padding: 16, border: "1px solid #FCA5A5", borderRadius: 8, background: "#FEF2F2" }}>{tt("Your authorized tools could not be loaded.", "No se pudieron cargar sus herramientas autorizadas.")} <button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw aria-hidden /> {tt("Try again", "Intentar de nuevo")}</button></div>}
        {!error && !profile && <div role="status" aria-live="polite" style={{ maxWidth: 1120, margin: "0 auto" }}>{tt("Loading authorized tools…", "Cargando herramientas autorizadas…")}</div>}
        {profile && entries.length === 0 && <div role="status" style={{ maxWidth: 1120, margin: "0 auto", padding: 28, textAlign: "center", border: "1px dashed hsl(var(--border))", borderRadius: 10 }}>{tt("No authorized tools match your search.", "Ninguna herramienta autorizada coincide con su búsqueda.")}</div>}
        {profile && entries.length > 0 && <div style={{ maxWidth: 1120, margin: "0 auto", display: "grid", gap: 28 }}>
          {groups.map(group => <section key={group.id} aria-labelledby={`tools-${group.id.toLowerCase()}`}>
            <h2 id={`tools-${group.id.toLowerCase()}`} style={{ fontSize: 16, marginBottom: 4 }}>{group.label[lang]}</h2>
            <p style={{ margin: "0 0 12px", color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{group.description[lang]}</p>
            <div className="all-tools-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              {entries.filter(entry => entry.group === group.id).map(entry => <button key={entry.id} type="button" aria-disabled={!entry.href} aria-describedby={`tool-purpose-${entry.id}`} onClick={() => entry.href && setLocation(entry.href)} className="all-tools-card" style={{ textAlign: "left", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--card))", padding: 16, cursor: entry.href ? "pointer" : "not-allowed", color: "inherit", opacity: entry.href ? 1 : .72 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: 750 }}>{entry.name[lang]}{entry.href ? <ArrowRight aria-hidden style={{ width: 16, height: 16, flexShrink: 0 }} /> : <LockKeyhole aria-hidden style={{ width: 16, height: 16, flexShrink: 0 }} />}</span>
                <span id={`tool-purpose-${entry.id}`} style={{ display: "block", marginTop: 7, fontSize: 12, lineHeight: 1.5, color: "hsl(var(--muted-foreground))" }}>{entry.purpose[lang]}</span>
                {entry.guidance && <dl style={{ display: "grid", gap: 5, margin: "12px 0 0", fontSize: 11, lineHeight: 1.4 }}>
                  <div><dt style={{ display: "inline", fontWeight: 800 }}>{tt("Before you start: ", "Antes de empezar: ")}</dt><dd style={{ display: "inline", margin: 0 }}>{entry.guidance.prerequisite[lang]}</dd></div>
                  <div><dt style={{ display: "inline", fontWeight: 800 }}>{tt("Who acts: ", "Quién actúa: ")}</dt><dd style={{ display: "inline", margin: 0 }}>{entry.guidance.actor[lang]}</dd></div>
                  <div><dt style={{ display: "inline", fontWeight: 800 }}>{tt("Next: ", "Siguiente: ")}</dt><dd style={{ display: "inline", margin: 0 }}>{entry.guidance.nextStep[lang]}</dd></div>
                </dl>}
                {entry.availability !== "available" && <span style={{ display: "block", marginTop: 10, fontSize: 11, fontWeight: 750, color: "#92400E" }}>{entry.availability === "requires-project" ? tt("Requires an active project assignment", "Requiere una asignación activa de proyecto") : tt("Administrator only", "Solo administradores")}</span>}
              </button>)}
            </div>
          </section>)}
        </div>}
      </main>
    </div>
  );
}

export default AllTools;
