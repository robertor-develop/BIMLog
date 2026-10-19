function number(value: unknown) { const parsed=Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : null; }
export function intakePhaseHoursPreview(plannedHours: unknown, definition: any): Array<{code:string;name:string;plannedHours:string}> {
  const total=number(plannedHours), phases=Array.isArray(definition?.phases)?definition.phases:[], rows=Array.isArray(definition?.economicAllocation?.phases)?definition.economicAllocation.phases:[];
  if(total==null || !phases.length || rows.length!==phases.length) return [];
  const weights=phases.map((phase:any,index:number)=>{const row=rows[index]; return row && String(row.phaseId)===String(phase.id) && String(row.code)===String(phase.code) ? number(row.workflowPercent) : null;});
  if(weights.some((value:any)=>value==null) || Math.abs(weights.reduce((sum:number,value:any)=>sum+value,0)-100)>0.000001) return [];
  let used=0; return phases.map((phase:any,index:number)=>{const hours=index===phases.length-1?total-used:Number((total*(weights[index] as number)/100).toFixed(6)); used+=hours; return {code:String(phase.code||phase.name),name:String(phase.name),plannedHours:String(Number(hours.toFixed(6)))};});
}

export function intakePhaseHoursPreviewLabel(plannedHours: unknown, definition: any, spanish = false): string | null {
  const rows = intakePhaseHoursPreview(plannedHours, definition);
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + Number(row.plannedHours), 0);
  const phases = rows.map(row => `${row.code} ${row.plannedHours}h`).join(" · ");
  return spanish
    ? `Distribución verificada del flujo (${Number(total.toFixed(6))}h total): ${phases}`
    : `Verified workflow allocation (${Number(total.toFixed(6))}h total): ${phases}`;
}
