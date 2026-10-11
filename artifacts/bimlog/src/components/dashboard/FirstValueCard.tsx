import { ArrowRight, FileCheck2 } from "lucide-react";
import type { FirstValueActionKind } from "@/lib/first-value-action";

const copy = {
  rfi: { en: ["Create a controlled RFI", "Record one project question, its responsible party and response path."], es: ["Cree un RFI controlado", "Registre una pregunta del proyecto, su responsable y la ruta de respuesta."] },
  submittal: { en: ["Create a controlled Submittal", "Register one deliverable package for review and status tracking."], es: ["Cree un Submittal controlado", "Registre un paquete entregable para revisión y seguimiento de estado."] },
  file: { en: ["Add a governed project file", "Upload one project file into the authorized document register."], es: ["Agregue un archivo controlado", "Cargue un archivo del proyecto en el registro documental autorizado."] },
} as const;

export function FirstValueCard({lang,kind,projectName,onOpen}:{lang:string;kind:FirstValueActionKind;projectName:string;onOpen:()=>void}){
  const locale=lang==="es"?"es":"en",[title,detail]=copy[kind][locale];
  return <section className="first-value-card" aria-labelledby="first-value-title">
    <div className="first-value-card__icon"><FileCheck2 aria-hidden size={18}/></div>
    <div><p>{locale==="es"?"PRIMER RESULTADO CONTROLADO":"FIRST CONTROLLED RESULT"}</p><h2 id="first-value-title">{title}</h2><span>{projectName} · {detail}</span></div>
    <button type="button" onClick={onOpen}>{locale==="es"?"Crear primer registro":"Create first record"}<ArrowRight aria-hidden size={16}/></button>
  </section>;
}
