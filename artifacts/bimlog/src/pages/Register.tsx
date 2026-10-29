import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { readInvitationToken, invitationError } from "@/lib/invitation-ui";
import { intentLabel, parseCommercialIntent, readCommercialIntent, rememberCommercialIntent } from "@/lib/commercial-intent";
import { recordConversionEvent } from "@/lib/conversion-funnel";
import { EMAIL_VERIFICATION_POLICY } from "@/lib/adoption-journey";

export function Register() {
  const { t, tt, lang } = useI18n();
  const [, setLocation] = useLocation();
  const { login, token:sessionToken, user, logout } = useAuthStore();
  const [inviteToken,setInviteToken] = useState(readInvitationToken);
  const [invitation,setInvitation]=useState<{email:string;companyName:string;purpose:string;projectId:number}|null>(null);
  const [inviteLoading,setInviteLoading]=useState(Boolean(inviteToken));
  const [accepting,setAccepting]=useState(false);
  const [journey,setJourney]=useState("create");
  const queryCommercialIntent=parseCommercialIntent(window.location.search);
  const commercialIntent=queryCommercialIntent??readCommercialIntent();
  useEffect(()=>{if(queryCommercialIntent)rememberCommercialIntent(queryCommercialIntent);if(commercialIntent)recordConversionEvent("registration_started");},[]);
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
    invitationToken: inviteToken || undefined,
  });
  const [error, setError] = useState("");
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const passwordValid = form.password.length >= 8;
  const BASE=import.meta.env.BASE_URL?.replace(/\/$/,"")||"";
  useEffect(()=>{
    const changed=()=>{
      const next=readInvitationToken();
      setInviteToken(next);setInvitation(null);setInviteLoading(Boolean(next));setError("");
      setForm(current=>({...current,email:"",companyName:"",invitationToken:next||undefined}));
    };
    window.addEventListener("hashchange",changed);
    return()=>window.removeEventListener("hashchange",changed);
  },[]);
  useEffect(()=>{
    if(!inviteToken)return;
    const controller=new AbortController();
    fetch(`${BASE}/api/v1/auth/invitations/preview`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:inviteToken}),signal:controller.signal})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);return data;})
      .then(data=>{setInvitation(data);setForm(current=>({...current,email:data.email,companyName:data.purpose==="company_join"?data.companyName:""}));})
      .catch(e=>{if(!controller.signal.aborted)setError(invitationError(String(e.message),tt));})
      .finally(()=>{if(!controller.signal.aborted)setInviteLoading(false);});
    return()=>controller.abort();
  },[inviteToken,BASE]);
  const accept=async()=>{
    setAccepting(true);setError("");
    try {const r=await fetch(`${BASE}/api/v1/auth/invitations/accept`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${sessionToken}`},body:JSON.stringify({token:inviteToken})});
      const data=await r.json();if(!r.ok)throw new Error(data.error);setLocation(`/projects/${data.projectId}`);
    }catch(e){setError(invitationError(e instanceof Error?e.message:"",tt));}finally{setAccepting(false);}
  };

  const { mutate, isPending } = useRegister({
    mutation: {
      onSuccess: (data) => {
        if(commercialIntent)recordConversionEvent("registration_completed");
        login(data.token, data.user);
        setLocation("/dashboard");
      },
      onError: (error) => {
        const detail = error as { data?: { code?: string;error?:string }; message?: string };
        setError(invitationError(detail.data?.code||detail.data?.error||detail.message||"",tt));
      },
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
            href={inviteToken?`/login#invite=${encodeURIComponent(inviteToken)}`:"/login"}
            className="text-primary font-medium hover:underline"
          >
            {t("auth.login")}
          </Link>
        </>
      }
    >
      {commercialIntent && <div role="status" className="mb-4 rounded-lg border p-3 text-sm"><strong>{tt("Selected offer","Oferta seleccionada")}:</strong> {intentLabel(commercialIntent)}{commercialIntent.useCase?` · ${commercialIntent.useCase}`:""}. {tt("Your selection will remain available during onboarding.","Su selección permanecerá disponible durante la incorporación.")}</div>}
      <div role="note" className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        {EMAIL_VERIFICATION_POLICY.reason[lang === "es" ? "es" : "en"]}
      </div>
      <div role="note" className="mb-4 rounded-lg border p-3 text-sm">
        <strong>{tt("What happens next", "Qué sucede después")}:</strong> {tt("BIMLog creates your governed company account, signs you in, and opens your dashboard. If you have a valid invitation, it joins the authorized company or project without creating a duplicate company.", "BIMLog crea su cuenta empresarial gobernada, inicia la sesión y abre su panel. Si tiene una invitación válida, se une a la empresa o proyecto autorizado sin crear una empresa duplicada.")}
      </div>
      {error && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {inviteLoading && <p role="status">{tt("Checking invitation...","Verificando invitación...")}</p>}
      {!inviteToken && <div className="mb-4"><label>{tt("What would you like to do?","¿Qué desea hacer?")}<select className="w-full" value={journey} onChange={e=>setJourney(e.target.value)}><option value="create">{tt("Create a new company","Crear una empresa nueva")}</option><option value="join">{tt("Join an existing company","Unirse a una empresa existente")}</option></select></label>{journey==="join"&&<p>{tt("Open the invitation email sent by your company administrator. If it fails, ask for a new invitation; do not create another company.","Abra el correo de invitación enviado por el administrador de su empresa. Si falla, solicite una nueva invitación; no cree otra empresa.")}</p>}</div>}
      {sessionToken && inviteToken ? <div className="space-y-4"><p>{tt("Signed in as","Sesión iniciada como")} {user?.email}</p><p>{invitation?.companyName}</p><Button disabled={!invitation||accepting||inviteLoading} onClick={accept}>{tt("Accept invitation","Aceptar invitación")}</Button><Button variant="outline" onClick={()=>{logout();setLocation(`/login#invite=${encodeURIComponent(inviteToken)}`);}}>{tt("Use another account","Usar otra cuenta")}</Button></div> : <>
      <div className="space-y-4">
        {invitation && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            {tt(
              invitation.purpose==="company_join" ? "You are joining the company shown below. No new company will be created." : "You are joining a project as an external collaborator. Enter your own new company or sign in to your existing account.",
              invitation.purpose==="company_join" ? "Se unirá a la empresa indicada abajo. No se creará otra empresa." : "Se unirá al proyecto como colaborador externo. Indique su empresa nueva o inicie sesión con su cuenta existente.",
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
            disabled={invitation?.purpose==="company_join"}
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
            disabled={Boolean(inviteToken)}
            onChange={set("email")}
            autoComplete="email"
            aria-invalid={Boolean(form.email) && !emailValid}
          />
          {form.email && !emailValid && <p className="mt-1 text-xs text-destructive">{tt("Enter a valid email address.", "Ingrese una dirección de correo válida.")}</p>}
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
            aria-invalid={Boolean(form.password) && !passwordValid}
          />
          <p className="mt-1 text-xs text-muted-foreground">{tt("Use at least 8 characters.", "Use al menos 8 caracteres.")}</p>
        </div>
      </div>

      <Button
        className="w-full mt-6"
        disabled={
          !emailValid ||
          inviteLoading || (Boolean(inviteToken) && !invitation) || (!inviteToken && journey==="join") ||
          !passwordValid ||
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
      </>}
    </AuthLayout>
  );
}
