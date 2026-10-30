export async function resolveOriginalClash(projectId:number,clashId:number,token:string,signal?:AbortSignal){
 const response=await fetch(`/api/v1/projects/${projectId}/clashes/${clashId}`,{headers:{Authorization:`Bearer ${token}`},signal});
 if(!response.ok)throw new Error([401,403].includes(response.status)?"denied":response.status===404?"missing":"unavailable");
 const row=await response.json();
 if(response.headers.get("X-BIMLog-Project-Id")!==String(projectId)||row?.id!==clashId||!Number.isSafeInteger(row.reportId)||row.reportId<=0)throw new Error("invalid");
 return {id:row.id as number,reportId:row.reportId as number,href:`/projects/${projectId}/clash-reports?report=${row.reportId}&clash=${row.id}`};
}
