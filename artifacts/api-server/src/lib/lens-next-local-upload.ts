import { createHash } from "node:crypto";

export class LensNextLocalUploadError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422, public readonly digestDiagnostics: Record<string, unknown> | null = null) { super(message); }
}

const text = (value: unknown) => value == null ? "<null>" : String(value);
const field = (value: any, pascal: string, camel: string) => value?.[pascal] ?? value?.[camel] ?? null;
const elementKey = (value: any) => `${field(value, "ModelSource", "modelSource") ?? ""}|${field(value, "InstanceGuid", "instanceGuid") ?? ""}`;
const ordinal = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
type DigestToken = { field: string; value: string };
const append = (parts: DigestToken[], name: string, value: unknown) => parts.push({ field: name, value: text(value) });
const appendElement = (parts: DigestToken[], name: string, prefix: string, index: number, value: any) => { append(parts, `${name}[${index}].prefix`, prefix); append(parts, `${name}[${index}].modelSource`, field(value, "ModelSource", "modelSource")); append(parts, `${name}[${index}].instanceGuid`, field(value, "InstanceGuid", "instanceGuid")); };
const appendPoint = (parts: DigestToken[], name: string, value: any, nullToken: string): void => { if (!value) { append(parts, name, nullToken); return; } append(parts, `${name}.x`, field(value, "X", "x")); append(parts, `${name}.y`, field(value, "Y", "y")); append(parts, `${name}.z`, field(value, "Z", "z")); };

export const LENS_NEXT_DIGEST_ALGORITHM = "SHA-256";
export const LENS_NEXT_DIGEST_CONTRACT_VERSION = "lens-next-visual-digest.v1";

function lensNextVisualStateDigestTokens(state: any): DigestToken[] {
  const parts: DigestToken[] = [];
  append(parts, "schemaVersion", field(state, "SchemaVersion", "schemaVersion")); append(parts, "projectId", field(state, "ProjectId", "projectId"));
  append(parts, "serverId", field(state, "ServerId", "serverId")); append(parts, "viewpointId", field(state, "ViewpointId", "viewpointId"));
  append(parts, "lifecycleStatus", field(state, "LifecycleStatus", "lifecycleStatus")); append(parts, "revisionNumber", field(state, "RevisionNumber", "revisionNumber"));
  append(parts, "modelFingerprint", field(state, "ModelFingerprint", "modelFingerprint"));
  const camera = field(state, "Camera", "camera");
  if (!camera) append(parts, "camera", "camera:null"); else {
    appendPoint(parts, "camera.position", field(camera, "Position", "position"), "point:null");
    const rotation = field(camera, "Rotation", "rotation");
    if (!rotation) append(parts, "camera.rotation", "rotation:null"); else { append(parts, "camera.rotation.a", field(rotation, "A", "a")); append(parts, "camera.rotation.b", field(rotation, "B", "b")); append(parts, "camera.rotation.c", field(rotation, "C", "c")); append(parts, "camera.rotation.d", field(rotation, "D", "d")); }
    appendPoint(parts, "camera.worldUpVector", field(camera, "WorldUpVector", "worldUpVector"), "point:null");
    append(parts, "camera.projection", field(camera, "Projection", "projection")); append(parts, "camera.focalDistance", field(camera, "FocalDistance", "focalDistance"));
    append(parts, "camera.horizontalExtentAtFocalDistance", field(camera, "HorizontalExtentAtFocalDistance", "horizontalExtentAtFocalDistance")); append(parts, "camera.verticalExtentAtFocalDistance", field(camera, "VerticalExtentAtFocalDistance", "verticalExtentAtFocalDistance"));
  }
  [...(field(state, "SelectedElements", "selectedElements") ?? [])].sort((a,b) => ordinal(elementKey(a), elementKey(b))).forEach((value, index) => appendElement(parts, "selected", "S", index, value));
  [...(field(state, "HiddenElements", "hiddenElements") ?? [])].sort((a,b) => ordinal(elementKey(a), elementKey(b))).forEach((value, index) => appendElement(parts, "hidden", "H", index, value));
  [...(field(state, "AppearanceOverrides", "appearanceOverrides") ?? [])].sort((a,b) => ordinal(elementKey(field(a,"Element","element")), elementKey(field(b,"Element","element")))).forEach((value, index) => {
    appendElement(parts, "appearance", "A", index, field(value, "Element", "element")); append(parts, `appearance[${index}].red`, field(value, "Red", "red")); append(parts, `appearance[${index}].green`, field(value, "Green", "green")); append(parts, `appearance[${index}].blue`, field(value, "Blue", "blue")); append(parts, `appearance[${index}].transparency`, field(value, "Transparency", "transparency"));
  });
  [...(field(state, "ModelReferences", "modelReferences") ?? [])].sort((a,b) => ordinal(String(field(a,"Source","source") ?? ""), String(field(b,"Source","source") ?? ""))).forEach((value, index) => {
    append(parts, `models[${index}].source`, field(value,"Source","source")); append(parts, `models[${index}].modelGuid`, field(value,"ModelGuid","modelGuid")); append(parts, `models[${index}].transformFingerprint`, field(value,"TransformFingerprint","transformFingerprint"));
  });
  append(parts, "sectioningJson", field(state,"SectioningJson","sectioningJson")); append(parts, "redlinesJson", field(state,"RedlinesJson","redlinesJson")); append(parts, "screenshotSha256", field(state,"ScreenshotSha256","screenshotSha256"));
  return parts;
}

const canonicalInput = (tokens: DigestToken[]) => tokens.map(token => `${token.value}\u001f`).join("");

export function lensNextVisualStateDigest(state: any): string {
  return createHash("sha256").update(canonicalInput(lensNextVisualStateDigestTokens(state)), "utf8").digest("hex");
}

function digestMismatchDiagnostics(state: any, embedded: string, recomputed: string): Record<string, unknown> {
  const tokens = lensNextVisualStateDigestTokens(state);
  const serverCanonical = canonicalInput(tokens);
  const native = field(state, "DigestDiagnostics", "digestDiagnostics") ?? {};
  const encoded = String(field(native, "CanonicalInputBase64", "canonicalInputBase64") ?? "");
  let localCanonical = "";
  try { localCanonical = Buffer.from(encoded, "base64").toString("utf8"); } catch { localCanonical = ""; }
  const localTokens = localCanonical ? localCanonical.split("\u001f").slice(0, -1) : [];
  const serverTokens = tokens.map(token => token.value);
  const maximum = Math.max(localTokens.length, serverTokens.length);
  let index = -1;
  for (let candidate = 0; candidate < maximum; candidate += 1) if (localTokens[candidate] !== serverTokens[candidate]) { index = candidate; break; }
  const mismatch = index < 0 ? null : {
    index,
    field: tokens[index]?.field ?? `extra-local-token[${index}]`,
    localValue: localTokens[index] ?? "<missing>",
    serverValue: serverTokens[index] ?? "<missing>",
  };
  return {
    algorithm: String(field(native, "Algorithm", "algorithm") ?? LENS_NEXT_DIGEST_ALGORITHM),
    contractVersion: String(field(native, "ContractVersion", "contractVersion") ?? LENS_NEXT_DIGEST_CONTRACT_VERSION),
    localDigest: embedded,
    serverDigest: recomputed,
    truncated: Boolean(field(native, "Truncated", "truncated")),
    localCanonicalLength: localCanonical.length,
    serverCanonicalLength: serverCanonical.length,
    localCanonicalInputBase64: encoded || null,
    serverCanonicalInputBase64: Buffer.from(serverCanonical, "utf8").toString("base64"),
    firstMismatch: mismatch,
  };
}

export function validateAndRebindLocalVisualState(raw: unknown, input: { projectId: number; serverId: number; viewpointId: string; modelFingerprint: string }): { json: string; digest: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new LensNextLocalUploadError("visual_state_invalid", "Exact local visual state is required.");
  const state = structuredClone(raw as Record<string, unknown>) as any;
  const embedded = String(field(state,"DigestSha256","digestSha256") ?? "").toLowerCase();
  const recomputed = lensNextVisualStateDigest(state);
  if (!/^[a-f0-9]{64}$/.test(embedded) || recomputed !== embedded) {
    const diagnostics = digestMismatchDiagnostics(state, embedded, recomputed);
    console.warn("[LensNextDigestMismatch]", JSON.stringify(diagnostics));
    throw new LensNextLocalUploadError("visual_state_digest_mismatch", "The captured local visual-state digest is invalid.", 409, diagnostics);
  }
  if (Number(field(state,"ProjectId","projectId")) !== input.projectId || String(field(state,"ModelFingerprint","modelFingerprint")) !== input.modelFingerprint || Number(field(state,"ServerId","serverId")) !== 1)
    throw new LensNextLocalUploadError("visual_state_context_mismatch", "The captured local visual state does not match this project/model.", 409);
  state.ProjectId = input.projectId; state.ServerId = input.serverId; state.ViewpointId = input.viewpointId; state.LifecycleStatus = "active"; state.RevisionNumber = 1;
  state.DigestSha256 = null; const digest = lensNextVisualStateDigest(state); state.DigestSha256 = digest;
  const json = JSON.stringify(state);
  if (Buffer.byteLength(json, "utf8") > 4 * 1024 * 1024) throw new LensNextLocalUploadError("visual_state_too_large", "Lens visual state exceeds the 4 MiB limit.", 413);
  return { json, digest };
}
