import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, CircleHelp, Compass, History, Search, ShieldCheck, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { HELP_CATEGORIES, HELP_RELEASES, HELP_TOPICS, HELP_TROUBLESHOOTING, helpTopicForContext, type HelpText } from "@/lib/help-content";

type View = "manual" | "guides" | "troubleshooting" | "releases";

const HELP_VIEWS: View[] = ["manual", "guides", "troubleshooting", "releases"];

function queryValue(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function safeBackPath() {
  const value = queryValue("from");
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function requestedView(): View {
  const value = queryValue("view");
  return HELP_VIEWS.includes(value as View) ? (value as View) : "manual";
}

export function HelpCenter() {
  const { lang } = useI18n();
  const text = (value: HelpText) => value[lang === "es" ? "es" : "en"];
  const label = (en: string, es: string) => (lang === "es" ? es : en);
  const requested = queryValue("topic") || queryValue("context");
  const initialTopic = helpTopicForContext(requested);
  const [view, setView] = useState<View>(requestedView);
  const [topicId, setTopicId] = useState(initialTopic.id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const backPath = safeBackPath();

  const filteredTopics = useMemo(() => {
    const needle = normalize(query.trim());
    return HELP_TOPICS.filter((topic) => {
      if (category !== "all" && topic.category !== category) return false;
      if (!needle) return true;
      return normalize([
        topic.title.en, topic.title.es, topic.summary.en, topic.summary.es,
        ...topic.keywords, ...topic.steps.flatMap((step) => [step.title.en, step.title.es, step.body.en, step.body.es]),
      ].join(" ")).includes(needle);
    });
  }, [category, query]);
  const topic = HELP_TOPICS.find((candidate) => candidate.id === topicId) ?? filteredTopics[0] ?? HELP_TOPICS[0];

  function selectTopic(nextTopicId: string, nextView: View = "manual") {
    setTopicId(nextTopicId);
    setView(nextView);
    setQuery("");
    setCategory("all");
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("topic", nextTopicId);
      params.set("view", nextView);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const tabs: Array<{ id: View; icon: typeof BookOpen; en: string; es: string }> = [
    { id: "manual", icon: BookOpen, en: "User Manual", es: "Manual del usuario" },
    { id: "guides", icon: Compass, en: "Quick Guides", es: "Guías rápidas" },
    { id: "troubleshooting", icon: Wrench, en: "Troubleshooting", es: "Solución de problemas" },
    { id: "releases", icon: History, en: "What's New", es: "Novedades" },
  ];

  return (
    <div className="hc-page">
      <style>{`
        .hc-page{min-height:100vh;background:#f6f8fb;color:#172033}.hc-shell{max-width:1280px;margin:0 auto;padding:24px}.hc-back{display:inline-flex;align-items:center;gap:6px;color:#526178;text-decoration:none;font-size:13px;font-weight:650;margin-bottom:18px}.hc-hero{background:linear-gradient(135deg,#13233f,#244b96);color:#fff;border-radius:16px;padding:24px;box-shadow:0 18px 40px rgba(17,39,78,.16)}.hc-hero-row{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap}.hc-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#bcd2ff}.hc-hero h1{font-size:28px;margin:5px 0 7px}.hc-hero p{max-width:760px;margin:0;color:#e2ebff;line-height:1.6;font-size:14px}.hc-version{font-size:11px;border:1px solid rgba(255,255,255,.28);padding:7px 10px;border-radius:999px;white-space:nowrap}.hc-search{position:relative;margin-top:18px;max-width:760px}.hc-search svg{position:absolute;left:13px;top:12px;width:17px}.hc-search input{width:100%;height:42px;border:0;border-radius:10px;padding:0 14px 0 40px;font-size:14px;outline:2px solid transparent}.hc-search input:focus{outline-color:#8cb3ff}.hc-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;background:#fff;border:1px solid #dce3ed;border-radius:13px;padding:7px;margin:16px 0}.hc-tab{border:0;background:transparent;border-radius:8px;padding:10px;display:flex;align-items:center;justify-content:center;gap:7px;font-weight:750;color:#526178;cursor:pointer}.hc-tab.active{background:#eaf1ff;color:#174da8}.hc-tab svg{width:16px}.hc-layout{display:grid;grid-template-columns:290px minmax(0,1fr);gap:18px;align-items:start}.hc-nav,.hc-article,.hc-card{background:#fff;border:1px solid #dce3ed;border-radius:14px}.hc-nav{padding:14px;position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto}.hc-filter{width:100%;height:36px;border:1px solid #cdd6e4;border-radius:8px;padding:0 9px;margin-bottom:12px;background:#fff}.hc-category{margin:13px 0 6px;font-size:10px;color:#758197;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.hc-topic-button{width:100%;border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:8px;font-size:12px;line-height:1.35;color:#3d4b61;cursor:pointer;display:flex;justify-content:space-between;gap:8px}.hc-topic-button:hover{background:#f3f6fa}.hc-topic-button.active{background:#eaf1ff;color:#174da8;font-weight:750}.hc-topic-button svg{width:13px;flex:none}.hc-empty{padding:18px 8px;text-align:center;color:#758197;font-size:12px}.hc-article{padding:26px}.hc-article h2{font-size:25px;margin:0 0 7px}.hc-summary{color:#526178;line-height:1.65;font-size:14px;margin:0 0 16px}.hc-badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.hc-badge{font-size:11px;font-weight:700;padding:5px 8px;border-radius:999px;background:#f0f4f9;color:#40506a}.hc-tip{border-left:4px solid #2563eb;background:#eff5ff;border-radius:8px;padding:13px 15px;margin:18px 0;color:#233d68;font-size:13px;line-height:1.55}.hc-section-title{font-size:15px;margin:24px 0 12px;display:flex;align-items:center;gap:7px}.hc-section-title svg{width:17px;color:#2563eb}.hc-steps{display:flex;flex-direction:column;gap:10px}.hc-step{display:grid;grid-template-columns:28px minmax(0,1fr);gap:11px;padding:13px;border:1px solid #e2e7ef;border-radius:10px}.hc-step-number{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#eaf1ff;color:#174da8;font-size:11px;font-weight:850}.hc-step h3{font-size:13px;margin:1px 0 4px}.hc-step p{font-size:12px;color:#526178;line-height:1.6;margin:0}.hc-result{background:#edf9f2;border:1px solid #bfe7cf;border-radius:10px;padding:14px;color:#195d37;font-size:13px;line-height:1.55}.hc-issues{display:grid;gap:8px}.hc-issue{display:flex;gap:9px;background:#fff8eb;border:1px solid #f5deb3;border-radius:9px;padding:11px;font-size:12px;color:#65491d;line-height:1.55}.hc-issue svg{width:16px;flex:none;margin-top:1px}.hc-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hc-card{padding:17px}.hc-card h3{font-size:14px;margin:0 0 6px}.hc-card p{font-size:12px;color:#526178;line-height:1.6;margin:0 0 12px}.hc-link-button{border:0;background:#eaf1ff;color:#174da8;padding:8px 10px;border-radius:7px;font-size:11px;font-weight:750;cursor:pointer}.hc-guide-list{display:grid;gap:12px}.hc-guide{background:#fff;border:1px solid #dce3ed;border-radius:13px;padding:18px}.hc-guide h3{margin:0 0 6px;font-size:16px}.hc-guide p{color:#526178;font-size:12px;line-height:1.55}.hc-guide ol{padding-left:20px;color:#3d4b61;font-size:12px;line-height:1.7}.hc-guide-actions{display:flex;justify-content:flex-end}.hc-note{font-size:12px;color:#68758a;margin:0 0 14px;line-height:1.6}.hc-count{font-weight:800;color:#174da8}.hc-footer-note{margin-top:16px;text-align:center;font-size:11px;color:#758197}.hc-footer-note strong{color:#40506a}
        @media(max-width:850px){.hc-shell{padding:14px}.hc-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.hc-layout{grid-template-columns:1fr}.hc-nav{position:static;max-height:360px}.hc-article{padding:18px}.hc-card-grid{grid-template-columns:1fr}.hc-hero h1{font-size:23px}}
        @media(max-width:480px){.hc-tab{font-size:11px;padding:9px 5px}.hc-hero{padding:19px}.hc-step{grid-template-columns:24px minmax(0,1fr);padding:11px}.hc-step-number{width:24px;height:24px}}
      `}</style>
      <main className="hc-shell">
        <Link href={backPath} className="hc-back"><ArrowLeft size={15}/>{label("Back", "Volver")}</Link>
        <header className="hc-hero">
          <div className="hc-hero-row">
            <div><div className="hc-kicker">BIMLog {label("Support", "Soporte")}</div><h1>{label("Help Center", "Centro de ayuda")}</h1><p>{label("One place for quick reminders, guided workflows, the complete user manual, troubleshooting, and release information.", "Un solo lugar para recordatorios, flujos guiados, el manual completo, solución de problemas e información de versiones.")}</p></div>
            <div className="hc-version">{label("Current through Work Packages", "Actualizado hasta Paquetes de Trabajo")}</div>
          </div>
          <div className="hc-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={label("Search features, actions, errors, or terms", "Buscar funciones, acciones, errores o términos")} aria-label={label("Search Help Center", "Buscar en Centro de ayuda")}/></div>
        </header>

        <nav className="hc-tabs" aria-label={label("Help Center sections", "Secciones del Centro de ayuda")}>
          {tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} className={`hc-tab${view === tab.id ? " active" : ""}`} onClick={() => setView(tab.id)}><Icon/>{label(tab.en, tab.es)}</button>; })}
        </nav>

        {view === "manual" && <div className="hc-layout">
          <aside className="hc-nav">
            <select className="hc-filter" value={category} onChange={(event) => setCategory(event.target.value)} aria-label={label("Filter manual category", "Filtrar categoría del manual")}>
              <option value="all">{label("All manual sections", "Todas las secciones")}</option>
              {HELP_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{text(item.label)}</option>)}
            </select>
            {HELP_CATEGORIES.map((item) => { const topics = filteredTopics.filter((candidate) => candidate.category === item.id); if (!topics.length) return null; return <div key={item.id}><div className="hc-category">{text(item.label)}</div>{topics.map((candidate) => <button key={candidate.id} className={`hc-topic-button${topic.id === candidate.id ? " active" : ""}`} onClick={() => selectTopic(candidate.id)}><span>{text(candidate.title)}</span><ChevronRight/></button>)}</div>; })}
            {filteredTopics.length === 0 && <div className="hc-empty">{label("No manual section matches this search.", "Ninguna sección coincide con la búsqueda.")}</div>}
          </aside>
          <article className="hc-article">
            <h2>{text(topic.title)}</h2><p className="hc-summary">{text(topic.summary)}</p>
            <div className="hc-badges"><span className="hc-badge">{label("Audience", "Usuarios")}: {text(topic.audience)}</span><span className="hc-badge">{text(topic.availability)}</span></div>
            <div className="hc-tip"><strong>{label("Quick help:", "Ayuda rápida:")}</strong> {text(topic.quickTip)}</div>
            <h3 className="hc-section-title"><Compass/>{label("Detailed workflow", "Flujo detallado")}</h3>
            <div className="hc-steps">{topic.steps.map((step, index) => <section className="hc-step" key={`${topic.id}-${index}`}><div className="hc-step-number">{index + 1}</div><div><h3>{text(step.title)}</h3><p>{text(step.body)}</p></div></section>)}</div>
            <h3 className="hc-section-title"><CheckCircle2/>{label("Expected result", "Resultado esperado")}</h3><div className="hc-result">{text(topic.result)}</div>
            <h3 className="hc-section-title"><AlertCircle/>{label("Common problems", "Problemas comunes")}</h3><div className="hc-issues">{topic.troubleshooting.map((item, index) => <div className="hc-issue" key={index}><AlertCircle/>{text(item)}</div>)}</div>
          </article>
        </div>}

        {view === "guides" && <section><p className="hc-note">{label("Quick Guides condense each complete manual section into an executable checklist. Open the manual when you need definitions, permissions, calculations, or troubleshooting.", "Las Guías rápidas condensan cada sección en una lista ejecutable. Abra el manual cuando necesite definiciones, permisos, cálculos o solución de problemas.")}</p><div className="hc-guide-list">{filteredTopics.map((item) => <article className="hc-guide" key={item.id}><h3>{text(item.title)}</h3><p>{text(item.quickTip)}</p><ol>{item.steps.map((step, index) => <li key={index}>{text(step.title)}</li>)}</ol><div className="hc-guide-actions"><button className="hc-link-button" onClick={() => selectTopic(item.id)}>{label("Open detailed manual", "Abrir manual detallado")}</button></div></article>)}</div></section>}

        {view === "troubleshooting" && <section><p className="hc-note"><span className="hc-count">{HELP_TROUBLESHOOTING.length}</span> {label("common situations with direct explanations and links to the governing workflow.", "situaciones comunes con explicación directa y vínculo al flujo correspondiente.")}</p><div className="hc-card-grid">{HELP_TROUBLESHOOTING.map((item, index) => <article className="hc-card" key={index}><h3>{text(item.title)}</h3><p>{text(item.body)}</p><button className="hc-link-button" onClick={() => selectTopic(item.topicId)}>{label("See complete instructions", "Ver instrucciones completas")}</button></article>)}</div></section>}

        {view === "releases" && <section><p className="hc-note">{label("This explains user-visible capabilities. It intentionally does not expose source code, credentials, security internals, or proprietary implementation details.", "Esto explica capacidades visibles. Intencionalmente no expone código fuente, credenciales, controles internos de seguridad ni detalles propietarios.")}</p><div className="hc-card-grid">{HELP_RELEASES.map((item, index) => <article className="hc-card" key={index}><h3>{text(item.title)}</h3><p>{text(item.body)}</p><button className="hc-link-button" onClick={() => selectTopic(item.topicId)}>{label("Read how it works", "Leer cómo funciona")}</button></article>)}</div></section>}
        <div className="hc-footer-note"><ShieldCheck size={13} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/><strong>{label("Documentation policy:", "Política de documentación:")}</strong> {label("Every future feature must update this Help Center in the same release.", "Cada función futura debe actualizar este Centro de ayuda en la misma versión.")}</div>
      </main>
    </div>
  );
}
