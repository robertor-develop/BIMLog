import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Small EN/ES/PT language toggle. In the sidebar it uses the same footprint
 * as the Guide button; the floating style remains available for standalone pages.
 */
export function LangToggle({ floating = false, compact = false }: { floating?: boolean; compact?: boolean }) {
  const { language, setLanguage } = useI18n();
  const nextLanguage = language === "en" ? "es" : language === "es" ? "pt" : "en";
  const nextLanguageName = nextLanguage === "en" ? "English" : nextLanguage === "es" ? "Español" : "Português";

  const baseStyle: React.CSSProperties = {
    width: floating ? undefined : "100%",
    height: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    padding: "0 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    background: "rgba(17, 24, 39, 0.85)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: floating ? "0 2px 6px rgba(0,0,0,0.18)" : undefined,
  };

  const floatStyle: React.CSSProperties = floating
    ? { position: "fixed", bottom: 72, left: 24, zIndex: 2147483000 }
    : {};

  return (
    <button
      type="button"
      className={floating ? undefined : "sidebar-utility-button"}
      aria-label={`Switch language to ${nextLanguageName}`}
      title={nextLanguageName}
      onClick={() => setLanguage(nextLanguage)}
      style={floating ? { ...baseStyle, ...floatStyle } : undefined}
    >
      <Globe style={{ width: 13, height: 13 }} />
      {!compact && language.toUpperCase()}
    </button>
  );
}
