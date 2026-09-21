import { useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, GitPullRequest, Lightbulb, Route, ShieldCheck } from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { useI18n } from "@/lib/i18n";
import "./CoordinationKnowledgeLibrary.css";

type WorkspaceSection = "conflict-types" | "rules" | "methods" | "lessons";

const sections: Array<{ id: WorkspaceSection; en: string; es: string; icon: typeof BookOpen }> = [
  { id: "conflict-types", en: "Conflict Types", es: "Tipos de Conflicto", icon: GitPullRequest },
  { id: "rules", en: "Coordination Rules", es: "Reglas de Coordinación", icon: ShieldCheck },
  { id: "methods", en: "Resolution Methods", es: "Métodos de Resolución", icon: Route },
  { id: "lessons", en: "Lessons Learned", es: "Lecciones Aprendidas", icon: Lightbulb },
];

export function CoordinationKnowledgeLibrary() {
  const { lang } = useI18n();
  const es = lang === "es";
  const t = (en: string, spanish: string) => es ? spanish : en;
  const [active, setActive] = useState<WorkspaceSection>("conflict-types");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const changeTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    setActive(sections[next].id);
    tabRefs.current[next]?.focus();
  };

  const selected = sections.find(section => section.id === active)!;
  return <div className="knowledge-page">
    <MasterSidebar />
    <main className="knowledge-main">
      <header className="knowledge-header">
        <div>
          <p className="knowledge-eyebrow">BIMLog · {t("Company knowledge", "Conocimiento de la empresa")}</p>
          <h1>{t("Coordination Knowledge Library", "Biblioteca de Conocimiento de Coordinación")}</h1>
          <p>{t("Reusable company guidance, governed resolution methods and reviewed project experience.", "Guía reutilizable de la empresa, métodos de resolución gobernados y experiencia de proyectos revisada.")}</p>
        </div>
        <span className="knowledge-scope"><BookOpen aria-hidden />{t("Organization workspace", "Espacio de la organización")}</span>
      </header>

      <nav className="knowledge-tabs" role="tablist" aria-label={t("Knowledge library sections", "Secciones de la biblioteca de conocimiento")}>
        {sections.map((section, index) => {
          const Icon = section.icon;
          const selectedTab = active === section.id;
          return <button
            ref={node => { tabRefs.current[index] = node; }}
            key={section.id}
            id={`knowledge-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={selectedTab}
            aria-controls={`knowledge-panel-${section.id}`}
            tabIndex={selectedTab ? 0 : -1}
            onClick={() => setActive(section.id)}
            onKeyDown={event => changeTab(event, index)}
          ><Icon aria-hidden /><span>{es ? section.es : section.en}</span></button>;
        })}
      </nav>

      <section
        id={`knowledge-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`knowledge-tab-${active}`}
        className="knowledge-panel"
      >
        <div className="knowledge-panel-heading">
          <div><h2>{es ? selected.es : selected.en}</h2><p>{t("This governed catalog is being loaded from BIMLog's company-scoped knowledge authority.", "Este catálogo gobernado se carga desde la autoridad de conocimiento de empresa de BIMLog.")}</p></div>
        </div>
        <div className="knowledge-placeholder" role="status">
          <selected.icon aria-hidden />
          <strong>{t("Workspace ready", "Espacio listo")}</strong>
          <span>{t("Catalog content becomes available in the following builds of this block.", "El contenido del catálogo se habilita en los siguientes builds de este bloque.")}</span>
        </div>
      </section>
    </main>
  </div>;
}
