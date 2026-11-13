import { createHash, randomUUID } from "crypto";

type RevitNavigationQueryClient = {
  query(text: string, values?: readonly unknown[]): Promise<unknown>;
};

export const LENS_NEXT_REVIT_CONTRACT = "lens-next-revit-navigation.v1";

export async function ensureLensNextRevitNavigationSchema(pool: RevitNavigationQueryClient): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lens_next_revit_navigation_events (
      id BIGSERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      lens_viewpoint_id INTEGER NOT NULL REFERENCES lens_viewpoints(id),
      request_id UUID NOT NULL UNIQUE,
      requested_by_id INTEGER NOT NULL REFERENCES users(id),
      target_digest TEXT NOT NULL CHECK (target_digest ~ '^[a-f0-9]{64}$'),
      target_json JSONB NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'requested' CHECK (outcome IN ('requested','opened','already-opened','blocked','expired')),
      receipt_json JSONB,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      CHECK (expires_at > requested_at)
    );
    CREATE INDEX IF NOT EXISTS lens_next_revit_navigation_project_issue_idx
      ON lens_next_revit_navigation_events(project_id, lens_viewpoint_id, requested_at DESC);
  `);
}

export type RevitNavigationTarget = {
  contractVersion: typeof LENS_NEXT_REVIT_CONTRACT;
  projectId: number;
  issueId: number;
  viewpointId: string;
  visualStateDigest: string;
  model: {
    documentGuid: string;
    centralModelGuid?: string | null;
    fileNameNormalized: string;
    revitMajorVersion: 2026;
    coordinateFrame: "revit-internal";
    navisworksToRevitTransform: number[];
  };
  revitInternalPoint: { x: number; y: number; z: number };
  revitElementIds: number[];
};
export type RevitModelBinding=RevitNavigationTarget["model"];

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function validateRevitNavigationTarget(value: unknown, expected: { projectId: number; issueId: number; viewpointId: string; visualStateDigest: string }): { target: RevitNavigationTarget; digest: string } {
  const target = value as RevitNavigationTarget;
  if (!target || target.contractVersion !== LENS_NEXT_REVIT_CONTRACT || target.projectId !== expected.projectId || target.issueId !== expected.issueId || target.viewpointId !== expected.viewpointId || target.visualStateDigest !== expected.visualStateDigest)
    throw Object.assign(new Error("Revit navigation target does not match the exact authorized BIMLog issue revision."), { status: 422, code: "revit_target_identity_mismatch" });
  const model = target.model;
  if (!model || model.revitMajorVersion !== 2026 || model.coordinateFrame !== "revit-internal" || !model.documentGuid || !model.fileNameNormalized || !Array.isArray(model.navisworksToRevitTransform) || model.navisworksToRevitTransform.length !== 16 || !model.navisworksToRevitTransform.every(finite))
    throw Object.assign(new Error("Revit navigation requires an exact Revit 2026 model identity and finite 4x4 transform."), { status: 422, code: "revit_model_binding_invalid" });
  if (!target.revitInternalPoint || ![target.revitInternalPoint.x, target.revitInternalPoint.y, target.revitInternalPoint.z].every(finite) || !Array.isArray(target.revitElementIds) || target.revitElementIds.length > 5000 || target.revitElementIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(target.revitElementIds).size !== target.revitElementIds.length)
    throw Object.assign(new Error("Revit navigation point or element identities are invalid."), { status: 422, code: "revit_navigation_geometry_invalid" });
  return { target, digest: sha256(JSON.stringify(target)) };
}

export function buildRevitNavigationTarget(input:{projectId:number;issueId:number;viewpointId:string;visualStateDigest:string;visualState:unknown;model:unknown;revitElementIds?:unknown}):{target:RevitNavigationTarget;digest:string}{
  const model=input.model as RevitModelBinding, state=input.visualState as any, position=state?.Camera?.Position??state?.camera?.position, matrix=model?.navisworksToRevitTransform;
  if(!model||model.revitMajorVersion!==2026||model.coordinateFrame!=="revit-internal"||!model.documentGuid||!model.fileNameNormalized||!Array.isArray(matrix)||matrix.length!==16||!matrix.every(finite))throw Object.assign(new Error("Revit navigation requires an exact verified Revit 2026 model binding."),{status:422,code:"revit_model_binding_invalid"});
  const source=[position?.X??position?.x,position?.Y??position?.y,position?.Z??position?.z];
  if(!source.every(finite))throw Object.assign(new Error("The exact Lens visual package does not contain a finite navigation position."),{status:409,code:"revit_visual_position_unavailable"});
  const x=matrix[0]*source[0]+matrix[1]*source[1]+matrix[2]*source[2]+matrix[3],y=matrix[4]*source[0]+matrix[5]*source[1]+matrix[6]*source[2]+matrix[7],z=matrix[8]*source[0]+matrix[9]*source[1]+matrix[10]*source[2]+matrix[11],w=matrix[12]*source[0]+matrix[13]*source[1]+matrix[14]*source[2]+matrix[15];
  if(!finite(w)||w===0)throw Object.assign(new Error("The governed coordinate transform produced an invalid homogeneous coordinate."),{status:422,code:"revit_transform_invalid"});
  const target={contractVersion:LENS_NEXT_REVIT_CONTRACT,projectId:input.projectId,issueId:input.issueId,viewpointId:input.viewpointId,visualStateDigest:input.visualStateDigest,model,revitInternalPoint:{x:x/w,y:y/w,z:z/w},revitElementIds:Array.isArray(input.revitElementIds)?input.revitElementIds:[]} as RevitNavigationTarget;
  return validateRevitNavigationTarget(target,{projectId:input.projectId,issueId:input.issueId,viewpointId:input.viewpointId,visualStateDigest:input.visualStateDigest});
}

export async function createRevitNavigationRequest(client: RevitNavigationQueryClient, input: { projectId: number; issueId: number; userId: number; target: RevitNavigationTarget; digest: string; now?: Date }): Promise<{ requestId: string; expiresAt: string }> {
  const requestId = randomUUID(), now = input.now ?? new Date(), expiresAt = new Date(now.getTime() + 5 * 60_000);
  await client.query(`INSERT INTO lens_next_revit_navigation_events(project_id,lens_viewpoint_id,request_id,requested_by_id,target_digest,target_json,requested_at,expires_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`, [input.projectId,input.issueId,requestId,input.userId,input.digest,JSON.stringify(input.target),now,expiresAt]);
  return { requestId, expiresAt: expiresAt.toISOString() };
}
