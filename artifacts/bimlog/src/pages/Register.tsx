import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export function Register() {
  const { t, tt } = useI18n();
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const invitedEmail =
    new URLSearchParams(window.location.search)
      .get("email")
      ?.trim()
      .toLowerCase() ?? "";
  const [form, setForm] = useState({
    email: invitedEmail,
    password: "",
    fullName: "",
    companyName: "",
  });
  const [error, setError] = useState("");
  const matchesInvitationEmail =
    Boolean(invitedEmail) && form.email.trim().toLowerCase() === invitedEmail;

  const { mutate, isPending } = useRegister({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: () => setError(t("auth.registerFailed")),
    },
  });

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm({ ...form, [k]: e.target.value });
      setError("");
    };

  return (
    <AuthLayout
      title={tt("Create your account", "Cree su cuenta")}
      subtitle={tt(
        "Start coordinating better with BIMLog",
        "Comience a coordinar mejor con BIMLog",
      )}
      footer={
        <>
          {t("auth.hasAccount")}{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline"
          >
            {t("auth.login")}
          </Link>
        </>
      }
    >
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        {matchesInvitationEmail && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            {tt(
              "If a pending invitation matches this email, registration will connect the account to the inviting company and project automatically. The company field will not create a duplicate company in that case.",
              "Si una invitación pendiente coincide con este correo, el registro conectará automáticamente la cuenta con la empresa y el proyecto que la enviaron. En ese caso, el campo de empresa no creará una empresa duplicada.",
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("auth.fullName")}
          </label>
          <Input
            placeholder="Roberto Rodriguez"
            value={form.fullName}
            onChange={set("fullName")}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("auth.companyName")}
          </label>
          <Input
            placeholder="BIMtech Corp"
            value={form.companyName}
            onChange={set("companyName")}
            autoComplete="organization"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("auth.email")}
          </label>
          <Input
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set("email")}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t("auth.password")}
          </label>
          <Input
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button
        className="w-full mt-6"
        disabled={
          !form.email ||
          !form.password ||
          !form.fullName ||
          !form.companyName ||
          isPending
        }
        onClick={() => mutate({ data: form })}
      >
        {isPending
          ? tt("Creating account...", "Creando la cuenta...")
          : t("auth.register")}
      </Button>
    </AuthLayout>
  );
}
