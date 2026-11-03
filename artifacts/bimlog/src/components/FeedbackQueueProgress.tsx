import React from 'react';
export type QueueProgress={phase:string;attempts:number;maxAttempts:number;processingUntil:string|null;nextAttemptAt:string|null;observedAt:string};
export function FeedbackQueueProgress({queue,es,onRefresh}:{queue:QueueProgress|null|undefined;es:boolean;onRefresh:()=>void}){
  if(!queue)return null;
  const labels:Record<string,string>={queued:es?'Esperando al agente':'Waiting for the agent',processing:es?'El agente está procesando':'Agent processing',awaiting_recovery:es?'Terminó el plazo de procesamiento; esperando recuperación':'Processing window ended; awaiting recovery',retry_scheduled:es?'Reintento programado':'Retry scheduled',needs_attention:es?'La entrega necesita revisión de Operations':'Delivery needs Operations review',delivered:es?'Entrega completada':'Delivery completed',status_unavailable:es?'No se pudo interpretar el estado; actualice o consulte soporte':'Status could not be interpreted; refresh or contact support'};
  return <details><summary>{es?'Progreso de entrega':'Delivery progress'}: {labels[queue.phase]??queue.phase}</summary><p>{es?'Intentos':'Attempts'}: {queue.attempts} / {queue.maxAttempts}</p>
    {queue.processingUntil&&<p>{es?'Plazo de procesamiento':'Processing window ends'}: {queue.processingUntil}</p>}{queue.nextAttemptAt&&<p>{es?'Próximo intento disponible desde':'Next attempt eligible from'}: {queue.nextAttemptAt}</p>}
    <p>{es?'Consultado el':'Observed at'}: {queue.observedAt}</p><p>{es?'El agente central gestiona los intentos. Actualizar consulta el estado; no reclama trabajos ni fuerza entregas.':'The central agent manages attempts. Refresh reads status; it does not claim work or force delivery.'}</p><button type="button" onClick={onRefresh}>{es?'Actualizar estado de mis comentarios':'Refresh my feedback status'}</button>
  </details>;
}
