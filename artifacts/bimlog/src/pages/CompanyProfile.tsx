import { useI18n } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Building2, Upload, Trash2 } from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { readCommercialBillingIdentity, saveCommercialBillingIdentity, type CommercialBillingIdentityDto } from "@/lib/commercial-billing-identity-client";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CompanyProfileData {
  userId: number;
  canonicalCompanyId: number;
  canonicalCompanyName: string;
  companyName: string | null;
  companyRole: string | null;
  logoUrl: string | null;
  website: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
}

export function CompanyProfile() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<CompanyProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [billing, setBilling] = useState<CommercialBillingIdentityDto | null>(null);
  const [billingError, setBillingError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const fromBilling = new URLSearchParams(window.location.search).get("from") === "billing";

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    let current = true;
    setLoading(true); setLoadError(false); setData(null);
    fetch(`${API_BASE}/api/v1/users/me/company-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: CompanyProfileData) => { if (current) setData(d); })
      .catch(() => { if (current) setLoadError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, setLocation, retry]);

  useEffect(() => {
    if (!token || !fromBilling) return;
    readCommercialBillingIdentity(token).then(setBilling).catch(e => setBillingError(e instanceof Error ? e.message : String(e)));
  }, [token, fromBilling]);

  const saveBilling = async () => {
    if (!token || !billing) return;
    setBillingError("");
    try { setBilling(await saveCommercialBillingIdentity(token, billing)); }
    catch (e) { setBillingError(e instanceof Error ? e.message : String(e)); }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/users/me/company-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyName: data.companyName,
          companyRole: data.companyRole,
          website: data.website,
          phone: data.phone,
          city: data.city,
          country: data.country,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const next = await r.json();
      setData(next);
      toast({ title: t("Company profile saved", "Perfil de empresa guardado") });
    } catch (e) {
      toast({ title: t("Company profile could not be saved", "No se pudo guardar el perfil de empresa"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const r = await fetch(`${API_BASE}/api/v1/users/me/company-logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      const out = await r.json();
      setData(d => d ? { ...d, logoUrl: out.logoUrl } : d);
      toast({ title: t("Logo uploaded", "Logotipo cargado") });
    } catch (e) {
      toast({ title: t("Logo upload failed", "No se pudo cargar el logotipo"), variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="app-shell">
      <MasterSidebar />
      <div className="main-area">
        <div className="topbar">
          <div className="breadcrumb">
            <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 4, color: "hsl(var(--muted-foreground))", textDecoration: "none" }}>
              <ChevronLeft style={{ width: 14, height: 14 }} />
              {t("Profile", "Perfil")}
            </Link>
            <span style={{ color: "hsl(var(--border))" }}>/</span>
            <span className="breadcrumb-active">{t("Company Profile", "Perfil de Empresa")}</span>
          </div>
        </div>

        <div className="page-content" style={{ padding: "20px 28px 60px", maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Building2 style={{ width: 20, height: 20, color: "#1D4ED8" }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>{t("Company Profile", "Perfil de Empresa")}</h1>
          </div>
          {loadError && <div role="alert">{t("Company profile could not be loaded.", "No se pudo cargar el perfil de empresa.")} <Button variant="outline" onClick={() => setRetry(n => n + 1)}>{t("Retry", "Reintentar")}</Button></div>}
          {loading ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
          ) : data && (
            <>
              <section aria-label={t("Account company", "Empresa de la cuenta")}>
                <strong>{t("Account company", "Empresa de la cuenta")}: {data.canonicalCompanyName}</strong>
              </section>
              {fromBilling && <section>
                <h2>{t("Billing identity","Identidad de facturación")}</h2>
                {billingError && <p role="alert">{billingError}</p>}
                {billing && <><Label>{t("Legal company name","Nombre legal de la empresa")}</Label><Input value={billing.legalName} disabled />
                  <Label htmlFor="billing-phone">{t("Billing phone","Teléfono de facturación")}</Label><Input id="billing-phone" value={billing.phone} onChange={e=>setBilling({...billing,phone:e.target.value})}/>
                  <Label htmlFor="billing-address">{t("Billing address","Dirección de facturación")}</Label><Input id="billing-address" value={billing.address} onChange={e=>setBilling({...billing,address:e.target.value})}/>
                  <p role="status">{billing.status==="complete"?t("Complete","Completa"):t("Missing","Falta")}</p>
                  <Button onClick={()=>void saveBilling()}>{t("Save billing identity","Guardar identidad de facturación")}</Button> <Button variant="outline" asChild><Link href="/settings/billing-support">{t("Return to Billing & Support","Volver a Facturación y Soporte")}</Link></Button></>}
              </section>}
              {/* Logo card */}
              <div style={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "18px 20px", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t("Company Logo", "Logotipo de empresa")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: 10,
                    background: data.logoUrl ? `url(${data.logoUrl}) center/contain no-repeat` : "#F3F4F6",
                    border: "1px solid hsl(var(--border))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#9CA3AF",
                  }}>
                    {!data.logoUrl && <Building2 style={{ width: 28, height: 28 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                      style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                    />
                    <Button
                      variant="outline" size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      style={{ gap: 6 }}
                    >
                      <Upload style={{ width: 13, height: 13 }} />
                      {uploading ? t("Uploading…", "Cargando…") : data.logoUrl ? t("Replace logo", "Reemplazar logotipo") : t("Upload logo", "Cargar logotipo")}
                    </Button>
                    {data.logoUrl && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setData(d => d ? { ...d, logoUrl: null } : d)}
                        style={{ gap: 6, marginLeft: 6, color: "#DC2626" }}
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                        {t("Remove", "Quitar")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Details card */}
              <div style={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {t("Company Details", "Datos de empresa")}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
                  <div>
                    <Label htmlFor="companyName" style={{ fontSize: 11 }}>{t("Document branding name", "Nombre de marca documental")}</Label>
                    <Input id="companyName" value={data.companyName ?? ""} onChange={e => setData(d => d ? { ...d, companyName: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="companyRole" style={{ fontSize: 11 }}>{t("Role in projects", "Rol en proyectos")}</Label>
                    <Input id="companyRole" placeholder="e.g. General Contractor, Architect" value={data.companyRole ?? ""} onChange={e => setData(d => d ? { ...d, companyRole: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="website">{t("Website", "Sitio web")}</Label>
                    <Input id="website" placeholder="https://" value={data.website ?? ""} onChange={e => setData(d => d ? { ...d, website: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="phone">{t("Phone", "Teléfono")}</Label>
                    <Input id="phone" value={data.phone ?? ""} onChange={e => setData(d => d ? { ...d, phone: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="city">{t("City", "Ciudad")}</Label>
                    <Input id="city" value={data.city ?? ""} onChange={e => setData(d => d ? { ...d, city: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="country" style={{ fontSize: 11 }}>{t("Country", "País")}</Label>
                    <Input id="country" value={data.country ?? ""} onChange={e => setData(d => d ? { ...d, country: e.target.value } : d)} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? t("Saving…", "Guardando…") : t("Save changes", "Guardar cambios")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
