import React from "react";

function StructuredValue({value,empty}:{value:unknown;empty:string}) {
  if(value==null||value==="")return <span>{empty}</span>;
  if(Array.isArray(value))return value.length?<ul>{value.map((entry,index)=><li key={index}><StructuredValue value={entry} empty={empty}/></li>)}</ul>:<span>{empty}</span>;
  if(typeof value==="object")return Object.keys(value).length?<dl>{Object.entries(value).map(([key,entry])=><React.Fragment key={key}><dt>{key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ")}</dt><dd><StructuredValue value={entry} empty={empty}/></dd></React.Fragment>)}</dl>:<span>{empty}</span>;
  return <span style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{String(value)}</span>;
}
export function CoordinationRuleDetails({item,spanish}:{item:Record<string,unknown>;spanish:boolean}) {
  const t=(en:string,es:string)=>spanish?es:en,empty=t("None recorded","Ninguno registrado");
  return <section aria-label={t("Coordination rule details","Detalles de regla de coordinación")}>
    <h3>{String(item.title??item.code??"")}</h3>
    <dl className="knowledge-detail-list">
      <div><dt>{t("Guidance","Guía")}</dt><dd><StructuredValue value={item.guidance} empty={empty}/></dd></div>
      <div><dt>{t("Rationale","Justificación")}</dt><dd><StructuredValue value={item.rationale} empty={empty}/></dd></div>
      <div><dt>{t("Where this applies","Dónde aplica")}</dt><dd><StructuredValue value={item.applicability} empty={empty}/></dd></div>
      <div><dt>{t("Exceptions","Excepciones")}</dt><dd><StructuredValue value={item.exceptions} empty={empty}/></dd></div>
      <div><dt>{t("References","Referencias")}</dt><dd><StructuredValue value={item.references} empty={empty}/></dd></div>
      <div><dt>{t("Saved revision","Revisión guardada")}</dt><dd>{String(item.revision??"")} · {String(item.status??"")}</dd></div>
    </dl>
  </section>;
}
