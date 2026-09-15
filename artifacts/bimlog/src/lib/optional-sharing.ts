export type EmailComposeProvider = "default" | "gmail" | "outlook" | "yahoo";

export type OptionalShareDraft = {
  recipients: string[];
  subject: string;
  body: string;
  downloadUrl?: string;
};

const normalizeRecipients = (recipients: string[]): string[] => (
  [...new Set(recipients.map(value => value.trim().toLowerCase()).filter(Boolean))].sort()
);

export function buildEmailComposeUrl(provider: EmailComposeProvider, draft: OptionalShareDraft): string {
  const recipients = normalizeRecipients(draft.recipients).join(",");
  const body = draft.downloadUrl
    ? `${draft.body.trim()}\n\nBIMLog package: ${draft.downloadUrl}`
    : draft.body.trim();
  const encoded = {
    to: encodeURIComponent(recipients),
    subject: encodeURIComponent(draft.subject.trim()),
    body: encodeURIComponent(body),
  };

  if (provider === "gmail") {
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encoded.to}&su=${encoded.subject}&body=${encoded.body}`;
  }
  if (provider === "outlook") {
    return `https://outlook.office.com/mail/deeplink/compose?to=${encoded.to}&subject=${encoded.subject}&body=${encoded.body}`;
  }
  if (provider === "yahoo") {
    return `https://compose.mail.yahoo.com/?to=${encoded.to}&subject=${encoded.subject}&body=${encoded.body}`;
  }
  return `mailto:${encoded.to}?subject=${encoded.subject}&body=${encoded.body}`;
}

export function emailAttachmentGuidance(language: "en" | "es"): string {
  return language === "es"
    ? "BIMLog preparará el mensaje y descargará el archivo. Su proveedor de correo no permite que un sitio web adjunte el archivo automáticamente; adjúntelo en la ventana de redacción antes de enviar."
    : "BIMLog will prepare the message and download the file. Your email provider does not allow a website to attach it automatically; attach it in the compose window before sending.";
}

export function optionalSharingChoices(language: "en" | "es") {
  return language === "es"
    ? ["Enviar por Telegram", "Preparar correo", "Descargar paquete", "Copiar enlace seguro", "No enviar ahora"] as const
    : ["Send by Telegram", "Prepare email", "Download package", "Copy secure link", "Do not send now"] as const;
}
