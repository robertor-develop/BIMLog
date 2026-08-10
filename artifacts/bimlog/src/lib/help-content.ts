export type HelpText = { en: string; es: string };

export type HelpStep = {
  title: HelpText;
  body: HelpText;
};

export type HelpTopic = {
  id: string;
  category: string;
  title: HelpText;
  summary: HelpText;
  audience: HelpText;
  availability: HelpText;
  quickTip: HelpText;
  steps: HelpStep[];
  result: HelpText;
  troubleshooting: HelpText[];
  keywords: string[];
};

export const HELP_CATEGORIES: Array<{ id: string; label: HelpText }> = [
  { id: "start", label: { en: "Getting started", es: "Primeros pasos" } },
  { id: "command", label: { en: "Command & execution", es: "Comando y ejecución" } },
  { id: "documents", label: { en: "Documents & workflows", es: "Documentos y flujos" } },
  { id: "planning", label: { en: "Planning", es: "Planificación" } },
  { id: "commercial", label: { en: "Commercial", es: "Comercial" } },
  { id: "insights", label: { en: "Insights & reports", es: "Informes e inteligencia" } },
  { id: "admin", label: { en: "Directory & administration", es: "Directorio y administración" } },
  { id: "integrations", label: { en: "Integrations", es: "Integraciones" } },
];

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "getting-started", category: "start",
    title: { en: "Getting started with BIMLog", es: "Primeros pasos con BIMLog" },
    summary: { en: "Create a company workspace, open a project, invite the team, and understand the project navigation.", es: "Cree el espacio de la empresa, abra un proyecto, invite al equipo y conozca la navegación del proyecto." },
    audience: { en: "All users", es: "Todos los usuarios" },
    availability: { en: "Core platform", es: "Plataforma base" },
    quickTip: { en: "Start at Headquarters, open a project, then use the left navigation to move between command, documents, planning, commercial, reports, and administration.", es: "Comience en la Sede, abra un proyecto y use la navegación izquierda para moverse entre comando, documentos, planificación, comercial, informes y administración." },
    steps: [
      { title: { en: "Open Headquarters", es: "Abrir la Sede" }, body: { en: "Headquarters lists the projects available to your account. Select a project to enter its controlled workspace.", es: "La Sede muestra los proyectos disponibles para su cuenta. Seleccione un proyecto para entrar a su espacio controlado." } },
      { title: { en: "Confirm the active project", es: "Confirmar el proyecto activo" }, body: { en: "The project card, code, breadcrumb, and role badge identify the current project. Verify them before entering or importing information.", es: "La tarjeta, el código, la ruta de navegación y la insignia de rol identifican el proyecto actual. Verifíquelos antes de ingresar o importar información." } },
      { title: { en: "Invite and assign the team", es: "Invitar y asignar el equipo" }, body: { en: "Project administrators add active members and roles from Team. Roles control who may manage configuration, records, assignments, and approvals.", es: "Los administradores agregan miembros activos y roles desde Equipo. Los roles controlan quién administra configuración, registros, asignaciones y aprobaciones." } },
      { title: { en: "Choose the correct workflow", es: "Elegir el flujo correcto" }, body: { en: "Use Job Intake for a newly negotiated job, Job Operations for activated work, and Documents & Workflows for live project records.", es: "Use Ingreso del Trabajo para un trabajo recién negociado, Operaciones para trabajo activado y Documentos y flujos para los registros vivos del proyecto." } },
    ],
    result: { en: "You are working in the correct project with the correct role and workflow.", es: "Está trabajando en el proyecto, rol y flujo correctos." },
    troubleshooting: [
      { en: "If a project is missing, ask a project administrator to confirm active membership.", es: "Si falta un proyecto, pida al administrador que confirme su membresía activa." },
      { en: "If a module is hidden, the feature may not be enabled for your user or package.", es: "Si un módulo está oculto, es posible que la función no esté habilitada para su usuario o paquete." },
    ], keywords: ["headquarters", "project", "team", "role", "sede", "proyecto", "equipo", "rol"],
  },
  {
    id: "command-center", category: "command",
    title: { en: "Coordinator Command Center", es: "Centro de Control del Coordinador" },
    summary: { en: "Review current priorities, overdue records, blockers, and actions requiring coordination.", es: "Revise prioridades actuales, registros vencidos, bloqueos y acciones que requieren coordinación." },
    audience: { en: "Coordinators, project leaders, and administrators", es: "Coordinadores, líderes y administradores" },
    availability: { en: "Core project capability", es: "Capacidad base del proyecto" },
    quickTip: { en: "Use Command Center for action. Use Insights & Reports for analysis. Filters and links preserve the project context.", es: "Use el Centro de Control para actuar. Use Informes e inteligencia para analizar. Los filtros y enlaces conservan el contexto del proyecto." },
    steps: [
      { title: { en: "Review priority groups", es: "Revisar grupos prioritarios" }, body: { en: "Start with overdue, due soon, blocked, and unassigned groups. Counts reflect current project records.", es: "Comience con vencidos, próximos, bloqueados y sin asignar. Los conteos reflejan los registros actuales del proyecto." } },
      { title: { en: "Open the source record", es: "Abrir el registro de origen" }, body: { en: "Select an item to open its RFI, submittal, task, meeting action, or other authoritative record before acting.", es: "Seleccione un elemento para abrir su RFI, submittal, tarea, acción de reunión u otro registro autorizado antes de actuar." } },
      { title: { en: "Complete and verify the action", es: "Completar y verificar la acción" }, body: { en: "Update the source record, save it, then return to the Command Center and confirm that its status and priority changed.", es: "Actualice el registro de origen, guárdelo y regrese al Centro de Control para confirmar que cambió su estado y prioridad." } },
    ],
    result: { en: "The project action queue reflects current, traceable records.", es: "La cola de acciones refleja registros actuales y trazables." },
    troubleshooting: [{ en: "If a count does not change, reload after confirming the source record was saved.", es: "Si un conteo no cambia, recargue después de confirmar que el registro de origen se guardó." }],
    keywords: ["command", "priority", "overdue", "blocked", "comando", "prioridad", "vencido", "bloqueado"],
  },
  {
    id: "coordination-files", category: "command",
    title: { en: "Coordination Hub, files, and activity", es: "Centro de Coordinación, archivos y actividad" },
    summary: { en: "Receive files, validate names, preserve project records, and review the resulting activity history.", es: "Reciba archivos, valide nombres, conserve registros del proyecto y revise el historial resultante." },
    audience: { en: "Project members", es: "Miembros del proyecto" },
    availability: { en: "Core platform; some automation depends on configuration", es: "Plataforma base; algunas automatizaciones dependen de la configuración" },
    quickTip: { en: "Confirm the active naming convention before processing files. Review every proposed name before accepting it.", es: "Confirme la convención activa antes de procesar archivos. Revise cada nombre propuesto antes de aceptarlo." },
    steps: [
      { title: { en: "Confirm the naming convention", es: "Confirmar la convención" }, body: { en: "Project administrators configure fields, separators, allowed values, and activation in Convention Builder.", es: "Los administradores configuran campos, separadores, valores permitidos y activación en el Constructor de Convenciones." } },
      { title: { en: "Process or validate a file", es: "Procesar o validar un archivo" }, body: { en: "Use Coordination Hub when you want a naming proposal. Use Files when you need to inspect the project file register and validation state.", es: "Use el Centro de Coordinación cuando necesite una propuesta de nombre. Use Archivos para revisar el registro y estado de validación." } },
      { title: { en: "Review before confirmation", es: "Revisar antes de confirmar" }, body: { en: "Check every field and the final name. BIMLog records confirmed actions but does not replace your professional review.", es: "Compruebe cada campo y el nombre final. BIMLog registra acciones confirmadas, pero no sustituye su revisión profesional." } },
      { title: { en: "Review Activity Log", es: "Revisar la Bitácora" }, body: { en: "Activity Log records project events and provides traceability for uploads, validations, changes, and workflow actions.", es: "La Bitácora registra eventos y aporta trazabilidad para cargas, validaciones, cambios y acciones del flujo." } },
    ],
    result: { en: "The project has a controlled file record and traceable activity history.", es: "El proyecto conserva un registro controlado de archivos y un historial trazable." },
    troubleshooting: [{ en: "If validation options are empty, confirm that an active convention exists for the project.", es: "Si las opciones de validación están vacías, confirme que exista una convención activa para el proyecto." }],
    keywords: ["coordination", "files", "naming", "activity", "coordinación", "archivos", "nombres", "bitácora"],
  },
  {
    id: "job-intake", category: "command",
    title: { en: "Job Intake & Setup", es: "Ingreso y Configuración del Trabajo" },
    summary: { en: "Turn a negotiated quotation, proposal, takeoff, estimate, or contract into an executable BIMLog project baseline.", es: "Convierta una cotización, propuesta, takeoff, estimado o contrato negociado en una línea base ejecutable de BIMLog." },
    audience: { en: "Project leaders and authorized team members", es: "Líderes y miembros autorizados" },
    availability: { en: "Core activation is included; commercial overlays require their enabled features", es: "La activación base está incluida; las capas comerciales requieren sus funciones habilitadas" },
    quickTip: { en: "Complete the steps in order. The progress card shows what remains. Source documents stay preserved and imported values require confirmation.", es: "Complete los pasos en orden. La tarjeta de progreso muestra lo pendiente. Los documentos originales se conservan y los valores importados requieren confirmación." },
    steps: [
      { title: { en: "Add source documents", es: "Agregar documentos de origen" }, body: { en: "Upload the quotation, proposal, takeoff, estimate, or contract. Classify the document and revision. Excel and CSV can seed scope rows; PDF and Word values require user confirmation.", es: "Cargue la cotización, propuesta, takeoff, estimado o contrato. Clasifique el documento y la revisión. Excel y CSV pueden iniciar partidas; los valores de PDF y Word requieren confirmación." } },
      { title: { en: "Confirm job identity", es: "Confirmar identidad del trabajo" }, body: { en: "Enter the customer, contract or job reference, currency, dates, and project identity. Confirm that the information matches the negotiated record.", es: "Ingrese cliente, referencia contractual, moneda, fechas e identidad del proyecto. Confirme que coincida con el registro negociado." } },
      { title: { en: "Build scope and hours", es: "Construir alcance y horas" }, body: { en: "Create scope items with units, quantities, planned hours, billing hourly rates, internal rates, and responsible disciplines. Hourly rate is the joining factor between commercial value and execution effort.", es: "Cree partidas con unidades, cantidades, horas planificadas, tarifas facturables, tarifas internas y disciplinas responsables. La tarifa por hora conecta el valor comercial con el esfuerzo de ejecución." } },
      { title: { en: "Apply enabled commercial layers", es: "Aplicar capas comerciales habilitadas" }, body: { en: "Use Cost & Value pricing, budget, or contract setup only when those features are enabled. Core activation remains available without paid commercial features.", es: "Use precios de Costos y Valor, presupuesto o contrato solo cuando estén habilitados. La activación base permanece disponible sin funciones comerciales pagadas." } },
      { title: { en: "Define delivery and resources", es: "Definir entrega y recursos" }, body: { en: "Select the workflow, planned tasks, team assignments, planned hours, and deliverable expectations for each scope item.", es: "Seleccione flujo, tareas, asignaciones, horas y entregables esperados para cada partida." } },
      { title: { en: "Review and activate", es: "Revisar y activar" }, body: { en: "Resolve missing required fields, review the activation summary, and activate. Activation creates the controlled operational baseline without deleting the source documents.", es: "Resuelva campos obligatorios, revise el resumen y active. La activación crea la línea operativa controlada sin eliminar los documentos de origen." } },
    ],
    result: { en: "The negotiated job becomes an activated scope, resource, task, and workflow baseline available in Job Operations.", es: "El trabajo negociado se convierte en una línea base activa de alcance, recursos, tareas y flujo disponible en Operaciones." },
    troubleshooting: [
      { en: "If activation is unavailable, review the completion card and the highlighted missing fields.", es: "Si no puede activar, revise la tarjeta de avance y los campos faltantes resaltados." },
      { en: "A commercial feature can be unavailable while core job activation remains available.", es: "Una función comercial puede no estar disponible mientras la activación base sí lo está." },
    ], keywords: ["intake", "quotation", "contract", "scope", "hours", "ingreso", "cotización", "contrato", "alcance", "horas"],
  },
  {
    id: "job-operations", category: "command",
    title: { en: "Job Operations and work packages", es: "Operaciones y paquetes de trabajo" },
    summary: { en: "Run activated scope through assignments, actual hours, deliverables, and controlled work packages.", es: "Ejecute el alcance activado mediante asignaciones, horas reales, entregables y paquetes controlados." },
    audience: { en: "Project leaders, coordinators, and assigned members", es: "Líderes, coordinadores y miembros asignados" },
    availability: { en: "Core operations included; financial totals follow Commercial entitlements", es: "Operaciones base incluidas; los totales financieros respetan permisos Comerciales" },
    quickTip: { en: "Leaders manage assignments and packages. Assigned members update their tasks, record their own time, and link project deliverables.", es: "Los líderes administran asignaciones y paquetes. Los miembros asignados actualizan tareas, registran sus horas y vinculan entregables." },
    steps: [
      { title: { en: "Review the activated work item", es: "Revisar la partida activada" }, body: { en: "Confirm scope, planned hours, rates when entitled, workflow, resource plan, and generated tasks.", es: "Confirme alcance, horas, tarifas cuando estén habilitadas, flujo, recursos y tareas generadas." } },
      { title: { en: "Assign and update tasks", es: "Asignar y actualizar tareas" }, body: { en: "Leaders assign active project members. The responsible member updates status and whole-number progress; completed tasks become 100 percent.", es: "Los líderes asignan miembros activos. El responsable actualiza estado y progreso entero; las tareas completadas pasan a 100 por ciento." } },
      { title: { en: "Record actual hours", es: "Registrar horas reales" }, body: { en: "Select the task or assignment, work date, hours, and note. Members may record their own time; leaders can manage the team record.", es: "Seleccione tarea o asignación, fecha, horas y nota. Los miembros registran su propio tiempo; los líderes administran el registro del equipo." } },
      { title: { en: "Link deliverables", es: "Vincular entregables" }, body: { en: "Link an active file from the same project and classify it as shop drawing, submittal, deliverable, or supporting record.", es: "Vincule un archivo activo del mismo proyecto y clasifíquelo como plano de taller, submittal, entregable o soporte." } },
      { title: { en: "Create a work package", es: "Crear un paquete de trabajo" }, body: { en: "Leaders group tasks from the same activated work item, assign a project-unique code, type, responsible member, and due date.", es: "Los líderes agrupan tareas de la misma partida y asignan código único, tipo, responsable y fecha límite." } },
      { title: { en: "Control the package lifecycle", es: "Controlar el ciclo del paquete" }, body: { en: "Move the package through Draft, Internal Review, Submitted, Returned, Approved, or Cancelled. Package progress is calculated from its linked tasks; overdue and blocker summaries update automatically.", es: "Mueva el paquete por Borrador, Revisión interna, Enviado, Devuelto, Aprobado o Cancelado. El progreso se calcula desde las tareas; vencimientos y bloqueos se actualizan automáticamente." } },
      { title: { en: "Freeze the approved execution baseline", es: "Congelar la línea base de ejecución aprobada" }, body: { en: "Budget-entitled leaders freeze the current planned hours, internal cost, and billable value. Later changes create a new version and require a written reason; prior versions remain visible.", es: "Los líderes habilitados congelan horas, costo interno y valor facturable. Los cambios posteriores crean una versión nueva con justificación; las versiones anteriores permanecen visibles." } },
      { title: { en: "Explain and resolve overruns", es: "Explicar y resolver excesos" }, body: { en: "Actual hours and costs are compared with the current baseline. Every overrun requires a root cause and corrective action before management can mark the review resolved.", es: "Las horas y costos reales se comparan con la línea base vigente. Cada exceso requiere causa raíz y acción correctiva antes de cerrar la revisión." } },
      { title: { en: "Read Project Controls and forecasts", es: "Leer Control del Proyecto y pronósticos" }, body: { en: "The dashboard weights physical progress by planned task hours, calculates operational CPI from earned internal value and actual internal cost, and projects EAC, ETC, and VAC from current physical progress. Filter by scope, package, team-member scope, or risk.", es: "El panel pondera el progreso físico por horas planificadas, calcula el CPI operativo desde valor interno ganado y costo interno real, y proyecta EAC, ETC y VAC desde el progreso físico actual. Filtre por partida, paquete, alcance del miembro o riesgo." } },
      { title: { en: "Export the management view", es: "Exportar la vista gerencial" }, body: { en: "Export the visible filtered rows to CSV or use Print / PDF for a presentation-ready management view. SPI remains unavailable until the project has an approved schedule baseline; the system does not invent it.", es: "Exporte las filas filtradas visibles a CSV o use Imprimir / PDF para una vista gerencial. SPI permanece no disponible hasta que exista una línea base de cronograma aprobada; el sistema no lo inventa." } },
    ],
    result: { en: "Activated work has responsible people, actual effort, linked evidence, package status, and an immutable operational history.", es: "El trabajo activado tiene responsables, esfuerzo real, evidencia vinculada, estado del paquete e historial operativo inmutable." },
    troubleshooting: [
      { en: "A package requires at least one task from the same activated work item.", es: "Un paquete requiere al menos una tarea de la misma partida activada." },
      { en: "If another session changed a task or package, reload before saving again.", es: "Si otra sesión cambió una tarea o paquete, recargue antes de volver a guardar." },
    ], keywords: ["operations", "package", "task", "time", "deliverable", "operaciones", "paquete", "tarea", "tiempo", "entregable"],
  },
  {
    id: "rfis", category: "documents",
    title: { en: "RFIs, imports, responses, and exports", es: "RFIs, importaciones, respuestas y exportaciones" },
    summary: { en: "Create, import, track, respond to, and export Requests for Information without requiring a Procore API connection.", es: "Cree, importe, controle, responda y exporte Solicitudes de Información sin requerir conexión API con Procore." },
    audience: { en: "Project members with RFI access", es: "Miembros con acceso a RFIs" },
    availability: { en: "Core document workflow", es: "Flujo documental base" },
    quickTip: { en: "Import CSV or PDF into the active project, review the preview, resolve duplicates, then confirm. Never assume an import belongs to a different project.", es: "Importe CSV o PDF al proyecto activo, revise la vista previa, resuelva duplicados y confirme. Nunca suponga que una importación pertenece a otro proyecto." },
    steps: [
      { title: { en: "Create or import", es: "Crear o importar" }, body: { en: "Use New RFI for one record. Use Import CSV or PDF for an exported register or document package. Column detection is dynamic and does not depend on one fixed column count.", es: "Use Nueva RFI para un registro. Use Importar CSV o PDF para un registro exportado o paquete documental. La detección de columnas es dinámica y no depende de una cantidad fija." } },
      { title: { en: "Review project identity and preview", es: "Revisar identidad y vista previa" }, body: { en: "Confirm the active project, source identity, mapped fields, skipped rows, conflicts, and duplicates before committing the import.", es: "Confirme proyecto activo, identidad de origen, campos mapeados, filas omitidas, conflictos y duplicados antes de confirmar." } },
      { title: { en: "Track ball in court and dates", es: "Controlar responsable y fechas" }, body: { en: "Maintain responsible party, sent-to company, required date, status, type, references, and response history.", es: "Mantenga responsable actual, empresa destinataria, fecha requerida, estado, tipo, referencias e historial de respuestas." } },
      { title: { en: "Respond and close", es: "Responder y cerrar" }, body: { en: "Record the authoritative response, attachments, responder, date, and resulting status. Preserve the history rather than replacing earlier responses.", es: "Registre respuesta autorizada, adjuntos, responsable, fecha y estado resultante. Conserve el historial en lugar de reemplazar respuestas anteriores." } },
      { title: { en: "Export governed records", es: "Exportar registros controlados" }, body: { en: "Use Print PDF, individual PDF or Word exports, and the filtered RFI register export. Confirm report settings and visible filters first.", es: "Use Imprimir PDF, exportaciones individuales PDF o Word y el registro filtrado. Confirme configuración y filtros visibles primero." } },
    ],
    result: { en: "RFIs become native BIMLog records with searchable status, responsibility, history, and governed exports.", es: "Las RFIs se convierten en registros nativos con estado, responsabilidad, historial y exportaciones controladas." },
    troubleshooting: [
      { en: "If import fails, verify the source file is CSV or PDF, belongs to the active project, and contains recognizable RFI fields.", es: "Si falla la importación, verifique que sea CSV o PDF, corresponda al proyecto activo y contenga campos reconocibles." },
      { en: "Use the import preview instead of modifying production records to make a source file fit.", es: "Use la vista previa en lugar de modificar registros productivos para adaptar un archivo." },
    ], keywords: ["rfi", "csv", "pdf", "procore", "import", "ball in court", "importar", "responsable"],
  },
  {
    id: "submittals-transmittals", category: "documents",
    title: { en: "Submittals and transmittals", es: "Submittals y transmittals" },
    summary: { en: "Control review packages, revisions, due dates, formal delivery records, and acknowledgements.", es: "Controle paquetes de revisión, revisiones, fechas, entregas formales y acuses de recibo." },
    audience: { en: "Document controllers, coordinators, and reviewers", es: "Controladores documentales, coordinadores y revisores" },
    availability: { en: "Core document workflows", es: "Flujos documentales base" },
    quickTip: { en: "A submittal controls review and disposition. A transmittal records what was formally sent, to whom, when, and whether it was acknowledged.", es: "Un submittal controla revisión y resultado. Un transmittal registra qué se envió formalmente, a quién, cuándo y si fue recibido." },
    steps: [
      { title: { en: "Create the record", es: "Crear el registro" }, body: { en: "Enter title, specification or discipline, revision, responsible reviewer, dates, distribution, and linked files.", es: "Ingrese título, especificación o disciplina, revisión, responsable, fechas, distribución y archivos vinculados." } },
      { title: { en: "Control review", es: "Controlar revisión" }, body: { en: "Update status, review comments, disposition, response dates, and resubmission requirements without erasing previous revisions.", es: "Actualice estado, comentarios, resultado, fechas y requisitos de reenvío sin borrar revisiones anteriores." } },
      { title: { en: "Issue a transmittal", es: "Emitir un transmittal" }, body: { en: "Select the records and recipients, verify the purpose and attachments, then preserve the issued delivery record and acknowledgement state.", es: "Seleccione registros y destinatarios, verifique propósito y adjuntos, y conserve el registro emitido y su acuse." } },
    ],
    result: { en: "Review and formal delivery remain traceable by revision, recipient, date, and disposition.", es: "La revisión y entrega formal permanecen trazables por revisión, destinatario, fecha y resultado." },
    troubleshooting: [{ en: "If a linked file is missing, confirm that it is active in the same project.", es: "Si falta un archivo vinculado, confirme que esté activo en el mismo proyecto." }],
    keywords: ["submittal", "transmittal", "review", "revision", "submission", "revisión", "revisión", "entrega"],
  },
  {
    id: "changes-meetings", category: "documents",
    title: { en: "Change orders and meetings", es: "Órdenes de cambio y reuniones" },
    summary: { en: "Preserve change records, meeting minutes, decisions, attendees, and action items inside the project history.", es: "Conserve cambios, minutas, decisiones, asistentes y acciones dentro del historial del proyecto." },
    audience: { en: "Project teams", es: "Equipos de proyecto" },
    availability: { en: "Core document workflows; AI-assisted transcription requires configured provider access", es: "Flujos base; la transcripción asistida requiere proveedor configurado" },
    quickTip: { en: "Record decisions and assignments at the source. A meeting note is useful only when owners, dates, and actions are explicit.", es: "Registre decisiones y asignaciones en su origen. Una minuta es útil cuando responsables, fechas y acciones son explícitos." },
    steps: [
      { title: { en: "Create the authoritative record", es: "Crear el registro autorizado" }, body: { en: "For changes, record scope, reason, status, cost or schedule effect when known, and linked evidence. For meetings, record title, date, attendees, agenda, discussion, decisions, and actions.", es: "Para cambios, registre alcance, razón, estado, efecto conocido y evidencia. Para reuniones, registre título, fecha, asistentes, agenda, discusión, decisiones y acciones." } },
      { title: { en: "Assign and follow up", es: "Asignar y dar seguimiento" }, body: { en: "Every action should have an owner, due date, and status. Link related RFIs, submittals, files, or change records when available.", es: "Cada acción debe tener responsable, fecha y estado. Vincule RFIs, submittals, archivos o cambios relacionados cuando existan." } },
      { title: { en: "Use transcription carefully", es: "Usar transcripción con cuidado" }, body: { en: "AI-assisted transcription can propose structured content, but a user must review names, decisions, dates, and commitments before saving.", es: "La transcripción asistida puede proponer contenido, pero un usuario debe revisar nombres, decisiones, fechas y compromisos antes de guardar." } },
    ],
    result: { en: "Project decisions, changes, and assigned follow-up remain searchable and accountable.", es: "Las decisiones, cambios y seguimientos permanecen buscables y responsables." },
    troubleshooting: [{ en: "Do not treat an AI transcription as accepted minutes until a responsible user reviews it.", es: "No trate una transcripción de IA como minuta aceptada hasta que un responsable la revise." }],
    keywords: ["change order", "meeting", "minutes", "action", "cambio", "reunión", "minuta", "acción"],
  },
  {
    id: "planning", category: "planning",
    title: { en: "Schedule and clash coordination", es: "Cronograma y coordinación de interferencias" },
    summary: { en: "Review planning records, schedule context, clash reports, responsibility, and follow-up.", es: "Revise planificación, contexto del cronograma, reportes de interferencias, responsabilidad y seguimiento." },
    audience: { en: "Planners, BIM coordinators, and project leaders", es: "Planificadores, coordinadores BIM y líderes" },
    availability: { en: "Depends on the project planning and model inputs", es: "Depende de los insumos de planificación y modelo" },
    quickTip: { en: "Planning accuracy depends on realistic source dates and dependencies. BIMLog should not invent missing client or contractor planning variables.", es: "La precisión depende de fechas y dependencias realistas. BIMLog no debe inventar variables faltantes del cliente o contratistas." },
    steps: [
      { title: { en: "Load the source planning record", es: "Cargar el registro de planificación" }, body: { en: "Use the project schedule or approved planning input. Confirm calendars, milestones, dependencies, and source revision.", es: "Use el cronograma o insumo aprobado. Confirme calendarios, hitos, dependencias y revisión de origen." } },
      { title: { en: "Review clashes", es: "Revisar interferencias" }, body: { en: "Open clash reports, verify model context and viewpoints, classify responsibility, and assign follow-up without replacing the originating model evidence.", es: "Abra reportes, verifique contexto y viewpoints, clasifique responsabilidad y asigne seguimiento sin reemplazar la evidencia del modelo." } },
      { title: { en: "Connect follow-up records", es: "Conectar registros de seguimiento" }, body: { en: "Create or link the appropriate RFI, task, meeting action, file, or package so planning issues become executable work.", es: "Cree o vincule la RFI, tarea, acción, archivo o paquete apropiado para convertir problemas en trabajo ejecutable." } },
    ],
    result: { en: "Planning and clash information has an explicit source, responsible party, and follow-up path.", es: "La planificación e interferencias tienen origen, responsable y seguimiento explícitos." },
    troubleshooting: [{ en: "SPI is not reliable when the approved baseline does not represent the actual executable plan.", es: "El SPI no es confiable cuando la línea base aprobada no representa el plan ejecutable real." }],
    keywords: ["schedule", "clash", "spi", "planning", "cronograma", "interferencia", "planificación"],
  },
  {
    id: "commercial-overview", category: "commercial",
    title: { en: "Commercial access and feature packages", es: "Acceso Comercial y paquetes de funciones" },
    summary: { en: "Understand user-level Commercial entitlements, package access, and the difference between project membership and paid capabilities.", es: "Comprenda permisos Comerciales por usuario, acceso por paquete y la diferencia entre membresía y funciones pagadas." },
    audience: { en: "All users; configuration is restricted to Super Administrators", es: "Todos los usuarios; la configuración corresponde a Super Administradores" },
    availability: { en: "Feature dependent", es: "Depende de la función" },
    quickTip: { en: "Project membership identifies where a user works. Commercial entitlements identify which paid financial capabilities that user may open across authorized projects.", es: "La membresía identifica dónde trabaja el usuario. Los permisos Comerciales identifican qué capacidades financieras pagadas puede abrir en sus proyectos autorizados." },
    steps: [
      { title: { en: "Confirm project access", es: "Confirmar acceso al proyecto" }, body: { en: "A user must first have an authorized relationship with the project. Entitlement does not create project membership.", es: "El usuario primero debe tener relación autorizada con el proyecto. El permiso comercial no crea membresía." } },
      { title: { en: "Confirm the enabled capability", es: "Confirmar la capacidad habilitada" }, body: { en: "Commercial may be enabled as a complete package or by individual capability: Project Budget, Contracts & Commitments, or Cost & Value Planner.", es: "Comercial puede habilitarse como paquete completo o por capacidad: Presupuesto, Contratos y Compromisos o Planificador de Costos y Valor." } },
      { title: { en: "Manage from Total Control", es: "Administrar desde Control Total" }, body: { en: "A Super Administrator turns the capability on or off for the user. Changes are audited and do not rewrite project records.", es: "Un Super Administrador activa o desactiva la capacidad para el usuario. Los cambios se auditan y no reescriben registros del proyecto." } },
    ],
    result: { en: "Users see only the commercial capabilities enabled for them while remaining limited to authorized projects.", es: "Los usuarios ven las capacidades habilitadas y permanecen limitados a proyectos autorizados." },
    troubleshooting: [{ en: "A 'Project not found' message indicates project resolution or membership, not necessarily a Commercial entitlement problem.", es: "El mensaje 'Proyecto no encontrado' indica resolución o membresía, no necesariamente un problema de permiso Comercial." }],
    keywords: ["commercial", "entitlement", "total control", "package", "comercial", "permiso", "control total", "paquete"],
  },
  {
    id: "budget-contracts", category: "commercial",
    title: { en: "Project Budget and Contracts & Commitments", es: "Presupuesto y Contratos y Compromisos" },
    summary: { en: "Create governed project budgets, cost structures, contract items, commitments, amendments, and exports.", es: "Cree presupuestos, estructuras de costo, partidas contractuales, compromisos, enmiendas y exportaciones controladas." },
    audience: { en: "Users with the corresponding Commercial capabilities", es: "Usuarios con las capacidades Comerciales correspondientes" },
    availability: { en: "Paid à-la-carte capabilities or complete Commercial package", es: "Capacidades pagadas individuales o paquete Comercial completo" },
    quickTip: { en: "Budget plans internal financial control. Contracts & Commitments preserve external commercial obligations. Do not treat one as a replacement for the other.", es: "Presupuesto controla finanzas internas. Contratos y Compromisos conserva obligaciones externas. Uno no sustituye al otro." },
    steps: [
      { title: { en: "Define the cost structure", es: "Definir la estructura de costos" }, body: { en: "Create controlled cost categories and codes before entering budget lines. Use stable identifiers and preserve version history.", es: "Cree categorías y códigos antes de ingresar partidas. Use identificadores estables y conserve versiones." } },
      { title: { en: "Create and revise the budget", es: "Crear y revisar el presupuesto" }, body: { en: "Enter quantities, units, rates, amounts, responsible parties, and notes. Save controlled versions and use history or snapshots to compare changes.", es: "Ingrese cantidades, unidades, tarifas, importes, responsables y notas. Guarde versiones y use historial o snapshots para comparar." } },
      { title: { en: "Create contract items", es: "Crear partidas contractuales" }, body: { en: "Record contract identity, parties, scope items, values, dates, and supporting references. Activate only after review.", es: "Registre identidad, partes, alcance, valores, fechas y referencias. Active solamente después de revisar." } },
      { title: { en: "Track commitments and amendments", es: "Controlar compromisos y enmiendas" }, body: { en: "Preserve the original baseline. Add commitments, approved amendments, and status changes as controlled records rather than overwriting history.", es: "Conserve la línea original. Agregue compromisos, enmiendas aprobadas y cambios como registros controlados sin sobrescribir historial." } },
      { title: { en: "Export and verify", es: "Exportar y verificar" }, body: { en: "Use the available Excel or governed report exports and verify totals, version, project identity, and generated date before distribution.", es: "Use exportaciones Excel o reportes disponibles y verifique totales, versión, proyecto y fecha antes de distribuir." } },
    ],
    result: { en: "The project has versioned internal budgets and traceable external commitments.", es: "El proyecto tiene presupuestos internos versionados y compromisos externos trazables." },
    troubleshooting: [{ en: "If financial access is denied, verify both active project access and the specific user-level capability.", es: "Si se niega acceso financiero, verifique acceso activo al proyecto y la capacidad específica del usuario." }],
    keywords: ["budget", "contract", "commitment", "amendment", "presupuesto", "contrato", "compromiso", "enmienda"],
  },
  {
    id: "cost-value-planner", category: "commercial",
    title: { en: "Cost & Value Planner", es: "Planificador de Costos y Valor" },
    summary: { en: "Plan value allocation, record performance, and create deterministic forecasts from approved project data.", es: "Planifique distribución de valor, registre desempeño y cree pronósticos deterministas desde datos aprobados." },
    audience: { en: "Users with Cost & Value Planner access", es: "Usuarios con acceso al Planificador de Costos y Valor" },
    availability: { en: "Paid à-la-carte capability or Commercial package", es: "Capacidad pagada individual o paquete Comercial" },
    quickTip: { en: "Amounts and percentages are two views of the same allocation. Enter the preferred view and BIMLog calculates the other using two-decimal financial rounding.", es: "Importes y porcentajes son dos vistas de la misma distribución. Ingrese la vista preferida y BIMLog calcula la otra con redondeo financiero de dos decimales." },
    steps: [
      { title: { en: "Define the value foundation", es: "Definir la base de valor" }, body: { en: "Enter template name, currency, selling price, and fixed company cost. Net distributable value is selling price minus fixed company cost.", es: "Ingrese nombre, moneda, precio de venta y costo fijo. El valor neto distribuible es precio menos costo fijo." } },
      { title: { en: "Allocate net value", es: "Distribuir el valor neto" }, body: { en: "Allocate Labor Operating Pool, Project Incentive Reserve, and Project Earnings. Percentages and amounts remain synchronized; the final allocation must balance.", es: "Distribuya Fondo Laboral, Reserva de Incentivos y Ganancia del Proyecto. Porcentajes e importes se sincronizan y el total debe balancear." } },
      { title: { en: "Split labor", es: "Dividir mano de obra" }, body: { en: "Divide labor between Direct Production Labor and Project Administrative Labor, then distribute direct production by phases and administration by budget lines.", es: "Divida entre Mano de Obra de Producción Directa y Administrativa, luego distribuya producción por fases y administración por partidas." } },
      { title: { en: "Connect rates and hours", es: "Conectar tarifas y horas" }, body: { en: "Use billing hourly rate and planned hours to connect the negotiated selling value to executable scope. Maintain internal hourly cost separately for margin analysis.", es: "Use tarifa facturable y horas planificadas para conectar valor negociado y alcance ejecutable. Mantenga costo interno separado para analizar margen." } },
      { title: { en: "Save a balanced plan", es: "Guardar un plan balanceado" }, body: { en: "Resolve every balance message, then save. Reload to confirm the exact version persisted. Use reset, delete, templates, and exports only through their visible controlled actions.", es: "Resuelva cada mensaje de balance y guarde. Recargue para confirmar la versión. Use reinicio, eliminación, plantillas y exportaciones mediante acciones visibles." } },
      { title: { en: "Record performance and forecast", es: "Registrar desempeño y pronosticar" }, body: { en: "Module 2 records approved performance inputs and CPI context. Module 3 Layer 1 generates a deterministic forecast tied to the saved plan and performance version; it does not invent missing facts.", es: "Módulo 2 registra desempeño aprobado y contexto CPI. Módulo 3 Capa 1 genera pronóstico determinista ligado al plan y desempeño guardados; no inventa datos faltantes." } },
    ],
    result: { en: "The project has a versioned plan, performance record, and explainable forecast connected through rates and hours.", es: "El proyecto tiene plan, desempeño y pronóstico explicable y versionado conectado por tarifas y horas." },
    troubleshooting: [
      { en: "Save remains disabled until required allocations balance to the displayed target.", es: "Guardar permanece deshabilitado hasta que las distribuciones balanceen con el objetivo mostrado." },
      { en: "CPI above 1 indicates favorable cost performance; bonus rules still require an approved company policy and authoritative inputs.", es: "CPI mayor que 1 indica desempeño favorable; las reglas de bono requieren política aprobada e insumos autorizados." },
    ], keywords: ["apu", "cost value", "percentage", "hourly rate", "cpi", "forecast", "costos", "valor", "porcentaje", "tarifa", "pronóstico"],
  },
  {
    id: "insights-reports", category: "insights",
    title: { en: "Insights, reports, and exports", es: "Inteligencia, informes y exportaciones" },
    summary: { en: "Understand trends and generate governed project outputs from current records and visible filters.", es: "Comprenda tendencias y genere salidas controladas desde registros actuales y filtros visibles." },
    audience: { en: "Authorized project users", es: "Usuarios autorizados" },
    availability: { en: "Varies by report and feature", es: "Varía según informe y función" },
    quickTip: { en: "Insights explain; Command Center acts. Confirm filters, project, version, and report settings before exporting.", es: "Inteligencia explica; Centro de Control actúa. Confirme filtros, proyecto, versión y configuración antes de exportar." },
    steps: [
      { title: { en: "Select the question", es: "Seleccionar la pregunta" }, body: { en: "Choose the relevant view: trends, compliance, aging, bottlenecks, responsibility, financial performance, or workflow status.", es: "Elija la vista: tendencias, cumplimiento, antigüedad, cuellos de botella, responsabilidad, desempeño financiero o estado." } },
      { title: { en: "Apply and verify filters", es: "Aplicar y verificar filtros" }, body: { en: "Review status, type, date, company, responsibility, and sort filters. Visible filters define many exports.", es: "Revise estado, tipo, fecha, empresa, responsabilidad y orden. Los filtros visibles definen muchas exportaciones." } },
      { title: { en: "Generate the output", es: "Generar la salida" }, body: { en: "Use the available PDF, Word, CSV, or Excel action. Verify title, project identity, timestamps, totals, pages, and included records before sending.", es: "Use la acción PDF, Word, CSV o Excel disponible. Verifique título, proyecto, fecha, totales, páginas y registros antes de enviar." } },
    ],
    result: { en: "The exported record represents the selected project state and filters at generation time.", es: "El registro exportado representa el estado y filtros seleccionados al generarse." },
    troubleshooting: [{ en: "If an export is empty, clear filters and confirm that the project contains matching records.", es: "Si una exportación está vacía, limpie filtros y confirme registros coincidentes." }],
    keywords: ["insights", "reports", "export", "pdf", "excel", "informes", "exportar"],
  },
  {
    id: "directory-administration", category: "admin",
    title: { en: "Directory, team, naming, and administration", es: "Directorio, equipo, nombres y administración" },
    summary: { en: "Manage project people, roles, contacts, naming tools, feature visibility, and authorized administrative controls.", es: "Administre personas, roles, contactos, nombres, visibilidad y controles administrativos autorizados." },
    audience: { en: "All users for viewing; administrators for controlled changes", es: "Todos para consulta; administradores para cambios controlados" },
    availability: { en: "Role dependent", es: "Depende del rol" },
    quickTip: { en: "Directory stores project contacts; Team controls platform membership and roles. They are related but not interchangeable.", es: "Directorio almacena contactos; Equipo controla membresía y roles. Se relacionan, pero no son intercambiables." },
    steps: [
      { title: { en: "Maintain the directory", es: "Mantener el directorio" }, body: { en: "Review companies, contacts, disciplines, communication details, and project relationships. Avoid duplicate people and companies.", es: "Revise empresas, contactos, disciplinas, datos y relaciones. Evite duplicar personas y empresas." } },
      { title: { en: "Manage active members", es: "Administrar miembros activos" }, body: { en: "Administrators invite users, assign the least necessary role, and deactivate access when the project relationship ends.", es: "Los administradores invitan usuarios, asignan el rol mínimo y desactivan acceso cuando termina la relación." } },
      { title: { en: "Configure naming", es: "Configurar nombres" }, body: { en: "Use Convention Builder to define controlled fields and Name Generator to assemble compliant names from the active convention.", es: "Use Constructor de Convenciones para campos controlados y Generador para ensamblar nombres conformes." } },
      { title: { en: "Use administrative surfaces", es: "Usar superficies administrativas" }, body: { en: "Headquarters administrators manage projects and settings. Super Administrators use Total Control for platform-wide users, companies, projects, feature entitlements, and audited controls.", es: "Administradores gestionan proyectos y configuración. Super Administradores usan Control Total para usuarios, empresas, proyectos, permisos y controles auditados." } },
    ],
    result: { en: "People, permissions, project relationships, and naming configuration remain controlled and understandable.", es: "Personas, permisos, relaciones y configuración de nombres permanecen controlados y comprensibles." },
    troubleshooting: [{ en: "Do not solve a missing feature by changing project roles; verify the separate feature entitlement.", es: "No resuelva una función faltante cambiando roles; verifique el permiso de función por separado." }],
    keywords: ["directory", "team", "role", "convention", "total control", "directorio", "equipo", "rol", "convención"],
  },
  {
    id: "integrations", category: "integrations",
    title: { en: "Integrations and Sync Agent", es: "Integraciones y Sync Agent" },
    summary: { en: "Understand approved connectors, local validation tools, imports, and the boundary between BIMLog records and external systems.", es: "Comprenda conectores aprobados, herramientas locales, importaciones y el límite entre BIMLog y sistemas externos." },
    audience: { en: "Authorized users and administrators", es: "Usuarios y administradores autorizados" },
    availability: { en: "Connector and plan dependent", es: "Depende del conector y plan" },
    quickTip: { en: "An import is not a live integration. BIMLog can import exported CSV or PDF records without granting continuous API access to the external platform.", es: "Una importación no es una integración viva. BIMLog puede importar CSV o PDF exportados sin otorgar acceso API continuo." },
    steps: [
      { title: { en: "Choose import or connector", es: "Elegir importación o conector" }, body: { en: "Use file import for controlled snapshots such as exported RFI registers. Use a connector only when the provider, customer, scope, and credentials are explicitly approved.", es: "Use importación para snapshots como registros RFI. Use conector solo cuando proveedor, cliente, alcance y credenciales estén aprobados." } },
      { title: { en: "Review the governed catalog", es: "Revisar el catálogo controlado" }, body: { en: "The Integrations page shows availability and required setup. Do not send passwords, tokens, or API keys in ordinary requests.", es: "La página Integraciones muestra disponibilidad y requisitos. No envíe contraseñas, tokens o claves en solicitudes ordinarias." } },
      { title: { en: "Use Sync Agent", es: "Usar Sync Agent" }, body: { en: "The desktop agent watches a selected folder and submits supported files for BIMLog validation. It does not imply uncontrolled external delivery.", es: "El agente de escritorio observa una carpeta y envía archivos compatibles para validación. No implica entrega externa sin control." } },
    ],
    result: { en: "External data enters BIMLog through an explicit, reviewable boundary.", es: "Los datos externos entran a BIMLog por un límite explícito y revisable." },
    troubleshooting: [{ en: "If a connector is unavailable, use the supported export/import workflow instead of sharing credentials.", es: "Si un conector no está disponible, use exportación/importación en lugar de compartir credenciales." }],
    keywords: ["integration", "sync", "api", "csv", "pdf", "integración", "sincronización", "importación"],
  },
];

export const HELP_TROUBLESHOOTING: Array<{ title: HelpText; body: HelpText; topicId: string }> = [
  { title: { en: "A button is disabled", es: "Un botón está deshabilitado" }, body: { en: "Review highlighted required fields, balance messages, active membership, record status, and the specific feature entitlement. Disabled actions should identify what remains.", es: "Revise campos obligatorios, mensajes de balance, membresía activa, estado y permiso de función. Las acciones deshabilitadas deben indicar lo pendiente." }, topicId: "getting-started" },
  { title: { en: "Financial access denied", es: "Acceso financiero denegado" }, body: { en: "Confirm that the project exists for the active account, the user is authorized for that project, and the specific Commercial capability is enabled for the user.", es: "Confirme que el proyecto exista para la cuenta activa, que el usuario esté autorizado y que la capacidad Comercial esté habilitada." }, topicId: "commercial-overview" },
  { title: { en: "Save does not work", es: "Guardar no funciona" }, body: { en: "Read the on-screen validation message, complete required fields, resolve allocation differences, and retry. If another session changed the record, reload first.", es: "Lea el mensaje, complete campos, resuelva diferencias y reintente. Si otra sesión cambió el registro, recargue primero." }, topicId: "cost-value-planner" },
  { title: { en: "Import failed", es: "Falló la importación" }, body: { en: "Verify file type, active project, source identity, recognizable headers or document structure, size limits, and duplicate/conflict results shown in preview.", es: "Verifique tipo, proyecto, identidad, encabezados o estructura reconocible, límites y duplicados o conflictos de la vista previa." }, topicId: "rfis" },
  { title: { en: "Data did not appear after reload", es: "Los datos no aparecen después de recargar" }, body: { en: "Confirm that Save completed successfully and that you reopened the same project and record version. Do not re-enter data until checking the visible notice and history.", es: "Confirme que Guardar terminó y que abrió el mismo proyecto y versión. No reingrese datos sin revisar aviso e historial." }, topicId: "job-operations" },
  { title: { en: "Export is empty or incomplete", es: "La exportación está vacía o incompleta" }, body: { en: "Confirm current filters, visible records, report settings, project identity, and feature access before generating it again.", es: "Confirme filtros, registros visibles, configuración, proyecto y acceso antes de generar nuevamente." }, topicId: "insights-reports" },
];

export const HELP_RELEASES: Array<{ title: HelpText; body: HelpText; topicId: string }> = [
  { title: { en: "Job Intake & Setup", es: "Ingreso y Configuración del Trabajo" }, body: { en: "Negotiated source documents can become an activated operational baseline with scope, hours, rates, contracts, workflows, and resources.", es: "Documentos negociados pueden convertirse en línea operativa con alcance, horas, tarifas, contratos, flujos y recursos." }, topicId: "job-intake" },
  { title: { en: "Job Operations", es: "Operaciones del Trabajo" }, body: { en: "Activated tasks support assignments, actual hours, deliverable links, progress, and entitlement-aware financial totals.", es: "Las tareas activadas permiten asignaciones, horas reales, entregables, progreso y totales financieros según permisos." }, topicId: "job-operations" },
  { title: { en: "Controlled work packages", es: "Paquetes de trabajo controlados" }, body: { en: "Project leaders can group tasks into responsible, due-dated packages with automatic progress, blockers, overdue state, and lifecycle history.", es: "Los líderes agrupan tareas en paquetes con responsable, fecha, progreso automático, bloqueos, vencimiento e historial." }, topicId: "job-operations" },
  { title: { en: "Budget Governance & Change Control", es: "Gobernanza del Presupuesto y Control de Cambios" }, body: { en: "Approved execution baselines are versioned, actual performance is compared automatically, and overruns require documented causes and corrective actions.", es: "Las líneas base aprobadas se versionan, el desempeño real se compara automáticamente y los excesos requieren causas y acciones correctivas documentadas." }, topicId: "job-operations" },
  { title: { en: "Project Controls Dashboard & Forecast", es: "Panel de Control y Pronóstico del Proyecto" }, body: { en: "Operational progress now drives CPI, EAC, ETC, VAC, remaining hours, remaining budget, risk alerts, filtered management views, CSV export, and Print / PDF. SPI remains unavailable until an approved schedule baseline exists.", es: "El progreso operativo alimenta CPI, EAC, ETC, VAC, horas y presupuesto restantes, alertas, filtros, CSV e Imprimir / PDF. SPI permanece no disponible hasta existir una línea base de cronograma aprobada." }, topicId: "job-operations" },
  { title: { en: "Cost & Value planning, performance, and forecasting", es: "Planificación, desempeño y pronóstico de Costos y Valor" }, body: { en: "Versioned value allocation, hourly-rate planning, performance context, and deterministic forecast layers are available to entitled users.", es: "Distribución versionada, planificación por tarifa, contexto de desempeño y pronóstico determinista están disponibles para usuarios habilitados." }, topicId: "cost-value-planner" },
  { title: { en: "RFI CSV and PDF import", es: "Importación RFI CSV y PDF" }, body: { en: "Exported RFI records can be reviewed and imported into BIMLog without a continuous Procore API connection.", es: "Registros RFI exportados pueden revisarse e importarse sin conexión API continua con Procore." }, topicId: "rfis" },
];

export const HELP_CONTEXT_ALIASES: Record<string, string> = {
  dashboard: "getting-started", "command-center": "command-center", coordination: "coordination-files", files: "coordination-files", activity: "coordination-files",
  intake: "job-intake", operations: "job-operations", rfis: "rfis", submittals: "submittals-transmittals", "submittal-tracker": "submittals-transmittals", transmittals: "submittals-transmittals",
  "change-orders": "changes-meetings", meetings: "changes-meetings", schedule: "planning", "clash-reports": "planning", budget: "budget-contracts", contracts: "budget-contracts", apu: "cost-value-planner",
  analytics: "insights-reports", reports: "insights-reports", directory: "directory-administration", team: "directory-administration", generator: "directory-administration", convention: "directory-administration",
  integrations: "integrations", "sync-agent": "integrations",
};

export function helpTopicForContext(context: string | null | undefined) {
  const topicId = HELP_CONTEXT_ALIASES[String(context ?? "")] ?? String(context ?? "");
  return HELP_TOPICS.find((topic) => topic.id === topicId) ?? HELP_TOPICS[0];
}
