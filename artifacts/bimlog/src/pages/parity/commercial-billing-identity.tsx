import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readCommercialBillingIdentity, saveCommercialBillingIdentity, type CommercialBillingIdentityDto } from "@/lib/commercial-billing-identity-client";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

export function CommercialBillingIdentity() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => (lang === "es" ? es : en);
  const [identity, setIdentity] = useState<CommercialBillingIdentityDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try { setIdentity(await readCommercialBillingIdentity(token)); }
    catch (caught) { setIdentity(null); setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!token || !identity) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const updated = await saveCommercialBillingIdentity(token, { address: identity.address, phone: identity.phone });
      setIdentity(updated);
      setSaved(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setSaving(false); }
  }

  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 850, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
    <h1>{t("Billing Identity", "Identidad de facturación")}</h1>
    <p>{t("Company billing administrators maintain the legal contact details used on governed invoices and billing records. The legal company name comes from the canonical company record and cannot be changed here.", "Los administradores de facturación de la empresa mantienen los datos de contacto legales usados en facturas y registros de facturación gobernados. El nombre legal proviene del registro canónico de la empresa y no se puede cambiar aquí.")}</p>
    {loading && <p role="status">{t("Loading billing identity…", "Cargando identidad de facturación…")}</p>}
    {error && <p role="alert">{error} <button onClick={() => void load()}>{t("Retry", "Reintentar")}</button></p>}
    {!loading && !error && !identity && <p role="status">{t("No billing identity is available for this company.", "No hay una identidad de facturación disponible para esta empresa.")}</p>}
    {identity && <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <Label htmlFor="billing-legal-name">{t("Legal company name", "Nombre legal de la empresa")}</Label>
      <Input id="billing-legal-name" value={identity.legalName} disabled />
      <Label htmlFor="billing-address">{t("Billing address", "Dirección de facturación")}</Label>
      <Input id="billing-address" value={identity.address} onChange={event => { setSaved(false); setIdentity({ ...identity, address: event.target.value }); }} required />
      <Label htmlFor="billing-phone">{t("Billing phone", "Teléfono de facturación")}</Label>
      <Input id="billing-phone" value={identity.phone} onChange={event => { setSaved(false); setIdentity({ ...identity, phone: event.target.value }); }} required />
      <p role="status">{identity.status === "complete" ? t("Billing identity is complete.", "La identidad de facturación está completa.") : t(`Missing fields: ${identity.missingFields.join(", ")}`, `Campos faltantes: ${identity.missingFields.join(", ")}`)}</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Button type="submit" disabled={saving || !identity.address.trim() || !identity.phone.trim()}>{saving ? t("Saving…", "Guardando…") : t("Save billing identity", "Guardar identidad de facturación")}</Button>
        <Button type="button" variant="outline" onClick={() => setLocation("/settings/billing-support")}>{t("Billing & Support", "Facturación y Soporte")}</Button>
      </div>
      {saved && <p role="status">{t("Billing identity saved. Refreshing or reopening this page will load the governed company record.", "Identidad de facturación guardada. Al actualizar o reabrir esta página se cargará el registro gobernado de la empresa.")}</p>}
    </form>}
  </main>;
}

export default CommercialBillingIdentity;
