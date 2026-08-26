import { createHash } from "node:crypto";

export class LensNextLocalUploadError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) { super(message); }
}

const text = (value: unknown) => value == null ? "<null>" : String(value);
const append = (parts: string[], value: unknown) => parts.push(`${text(value)}\u001f`);
const field = (value: any, pascal: string, camel: string) => value?.[pascal] ?? value?.[camel] ?? null;
const elementKey = (value: any) => `${field(value, "ModelSource", "modelSource") ?? ""}|${field(value, "InstanceGuid", "instanceGuid") ?? ""}`;
const ordinal = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const appendElement = (parts: string[], prefix: string, value: any) => { append(parts, prefix); append(parts, field(value, "ModelSource", "modelSource")); append(parts, field(value, "InstanceGuid", "instanceGuid")); };
const appendPoint = (parts: string[], value: any, nullToken: string): void => { if (!value) { append(parts, nullToken); return; } append(parts, field(value, "X", "x")); append(parts, field(value, "Y", "y")); append(parts, field(value, "Z", "z")); };

export function lensNextVisualStateDigest(state: any): string {
  const parts: string[] = [];
  append(parts, field(state, "SchemaVersion", "schemaVersion")); append(parts, field(state, "ProjectId", "projectId"));
  append(parts, field(state, "ServerId", "serverId")); append(parts, field(state, "ViewpointId", "viewpointId"));
  append(parts, field(state, "LifecycleStatus", "lifecycleStatus")); append(parts, field(state, "RevisionNumber", "revisionNumber"));
  append(parts, field(state, "ModelFingerprint", "modelFingerprint"));
  const camera = field(state, "Camera", "camera");
  if (!camera) append(parts, "camera:null"); else {
    appendPoint(parts, field(camera, "Position", "position"), "point:null");
    const rotation = field(camera, "Rotation", "rotation");
    if (!rotation) append(parts, "rotation:null"); else { append(parts, field(rotation, "A", "a")); append(parts, field(rotation, "B", "b")); append(parts, field(rotation, "C", "c")); append(parts, field(rotation, "D", "d")); }
    appendPoint(parts, field(camera, "WorldUpVector", "worldUpVector"), "point:null");
    append(parts, field(camera, "Projection", "projection")); append(parts, field(camera, "FocalDistance", "focalDistance"));
    append(parts, field(camera, "HorizontalExtentAtFocalDistance", "horizontalExtentAtFocalDistance")); append(parts, field(camera, "VerticalExtentAtFocalDistance", "verticalExtentAtFocalDistance"));
  }
  for (const value of [...(field(state, "SelectedElements", "selectedElements") ?? [])].sort((a,b) => ordinal(elementKey(a), elementKey(b)))) appendElement(parts, "S", value);
  for (const value of [...(field(state, "HiddenElements", "hiddenElements") ?? [])].sort((a,b) => ordinal(elementKey(a), elementKey(b)))) appendElement(parts, "H", value);
  for (const value of [...(field(state, "AppearanceOverrides", "appearanceOverrides") ?? [])].sort((a,b) => ordinal(elementKey(field(a,"Element","element")), elementKey(field(b,"Element","element"))))) {
    appendElement(parts, "A", field(value, "Element", "element")); append(parts, field(value, "Red", "red")); append(parts, field(value, "Green", "green")); append(parts, field(value, "Blue", "blue")); append(parts, field(value, "Transparency", "transparency"));
  }
  for (const value of [...(field(state, "ModelReferences", "modelReferences") ?? [])].sort((a,b) => ordinal(String(field(a,"Source","source") ?? ""), String(field(b,"Source","source") ?? "")))) {
    append(parts, field(value,"Source","source")); append(parts, field(value,"ModelGuid","modelGuid")); append(parts, field(value,"TransformFingerprint","transformFingerprint"));
  }
  append(parts, field(state,"SectioningJson","sectioningJson")); append(parts, field(state,"RedlinesJson","redlinesJson")); append(parts, field(state,"ScreenshotSha256","screenshotSha256"));
  return createHash("sha256").update(parts.join(""), "utf8").digest("hex");
}

export function validateAndRebindLocalVisualState(raw: unknown, input: { projectId: number; serverId: number; viewpointId: string; modelFingerprint: string }): { json: string; digest: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LensNextLocalUploadError("visual_state_invalid", "Exact local visual state is required.");
  const state = structuredClone(raw as Record<string, unknown>) as any;
  const embedded = String(field(state,"DigestSha256","digestSha256") ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(embedded) || lensNextVisualStateDigest(state) !== embedded) throw new LensNextLocalUploadError("visual_state_digest_mismatch", "The captured local visual-state digest is invalid.", 409);
  if (Number(field(state,"ProjectId","projectId")) !== input.projectId || String(field(state,"ModelFingerprint","modelFingerprint")) !== input.modelFingerprint || Number(field(state,"ServerId","serverId")) !== 1)
    throw new LensNextLocalUploadError("visual_state_context_mismatch", "The captured local visual state does not match this project/model.", 409);
  state.ProjectId = input.projectId; state.ServerId = input.serverId; state.ViewpointId = input.viewpointId; state.LifecycleStatus = "active"; state.RevisionNumber = 1;
  state.DigestSha256 = null; const digest = lensNextVisualStateDigest(state); state.DigestSha256 = digest;
  const json = JSON.stringify(state);
  if (Buffer.byteLength(json, "utf8") > 4 * 1024 * 1024) throw new LensNextLocalUploadError("visual_state_too_large", "Lens visual state exceeds the 4 MiB limit.", 413);
  return { json, digest };
}
