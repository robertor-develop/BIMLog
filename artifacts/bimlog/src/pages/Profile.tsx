import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
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
  Check, Copy, RefreshCw, Pen, Upload, Trash2, AlertTriangle,
  FolderOpen, Clock, Activity, ExternalLink, Camera, Mail
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
  openai_api_key: string | null;
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

interface ProjectItem {
  id: number;
  name: string;
  code: string;
  status: string;
  userRole: string;
}

interface PendingRfi {
  id: number;
  number: string;
  subject: string;
  projectId: number;
  projectName: string;
  createdAt: string;
  status: string;
}

interface PendingSubmittal {
  id: number;
  number: string;
  title: string;
  projectId: number;
  projectName: string;
  createdAt: string;
  dueDate: string | null;
}

interface ActivityEntry {
  id: number;
  projectId: number;
  projectName: string;
  actionType: string;
  details: string | null;
  userFullName: string;
  createdAt: string;
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

  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [savingOpenaiKey, setSavingOpenaiKey] = useState(false);
  const [removingOpenaiKey, setRemovingOpenaiKey] = useState(false);

  const [connections, setConnections] = useState<{ provider: string; status: string; accountLabel: string | null }[]>([]);
  const [sgKeyInput, setSgKeyInput] = useState("");
  const [sgFromInput, setSgFromInput] = useState("");
  const [savingSg, setSavingSg] = useState(false);
  const [removingSg, setRemovingSg] = useState(false);

  const [signatureMode, setSignatureMode] = useState<"canvas" | "upload">("canvas");
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [myProjects, setMyProjects] = useState<ProjectItem[]>([]);
  const [pendingRfis, setPendingRfis] = useState<PendingRfi[]>([]);
  const [pendingSubmittals, setPendingSubmittals] = useState<PendingSubmittal[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  const avatarFileInput = useRef<HTMLInputElement>(null);
  const logoFileInput = useRef<HTMLInputElement>(null);

  const [, navigate] = useLocation();

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

  async function loadMyProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/projects`, { headers: authHeaders });
      const data = await res.json();
      setMyProjects(Array.isArray(data) ? data : []);
    } catch {} finally {
      setLoadingProjects(false);
    }
  }

  async function loadPendingItems(userEmail: string) {
    setLoadingPending(true);
    try {
      const projRes = await fetch(`${API_BASE}/api/v1/projects`, { headers: authHeaders });
      const projects: ProjectItem[] = await projRes.json();

      const rfis: PendingRfi[] = [];
      const submittals: PendingSubmittal[] = [];

      await Promise.all(projects.map(async (proj) => {
        try {
          const [rfiRes, subRes] = await Promise.all([
            fetch(`${API_BASE}/api/v1/projects/${proj.id}/rfis`, { headers: authHeaders }),
            fetch(`${API_BASE}/api/v1/projects/${proj.id}/submittals`, { headers: authHeaders }),
          ]);
          const rfiData = await rfiRes.json();
          const subData = await subRes.json();

          if (Array.isArray(rfiData)) {
            rfiData
              .filter((r: any) => r.submittedToEmail === userEmail && (r.status === "open" || r.status === "in_review"))
              .forEach((r: any) => rfis.push({ id: r.id, number: r.number, subject: r.subject, projectId: proj.id, projectName: proj.name, createdAt: r.createdAt, status: r.status }));
          }
          if (Array.isArray(subData)) {
            subData
              .filter((s: any) => s.submittedToEmail === userEmail && s.status === "pending")
              .forEach((s: any) => submittals.push({ id: s.id, number: s.number, title: s.title, projectId: proj.id, projectName: proj.name, createdAt: s.createdAt, dueDate: s.dueDate || null }));
          }
        } catch {}
      }));

      setPendingRfis(rfis);
      setPendingSubmittals(submittals);
    } catch {} finally {
      setLoadingPending(false);
    }
  }

  async function loadRecentActivity() {
    setLoadingActivity(true);
    try {
      const projRes = await fetch(`${API_BASE}/api/v1/projects`, { headers: authHeaders });
      const projects: ProjectItem[] = await projRes.json();

      const entries: ActivityEntry[] = [];
      await Promise.all(projects.map(async (proj) => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/projects/${proj.id}/activity`, { headers: authHeaders });
          const data = await res.json();
          if (Array.isArray(data)) {
            data.forEach((e: any) => entries.push({ ...e, projectId: proj.id, projectName: proj.name }));
          }
        } catch {}
      }));

      entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecentActivity(entries.slice(0, 10));
    } catch {} finally {
      setLoadingActivity(false);
    }
  }

  useEffect(() => {
    loadProfile().then(() => {});
    loadPerformance();
    loadMyProjects();
    loadRecentActivity();
    loadConnections();
    // Handle the OAuth return from a provider connect.
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast({ title: `${params.get("connected")} connected` });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("connect_error")) {
      toast({ title: `Connect failed: ${params.get("connect_error")}`, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (profile?.email) {
      loadPendingItems(profile.email);
    }
  }, [profile?.email]);

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

  async function saveOpenaiKey() {
    if (!openaiKeyInput.trim()) return;
    setSavingOpenaiKey(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/openai-key`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ key: openaiKeyInput.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "OpenAI API key saved" });
      setOpenaiKeyInput("");
      await loadProfile();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to save key", variant: "destructive" });
    } finally {
      setSavingOpenaiKey(false);
    }
  }

  async function removeOpenaiKey() {
    setRemovingOpenaiKey(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/openai-key`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "OpenAI API key removed" });
      await loadProfile();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to remove key", variant: "destructive" });
    } finally {
      setRemovingOpenaiKey(false);
    }
  }

  async function loadConnections() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/me/connections`, { headers: authHeaders });
      const data = await res.json();
      setConnections(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function saveSendgrid() {
    if (!sgKeyInput.trim() || !sgFromInput.trim()) return;
    setSavingSg(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/me/connections/sendgrid`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ apiKey: sgKeyInput.trim(), fromEmail: sgFromInput.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "SendGrid connected" });
      setSgKeyInput("");
      await loadConnections();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to connect SendGrid", variant: "destructive" });
    } finally {
      setSavingSg(false);
    }
  }

  async function removeSendgrid() {
    setRemovingSg(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/me/connections/sendgrid`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "SendGrid disconnected" });
      await loadConnections();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to disconnect", variant: "destructive" });
    } finally {
      setRemovingSg(false);
    }
  }

  async function connectProvider(providerParam: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/me/connections/${providerParam}/authorize`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start connect");
      window.location.href = data.url; // provider consent screen (self-service)
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not start connect", variant: "destructive" });
    }
  }

  async function disconnectProvider(provider: string) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/me/connections/${provider}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Disconnected" });
      await loadConnections();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Failed to disconnect", variant: "destructive" });
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

  function handleAvatarFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Avatar = reader.result as string;
      try {
        const res = await fetch(`${API_BASE}/api/v1/users/me`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ avatarUrl: base64Avatar }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setProfile(prev => prev ? { ...prev, avatarUrl: base64Avatar } : prev);
        toast({ title: "Profile photo updated" });
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Failed to upload photo", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  }

  function handleLogoFileUpload(e: React.ChangeEvent<HTMLInputElement>) { // company logo upload via FileReader base64
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Logo = reader.result as string;
      setCompanyForm(prev => ({ ...prev, companyLogoUrl: base64Logo }));
    };
    reader.readAsDataURL(file);
  }

  function daysSince(dateStr: string) {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  function daysUntil(dateStr: string | null) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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
        <div style={{ marginLeft: "auto" }}>
          <Link href="/settings/company-profile">
            <Button variant="outline" size="sm" style={{ fontSize: 12, padding: "4px 10px" }}>
              Company Profile
            </Button>
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 2. Personal Info */}
        <SectionCard title="Personal Information" icon={User}>
          {/* Avatar upload */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <div
              onClick={() => avatarFileInput.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: "50%", cursor: "pointer", position: "relative",
                background: profile?.avatarUrl
                  ? `url(${profile.avatarUrl}) center/cover no-repeat`
                  : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 700, color: "white", flexShrink: 0,
                border: "2px dashed hsl(var(--border))",
              }}
              title="Click to upload profile photo"
            >
              {!profile?.avatarUrl && (profile?.fullName?.charAt(0).toUpperCase() || <Camera style={{ width: 24, height: 24 }} />)}
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0, transition: "opacity 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
              >
                <Camera style={{ width: 20, height: 20, color: "white" }} />
              </div>
            </div>
            <input
              ref={avatarFileInput}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: "none" }}
              onChange={handleAvatarFileUpload}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Profile Photo</div>
              <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>Click the avatar to upload a JPG or PNG photo</div>
            </div>
          </div>
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
              <Label style={{ fontSize: 12, marginBottom: 8, display: "block" }}>Company Logo</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  style={{ gap: 6 }}
                  onClick={() => logoFileInput.current?.click()}
                >
                  <Upload style={{ width: 13, height: 13 }} />
                  Upload Logo (JPG / PNG)
                </Button>
                <input
                  ref={logoFileInput}
                  type="file"
                  accept="image/jpeg,image/png"
                  style={{ display: "none" }}
                  onChange={handleLogoFileUpload}
                />
                {companyForm.companyLogoUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img
                      src={companyForm.companyLogoUrl}
                      alt="Company logo preview"
                      style={{ height: 36, maxWidth: 120, objectFit: "contain", border: "1px solid hsl(var(--border))", borderRadius: 4, padding: 2, background: "#fff" }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCompanyForm(p => ({ ...p, companyLogoUrl: "" }))}
                      style={{ padding: "2px 6px" }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={saveCompany} disabled={savingCompany} size="sm">
              {savingCompany ? "Saving…" : "Save Company Info"}
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

        {/* A. My Projects */}
        <SectionCard title="My Projects" icon={FolderOpen}>
          {loadingProjects ? (
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Loading projects…</div>
          ) : myProjects.length === 0 ? (
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>You are not a member of any projects yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {myProjects.map(proj => (
                <div key={proj.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  background: "hsl(var(--muted)/0.4)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</div>
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                      <span style={{ fontFamily: "monospace" }}>{proj.code}</span>
                    </div>
                  </div>
                  <Badge variant="outline" style={{ fontSize: 10, flexShrink: 0 }}>{proj.userRole.replace(/_/g, " ")}</Badge>
                  <Button size="sm" variant="outline" style={{ gap: 4, fontSize: 11, flexShrink: 0 }}
                    onClick={() => navigate(`/projects/${proj.id}/analytics`)}>
                    <ExternalLink style={{ width: 11, height: 11 }} />
                    Go to Project
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* B. Pending Items */}
        <SectionCard title="Pending Items" icon={Clock}>
          {loadingPending ? (
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Loading pending items…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* RFIs awaiting my response */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                  RFIs awaiting my response
                  {pendingRfis.length > 0 && <Badge style={{ fontSize: 10, marginLeft: 4 }}>{pendingRfis.length}</Badge>}
                </div>
                {pendingRfis.length === 0 ? (
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", paddingLeft: 14 }}>No RFIs awaiting your response.</div>
                ) : pendingRfis.map(rfi => (
                  <div key={rfi.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6,
                    background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))", borderRadius: 7,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{rfi.number} — {rfi.subject}</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{rfi.projectName} · {daysSince(rfi.createdAt)}d outstanding</div>
                    </div>
                    <Button size="sm" variant="outline" style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => navigate(`/projects/${rfi.projectId}/rfis`)}>View</Button>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Submittals awaiting my review */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
                  Submittals awaiting my review
                  {pendingSubmittals.length > 0 && <Badge style={{ fontSize: 10, marginLeft: 4 }}>{pendingSubmittals.length}</Badge>}
                </div>
                {pendingSubmittals.length === 0 ? (
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", paddingLeft: 14 }}>No submittals awaiting your review.</div>
                ) : pendingSubmittals.map(sub => (
                  <div key={sub.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 6,
                    background: "hsl(var(--muted)/0.4)", border: "1px solid hsl(var(--border))", borderRadius: 7,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{sub.number} — {sub.title}</div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                        {sub.projectName} · {daysSince(sub.createdAt)}d outstanding
                        {sub.dueDate && (() => { const d = daysUntil(sub.dueDate); return d !== null && d <= 7 ? <span style={{ color: "#ef4444", marginLeft: 6, fontWeight: 600 }}>Due in {d}d</span> : null; })()}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => navigate(`/projects/${sub.projectId}/submittals`)}>View</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* C. Recent Activity */}
        <SectionCard title="Recent Activity" icon={Activity}>
          {loadingActivity ? (
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Loading activity…</div>
          ) : recentActivity.length === 0 ? (
            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: 13 }}>No recent activity found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recentActivity.map((entry, i) => (
                <div key={`${entry.id}-${i}`} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 12px",
                  background: "hsl(var(--muted)/0.3)", borderRadius: 7,
                  borderLeft: "3px solid hsl(var(--primary)/0.4)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Badge variant="secondary" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {entry.actionType.replace(/_/g, " ")}
                      </Badge>
                      <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{entry.projectName}</span>
                    </div>
                    {entry.details && <div style={{ fontSize: 12, marginTop: 3, color: "hsl(var(--foreground))" }}>{entry.details}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 1. Performance Score */}
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

        {/* 8. OpenAI API Key */}
        <SectionCard title="OpenAI API Key" icon={Zap}>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 16 }}>
            Required for audio transcription in Meeting Minutes. Your key is used only for your account — you pay OpenAI directly at $0.006/minute (~$0.36 per hour of audio).
          </p>
          {profile?.openai_api_key === "configured" ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Badge style={{ background: "#DCFCE7", color: "#16A34A", border: "1px solid #BBF7D0", padding: "4px 10px", fontWeight: 600 }}>
                  <Check style={{ width: 12, height: 12, marginRight: 4 }} /> Configured
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={removeOpenaiKey}
                disabled={removingOpenaiKey}
                style={{ color: "#DC2626", borderColor: "#FECACA", gap: 6 }}
              >
                <Trash2 style={{ width: 12, height: 12 }} />
                {removingOpenaiKey ? "Removing…" : "Remove Key"}
              </Button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <Input
                  type="password"
                  value={openaiKeyInput}
                  onChange={e => setOpenaiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }}
                />
                <Button
                  size="sm"
                  onClick={saveOpenaiKey}
                  disabled={savingOpenaiKey || !openaiKeyInput.trim()}
                >
                  {savingOpenaiKey ? "Saving…" : "Save Key"}
                </Button>
              </div>
              <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 6 }}>
                Get your key at{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "#2563EB" }}>
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
          )}
        </SectionCard>

        {/* Email Sending — per-user SendGrid connection */}
        <SectionCard title="Email Sending (SendGrid)" icon={Mail}>
          {(() => {
            const sg = connections.find(c => c.provider === "sendgrid");
            if (sg) {
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <Badge style={{ background: sg.status === "connected" ? "#DCFCE7" : "#FEF3C7", color: sg.status === "connected" ? "#16A34A" : "#B45309", border: `1px solid ${sg.status === "connected" ? "#BBF7D0" : "#FDE68A"}`, padding: "4px 10px", fontWeight: 600 }}>
                      <Check style={{ width: 12, height: 12, marginRight: 4 }} /> {sg.status === "connected" ? "Connected" : "Needs attention"}
                    </Badge>
                    {sg.accountLabel && <span style={{ fontSize: 13, color: "hsl(var(--muted-foreground))" }}>Sends as {sg.accountLabel}</span>}
                  </div>
                  <Button size="sm" variant="outline" onClick={removeSendgrid} disabled={removingSg} style={{ color: "#DC2626", borderColor: "#FECACA", gap: 6 }}>
                    <Trash2 style={{ width: 12, height: 12 }} />
                    {removingSg ? "Disconnecting…" : "Disconnect"}
                  </Button>
                </div>
              );
            }
            return (
              <div>
                <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 16 }}>
                  Connect your own SendGrid account to send RFI emails from BIMLog as yourself. Your key is stored securely, used only for your account, and validated before it is saved.
                </p>
                <div style={{ display: "grid", gap: 10, maxWidth: 460 }}>
                  <div>
                    <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>SendGrid API Key</Label>
                    <Input type="password" value={sgKeyInput} onChange={e => setSgKeyInput(e.target.value)} placeholder="SG.xxxxx" style={{ fontFamily: "monospace", fontSize: 12 }} />
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, marginBottom: 4, display: "block" }}>Verified Sender Email</Label>
                    <Input value={sgFromInput} onChange={e => setSgFromInput(e.target.value)} placeholder="you@company.com" style={{ fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button size="sm" onClick={saveSendgrid} disabled={savingSg || !sgKeyInput.trim() || !sgFromInput.trim()}>
                      {savingSg ? "Connecting…" : "Connect SendGrid"}
                    </Button>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 8 }}>
                  Create a key at{" "}
                  <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noreferrer" style={{ color: "#2563EB" }}>app.sendgrid.com</a>{" "}
                  with Mail Send permission. The sender email must be a verified sender in your SendGrid account.
                </p>
              </div>
            );
          })()}
        </SectionCard>

        {/* Integrations — per-user cloud storage + PM connections */}
        <SectionCard title="File Sources & Integrations" icon={FolderOpen}>
          <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 16 }}>
            Connect your own accounts so you can attach files from them to RFIs and documents. Each account is connected per user — connect once and it's yours.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { key: "google_drive", param: "google-drive", label: "Google Drive", badge: "GD", color: "#1A73E8", bg: "#E8F0FE" },
              { key: "dropbox", param: "dropbox", label: "Dropbox", badge: "DB", color: "#0061FF", bg: "#E6EEFF" },
              { key: "bim360", param: "bim360", label: "BIM 360 / Autodesk", badge: "AU", color: "#0696D7", bg: "#E3F4FB" },
              { key: "procore", param: "procore", label: "Procore", badge: "PC", color: "#F47E42", bg: "#FDEEE4" },
            ].map(p => {
              const conn = connections.find(c => c.provider === p.key);
              return (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1px solid hsl(var(--border))", borderRadius: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: p.bg, color: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{p.badge}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{conn ? (conn.accountLabel ? `Connected — ${conn.accountLabel}` : "Connected") : "Not connected"}</div>
                  </div>
                  {conn ? (
                    <Button size="sm" variant="outline" onClick={() => disconnectProvider(p.key)} style={{ color: "#DC2626", borderColor: "#FECACA", gap: 6, flexShrink: 0 }}>
                      <Trash2 style={{ width: 12, height: 12 }} />Disconnect
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => connectProvider(p.param)} style={{ flexShrink: 0 }}>Connect</Button>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

            </div>
    </div>
  );
}
