import type {CommercialLaunchProfile} from "./commercial-launch-profile";

export type CommercialLaunchDossierSectionId="supplier_identity"|"commercial_services"|"current_verification";
export type CommercialLaunchDossierSection=Readonly<{
  id:CommercialLaunchDossierSectionId;
  status:"ready"|"action_required";
  owner:"bimlog_platform";
  blockerCount:number;
}>;
export type CommercialLaunchDossier=Readonly<{
  schemaVersion:"bimlog-commercial-launch-dossier-v1";
  status:"ready"|"blocked";
  ready:boolean;
  sourceCommit:string;
  sections:readonly CommercialLaunchDossierSection[];
  blockerCount:number;
  evaluatedAt:string;
}>;

export function deriveCommercialLaunchDossier(input:{
  sourceCommit:string;
  profile:CommercialLaunchProfile;
  serviceReady:boolean;
  serviceBlockerCount:number;
  verificationReady:boolean;
  now?:Date;
}):CommercialLaunchDossier{
  if(!/^[0-9a-f]{40}$/.test(input.sourceCommit))throw new Error("Commercial launch dossier source is invalid");
  if(!Number.isInteger(input.serviceBlockerCount)||input.serviceBlockerCount<0)throw new Error("Commercial launch dossier service count is invalid");
  if(input.serviceReady!==(input.serviceBlockerCount===0))throw new Error("Commercial launch dossier service state is contradictory");
  const sections:CommercialLaunchDossierSection[]=[
    {id:"supplier_identity",status:input.profile.complete?"ready":"action_required",owner:"bimlog_platform",blockerCount:input.profile.missingFields.length},
    {id:"commercial_services",status:input.serviceReady?"ready":"action_required",owner:"bimlog_platform",blockerCount:input.serviceBlockerCount},
    {id:"current_verification",status:input.verificationReady?"ready":"action_required",owner:"bimlog_platform",blockerCount:input.verificationReady?0:1},
  ];
  const blockerCount=sections.reduce((total,section)=>total+section.blockerCount,0),ready=blockerCount===0;
  return Object.freeze({schemaVersion:"bimlog-commercial-launch-dossier-v1",status:ready?"ready":"blocked",ready,sourceCommit:input.sourceCommit,sections:Object.freeze(sections.map(section=>Object.freeze(section))),blockerCount,evaluatedAt:(input.now??new Date()).toISOString()});
}
