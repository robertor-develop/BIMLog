export function readInvitationToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "";
}
/** Configuration may repeat a role; render each stable role identity once. */
export function distinctInvitationRoles<T extends { value: string }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter(option => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}
export function invitationError(code: string, tt: (en:string,es:string)=>string) {
  if(code.includes("WRONG_ACCOUNT"))return tt("Sign in with the email that received this invitation.","Inicie sesión con el correo que recibió esta invitación.");
  if(code.includes("TRANSFER"))return tt("This account belongs to another company. Ask an administrator to review the transfer; do not create another account.","Esta cuenta pertenece a otra empresa. Solicite al administrador revisar el traslado; no cree otra cuenta.");
  if(code.includes("Email already exists"))return tt("This email already has an account. Use Sign in below to accept this invitation.","Este correo ya tiene cuenta. Use Iniciar sesión abajo para aceptar la invitación.");
  if(code.includes("COMPANY_JOIN_REQUIRED"))return tt("This company already exists. Use its invitation or contact its administrator.","Esta empresa ya existe. Use su invitación o contacte a su administrador.");
  return tt("This invitation cannot be used. Ask the inviter to resend it, then open the newest email. Do not create a duplicate company.","Esta invitación no se puede usar. Solicite que la reenvíen y abra el correo más reciente. No cree una empresa duplicada.");
}
