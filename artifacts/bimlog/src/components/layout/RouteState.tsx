import { Link } from "wouter";

type RouteStateKind = "loading" | "empty" | "denied" | "offline" | "error";

const copy: Record<RouteStateKind, { title: string; detail: string }> = {
  loading: { title: "Loading workspace / Cargando espacio de trabajo", detail: "Please wait while BIMLog verifies the current context. / Espere mientras BIMLog verifica el contexto actual." },
  empty: { title: "Nothing here yet / Aún no hay contenido", detail: "This workspace is available, but it does not contain records yet. / Este espacio está disponible, pero todavía no contiene registros." },
  denied: { title: "Access unavailable / Acceso no disponible", detail: "Your account is signed in but is not authorized for this workspace. / Su cuenta inició sesión, pero no está autorizada para este espacio." },
  offline: { title: "Connection unavailable / Conexión no disponible", detail: "BIMLog could not verify this workspace. Check the connection and try again. / BIMLog no pudo verificar este espacio. Revise la conexión e intente nuevamente." },
  error: { title: "Workspace unavailable / Espacio no disponible", detail: "BIMLog could not load this workspace safely. Try again or return to headquarters. / BIMLog no pudo cargar este espacio de forma segura. Intente nuevamente o vuelva a la sede." },
};

export function RouteState({ kind, code, title, detail, onRetry }: { kind: RouteStateKind; code?: string; title?: string; detail?: string; onRetry?: () => void }) {
  const message = copy[kind];
  const loading = kind === "loading";
  return <section className={`route-state route-state-${kind}`} role={loading ? "status" : "alert"} aria-live={loading ? "polite" : "assertive"} aria-busy={loading || undefined}>
    <h1>{title ?? message.title}</h1>
    <p>{detail ?? message.detail}</p>
    {code && <code>{code}</code>}
    {!loading && <div className="route-state-actions">
      {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Try again / Intentar de nuevo</button>}
      <Link href="/dashboard" className="btn">Return to headquarters / Volver a la sede</Link>
    </div>}
  </section>;
}
