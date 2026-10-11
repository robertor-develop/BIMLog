import { ArrowRight, CircleCheckBig } from "lucide-react";
import type { FirstValueEvidence } from "@/lib/first-value-evidence";

const kindLabel={rfi:{en:"RFI",es:"RFI"},submittal:{en:"Submittal",es:"Submittal"},file:{en:"governed file",es:"archivo controlado"}} as const;

export function FirstValueSuccessCard({lang,evidence,onOpen}:{lang:string;evidence:FirstValueEvidence;onOpen:()=>void}){
  const locale=lang==="es"?"es":"en";
  return <section className="first-value-success" aria-labelledby="first-value-success-title">
    <div className="first-value-success__icon"><CircleCheckBig aria-hidden size={19}/></div>
    <div className="first-value-success__body">
      <p>{locale==="es"?"PRIMER RESULTADO LOGRADO":"FIRST RESULT ACHIEVED"}</p>
      <h2 id="first-value-success-title">{locale==="es"?"Su primer registro controlado ya forma parte de la memoria del proyecto.":"Your first controlled record is now part of the project memory."}</h2>
      <span>{evidence.projectCode} · {evidence.projectName} · {kindLabel[evidence.kind][locale]} · {evidence.label}</span>
    </div>
    <button type="button" onClick={onOpen}>{locale==="es"?"Ver resultado":"View result"}<ArrowRight aria-hidden size={16}/></button>
  </section>;
}
