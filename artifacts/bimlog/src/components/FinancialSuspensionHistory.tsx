import React from 'react';
type Event={id:string;scope_type:string;project_id:number|null;action:string;reason:string;actor_user_id:number;occurred_at:string};
export function FinancialSuspensionHistory({events,es}:{events:Event[];es:boolean}){
  return <section><h3>{es?'Historial guardado de suspensiones':'Saved suspension history'}</h3><p>{es?'Hasta 100 eventos autorizados. La liberación afecta solo al alcance seleccionado; una suspensión de empresa puede seguir bloqueando un proyecto.':'Up to 100 authorized events. Release applies only to the selected scope; a company suspension may still block a project.'}</p>
    {events.length===0&&<p>{es?'No hay eventos de suspensión guardados.':'No saved suspension events.'}</p>}
    <ol>{events.map(event=><li key={event.id}><details><summary>{event.action==='activate'?(es?'Suspender':'Suspend'):(es?'Liberar':'Release')} · {event.scope_type}{event.project_id?` ${event.project_id}`:''} · {event.occurred_at}</summary><p style={{whiteSpace:'pre-wrap'}}>{event.reason}</p><p>{es?'Registrado por':'Recorded by'}: {event.actor_user_id}</p><p style={{overflowWrap:'anywhere'}}>ID: {event.id}</p></details></li>)}</ol>
  </section>;
}
