import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * Small EN/ES language toggle. Rendered globally so it is visible on
 * every page (including layouts that hide the marketing Navbar, such
 * as the Dashboard and project pages).
 */
export function LangToggle({ floating = false }: { floating?: boolean }) {
  const { language, setLanguage } = useI18n();

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
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
    ? { position: "fixed", bottom: 72, right: 24, zIndex: 2147483000 }
    : {};

  return (
    <button
      type="button"
      aria-label="Toggle language"
      onClick={() => setLanguage(language === "en" ? "es" : "en")}
      style={{ ...baseStyle, ...floatStyle }}
    >
      <Globe style={{ width: 13, height: 13 }} />
      {language.toUpperCase()}
    </button>
  );
}