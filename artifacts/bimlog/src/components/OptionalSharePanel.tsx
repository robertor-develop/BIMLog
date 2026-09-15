import { useMemo, useState } from "react";
import { Copy, Download, Mail, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildEmailComposeUrl, emailAttachmentGuidance, type EmailComposeProvider } from "@/lib/optional-sharing";

type Props = {
  language: "en" | "es";
  artifactLabel: string;
  defaultRecipients?: string[];
  downloadUrl: string;
  secureLink?: string;
  onTelegramPreview?: (recipients: string[]) => Promise<void> | void;
};

const splitRecipients = (value: string) => value.split(/[;,]/).map(item => item.trim()).filter(Boolean);

export function OptionalSharePanel({ language, artifactLabel, defaultRecipients = [], downloadUrl, secureLink, onTelegramPreview }: Props) {
  const es = language === "es";
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(defaultRecipients.join(", "));
  const [provider, setProvider] = useState<EmailComposeProvider>("default");
  const [telegramReady, setTelegramReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
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
    if (!onTelegramPreview) return;
    setWorking(true);
    try {
      await onTelegramPreview(recipientList);
      setTelegramReady(true);
      setNotice(es ? "Vista previa preparada. Nada se envió todavía." : "Preview prepared. Nothing has been sent yet.");
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
          {onTelegramPreview && <Button type="button" variant="outline" disabled={working} onClick={() => void prepareTelegram()}><Send style={{ width: 15, height: 15 }} />{working ? (es ? "Preparando…" : "Preparing…") : (es ? "Preparar vista previa de Telegram" : "Prepare Telegram preview")}</Button>}
          {telegramReady && <p role="status" style={{ margin: 0 }}>{es ? "Use la confirmación separada que aparece en la vista previa para enviar." : "Use the separate confirmation shown in the preview to send."}</p>}
        </div>
        {notice && <p role="status" style={{ margin: "14px 0 0", color: "hsl(var(--muted-foreground))" }}>{notice}</p>}
        <footer style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}><Button type="button" variant="ghost" onClick={() => setOpen(false)}>{es ? "No enviar ahora" : "Do not send now"}</Button></footer>
      </section>
    </div>}
  </>;
}
