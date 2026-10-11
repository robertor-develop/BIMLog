export type FirstValueEvidenceKind="rfi"|"submittal"|"file";

export type FirstValueEvidence={
  kind:FirstValueEvidenceKind;
  recordId:number;
  projectId:number;
  projectCode:string;
  projectName:string;
  label:string;
  createdAt:string;
};

export function firstValueEvidenceDestination(evidence:FirstValueEvidence):string{
  const projectId=encodeURIComponent(String(evidence.projectId)),recordId=encodeURIComponent(String(evidence.recordId));
  if(evidence.kind==="rfi")return `/projects/${projectId}/rfis?rfi=${recordId}`;
  if(evidence.kind==="submittal")return `/projects/${projectId}/submittals?submittal=${recordId}`;
  return `/projects/${projectId}/files?file=${recordId}`;
}
