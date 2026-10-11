import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const workspace=readFileSync(new URL("../artifacts/bimlog/src/pages/CommercialWorkspace.tsx",import.meta.url),"utf8");

for(const label of [
  "Recommended next","Siguiente recomendado",
  "Continue your account setup","Continúe la configuración de su cuenta",
  "Account and platform readiness","Preparación de cuenta y plataforma",
  "Billing history and statements","Historial y estados de facturación",
  "Customer support and requests","Soporte y solicitudes del cliente",
  "Next steps · other account actions","Próximos pasos · otras acciones de la cuenta",
]) assert.ok(workspace.includes(label),`missing ${label}`);

assert.match(workspace,/actions\.find\(action=>action\.status==="available"\)/);
assert.match(workspace,/actions\.filter\(action=>action!==primaryAction\)/);
assert.match(workspace,/billingHistoryOpen&&<div[^>]*><BillingHistoryPanel/);
assert.match(workspace,/supportOpen&&<div[^>]*><SupportCasesPanel/);
assert.match(workspace,/onToggle=\{event=>setBillingHistoryOpen\(event\.currentTarget\.open\)\}/);
assert.match(workspace,/onToggle=\{event=>setSupportOpen\(event\.currentTarget\.open\)\}/);
assert.doesNotMatch(workspace,/<BillingHistoryPanel token=\{token\?\?""\}\/>(?!<\/div>)/);
assert.doesNotMatch(workspace,/<SupportCasesPanel\/>\s*<\/?>/);

console.log("Progressive disclosure Block 3 Billing & Support acceptance: PASS");
