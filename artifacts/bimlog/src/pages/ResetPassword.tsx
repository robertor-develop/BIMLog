import { useState } from "react";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type Stage = "request" | "reset" | "done";

export function ResetPasswordPage() {
  const { t } = useI18n();
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get("token") || "";
  const [stage, setStage] = useState<Stage>(tokenFromUrl ? "reset" : "request");
  const [email, setEmail] = useState("");
  const [token] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleRequest() {
    if (!email) { setError(t("auth.emailRequired")); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Request failed"); return; }
      setMessage(t("auth.resetPasswordSuccess"));
      setStage("done");
    } catch {
      setError("Network error. Please try again.");
    } finally { setLoading(false); }
  }

  async function handleReset() {
    if (!password) { setError(t("auth.passwordRequired")); return; }
    if (password !== confirm) { setError(t("auth.passwordMismatch")); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        if (d.error?.includes("Invalid or expired")) { setError(t("auth.invalidResetToken")); }
        else { setError(d.error || "Reset failed"); }
        return;
      }
      setMessage(t("auth.passwordUpdated"));
      setStage("done");
    } catch {
      setError("Network error. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-foreground mb-1">{t("auth.resetPassword")}</h1>
      {stage === "request" && (
        <>
          <p className="text-sm text-muted-foreground mb-6">{t("auth.resetPasswordSubtitle")}</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.email")}</label>
            <Input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              autoComplete="email"
            />
          </div>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={handleRequest}>
            {loading ? "Sending..." : t("auth.resetPassword")}
          </Button>
          <div className="mt-4 text-center">
            <a href="/login" className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
              {t("auth.hasAccount")}
            </a>
          </div>
        </>
      )}
      {stage === "reset" && (
        <>
          <p className="text-sm text-muted-foreground mb-6">Enter your new password below.</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.newPassword")}</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1.5">{t("auth.confirmPassword")}</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
            />
          </div>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={handleReset}>
            {loading ? "Updating..." : t("auth.resetPassword")}
          </Button>
        </>
      )}
      {stage === "done" && (
        <>
          <p className="text-sm text-green-600 dark:text-green-400 mb-6 mt-2">{message}</p>
          <a href="/login">
            <Button className="w-full">{t("auth.login")}</Button>
          </a>
        </>
      )}
    </AuthLayout>
  );
}
