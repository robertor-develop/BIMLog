export type ProjectJourneyState = "setup_not_started" | "setup_in_progress" | "ready_to_start" | "active";

export type ProjectJourneyAction = {
  state: ProjectJourneyState;
  href: string;
  labelEn: string;
  labelEs: string;
  titleEn: string;
  titleEs: string;
  detailEn: string;
  detailEs: string;
};

type IntakeSummary = { status?: string; intake?: unknown } | null | undefined;

export function projectJourneyAction(projectId: number, intake: IntakeSummary): ProjectJourneyAction {
  if (intake?.status === "activated") {
    return {
      state: "active",
      href: `/projects/${projectId}/operations`,
      labelEn: "Continue project work",
      labelEs: "Continuar el trabajo del proyecto",
      titleEn: "Run the activated job",
      titleEs: "Ejecutar el trabajo activado",
      detailEn: "Assign people when known, update progress, record hours, and connect deliverables.",
      detailEs: "Asigne personas cuando se conozcan, actualice el avance, registre horas y conecte entregables.",
    };
  }
  if (intake?.status === "ready") {
    return {
      state: "ready_to_start",
      href: `/projects/${projectId}/intake#ji-review`,
      labelEn: "Review and start project",
      labelEs: "Revisar e iniciar el proyecto",
      titleEn: "Setup is ready for final review",
      titleEs: "La configuración está lista para revisión final",
      detailEn: "Confirm the saved setup and start the project. Staffing may remain pending.",
      detailEs: "Confirme la configuración guardada e inicie el proyecto. La asignación de personal puede quedar pendiente.",
    };
  }
  if (intake?.intake === null) {
    return {
      state: "setup_not_started",
      href: `/projects/${projectId}/intake`,
      labelEn: "Start job setup",
      labelEs: "Iniciar configuración del trabajo",
      titleEn: "Set up this project",
      titleEs: "Configurar este proyecto",
      detailEn: "Confirm the customer, contract, scope, delivery plan, and estimated effort.",
      detailEs: "Confirme el cliente, contrato, alcance, plan de entrega y esfuerzo estimado.",
    };
  }
  return {
    state: "setup_in_progress",
    href: `/projects/${projectId}/intake`,
    labelEn: "Continue job setup",
    labelEs: "Continuar configuración del trabajo",
    titleEn: "Finish the saved setup",
    titleEs: "Terminar la configuración guardada",
    detailEn: "BIMLog saved your progress. Complete the remaining required setup before starting work.",
    detailEs: "BIMLog guardó su avance. Complete la configuración requerida antes de iniciar el trabajo.",
  };
}

export function projectHomePath(projectId: number) {
  return `/projects/${projectId}`;
}
