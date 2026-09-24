import React, { type Dispatch, type SetStateAction } from "react";

type Props = {
  data: any;
  setData: Dispatch<SetStateAction<any>>;
  tt: (en: string, es: string) => string;
};

export function clearLegacyProjectClassification(old: any) {
  return {
    ...old,
    classification: {
      ...(old.classification ?? {}),
      serviceId: "", serviceCode: "", serviceName: "",
      phaseId: "", phaseCode: "", phaseName: "",
    },
    review: { ...(old.review ?? {}), scopeConfirmed: false },
  };
}

export function LegacyProjectClassificationNotice({ data, setData, tt }: Props) {
  const classification = data.classification ?? {};
  if (!classification.serviceId && !classification.phaseId) return null;

  const clearLegacy = () => setData(clearLegacyProjectClassification);

  return <div className="ji-missing" role="status">
    <strong>{tt("Legacy project Service/Phase selection", "Selección anterior de Servicio/Fase del proyecto")}</strong>
    <p>{tt("This saved draft contains an older project-wide selection. It is retained for review, but it will not classify new tasks. Select Service and Phase on the relevant work package or task in Advanced setup.", "Este borrador contiene una selección anterior para todo el proyecto. Se conserva para revisión, pero no clasificará tareas nuevas. Seleccione Servicio y Fase en el paquete o tarea correspondiente de Configuración avanzada.")}</p>
    <p>{[classification.serviceName || classification.serviceCode, classification.phaseName || classification.phaseCode].filter(Boolean).join(" · ")}</p>
    <button type="button" onClick={clearLegacy}>{tt("Clear legacy project selection", "Quitar selección anterior del proyecto")}</button>
  </div>;
}
