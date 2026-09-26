import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { readInvitationToken } from "@/lib/invitation-ui";

export function Login() {
  const { t, tt } = useI18n();
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const [inviteToken]=useState(readInvitationToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { mutate, isPending } = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation(inviteToken?`/register#invite=${encodeURIComponent(inviteToken)}`:'/dashboard');
      },
      onError: () => setError(t('auth.loginFailed'))
    }
  });

  return (
    <AuthLayout
      title={tt("Welcome back","Bienvenido de nuevo")}
      subtitle={tt("Sign in to your BIMLog account","Inicie sesión en su cuenta BIMLog")}
      footer={<>{t('auth.noAccount')} <Link href={inviteToken?`/register#invite=${encodeURIComponent(inviteToken)}`:"/register"} className="text-primary font-medium hover:underline">{t('auth.register')}</Link></>}
    >
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.email')}</label>
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">{t('auth.password')}</label>
          <div style={{ position: "relative" }}>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "hsl(var(--muted-foreground))", padding: 8, width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
              aria-label={showPassword ? tt("Hide password","Ocultar contraseña") : tt("Show password","Mostrar contraseña")}
            >
              {showPassword
                ? <EyeOff style={{ width: 16, height: 16 }} />
                : <Eye style={{ width: 16, height: 16 }} />
              }
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-1 mb-0">
        <a
          href="/reset-password"
          className="inline-flex min-h-6 items-center text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
          onClick={e => { e.preventDefault(); window.location.href = '/reset-password'; }}
        >
          {t('auth.forgotPassword')}
        </a>
      </div>

      <Button
        className="w-full mt-4"
        disabled={!email || !password || isPending}
        onClick={() => mutate({ data: { email, password } })}
      >
        {isPending ? tt('Signing in...','Iniciando sesión...') : t('auth.login')}
      </Button>
    </AuthLayout>
  );
}
