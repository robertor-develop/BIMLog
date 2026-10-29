import fs from "node:fs";
const page=fs.readFileSync(new URL("../artifacts/bimlog/src/pages/parity/admin-launch-configuration.tsx",import.meta.url),"utf8");
const panel=fs.readFileSync(new URL("../artifacts/bimlog/src/components/admin/LaunchConfigurationPanel.tsx",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../artifacts/bimlog/src/App.tsx",import.meta.url),"utf8");
const directory=fs.readFileSync(new URL("../artifacts/bimlog/src/lib/capability-directory.ts",import.meta.url),"utf8");
const routes=fs.readFileSync(new URL("../artifacts/api-server/src/routes/launch-configuration.ts",import.meta.url),"utf8");
const tokens=["/admin/launch-configuration/:environment","/admin/launch-configuration/:environment/history","/admin/launch-configuration/:environment/restore","/admin/launch-configuration/:environment/email/verify","/admin/launch-configuration/:environment/email/send-test","/admin/launch-configuration/:environment/payment/verify","/admin/launch-configuration/:environment/:action"];
const checks=[
 [app.includes('/admin/launch-configuration')&&app.includes('surface="total_control"'),"protected direct route"],
 [directory.includes('id: "launch-configuration"')&&directory.includes('href: "/admin/launch-configuration"'),"discoverable All Tools entry"],
 [page.includes("LaunchConfigurationPanel")&&page.includes("complete launch workflow"),"complete existing workflow reused"],
 [panel.includes('method:"PUT"')&&panel.includes('action("activate")')&&panel.includes('restore(item.revision)'),"save activate deactivate restore controls"],
 [panel.includes('checkEmail("verify")')&&panel.includes('checkEmail("send-test")')&&panel.includes('checkPayment(method)'),"email and payment verification controls"],
 [panel.includes('x-bimlog-step-up')&&panel.includes('/auth/launch-step-up'),"step-up authentication"],
 [tokens.every(token=>routes.includes(token)),"all eight backend identities represented"],
 [(routes.match(/isSuperAdminMiddleware/g)||[]).length>=8&&routes.includes("requireLaunchStepUp"),"server authority and step-up enforcement"],
];
for(const [ok,label] of checks)console.log(`${ok?"PASS":"FAIL"} ${label}`);if(checks.some(([ok])=>!ok))process.exit(1);console.log("PASS P037 admin launch-configuration parity");
