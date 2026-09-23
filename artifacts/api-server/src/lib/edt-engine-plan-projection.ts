import {
  makeEdtWorkItemCode, validateEdtPlanCoverage, validateEdtPlanNodes,
  validateEdtPlanSourceBindings, validateEdtPlanWorkItems,
  type EdtPlanNode, type EdtPlanWorkItem,
} from "./edt-engine-activation-service";
import type { ActivatedEdtSource } from "./edt-engine-source-service";
import { loadActivatedEdtSource } from "./edt-engine-source-service";
import { edtFingerprint, EdtEngineConflict, withEdtTransaction, type EdtTransactionHost } from "./edt-engine-transaction";

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS", "A saved Intake source record is missing or invalid.");
  return value as Record<string, unknown>;
}
function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS", "A saved Intake source list is missing.");
  return value.map(record);
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function required(value: unknown, field: string): string {
  const result = text(value);
  if (!result) throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS", `${field} is required for generated EDT identity.`);
  return result;
}

export type ProjectedEdtPlan = Readonly<{ nodes: readonly EdtPlanNode[]; workItems: readonly EdtPlanWorkItem[]; sourceFingerprint: string }>;

export function projectActivatedEdtPlan(source: ActivatedEdtSource): ProjectedEdtPlan {
  const data = source.intake.data;
  const commercial = record(data.commercial);
  const profiles = list(commercial.contracts);
  const scopeItems = list(data.scopeItems);
  const activatedContracts = list(source.intake.activationSummary.contracts);
  if (!profiles.length || !scopeItems.length || !activatedContracts.length)
    throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS", "Commercial contracts and scope must be present in the activated Intake.");
  const byProfile = new Map(activatedContracts.map(entry => [required(entry.profileId,"activated contract profile"),entry]));
  if (byProfile.size !== activatedContracts.length || byProfile.size !== profiles.length)
    throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS", "Activated contract profiles must be unique.");
  const byScope = new Map(scopeItems.map(entry => [required(entry.id,"scope item ID"),entry]));
  if (byScope.size !== scopeItems.length)
    throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS", "Saved scope item IDs must be unique.");
  const savedScopeIds = new Set(source.workItems.map(item => required(item.stableScopeItemId,"saved Work Item scope ID")));
  if (savedScopeIds.size !== source.workItems.length || savedScopeIds.size !== byScope.size || [...byScope.keys()].some(id => !savedScopeIds.has(id)))
    throw new EdtEngineConflict("EDT_PLAN_COVERAGE_MISMATCH", "Every activated Intake scope item must have exactly one saved Work Item.");
  const projectNode: EdtPlanNode = {
    kind:"project",sourceIdentity:`project:${source.project.id}`,code:required(source.project.code,"project code"),
    name:required(source.project.name,"project name"),sequence:1,snapshot:{projectId:source.project.id,code:source.project.code,name:source.project.name},
  };
  const nodes: EdtPlanNode[]=[projectNode];
  const workItems: EdtPlanWorkItem[]=[];
  const contractNodes=new Map<string,EdtPlanNode>();
  const deliverableNodes=new Map<string,EdtPlanNode>();
  for(const [index,profile] of profiles.entries()){
    const profileId=required(profile.id,"contract profile ID");
    const activated=byProfile.get(profileId);
    if(!activated)throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS","Every Intake contract must have a saved activation binding.");
    const canonicalId=required(activated.contractId,"canonical Contract ID");
    const versionId=required(activated.contractVersionId,"canonical Contract version ID");
    const contractNode:EdtPlanNode={kind:"contract",sourceIdentity:canonicalId,parentSourceIdentity:projectNode.sourceIdentity,
      code:text(profile.contractNumber)||`C${index+1}`,name:text(profile.title)||`Contract ${index+1}`,
      sequence:index+1,snapshot:{profileId,contractId:canonicalId,contractVersionId:versionId,contractNumber:text(profile.contractNumber)}};
    nodes.push(contractNode);contractNodes.set(profileId,contractNode);
  }
  for(const saved of source.workItems){
    const scope=byScope.get(saved.stableScopeItemId);
    if(!scope)throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS","A saved Work Item has no matching Intake scope item.");
    const contractNode=contractNodes.get(required(scope.contractId,"scope Contract profile"));
    if(!contractNode||saved.contractId!==contractNode.sourceIdentity||saved.contractVersionId!==contractNode.snapshot.contractVersionId)
      throw new EdtEngineConflict("EDT_SOURCE_AMBIGUOUS","Saved Work Item Contract binding differs from the activated Intake snapshot.");
    const deliverableType=required(scope.deliverableType,"scope deliverable type");
    const deliverableKey=`${contractNode.sourceIdentity}:${deliverableType}`;
    let deliverable=deliverableNodes.get(deliverableKey);
    if(!deliverable){
      const siblings=[...deliverableNodes.values()].filter(node=>node.parentSourceIdentity===contractNode.sourceIdentity);
      deliverable={kind:"deliverable",sourceIdentity:`deliverable:${deliverableKey}`,parentSourceIdentity:contractNode.sourceIdentity,
        code:deliverableType,name:deliverableType.replaceAll("_"," "),sequence:siblings.length+1,snapshot:{deliverableType}};
      nodes.push(deliverable);deliverableNodes.set(deliverableKey,deliverable);
    }
    const packages=list(scope.workPackages);
    if(packages.length!==1)throw new EdtEngineConflict("EDT_LOCATION_AMBIGUOUS","A Work Item requires exactly one governed floor or area Work Package.");
    const workPackage=packages[0];
    const dimensionType=required(workPackage.dimensionType,"location dimension type");
    if(!["floor","zone"].includes(dimensionType))throw new EdtEngineConflict("EDT_LOCATION_AMBIGUOUS","A Work Item location must be a floor or area.");
    const dimensionValue=required(workPackage.dimensionValue,"floor or area");
    const classification=record(workPackage.classification);
    const tradeIdentity=required(classification.disciplineId,"permanent trade ID");
    const tradeCode=required(classification.disciplineCode,"trade code");
    const location:EdtPlanNode={kind:"location",sourceIdentity:`location:${saved.id}`,parentSourceIdentity:deliverable.sourceIdentity,
      code:dimensionValue,name:dimensionValue,sequence:source.workItems.filter(item=>{
        const candidate=byScope.get(item.stableScopeItemId);
        return candidate?.contractId===scope.contractId&&candidate?.deliverableType===deliverableType;
      }).findIndex(item=>item.id===saved.id)+1,
      snapshot:{workItemId:saved.id,workPackageId:required(workPackage.id,"Work Package ID"),dimensionType,dimensionValue}};
    nodes.push(location);
    const tradeSnapshot={id:tradeIdentity,code:tradeCode,name:text(classification.disciplineName)};
    workItems.push({id:saved.id,edtNodeSourceIdentity:location.sourceIdentity,contractSourceIdentity:contractNode.sourceIdentity,
      locationIdentity:location.sourceIdentity,locationSnapshot:location.snapshot,tradeIdentity,tradeSnapshot,
      deliverableTypeIdentity:deliverable.sourceIdentity,deliverableTypeSnapshot:deliverable.snapshot,
      displayCode:makeEdtWorkItemCode({project:projectNode,contract:contractNode,deliverable,location,tradeIdentity,tradeCode})});
  }
  validateEdtPlanNodes(nodes);
  validateEdtPlanWorkItems(nodes,workItems);
  validateEdtPlanCoverage(source.workItems.map(item=>item.id),workItems);
  validateEdtPlanSourceBindings(source.workItems.map(item=>({id:item.id,contractId:item.contractId,stableScopeItemId:item.stableScopeItemId})),workItems);
  return {nodes,workItems,sourceFingerprint:edtFingerprint({project:source.project,intakeId:source.intake.id,revision:source.intake.revision,nodes,workItems})};
}

export async function previewActivatedEdtPlan(input: { companyId: number; projectId: number; intakeId: string }, host?: EdtTransactionHost): Promise<ProjectedEdtPlan> {
  return withEdtTransaction(async client => projectActivatedEdtPlan(await loadActivatedEdtSource(client, input)), host);
}
