import type{DataRequestState}from"./support-case-client";
export type DataRequestGuidance=Readonly<{tone:"waiting"|"action"|"complete";title:[string,string];next:[string,string]}>;
const guidance:Record<DataRequestState,DataRequestGuidance>={
  requested:{tone:"waiting",title:["Request received","Solicitud recibida"],next:["BIMLog will review the request before any data action occurs.","BIMLog revisará la solicitud antes de realizar cualquier acción sobre los datos."]},
  under_review:{tone:"waiting",title:["Review in progress","Revisión en curso"],next:["No action is required from you unless support asks for clarification.","No necesita realizar ninguna acción salvo que soporte solicite una aclaración."]},
  approved:{tone:"waiting",title:["Approved for fulfillment","Aprobada para cumplimiento"],next:["BIMLog is completing the approved scope. A verified receipt will appear here when finished.","BIMLog está completando el alcance aprobado. Aquí aparecerá un comprobante verificado al finalizar."]},
  partially_approved:{tone:"action",title:["Partially approved","Aprobada parcialmente"],next:["Review the decision explanation. BIMLog will fulfill only the approved scope.","Revise la explicación de la decisión. BIMLog cumplirá únicamente el alcance aprobado."]},
  denied:{tone:"action",title:["Request not approved","Solicitud no aprobada"],next:["Review the decision explanation and use the conversation if clarification is needed.","Revise la explicación de la decisión y use la conversación si necesita una aclaración."]},
  fulfilled:{tone:"complete",title:["Fulfillment complete","Cumplimiento completado"],next:["Review the verified fulfillment receipt below.","Revise el comprobante de cumplimiento verificado a continuación."]},
};
export const dataRequestGuidance=(state:DataRequestState)=>guidance[state];
