export type ProjectHomePhase = {
  key: "setup" | "start" | "work" | "results";
  state: "complete" | "current" | "upcoming";
  labelEn: string;
  labelEs: string;
};

export function projectHomePhases(status?: string): ProjectHomePhase[] {
  const active = status === "activated";
  const ready = status === "ready";
  return [
    { key: "setup", state: active || ready ? "complete" : "current", labelEn: "Set up", labelEs: "Configurar" },
    { key: "start", state: active ? "complete" : ready ? "current" : "upcoming", labelEn: "Start", labelEs: "Iniciar" },
    { key: "work", state: active ? "current" : "upcoming", labelEn: "Do the work", labelEs: "Ejecutar" },
    { key: "results", state: "upcoming", labelEn: "Review results", labelEs: "Revisar resultados" },
  ];
}
