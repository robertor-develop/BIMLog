import { ArrowRight, CircleCheck } from "lucide-react";
import { nextActionReason, type NextAction } from "@/lib/next-action";

export function NextActionCard({ item, lang, onOpen }: { item: NextAction | null; lang: string; onOpen: (href: string) => void }) {
  const es = lang === "es";
  return <section aria-labelledby="next-action-heading" style={{ border: "1px solid #93c5fd", borderRadius: 10, padding: 14, marginBottom: 14, background: "color-mix(in srgb, #eff6ff 72%, hsl(var(--card)))" }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#1d4ed8", fontSize: 11, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" }}>{es ? "Siguiente acción" : "Next action"}</div>
        {item ? <>
          <h2 id="next-action-heading" style={{ fontSize: 16, lineHeight: 1.35, margin: "3px 0" }}>{item.title}</h2>
          <p style={{ margin: 0, color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{nextActionReason(item.reason, lang)} · {item.project.code} · {item.project.name}</p>
        </> : <>
          <h2 id="next-action-heading" style={{ fontSize: 16, margin: "3px 0" }}>{es ? "No tiene acciones pendientes" : "You have no pending actions"}</h2>
          <p style={{ margin: 0, color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{es ? "BIMLog no encontró trabajo accionable en esta vista." : "BIMLog found no actionable work in this view."}</p>
        </>}
      </div>
      {item ? <button type="button" onClick={() => onOpen(item.action.openLink)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: 7, padding: "8px 11px", background: "#1d4ed8", color: "white", cursor: "pointer", fontWeight: 700 }}>
        {item.action.label}<ArrowRight aria-hidden="true" size={15} />
      </button> : <CircleCheck aria-hidden="true" size={22} color="#15803d" />}
    </div>
    <p style={{ margin: "9px 0 0", fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{es ? "Abre el registro fuente autorizado. Esta tarjeta no crea una tarea separada." : "Opens the authorized source record. This card does not create a separate task."}</p>
  </section>;
}
