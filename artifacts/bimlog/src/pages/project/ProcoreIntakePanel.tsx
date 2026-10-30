import { useEffect, useRef, useState } from "react";
import { ChevronRight, RefreshCw, Send } from "lucide-react";
import { useAuthStore } from "@/store/auth";

type ChatMessage = { role: "user" | "assistant"; content: string };
type BrowseItem = { name: string; type: "file" | "folder"; ref: string; mimeType?: string | null; size?: number | null };

export function ProcoreIntakePanel({ projectId, lang }: { projectId: number; lang: string }) {
  const es = lang === "es";
  const tr = (en: string, spanish: string) => es ? spanish : en;
  const { token, user } = useAuthStore();
  const storageKey = `bimlog-procore-intake:${user?.id ?? "unknown"}:${projectId}`;
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [needed, setNeeded] = useState("");
  const [company, setCompany] = useState("");
  const [sourceProject, setSourceProject] = useState("");
  const [destination, setDestination] = useState(String(projectId));
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [selected, setSelected] = useState<BrowseItem[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const ready = restoredFor === storageKey;
  const activeTurn = useRef<AbortController | null>(null);

  useEffect(() => {
    setRestoredFor(null);
    setConversation([]);
    setGoal(""); setNeeded(""); setCompany(""); setSourceProject(""); setDestination(String(projectId)); setSelected([]);
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) { setRestoredFor(storageKey); return; }
      const parsed = JSON.parse(saved);
      setConversation(Array.isArray(parsed.messages) ? parsed.messages : []);
      setGoal(typeof parsed.goal === "string" ? parsed.goal : "");
      setNeeded(typeof parsed.needed === "string" ? parsed.needed : "");
      setCompany(typeof parsed.company === "string" ? parsed.company : "");
      setSourceProject(typeof parsed.sourceProject === "string" ? parsed.sourceProject : "");
      setDestination(typeof parsed.destination === "string" ? parsed.destination : String(projectId));
      setSelected(Array.isArray(parsed.selected) ? parsed.selected.filter((item: unknown): item is BrowseItem =>
        Boolean(item && typeof item === "object" && "ref" in item && typeof item.ref === "string" && "name" in item && typeof item.name === "string"),
      ) : []);
      setRestoredFor(storageKey);
    } catch { setConversation([]); setRestoredFor(storageKey); }
  }, [storageKey, projectId]);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ messages: conversation.slice(-30), goal, needed, company, sourceProject, destination, selected })); } catch { /* Storage may be disabled. */ }
  }, [ready, storageKey, conversation, goal, needed, company, sourceProject, destination, selected]);

  function save(next: ChatMessage[]) {
    setConversation(next);
    if (ready) try { localStorage.setItem(storageKey, JSON.stringify({ messages: next.slice(-30), goal, needed, company, sourceProject, destination, selected })); } catch { /* Storage may be disabled. */ }
  }

  async function send(text = question) {
    if (!token || !ready || !text.trim() || busy) return;
    setBusy(true); setError(""); setQuestion("");
    const controller = new AbortController();
    activeTurn.current = controller;
    const prior = conversation;
    const submittedText = prior.length ? text.trim() : [
      `Goal: ${goal.trim() || "not yet specified"}`,
      `Information/documents needed: ${needed.trim() || "not yet specified"}`,
      `Procore company: ${company || "not selected"}`,
      `Procore project: ${sourceProject || "not selected"}`,
      `BIMLog destination project: ${destination}`,
      `Selected source refs: ${selected.length ? selected.map((item) => `${item.name} (${item.ref}; pinned Procore version unavailable)`).join("; ") : "none yet"}`,
      `Request: ${text.trim()}`,
    ].join("\n");
    const next = [...prior, { role: "user" as const, content: submittedText }];
    save(next);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/intake-agent/turn`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question: submittedText, history: prior }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.code || "INTAKE_AGENT_FAILED");
      const answer = typeof data.answer === "string" && data.answer ? data.answer : tr("The agent did not return a response. Try again.", "El agente no respondió. Inténtelo de nuevo.");
      save([...next, { role: "assistant", content: answer }]);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr("Could not reach the intake agent.", "No se pudo conectar con el agente de incorporación."));
    } finally { if (activeTurn.current === controller) activeTurn.current = null; setBusy(false); }
  }

  async function browse(nextRef = ref) {
    if (!token || browsing) return;
    setBrowsing(true); setError("");
    try {
      const discovery = await fetch(`/api/v1/projects/${projectId}/intake-agent/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/list" }),
      });
      const available = await discovery.json();
      if (!discovery.ok || !(available.result?.tools || []).some((tool: { name: string }) => tool.name === "procore_browse")) {
        throw new Error(available.error?.message || "PROCORE_BROWSE_TOOL_UNAVAILABLE");
      }
      const response = await fetch(`/api/v1/projects/${projectId}/intake-agent/mcp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name: "procore_browse", arguments: { projectId, ref: nextRef, query: "" } } }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error?.message || data.code || "PROCORE_BROWSE_FAILED");
      const text = data.result?.content?.[0]?.text;
      const result = JSON.parse(text || "{}");
      setRef(nextRef); setItems(result.items || []);
      if (nextRef.startsWith("company:")) setCompany(nextRef);
      if (nextRef.startsWith("project:")) { setSourceProject(nextRef); setCompany(`company:${nextRef.split(":")[1]}`); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PROCORE_BROWSE_FAILED");
    } finally { setBrowsing(false); }
  }

  function continueInto(item: BrowseItem) {
    if (item.type === "folder") void browse(item.ref);
    else setSelected((current) => current.some((entry) => entry.ref === item.ref)
      ? current.filter((entry) => entry.ref !== item.ref)
      : [...current, item]);
  }

  return <section aria-label={tr("Procore intake agent", "Agente de incorporación de Procore")} style={{ margin: "18px 0", padding: 16, border: "1px solid hsl(var(--border))", borderRadius: 12, background: "hsl(var(--card))" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>{tr("Procore intake agent", "Agente de incorporación de Procore")}</h2>
        <p style={{ margin: "5px 0 0", color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{tr("Continue your saved intake conversation or start with the guided questions.", "Continúe su conversación guardada o empiece con las preguntas guiadas.")}</p>
      </div>
      <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !conversation.length) void browse(""); }} style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontWeight: 700 }}>
        {open ? tr("Close intake", "Cerrar incorporación") : conversation.length ? tr("Continue Procore intake", "Continuar incorporación de Procore") : tr("Start Procore intake", "Iniciar incorporación de Procore")}
      </button>
    </div>
    {open && <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("What are you trying to accomplish?", "¿Qué desea lograr?")}<textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} maxLength={2000} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("What information or documents do you need?", "¿Qué información o documentos necesita?")}<textarea value={needed} onChange={(e) => setNeeded(e.target.value)} rows={2} maxLength={2000} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("Authorized Procore company / project", "Empresa / proyecto autorizado de Procore")}<input value={[company, sourceProject].filter(Boolean).join(" / ")} readOnly placeholder={tr("Choose below", "Seleccione abajo")} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("BIMLog destination project", "Proyecto de destino en BIMLog")}<input value={destination} readOnly aria-readonly="true" inputMode="numeric" /></label>
      </div>
      <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>{tr("Browse authorized Procore sources", "Explorar fuentes autorizadas de Procore")}</strong>
          <button type="button" disabled={browsing} onClick={() => void browse("")}>{browsing ? <RefreshCw size={14} /> : null}{tr("Companies", "Empresas")}</button>
        </div>
        <div role="list" style={{ display: "grid", gap: 5, marginTop: 9 }}>
          {items.map((item) => <button key={item.ref} type="button" role="listitem" onClick={() => continueInto(item)} style={{ display: "flex", justifyContent: "space-between", gap: 10, textAlign: "left", padding: 8, border: "1px solid hsl(var(--border))", borderRadius: 7, background: selected.some((entry) => entry.ref === item.ref) ? "hsl(var(--accent))" : "transparent" }}>
            <span>{item.type === "folder" ? "▸ " : selected.some((entry) => entry.ref === item.ref) ? "☑ " : "□ "}{item.name}</span>{item.type === "folder" ? <ChevronRight size={15} /> : null}
          </button>)}
          {!items.length && <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{tr("Choose Companies to browse. File selection is read-only.", "Seleccione Empresas para explorar. La selección de archivos es de solo lectura.")}</span>}
        </div>
        {selected.length > 0 && <div role="status" style={{ fontSize: 12 }}>
          <strong>{tr("Selected sources", "Fuentes seleccionadas")} ({selected.length})</strong>
          <ul style={{ margin: "6px 0", paddingLeft: 20 }}>{selected.map((source) => <li key={source.ref} style={{ overflowWrap: "anywhere" }}>
            {source.name} — <code>{source.ref}</code>; {tr("pinned version unavailable", "versión fijada no disponible")}
          </li>)}</ul>
          <span>{tr("Procore's current browse response does not expose a pinned file version, so exact-version import is unavailable.", "La respuesta de exploración de Procore no expone una versión fijada; no se puede importar una versión exacta.")}</span>
        </div>}
      </div>
      <div aria-live="polite" style={{ maxHeight: 230, overflowY: "auto", display: "grid", gap: 8 }}>
        {conversation.map((message, index) => <div key={index} style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "92%", whiteSpace: "pre-wrap", padding: 10, borderRadius: 9, background: message.role === "user" ? "hsl(var(--accent))" : "hsl(var(--muted))", fontSize: 13 }}>{message.content}</div>)}
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{error} {error.includes("RECONNECT") || error.includes("not_connected") || error.includes("refresh_failed") ? tr("Reconnect Procore, then continue here.", "Vuelva a conectar Procore y continúe aquí.") : ""}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: "flex", gap: 8 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy} aria-label={tr("Message the Procore intake agent", "Enviar mensaje al agente de Procore")} placeholder={tr("Ask for help or describe the next step…", "Pida ayuda o describa el siguiente paso…")} style={{ flex: 1, minWidth: 0 }} />
        <button type="submit" disabled={!ready || busy || !question.trim()} aria-label={tr("Send message", "Enviar mensaje")}><Send size={15} />{busy ? tr("Working…", "Procesando…") : tr("Send", "Enviar")}</button>
        {busy && <button type="button" onClick={() => activeTurn.current?.abort()}>{tr("Cancel", "Cancelar")}</button>}
      </form>
      <p style={{ margin: 0, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{tr("Discovery and proposed plans do not import records. This intake currently has no commit action; use supported existing BIMLog import tools for actual changes.", "La exploración y los planes propuestos no importan registros. Esta incorporación aún no tiene acción de confirmación; use las herramientas existentes de BIMLog para cambios reales.")}</p>
    </div>}
  </section>;
}
