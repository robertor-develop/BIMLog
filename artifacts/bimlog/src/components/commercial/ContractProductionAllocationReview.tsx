import React from "react";

/** Read-only evidence in the existing independent contract-review workflow. */
export function ContractProductionAllocationReview({lines,currency,status,pools,tt}:{
  lines:Array<{stableLineId:string;description?:string;contractItem?:{displayName?:string;productionAllocation?:string}}>;
  currency:string;status:string;pools?:Record<string,string>;tt:(en:string,es:string)=>string;
}) {
  if (!pools&&!lines.some(line=>line.contractItem?.productionAllocation!==undefined)) return null;
  return <section aria-label={tt("Contract production allocations","Asignaciones contractuales de producción")}>
    <h3>{tt("Production allocation for this contract version","Asignación de producción de esta versión contractual")}</h3>
    <p>{["approved","executed"].includes(status)
      ? tt("These amounts belong to the approved contract version. They are separate from selling values and do not authorize payment.","Estos montos pertenecen a la versión contractual aprobada. Son independientes del valor de venta y no autorizan pagos.")
      : tt("Review these amounts before approving this contract version. Saved allocations are not yet approved funding.","Revise estos montos antes de aprobar esta versión contractual. Las asignaciones guardadas aún no son fondos aprobados.")}</p>
    {pools&&<><h4>{tt("Contract pools — counted once","Fondos del contrato — contabilizados una sola vez")}</h4><dl>{[
      ["fixedCompanyCost",tt("Fixed company cost","Costo fijo de empresa")],
      ["directProduction",tt("Direct production","Producción directa")],
      ["projectAdministration",tt("Contract administration","Administración contractual")],
      ["incentiveReserve",tt("Project incentive reserve","Reserva de incentivos del proyecto")],
      ["projectEarnings",tt("Project earnings","Ganancias del proyecto")],
    ].map(([key,label])=><div key={key} style={{display:"flex",flexWrap:"wrap",gap:12,padding:"6px 0"}}><dt style={{flex:"1 1 200px"}}>{label}</dt><dd style={{margin:0}}>{pools[key]===undefined?tt("Not classified","Sin clasificación"):`${pools[key]} ${currency}`}</dd></div>)}</dl></>}
    <h4>{tt("Production by Contract Item","Producción por Partida de Contrato")}</h4>
    <dl>{lines.map(line=><div key={line.stableLineId} style={{display:"flex",flexWrap:"wrap",gap:12,padding:"8px 0",borderBottom:"1px solid #dbe2ea"}}>
      <dt style={{flex:"1 1 200px",overflowWrap:"anywhere"}}>{line.contractItem?.displayName||line.description||line.stableLineId}</dt>
      <dd style={{margin:0}}>{line.contractItem?.productionAllocation===undefined?tt("Not allocated","Sin asignación"):`${line.contractItem.productionAllocation} ${currency}`}</dd>
    </div>)}</dl>
    <p>{tt("Administration, incentive reserve and project earnings remain at contract/project level; this list does not duplicate those pools for each item.","La administración, la reserva de incentivos y las ganancias del proyecto permanecen en el nivel contractual o del proyecto; esta lista no duplica esos fondos por partida.")}</p>
  </section>;
}
