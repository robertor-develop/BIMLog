import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronDown, HelpCircle, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/layout/LangToggle";
import { SmartGuideSidebarButton } from "@/components/layout/SmartGuide";

const INFO_LINKS = [
  { en: "Pricing", es: "Precios", href: "/pricing" },
  { en: "Features", es: "Funcionalidades", href: "/features" },
  { en: "About", es: "Acerca de", href: "/about" },
  { en: "Contact", es: "Contacto", href: "/contact" },
  { en: "Privacy Policy", es: "Politica de Privacidad", href: "/privacy" },
  { en: "Terms of Service", es: "Terminos del Servicio", href: "/terms" },
  { en: "Platform Disclaimer", es: "Aviso Legal de la Plataforma", href: "/disclaimer" },
  { en: "Data Retention", es: "Retencion de Datos", href: "/data-retention" },
];

export function SidebarUtilities({
  activeTab,
  helpHref = "/setup-guide",
}: {
  activeTab: string;
  helpHref?: string;
}) {
  const { lang } = useI18n();
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const label = (en: string, es: string) => (lang === "es" ? es : en);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(event.target as Node)) {
        setInfoOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="sidebar-utilities" aria-label="Sidebar utilities">
      <div className="sidebar-utility-grid">
        <div ref={infoRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="sidebar-utility-button"
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen((open) => !open)}
          >
            <Info style={{ width: 13, height: 13 }} />
            {label("Info", "Info")}
            <ChevronDown
              style={{
                width: 11,
                height: 11,
                transform: infoOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            />
          </button>
          {infoOpen && (
            <div className="sidebar-info-menu">
              <div className="sidebar-info-menu-title">
                <BookOpen style={{ width: 13, height: 13 }} />
                {label("Information", "Informacion")}
              </div>
              {INFO_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="sidebar-info-menu-item"
                  onClick={() => setInfoOpen(false)}
                >
                  {label(link.en, link.es)}
                </Link>
              ))}
            </div>
          )}
        </div>
        <Link href={helpHref} className="sidebar-utility-button">
          <HelpCircle style={{ width: 13, height: 13 }} />
          {label("Help", "Ayuda")}
        </Link>
        <SmartGuideSidebarButton activeTab={activeTab} />
        <LangToggle />
      </div>
    </div>
  );
}
