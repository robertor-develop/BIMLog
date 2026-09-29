export const experienceSpacing = Object.freeze({
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2rem",
});

export type ExperienceStatus = "neutral" | "info" | "success" | "warning" | "danger";

export const experienceStatus = Object.freeze({
  neutral: { label: "Not started", labelEs: "Sin iniciar", className: "experience-status-neutral" },
  info: { label: "In progress", labelEs: "En curso", className: "experience-status-info" },
  success: { label: "Ready", labelEs: "Listo", className: "experience-status-success" },
  warning: { label: "Needs attention", labelEs: "Requiere atención", className: "experience-status-warning" },
  danger: { label: "Blocked", labelEs: "Bloqueado", className: "experience-status-danger" },
} satisfies Record<ExperienceStatus, { label: string; labelEs: string; className: string }>);

export function statusPresentation(status: ExperienceStatus, spanish = false) {
  const item = experienceStatus[status];
  return { ...item, label: spanish ? item.labelEs : item.label };
}
