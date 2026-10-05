import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { LEGAL_DOCUMENTS, type LegalDocumentId } from "@/lib/legal-information";

export function LegalDocumentNav({ current }: { current: LegalDocumentId }) {
  const { language } = useI18n();
  const spanish = language === "es";
  return (
    <nav aria-label={spanish ? "Documentos legales" : "Legal documents"} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
      {LEGAL_DOCUMENTS.map((document) => {
        const active = document.id === current;
        return active ? (
          <span key={document.id} aria-current="page" style={{ borderRadius: 999, padding: "7px 12px", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontSize: 12, fontWeight: 700 }}>
            {spanish ? document.es : document.en}
          </span>
        ) : (
          <Link key={document.id} href={document.href} style={{ border: "1px solid hsl(var(--border))", borderRadius: 999, padding: "7px 12px", color: "hsl(var(--foreground))", textDecoration: "none", fontSize: 12, fontWeight: 650 }}>
            {spanish ? document.es : document.en}
          </Link>
        );
      })}
    </nav>
  );
}
