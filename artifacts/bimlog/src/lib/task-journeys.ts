export type JourneyText = { en: string; es: string };
const t = (en: string, es: string): JourneyText => ({ en, es });
export type JourneyStep = { title: JourneyText; action: JourneyText; completion: JourneyText; recovery: JourneyText; destination: string; topic: string };
export const TASK_JOURNEYS: { id: string; title: JourneyText; audience: JourneyText; steps: JourneyStep[] }[] = [
  { id: "setup", title: t("Set up a job", "Preparar un trabajo"), audience: t("Project manager", "Gerente de proyecto"), steps: [
    { title: t("Review the job draft", "Revisar el borrador"), action: t("Open Job Intake in your project. Check the client, scope, floors and deliverables before continuing.", "Abra la preparación del trabajo en su proyecto. Revise cliente, alcance, pisos y entregables antes de continuar."), completion: t("Your saved draft contains the intended scope. Saving is not activation.", "El borrador guardado contiene el alcance previsto. Guardar no equivale a activar."), recovery: t("If a prerequisite is missing, save first and note the current step. Do not recreate the project.", "Si falta un requisito, guarde primero y anote el paso actual. No vuelva a crear el proyecto."), destination: "intake", topic: "job-intake" },
    { title: t("Check naming prerequisites", "Revisar la nomenclatura"), action: t("Review the project's naming convention if Intake asks for one. Keep the same project selected.", "Revise la convención de nombres si la preparación la solicita. Mantenga seleccionado el mismo proyecto."), completion: t("The required convention is saved and available to this project.", "La convención requerida está guardada y disponible para este proyecto."), recovery: t("Use Return to Job Intake to go back to the exact saved Intake step. If a save failed, stay in the builder and resolve the visible error first.", "Use Volver al Ingreso para regresar al paso exacto guardado. Si falló el guardado, permanezca en el constructor y resuelva primero el error visible."), destination: "convention", topic: "coordination-files" },
    { title: t("Return and verify the draft", "Volver y verificar el borrador"), action: t("Reopen Job Intake, confirm the saved values, and review the on-screen readiness messages.", "Abra nuevamente la preparación, confirme los valores guardados y revise los mensajes de requisitos pendientes."), completion: t("The same draft and prerequisites are visible. Only a successful activation response means the job is active.", "Se ven el mismo borrador y sus requisitos. Solo una respuesta de activación exitosa indica que el trabajo está activo."), recovery: t("For an unexpected APU rate or staffing requirement, retain the draft and report the mismatch; do not overwrite the rate or invent staff to get past it.", "Ante una tarifa APU inesperada o un requisito de personal, conserve el borrador y reporte la diferencia; no sobrescriba tarifas ni invente personal para continuar."), destination: "intake", topic: "job-intake" },
    { title: t("Find the next task", "Encontrar la siguiente tarea"), action: t("After activation, open Job Operations and review the work generated from your scope.", "Después de activar, abra Operaciones y revise el trabajo generado desde su alcance."), completion: t("You can identify the next work item and its source. Setup progress does not measure delivered work.", "Puede identificar la siguiente tarea y su origen. El avance de configuración no mide trabajo entregado."), recovery: t("If EDT reports a missing canonical Contract version, complete the Contract source; keep existing work unchanged.", "Si EDT informa que falta una versión canónica del contrato, complete el origen del contrato; conserve el trabajo existente."), destination: "operations", topic: "job-operations" },
  ] },
  { id: "coordinate", title: t("Coordinate a delivery", "Coordinar una entrega"), audience: t("BIM coordinator", "Coordinador BIM"), steps: [
    { title: t("Review what needs attention", "Revisar lo pendiente"), action: t("Open the Command Center for the selected project and follow an item to its source.", "Abra el centro de mando del proyecto y siga un elemento hasta su origen."), completion: t("The source record, status and responsible party are identifiable.", "Se identifican el registro de origen, su estado y responsable."), recovery: t("Check project access and filters before creating a replacement record.", "Revise el acceso al proyecto y los filtros antes de crear otro registro."), destination: "command-center", topic: "command-center" },
    { title: t("Review the deliverable", "Revisar el entregable"), action: t("Open Files to verify the intended drawing or document revision.", "Abra Archivos para verificar la revisión del plano o documento."), completion: t("The intended revision is identifiable. A file upload is not a delivery or approval.", "La revisión prevista es identificable. Cargar un archivo no equivale a entregar ni aprobar."), recovery: t("Resolve a missing or ambiguous revision before preparing the delivery.", "Resuelva una revisión faltante o ambigua antes de preparar la entrega."), destination: "files", topic: "coordination-files" },
    { title: t("Prepare the delivery record", "Preparar el registro de entrega"), action: t("Use Submittals for review packages or Transmittals for dispatch, according to the agreed workflow.", "Use Submittals para paquetes de revisión o Transmittals para despachos, según el flujo acordado."), completion: t("Recipients, revision and workflow are correct. Confirm actual send status separately.", "Destinatarios, revisión y flujo son correctos. Confirme por separado el estado real del envío."), recovery: t("Check Integrations if email is unavailable. Do not infer delivery from a prepared record.", "Revise Integraciones si el correo no está disponible. Un registro preparado no prueba la entrega."), destination: "submittals", topic: "submittals-transmittals" },
  ] },
  { id: "execute", title: t("Work on an assigned task", "Trabajar en una tarea"), audience: t("Operator / drafter", "Operador / dibujante"), steps: [
    { title: t("Locate the work item", "Localizar la tarea"), action: t("Open Job Operations and identify the intended floor, discipline and work item.", "Abra Operaciones e identifique el piso, la disciplina y la tarea."), completion: t("The task and source scope match the work you intend to do.", "La tarea y su alcance coinciden con el trabajo previsto."), recovery: t("Ask the project manager about missing or unassigned work; do not create duplicate scope.", "Consulte al gerente sobre trabajo faltante o sin asignar; no duplique el alcance."), destination: "operations", topic: "job-operations" },
    { title: t("Verify the working revision", "Verificar la revisión de trabajo"), action: t("Open the project files and confirm the revision before producing or reviewing drawings.", "Abra los archivos y confirme la revisión antes de producir o revisar planos."), completion: t("The working revision is clear and any required task update has saved successfully.", "La revisión de trabajo está clara y los cambios requeridos en la tarea se guardaron correctamente."), recovery: t("Return to Operations to verify the task. File presence alone does not complete it.", "Vuelva a Operaciones para verificar la tarea. La presencia de un archivo no la completa."), destination: "files", topic: "coordination-files" },
  ] },
  { id: "administer", title: t("Prepare project access", "Preparar el acceso al proyecto"), audience: t("Administrator", "Administrador"), steps: [
    { title: t("Review project membership", "Revisar miembros del proyecto"), action: t("Review the project's Team page using an account authorized to manage membership.", "Revise Equipo con una cuenta autorizada para administrar miembros."), completion: t("The intended members and roles are correct. Membership does not automatically grant financial capabilities.", "Los miembros y roles previstos son correctos. Ser miembro no concede automáticamente capacidades financieras."), recovery: t("If access is denied, ask an authorized administrator; do not change project identity to bypass it.", "Si se deniega el acceso, consulte a un administrador autorizado; no cambie de proyecto para eludirlo."), destination: "team", topic: "directory-administration" },
    { title: t("Check required integrations", "Revisar integraciones necesarias"), action: t("Review Integrations for the services this project actually needs, including email readiness.", "Revise Integraciones para los servicios que necesita el proyecto, incluida la disponibilidad del correo."), completion: t("Required connections report their real readiness. Configuration alone does not prove an email was sent.", "Las conexiones requeridas muestran su disponibilidad real. Configurar no prueba que se envió un correo."), recovery: t("Keep credentials in the designated settings only; return to the original work after resolving readiness.", "Mantenga las credenciales solo en la configuración indicada; vuelva al trabajo original tras resolver los requisitos."), destination: "integrations", topic: "integrations" },
  ] },
];

// Context is navigation only, never proof of membership or permission.
export function projectContext(from: string): string | null {
  const match = /^\/projects\/([1-9]\d*)(?:\/[a-z][a-z0-9/-]*)?(?:\?[^#\\\r\n]*)?$/.exec(from);
  return match && Number.isSafeInteger(Number(match[1])) ? match[1] : null;
}
export function journeyDestination(from: string, destination: string, helpResume?: string): string {
  const id = projectContext(from);
  const allowed = TASK_JOURNEYS.some(j => j.steps.some(s => s.destination === destination));
  if (!id || !allowed) return "/dashboard";
  const target = `/projects/${id}/${destination}`;
  const params = new URLSearchParams();
  if (destination === "convention") params.set("returnTo", from);
  const resume = safeHelpResumeTarget(helpResume, Number(id));
  if (resume) params.set("helpReturn", resume);
  return `${target}${params.size ? `?${params.toString()}` : ""}`;
}
export function safeHelpReturn(from: string): string {
  if (from === "/dashboard") return from;
  return projectContext(from) ? from : "/dashboard";
}
export function safeHelpResumeTarget(value: string | null | undefined, projectId: number): string | null {
  if (!value || !Number.isSafeInteger(projectId) || projectId < 1 || value.includes("#")) return null;
  const [path, query = ""] = value.split("?");
  if (path !== "/help") return null;
  const params = new URLSearchParams(query);
  const allowed = new Set(["view", "journey", "step", "topic", "context", "from"]);
  if ([...params.keys()].some((key) => !allowed.has(key) || params.getAll(key).length !== 1)) return null;
  const from = params.get("from");
  if (!from || projectContext(from) !== String(projectId)) return null;
  const view = params.get("view");
  if (view && !["manual", "guides", "troubleshooting", "releases"].includes(view)) return null;
  const step = params.get("step");
  if (step && !/^\d+$/.test(step)) return null;
  return `${path}${query ? `?${params.toString()}` : ""}`;
}
export function journeySelection(search: string) {
  const params = new URLSearchParams(search);
  const journey = TASK_JOURNEYS.find(j => j.id === params.get("journey")) ?? TASK_JOURNEYS[0];
  const raw = params.get("step") ?? "0";
  const index = /^\d+$/.test(raw) ? Number(raw) : 0;
  return { journey, index: Number.isSafeInteger(index) && index < journey.steps.length ? index : 0 };
}
