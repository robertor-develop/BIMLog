import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export function Login() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { mutate, isPending } = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation('/dashboard');
      },
      onError: () => setError(t('auth.loginFailed'))
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your BIMLog account"
      footer={<>{t('auth.noAccount')} <Link href="/register" className="text-primary font-medium hover:underline">{t('auth.register')}</Link></>}
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
                color: "hsl(var(--muted-foreground))", padding: 2, display: "flex", alignItems: "center"
              }}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword
                ? <EyeOff style={{ width: 16, height: 16 }} />
                : <Eye style={{ width: 16, height: 16 }} />
              }
            </button>
          </div>
        </div>
      </div>

      <Button
        className="w-full mt-6"
        disabled={!email || !password || isPending}
        onClick={() => mutate({ data: { email, password } })}
      >
        {isPending ? 'Signing in...' : t('auth.login')}
      </Button>
    </AuthLayout>
  );
}
