import { useMemo, useState } from "react";
import { Copy, Download, Mail, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildEmailComposeUrl, emailAttachmentGuidance, type EmailComposeProvider } from "@/lib/optional-sharing";
import { useAuthStore } from "@/store/auth";

type Props = {
  language: "en" | "es";
  artifactLabel: string;
  defaultRecipients?: string[];
  downloadUrl: string;
  secureLink?: string;
  telegramDelivery?: { projectId: number; artifactType: string; entityId: number };
};

const splitRecipients = (value: string) => value.split(/[;,]/).map(item => item.trim()).filter(Boolean);

export function OptionalSharePanel({ language, artifactLabel, defaultRecipients = [], downloadUrl, secureLink, telegramDelivery }: Props) {
  const es = language === "es";
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(defaultRecipients.join(", "));
  const [provider, setProvider] = useState<EmailComposeProvider>("default");
  const [telegramReady, setTelegramReady] = useState(false);
  const [telegramDeliveryId, setTelegramDeliveryId] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const token = useAuthStore(state => state.token);
  const recipientList = useMemo(() => splitRecipients(recipients), [recipients]);
  const subject = es ? `Entrega BIMLog: ${artifactLabel}` : `BIMLog delivery: ${artifactLabel}`;
  const body = es
    ? `Se preparó el archivo controlado ${artifactLabel} en BIMLog. Revise el contenido antes de enviarlo.`
    : `The controlled file ${artifactLabel} was prepared in BIMLog. Review the contents before sending it.`;

  function prepareEmail() {
    window.open(buildEmailComposeUrl(provider, { recipients: recipientList, subject, body, downloadUrl: secureLink }), "_blank", "noopener,noreferrer");
    setNotice(emailAttachmentGuidance(language));
  }

  async function prepareTelegram() {
    if (!telegramDelivery || !token) return;
    setWorking(true);
    try {
      const response = await fetch("/api/v1/integrations/telegram/deliveries/preview", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...telegramDelivery, channel: "telegram", recipients: "me", language, confirmationKey: `browser:${crypto.randomUUID()}` }),
      });
      const data = await response.json() as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || (es ? "No se pudo preparar Telegram." : "Telegram preview could not be prepared."));
      setTelegramDeliveryId(data.id);
      setTelegramReady(true);
      setNotice(es ? "Vista previa preparada. Nada se envió todavía." : "Preview prepared. Nothing has been sent yet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (es ? "No se pudo preparar Telegram." : "Telegram preview could not be prepared."));
    } finally {
      setWorking(false);
    }
  }

  async function confirmTelegram() {
    if (!telegramDeliveryId || !token) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/v1/integrations/telegram/deliveries/${encodeURIComponent(telegramDeliveryId)}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json() as { status?: string; error?: string };
      if (!response.ok || data.status !== "delivered") throw new Error(data.error || `${es ? "Estado" : "Status"}: ${data.status || response.status}`);
      setTelegramReady(false);
      setNotice(es ? "Telegram confirmó la entrega." : "Telegram acknowledged delivery.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (es ? "Falló la entrega por Telegram." : "Telegram delivery failed."));
    } finally {
      setWorking(false);
    }
  }

  async function copyLink() {
    if (!secureLink) return;
    await navigator.clipboard.writeText(secureLink);
    setNotice(es ? "Enlace seguro copiado." : "Secure link copied.");
  }

  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>
      <Send style={{ width: 15, height: 15 }} />
      {es ? "Compartir opcionalmente" : "Optional sharing"}
    </Button>
    {open && <div role="dialog" aria-modal="true" aria-label={es ? "Compartir archivo" : "Share file"} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 16 }}>
      <section style={{ width: "min(620px, 100%)", maxHeight: "90vh", overflowY: "auto", borderRadius: 12, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", padding: 20, boxShadow: "0 24px 70px rgba(15,23,42,.25)" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div><h2 style={{ margin: 0, fontSize: 20 }}>{es ? "Compartir archivo" : "Share file"}</h2><p style={{ margin: "6px 0 0", color: "hsl(var(--muted-foreground))" }}>{artifactLabel}</p></div>
          <Button type="button" size="icon" variant="ghost" aria-label={es ? "Cerrar" : "Close"} onClick={() => setOpen(false)}><X style={{ width: 17, height: 17 }} /></Button>
        </header>
        <p style={{ margin: "16px 0", padding: 12, borderRadius: 8, background: "hsl(var(--muted))" }}>
          {es ? "Compartir es opcional. Guardar o completar el registro no envía nada automáticamente." : "Sharing is optional. Saving or completing the record never sends anything automatically."}
        </p>
        <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          <span>{es ? "Destinatarios de correo" : "Email recipients"}</span>
          <Input value={recipients} onChange={event => setRecipients(event.target.value)} placeholder="name@example.com" />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <a className="btn btn-outline" href={downloadUrl} download><Download style={{ width: 15, height: 15 }} />{es ? "Descargar paquete" : "Download package"}</a>
          {secureLink && <Button type="button" variant="outline" onClick={() => void copyLink()}><Copy style={{ width: 15, height: 15 }} />{es ? "Copiar enlace seguro" : "Copy secure link"}</Button>}
        </div>
        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 14, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}><span>{es ? "Aplicación de correo" : "Email application"}</span><select value={provider} onChange={event => setProvider(event.target.value as EmailComposeProvider)}><option value="default">{es ? "Aplicación predeterminada" : "Default application"}</option><option value="gmail">Gmail</option><option value="outlook">Outlook</option><option value="yahoo">Yahoo Mail</option></select></label>
          <Button type="button" variant="outline" onClick={prepareEmail}><Mail style={{ width: 15, height: 15 }} />{es ? "Preparar correo" : "Prepare email"}</Button>
          {telegramDelivery && <Button type="button" variant="outline" disabled={working || !token} onClick={() => void prepareTelegram()}><Send style={{ width: 15, height: 15 }} />{working ? (es ? "Preparando…" : "Preparing…") : (es ? "Preparar vista previa de Telegram" : "Prepare Telegram preview")}</Button>}
          {telegramReady && <div style={{ display: "grid", gap: 8, padding: 10, border: "1px solid hsl(var(--border))", borderRadius: 8 }}><p role="status" style={{ margin: 0 }}>{es ? "Nada se ha enviado. Revise el archivo y confirme solamente si desea enviarlo a su chat privado conectado." : "Nothing has been sent. Review the file and confirm only if you want to send it to your connected private chat."}</p><Button type="button" disabled={working} onClick={() => void confirmTelegram()}>{es ? "Confirmar y enviar por Telegram" : "Confirm and send by Telegram"}</Button></div>}
        </div>
        {notice && <p role="status" style={{ margin: "14px 0 0", color: "hsl(var(--muted-foreground))" }}>{notice}</p>}
        <footer style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><Button type="button" variant="ghost" onClick={() => setOpen(false)}>{es ? "No enviar ahora" : "Do not send now"}</Button></footer>
      </section>
    </div>}
  </>;
}
