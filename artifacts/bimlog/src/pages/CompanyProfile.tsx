import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Building2, Upload, Globe, Phone, MapPin, Trash2 } from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CompanyProfileData {
  userId: number;
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
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<CompanyProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    fetch(`${API_BASE}/api/v1/users/me/company-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d: CompanyProfileData) => setData(d))
      .catch(() => toast({ title: "Failed to load company profile", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [token, setLocation, toast]);

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
      toast({ title: "Company profile saved" });
    } catch (e) {
      toast({ title: "Failed to save", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
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
      toast({ title: "Logo uploaded" });
    } catch (e) {
      toast({ title: "Logo upload failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
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
              Profile
            </Link>
            <span style={{ color: "hsl(var(--border))" }}>/</span>
            <span className="breadcrumb-active">Company Profile</span>
          </div>
        </div>

        <div className="page-content" style={{ padding: "20px 28px 60px", maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <Building2 style={{ width: 20, height: 20, color: "#1D4ED8" }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Company Profile</h1>
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 20 }}>
            Your company branding appears in project headers, on dashboards, and on shared exports.
          </div>

          {loading ? (
            <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
          ) : data && (
            <>
              {/* Logo card */}
              <div style={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "18px 20px", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Company Logo
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
                      {uploading ? "Uploading…" : data.logoUrl ? "Replace logo" : "Upload logo"}
                    </Button>
                    {data.logoUrl && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setData(d => d ? { ...d, logoUrl: null } : d)}
                        style={{ gap: 6, marginLeft: 6, color: "#DC2626" }}
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                        Remove
                      </Button>
                    )}
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>
                      PNG, JPG, or SVG · up to 2 MB · square or wide format works best.
                    </div>
                  </div>
                </div>
              </div>

              {/* Details card */}
              <div style={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Company Details
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <Label htmlFor="companyName" style={{ fontSize: 11 }}>Company name</Label>
                    <Input id="companyName" value={data.companyName ?? ""} onChange={e => setData(d => d ? { ...d, companyName: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="companyRole" style={{ fontSize: 11 }}>Role in projects</Label>
                    <Input id="companyRole" placeholder="e.g. General Contractor, Architect" value={data.companyRole ?? ""} onChange={e => setData(d => d ? { ...d, companyRole: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="website" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <Globe style={{ width: 11, height: 11 }} /> Website
                    </Label>
                    <Input id="website" placeholder="https://" value={data.website ?? ""} onChange={e => setData(d => d ? { ...d, website: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="phone" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <Phone style={{ width: 11, height: 11 }} /> Phone
                    </Label>
                    <Input id="phone" value={data.phone ?? ""} onChange={e => setData(d => d ? { ...d, phone: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="city" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapPin style={{ width: 11, height: 11 }} /> City
                    </Label>
                    <Input id="city" value={data.city ?? ""} onChange={e => setData(d => d ? { ...d, city: e.target.value } : d)} />
                  </div>
                  <div>
                    <Label htmlFor="country" style={{ fontSize: 11 }}>Country</Label>
                    <Input id="country" value={data.country ?? ""} onChange={e => setData(d => d ? { ...d, country: e.target.value } : d)} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
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
