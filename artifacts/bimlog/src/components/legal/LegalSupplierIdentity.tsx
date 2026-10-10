import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchPublicLegalIdentity, type PublicLegalIdentityDto } from "@/lib/public-legal-identity-client";

export function LegalSupplierIdentity() {
  const { language } = useI18n();
  const es = language === "es";
  const [identity, setIdentity] = useState<PublicLegalIdentityDto | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicLegalIdentity(controller.signal).then(setIdentity).catch(error => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
    });
    return () => controller.abort();
  }, []);
  if (failed) return <p role="alert" style={{fontSize:13,color:"#991B1B"}}>{es ? "La identidad legal del proveedor no se pudo verificar." : "The supplier legal identity could not be verified."}</p>;
  if (!identity) return <p role="status" style={{fontSize:13,color:"hsl(var(--muted-foreground))"}}>{es ? "Verificando la identidad legal del proveedor…" : "Verifying supplier legal identity…"}</p>;
  if (!identity.available) return <p role="alert" style={{fontSize:13,color:"#92400E"}}>{es ? "La identidad legal pública del proveedor aún no está configurada." : "The public supplier legal identity is not configured yet."}</p>;
  return <aside aria-label={es ? "Identidad legal del proveedor" : "Supplier legal identity"} style={{padding:"14px 16px",border:"1px solid hsl(var(--border))",borderRadius:8,background:"hsl(var(--muted)/0.25)",marginBottom:28}}>
    <strong>{identity.supplierName}</strong>
    <div style={{fontSize:13,lineHeight:1.6,color:"hsl(var(--muted-foreground))"}}>{es ? "Jurisdicción" : "Jurisdiction"}: {identity.invoiceJurisdiction}<br/>{es ? "Contacto público" : "Public contact"}: <a href={`mailto:${identity.supportEmail}`}>{identity.supportEmail}</a></div>
  </aside>;
}
