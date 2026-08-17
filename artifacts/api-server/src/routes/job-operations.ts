import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import {
  addJobOperationTime,
  createJobBudgetBaseline,
  createJobBudgetVarianceReview,
  createJobOperationPackage,
  getJobOperations,
  linkJobOperationDocumentConnection,
  linkJobOperationDeliverable,
  reassignJobOperationResource,
  unlinkJobOperationDocumentConnection,
  unlinkJobOperationDeliverable,
  updateJobOperationPackage,
  updateJobOperationTask,
  updateJobBudgetVarianceReview,
} from "../lib/job-operations-service";

const router = Router();
router.use("/projects/:projectId/operations", authMiddleware);

const errorEs: Record<string, string> = {
  JOB_OPERATIONS_COMPANY_MISMATCH: "El proyecto pertenece a otra empresa.",
  JOB_OPERATIONS_DOCUMENT_TARGET_TYPE_INVALID: "El tipo de destino de la conexión no es válido.",
  JOB_OPERATIONS_DOCUMENT_ENTITY_TYPE_INVALID: "El tipo de documento de la conexión no es válido.",
  JOB_OPERATIONS_DOCUMENT_ENTITY_NOT_FOUND: "No se encontró el documento canónico en este proyecto.",
  JOB_OPERATIONS_DOCUMENT_CONNECTION_NOT_FOUND: "No se encontró la conexión del documento.",
  JOB_OPERATIONS_DOCUMENT_CONNECTION_DENIED: "No tiene permiso para administrar esta conexión.",
  JOB_OPERATIONS_DOCUMENT_TARGET_STALE: "La tarea o el paquete seleccionado ya no está activo.",
  JOB_OPERATIONS_DOCUMENT_CONNECTION_STALE: "El documento canónico conectado ya no está disponible.",
  JOB_OPERATIONS_DOCUMENT_CONNECTION_ID_CONFLICT: "El identificador de la conexión ya pertenece a otra solicitud.",
  JOB_OPERATIONS_DOCUMENT_CONNECTION_CONFLICT: "La conexión cambió en otra sesión. Recargue antes de guardar.",
  JOB_OPERATIONS_PROJECT_NOT_FOUND: "No se encontró el proyecto.",
  JOB_OPERATIONS_MEMBERSHIP_REQUIRED: "Debe ser miembro activo del proyecto.",
  JOB_OPERATIONS_TASK_NOT_FOUND: "No se encontró la tarea.",
  JOB_OPERATIONS_TASK_CONTROL_DENIED: "Solamente el líder del proyecto o los miembros asignados pueden actualizar esta tarea.",
  JOB_OPERATIONS_REASSIGN_DENIED: "Solamente el líder del proyecto puede reasignar recursos.",
  JOB_OPERATIONS_ASSIGNEE_INVALID: "La persona asignada debe ser miembro activo del proyecto.",
  JOB_OPERATIONS_ASSIGNMENT_INVALID: "La asignación seleccionada no corresponde a esta tarea.",
  JOB_OPERATIONS_TIME_DENIED: "Los miembros del equipo solamente pueden registrar sus propias horas.",
  JOB_OPERATIONS_FILE_INVALID: "Seleccione un archivo activo de este proyecto.",
  JOB_OPERATIONS_DELIVERABLE_DENIED: "Solamente el líder del proyecto o el miembro asignado puede administrar este entregable.",
  JOB_OPERATIONS_DELIVERABLE_NOT_FOUND: "No se encontró el vínculo del entregable.",
  JOB_OPERATIONS_WORK_ITEM_NOT_FOUND: "No se encontró la partida de trabajo activada.",
  JOB_OPERATIONS_PACKAGE_NOT_FOUND: "No se encontró el paquete de trabajo.",
  JOB_OPERATIONS_PACKAGE_MANAGE_DENIED: "Solamente el líder del proyecto puede definir paquetes de trabajo.",
  JOB_OPERATIONS_PACKAGE_CONTROL_DENIED: "Solamente el líder del proyecto o la persona responsable puede actualizar este paquete.",
  JOB_OPERATIONS_PACKAGE_CODE_CONFLICT: "El código del paquete ya existe en este proyecto.",
  JOB_OPERATIONS_PACKAGE_TASKS_INVALID: "Seleccione tareas válidas de la misma partida activada.",
  JOB_OPERATIONS_PACKAGE_TYPE_INVALID: "El tipo de paquete no es válido.",
  JOB_OPERATIONS_PACKAGE_STATUS_INVALID: "El estado del paquete no es válido.",
  JOB_OPERATIONS_PACKAGE_TRANSITION_INVALID: "Ese cambio de estado no está permitido para el paquete.",
  JOB_OPERATIONS_STALE: "Este registro cambió en otra sesión. Recargue antes de guardar.",
  JOB_OPERATIONS_HOURS_INVALID: "Las horas deben ser mayores que cero y no pueden exceder 24.",
  JOB_OPERATIONS_DATE_INVALID: "La fecha de trabajo no es válida.",
  JOB_OPERATIONS_PROGRESS_INVALID: "El progreso debe ser un número entero de 0 a 100.",
  JOB_OPERATIONS_STATUS_INVALID: "El estado de la tarea no es válido.",
  JOB_OPERATIONS_DELIVERABLE_TYPE_INVALID: "El tipo de entregable no es válido.",
  JOB_OPERATIONS_ID_INVALID: "El identificador proporcionado no es válido.",
  JOB_OPERATIONS_TEXT_INVALID: "El texto proporcionado no es válido.",
  JOB_BUDGET_MANAGE_DENIED: "Solamente el líder del proyecto puede administrar la gobernanza del presupuesto.",
  JOB_BUDGET_INTAKE_REQUIRED: "Active el Ingreso del Trabajo antes de congelar la línea base.",
  JOB_BUDGET_ENTITLEMENT_REQUIRED: "La Gobernanza del Presupuesto requiere acceso a Presupuesto o al Planificador de Costos y Valor.",
  JOB_BUDGET_REVISION_REASON_REQUIRED: "Una revisión requiere una justificación de al menos 10 caracteres.",
  JOB_BUDGET_BASELINE_REQUIRED: "Primero congele la línea base del presupuesto de ejecución.",
  JOB_BUDGET_METRIC_INVALID: "La métrica de variación no es válida.",
  JOB_BUDGET_OVERRUN_REQUIRED: "La métrica seleccionada no excede actualmente su línea base.",
  JOB_BUDGET_REVIEW_STATUS_INVALID: "El estado de revisión no es válido.",
};

const run = (handler: (req: any, res: any) => Promise<void>) => async (req: any, res: any) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof FinancialControlError) {
      res.status(error.status).json({ code: error.code, error: { en: error.message, es: errorEs[error.code] ?? "No se pudo completar la operación." } });
      return;
    }
    console.error("[job-operations] request failed", error);
    res.status(500).json({ code: "JOB_OPERATIONS_INTERNAL_ERROR", error: { en: "Job Operations is temporarily unavailable.", es: "Las operaciones del trabajo no están disponibles temporalmente." } });
  }
};

router.get("/projects/:projectId/operations", run(async (req, res) => {
  res.json(await getJobOperations({ actorUserId: req.user.userId, projectId: req.params.projectId }));
}));
router.patch("/projects/:projectId/operations/tasks/:taskId", run(async (req, res) => {
  res.json(await updateJobOperationTask({ actorUserId: req.user.userId, projectId: req.params.projectId, taskId: req.params.taskId, expectedVersion: req.body?.expectedVersion, status: req.body?.status, progressPercent: req.body?.progressPercent, assigneeUserId: req.body?.assigneeUserId }));
}));
router.patch("/projects/:projectId/operations/assignments/:assignmentId", run(async (req, res) => {
  res.json(await reassignJobOperationResource({ actorUserId: req.user.userId, projectId: req.params.projectId, assignmentId: req.params.assignmentId, expectedVersion: req.body?.expectedVersion, userId: req.body?.userId }));
}));
router.post("/projects/:projectId/operations/time", run(async (req, res) => {
  res.status(201).json(await addJobOperationTime({ actorUserId: req.user.userId, projectId: req.params.projectId, entryId: req.body?.entryId, taskId: req.body?.taskId, assignmentId: req.body?.assignmentId, workDate: req.body?.workDate, hours: req.body?.hours, note: req.body?.note }));
}));
router.post("/projects/:projectId/operations/deliverables", run(async (req, res) => {
  res.status(201).json(await linkJobOperationDeliverable({ actorUserId: req.user.userId, projectId: req.params.projectId, linkId: req.body?.linkId, taskId: req.body?.taskId, fileId: req.body?.fileId, deliverableType: req.body?.deliverableType, note: req.body?.note }));
}));
router.delete("/projects/:projectId/operations/deliverables/:deliverableId", run(async (req, res) => {
  res.json(await unlinkJobOperationDeliverable({ actorUserId: req.user.userId, projectId: req.params.projectId, deliverableId: req.params.deliverableId }));
}));
router.post("/projects/:projectId/operations/document-connections", run(async (req, res) => {
  res.status(201).json(await linkJobOperationDocumentConnection({ actorUserId: req.user.userId, projectId: req.params.projectId, connectionId: req.body?.connectionId, targetType: req.body?.targetType, targetId: req.body?.targetId, entityType: req.body?.entityType, entityId: req.body?.entityId, note: req.body?.note }));
}));
router.delete("/projects/:projectId/operations/document-connections/:connectionId", run(async (req, res) => {
  res.json(await unlinkJobOperationDocumentConnection({ actorUserId: req.user.userId, projectId: req.params.projectId, connectionId: req.params.connectionId }));
}));
router.post("/projects/:projectId/operations/packages", run(async (req, res) => {
  res.status(201).json(await createJobOperationPackage({ actorUserId: req.user.userId, projectId: req.params.projectId, packageId: req.body?.packageId, workItemId: req.body?.workItemId, packageCode: req.body?.packageCode, title: req.body?.title, description: req.body?.description, packageType: req.body?.packageType, responsibleUserId: req.body?.responsibleUserId, dueDate: req.body?.dueDate, taskIds: req.body?.taskIds }));
}));
router.patch("/projects/:projectId/operations/packages/:packageId", run(async (req, res) => {
  res.json(await updateJobOperationPackage({ actorUserId: req.user.userId, projectId: req.params.projectId, packageId: req.params.packageId, expectedVersion: req.body?.expectedVersion, status: req.body?.status, title: req.body?.title, description: req.body?.description, packageType: req.body?.packageType, responsibleUserId: req.body?.responsibleUserId, dueDate: req.body?.dueDate, taskIds: req.body?.taskIds }));
}));
router.post("/projects/:projectId/operations/budget/baselines", run(async (req, res) => {
  res.status(201).json(await createJobBudgetBaseline({ actorUserId: req.user.userId, projectId: req.params.projectId, baselineId: req.body?.baselineId, revisionReason: req.body?.revisionReason }));
}));
router.post("/projects/:projectId/operations/budget/variance-reviews", run(async (req, res) => {
  res.status(201).json(await createJobBudgetVarianceReview({ actorUserId: req.user.userId, projectId: req.params.projectId, reviewId: req.body?.reviewId, metric: req.body?.metric, reason: req.body?.reason, correctiveAction: req.body?.correctiveAction }));
}));
router.patch("/projects/:projectId/operations/budget/variance-reviews/:reviewId", run(async (req, res) => {
  res.json(await updateJobBudgetVarianceReview({ actorUserId: req.user.userId, projectId: req.params.projectId, reviewId: req.params.reviewId, expectedVersion: req.body?.expectedVersion, status: req.body?.status }));
}));

export default router;
