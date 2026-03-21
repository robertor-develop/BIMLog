import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User, Building2, Lock, Bell, Zap, Key, ChevronLeft,
  Check, Copy, RefreshCw, Pen, Upload, Trash2, AlertTriangle
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ProfileData {
  id: number;
  email: string;
  fullName: string;
  companyName: string;
  companyId: number;
  createdAt: string;
  jobTitle: string | null;
  phone: string | null;
  avatarUrl: string | null;
  signatureUrl: string | null;
  apiToken: string | null;
  notificationPreferences: Record<string, boolean> | null;
  company: {
    id: number;
    name: string;
    website: string | null;
    address: string | null;
    phone: string | null;
    companyLogoUrl: string | null;
  } | null;
}

interface PerformanceScore {
  overallScore: number | null;
  namingCompliance: { rate: number | null; passed: number; total: number };
  rfiCloseRate: { rate: number | null; closed: number; total: number };
  submittalsApprovalRate: { rate: number | null; approved: number; total: number };
}

const DEFAULT_PREFS = {
  emailRfiAssigned: true,
  emailSubmittalAssigned: true,
  emailMentioned: true,
  emailWeeklyDigest: false,
  inAppRfiUpdates: true,
  inAppSubmittalUpdates: true,
};

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 20px",
        borderBottom: "1px solid hsl(var(--border))",
        background: "hsl(var(--muted)/0.3)",
      }}>
        <Icon style={{ width: 16, height: 16, color: "hsl(var(--primary))" }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: "hsl(var(--foreground))" }}>{title}</span>
      </div>
      <div style={{ padding: "20px" }}>
        {children}
      </div>
    </div>
  );
}

function ScoreBar({ label, rate, detail }: { label: string; rate: number | null; detail: string }) {
  const pct = rate ?? 0;
  const color = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: rate === null ? "hsl(var(--muted-foreground))" : color }}>
          {rate === null ? "N/A" : `${rate}%`}
        </span>
      </div>
      <div style={{ height: 6, background: "hsl(var(--border))", borderRadius: 3, overflow: "hidden" }}>
        {rate !== null && (
          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
        )}
      </div>
      <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>{detail}</div>
    </div>
  );
}

export function Profile() {
  const { token, user: storeUser, setAuth } = useAuthStore();
  const { toast } = useToast();
  const { t } = useI18n();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [perfScore, setPerfScore] = useState<PerformanceScore | null>(null);
  const [loading, setLoading] = useState(true);

  const [personalForm, setPersonalForm] = useState({ fullName: "", jobTitle: "", phone: "" });
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [companyForm, setCompanyForm] = useState({ name: "", website: "", address: "", phone: "", companyLogoUrl: "" });
  const [savingCompany, setSavingCompany] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [tokenCopied, setTokenCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

  const [signatureMode, setSignatureMode] = useState<"canvas" | "upload">("canvas");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: authHeaders });
      const data = await res.json();
      setProfile(data);
      setPersonalForm({
        fullName: data.fullName || "",
        jobTitle: data.jobTitle || "",
        phone: data.phone || "",
      });
      setCompanyForm({
        name: data.company?.name || data.companyName || "",
        website: data.company?.website || "",
        address: data.company?.address || "",
        phone: data.company?.phone || "",
        companyLogoUrl: data.company?.companyLogoUrl || "",
      });
      setPrefs({ ...DEFAULT_PREFS, ...(data.notificationPreferences as Record<string, boolean> || {}) });
    } catch {
      toast({ title: "Failed to load profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadPerformance() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me/performance-score`, { headers: authHeaders });
      const data = await res.json();
      setPerfScore(data);
    } catch {}
  }

  useEffect(() => {
    loadProfile();
    loadPerformance();
  }, []);

  async function savePersonal() {
    setSavingPersonal(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(personalForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, ...data } : data);
      if (storeUser && token) {
        setAuth(token, { ...storeUser, fullName: data.fullName, companyName: data.companyName });
      }
      toast({ title: "Profile updated successfully" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Update failed", variant: "destructive" });
    } finally {
      setSavingPersonal(false);
    }
  }

  async function saveCompany() {
    setSavingCompany(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me/company`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(companyForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Company info updated successfully" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Update failed", variant: "destructive" });
    } finally {
      setSavingCompany(false);
    }
  }

  async function savePassword() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me/password`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "Password updated successfully" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Password update failed", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveNotificationPrefs() {
    setSavingPrefs(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ notificationPreferences: prefs }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Notification preferences saved" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Save failed", variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  }

  async function generateApiToken() {
    setGeneratingToken(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/me/api-token`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setProfile(prev => prev ? { ...prev, apiToken: data.apiToken } : prev);
      toast({ title: "New API token generated" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to generate token", variant: "destructive" });
    } finally {
      setGeneratingToken(false);
    }
  }

  async function copyToken() {
    if (!profile?.apiToken) return;
    await navigator.clipboard.writeText(profile.apiToken);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  }

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getCanvasPos(e);
  }

  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  }

  function stopDrawing() {
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    setSavingSignature(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ signatureUrl: dataUrl }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setProfile(prev => prev ? { ...prev, signatureUrl: dataUrl } : prev);
      toast({ title: "Signature saved successfully" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save signature", variant: "destructive" });
    } finally {
      setSavingSignature(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
        <Skeleton style={{ height: 32, width: 200, marginBottom: 24 }} />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} style={{ height: 180, marginBottom: 16, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  const overallPct = perfScore?.overallScore ?? null;
  const scoreColor = overallPct === null ? "#6b7280" : overallPct >= 80 ? "#22c55e" : overallPct >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" style={{ gap: 4, fontSize: 12, padding: "4px 8px" }}>
            <ChevronLeft style={{ width: 14, height: 14 }} />
            Dashboard
          </Button>
        </Link>
        <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>My Profile</span>
      </div>

      {/* Avatar + name hero */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        marginBottom: 28,
        padding: "20px 24px",
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 12,
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 700,
          color: "white",
          flexShrink: 0,
        }}>
          {profile?.fullName?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "hsl(var(--foreground))" }}>{profile?.fullName}</div>
          <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
            {profile?.jobTitle ? `${profile.jobTitle} · ` : ""}{profile?.companyName}
          </div>
          <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 1 }}>{profile?.email}</div>
        </div>
        {overallPct !== null && (
          <div style={{ marginLeft: "auto", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor }}>{overallPct}%</div>
            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Performance</div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 1. Personal Info */}
        <SectionCard title="Personal Information" icon={User}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Full Name</Label>
              <Input
                value={personalForm.fullName}
                onChange={e => setPersonalForm(p => ({ ...p, fullName: e.target.value }))}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Email</Label>
              <Input value={profile?.email || ""} disabled style={{ opacity: 0.6 }} />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Job Title</Label>
              <Input
                value={personalForm.jobTitle}
                onChange={e => setPersonalForm(p => ({ ...p, jobTitle: e.target.value }))}
                placeholder="e.g. BIM Manager"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Phone</Label>
              <Input
                value={personalForm.phone}
                onChange={e => setPersonalForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
              />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={savePersonal} disabled={savingPersonal} size="sm">
              {savingPersonal ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </SectionCard>

        {/* 2. Signature */}
        <SectionCard title="Digital Signature" icon={Pen}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <Button
              size="sm"
              variant={signatureMode === "canvas" ? "default" : "outline"}
              onClick={() => setSignatureMode("canvas")}
              style={{ gap: 4, fontSize: 12 }}
            >
              <Pen style={{ width: 12, height: 12 }} />
              Draw
            </Button>
            <Button
              size="sm"
              variant={signatureMode === "upload" ? "default" : "outline"}
              onClick={() => setSignatureMode("upload")}
              style={{ gap: 4, fontSize: 12 }}
            >
              <Upload style={{ width: 12, height: 12 }} />
              Upload Image
            </Button>
          </div>

          {signatureMode === "canvas" ? (
            <>
              <div style={{ border: "1px dashed hsl(var(--border))", borderRadius: 8, overflow: "hidden", background: "#fff", marginBottom: 10 }}>
                <canvas
                  ref={canvasRef}
                  width={680}
                  height={140}
                  style={{ width: "100%", height: 140, cursor: "crosshair", display: "block", touchAction: "none" }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant="outline" onClick={clearSignature} style={{ gap: 4, fontSize: 12 }}>
                  <Trash2 style={{ width: 12, height: 12 }} />
                  Clear
                </Button>
                <Button size="sm" onClick={saveSignature} disabled={!hasSignature || savingSignature} style={{ gap: 4, fontSize: 12 }}>
                  {savingSignature ? "Saving…" : "Save Signature"}
                </Button>
              </div>
            </>
          ) : (
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Signature Image URL</Label>
              <div style={{ display: "flex", gap: 8 }}>
                <Input
                  placeholder="https://..."
                  defaultValue={profile?.signatureUrl?.startsWith("data:") ? "" : (profile?.signatureUrl || "")}
                  onBlur={async e => {
                    const url = e.target.value.trim();
                    if (!url) return;
                    setSavingSignature(true);
                    try {
                      const res = await fetch(`${API_BASE}/api/v1/users/me`, {
                        method: "PATCH",
                        headers: authHeaders,
                        body: JSON.stringify({ signatureUrl: url }),
                      });
                      if (!res.ok) throw new Error((await res.json()).error);
                      setProfile(prev => prev ? { ...prev, signatureUrl: url } : prev);
                      toast({ title: "Signature URL saved" });
                    } catch {
                      toast({ title: "Failed to save signature URL", variant: "destructive" });
                    } finally {
                      setSavingSignature(false);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {profile?.signatureUrl && (
            <div style={{ marginTop: 14 }}>
              <Label style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 4, display: "block" }}>Current signature on file</Label>
              <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: 8, background: "#fff", display: "inline-block" }}>
                <img src={profile.signatureUrl} alt="Signature" style={{ height: 48, maxWidth: 280, objectFit: "contain" }} />
              </div>
            </div>
          )}
        </SectionCard>

        {/* 3. Company Info */}
        <SectionCard title="Company Information" icon={Building2}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Company Name</Label>
              <Input
                value={companyForm.name}
                onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Company name"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Website</Label>
              <Input
                value={companyForm.website}
                onChange={e => setCompanyForm(p => ({ ...p, website: e.target.value }))}
                placeholder="https://company.com"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Phone</Label>
              <Input
                value={companyForm.phone}
                onChange={e => setCompanyForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Address</Label>
              <Input
                value={companyForm.address}
                onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Main St, City, State"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Company Logo URL</Label>
              <Input
                value={companyForm.companyLogoUrl}
                onChange={e => setCompanyForm(p => ({ ...p, companyLogoUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={saveCompany} disabled={savingCompany} size="sm">
              {savingCompany ? "Saving…" : "Save Company Info"}
            </Button>
          </div>
        </SectionCard>

        {/* 4. Performance Score */}
        <SectionCard title="Performance Score" icon={Zap}>
          {perfScore ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: `4px solid ${scoreColor}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor }}>
                    {perfScore.overallScore !== null ? perfScore.overallScore : "—"}
                  </span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {perfScore.overallScore === null ? "No data yet" :
                     perfScore.overallScore >= 80 ? "Excellent Performance" :
                     perfScore.overallScore >= 60 ? "Good Performance" : "Needs Improvement"}
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                    Based on your activity across projects
                  </div>
                </div>
              </div>
              <ScoreBar
                label="Naming Compliance"
                rate={perfScore.namingCompliance.rate}
                detail={`${perfScore.namingCompliance.passed} of ${perfScore.namingCompliance.total} files passed validation`}
              />
              <ScoreBar
                label="RFI Close Rate"
                rate={perfScore.rfiCloseRate.rate}
                detail={`${perfScore.rfiCloseRate.closed} of ${perfScore.rfiCloseRate.total} RFIs closed`}
              />
              <ScoreBar
                label="Submittal Approval Rate"
                rate={perfScore.submittalsApprovalRate.rate}
                detail={`${perfScore.submittalsApprovalRate.approved} of ${perfScore.submittalsApprovalRate.total} submittals approved`}
              />
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
              Loading performance data…
            </div>
          )}
        </SectionCard>

        {/* 5. Security */}
        <SectionCard title="Security" icon={Lock}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Current Password</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>New Password</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
          </div>
          {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, color: "#ef4444", fontSize: 12 }}>
              <AlertTriangle style={{ width: 12, height: 12 }} />
              Passwords do not match
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={savePassword}
              disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
              size="sm"
              variant="destructive"
            >
              {savingPassword ? "Updating…" : "Update Password"}
            </Button>
          </div>
        </SectionCard>

        {/* 6. Notification Preferences */}
        <SectionCard title="Notification Preferences" icon={Bell}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { key: "emailRfiAssigned", label: "Email when RFI is assigned to me" },
              { key: "emailSubmittalAssigned", label: "Email when submittal is assigned to me" },
              { key: "emailMentioned", label: "Email when I am mentioned" },
              { key: "emailWeeklyDigest", label: "Weekly email digest" },
              { key: "inAppRfiUpdates", label: "In-app notifications for RFI updates" },
              { key: "inAppSubmittalUpdates", label: "In-app notifications for submittal updates" },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Label style={{ fontSize: 13, cursor: "pointer" }}>{label}</Label>
                <Switch
                  checked={!!prefs[key]}
                  onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={saveNotificationPrefs} disabled={savingPrefs} size="sm" variant="outline">
              {savingPrefs ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </SectionCard>

        {/* 7. API Token */}
        <SectionCard title="API Token" icon={Key}>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 16 }}>
            Use your API token to authenticate with the BIMLog API from external tools and integrations.
            Keep it secret — treat it like a password.
          </p>
          {profile?.apiToken ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <code style={{
                flex: 1,
                fontFamily: "monospace",
                fontSize: 12,
                background: "hsl(var(--muted))",
                padding: "8px 12px",
                borderRadius: 6,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "hsl(var(--foreground))",
                border: "1px solid hsl(var(--border))",
              }}>
                {profile.apiToken.slice(0, 8)}••••••••••••••••••••••••{profile.apiToken.slice(-4)}
              </code>
              <Button size="sm" variant="outline" onClick={copyToken} style={{ gap: 4, flexShrink: 0 }}>
                {tokenCopied ? <Check style={{ width: 12, height: 12, color: "#22c55e" }} /> : <Copy style={{ width: 12, height: 12 }} />}
                {tokenCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
              No API token generated yet.
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={generateApiToken}
            disabled={generatingToken}
            style={{ gap: 6 }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} className={generatingToken ? "animate-spin" : ""} />
            {profile?.apiToken ? "Regenerate Token" : "Generate Token"}
          </Button>
          {profile?.apiToken && (
            <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 10 }}>
              Regenerating will invalidate the current token immediately.
            </p>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
