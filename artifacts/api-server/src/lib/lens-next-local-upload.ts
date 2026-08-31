import { createHash } from "node:crypto";

export class LensNextLocalUploadError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422, public readonly digestDiagnostics: Record<string, unknown> | null = null) { super(message); }
}

const text = (value: unknown) => value == null ? "<null>" : String(value);
const field = (value: any, pascal: string, camel: string) => value?.[pascal] ?? value?.[camel] ?? null;
const elementKey = (value: any) => `${field(value, "ModelSource", "modelSource") ?? ""}|${field(value, "InstanceGuid", "instanceGuid") ?? ""}`;
const ordinal = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
type DigestToken = { field: string; value: string };

export const LENS_NEXT_DIGEST_ALGORITHM = "SHA-256";
export const LENS_NEXT_DIGEST_CONTRACT_VERSION = "lens-next-visual-digest.v2";
export const LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION = "lens-next-visual-digest.v1";
type DigestContractVersion = typeof LENS_NEXT_DIGEST_CONTRACT_VERSION | typeof LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION;

const digestContractVersion = (state: any): DigestContractVersion => {
  const diagnostics = field(state, "DigestDiagnostics", "digestDiagnostics");
  const requested = String(field(diagnostics, "ContractVersion", "contractVersion") ?? "");
  if (!requested || requested === LENS_NEXT_DIGEST_CONTRACT_VERSION) return LENS_NEXT_DIGEST_CONTRACT_VERSION;
  if (requested === LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION) return LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION;
  throw new LensNextLocalUploadError("visual_state_digest_contract_unsupported", `Unsupported Lens Next visual digest contract: ${requested}`, 409);
};

const float64Token = (value: unknown): string => {
  if (value == null) return "<null>";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new LensNextLocalUploadError("visual_state_number_invalid", "Lens visual state contains a non-finite number.", 409);
  const normalized = Object.is(numeric, -0) ? 0 : numeric;
  const bytes = Buffer.allocUnsafe(8);
  bytes.writeDoubleBE(normalized, 0);
  return `f64:${bytes.toString("hex")}`;
};

const append = (parts: DigestToken[], name: string, value: unknown) => parts.push({ field: name, value: text(value) });
const appendDouble = (parts: DigestToken[], name: string, value: unknown, contractVersion: DigestContractVersion) => parts.push({
  field: name,
  value: contractVersion === LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION ? text(value) : float64Token(value),
});
const appendElement = (parts: DigestToken[], name: string, prefix: string, index: number, value: any) => { append(parts, `${name}[${index}].prefix`, prefix); append(parts, `${name}[${index}].modelSource`, field(value, "ModelSource", "modelSource")); append(parts, `${name}[${index}].instanceGuid`, field(value, "InstanceGuid", "instanceGuid")); };
const appendPoint = (parts: DigestToken[], name: string, value: any, nullToken: string, contractVersion: DigestContractVersion): void => { if (!value) { append(parts, name, nullToken); return; } appendDouble(parts, `${name}.x`, field(value, "X", "x"), contractVersion); appendDouble(parts, `${name}.y`, field(value, "Y", "y"), contractVersion); appendDouble(parts, `${name}.z`, field(value, "Z", "z"), contractVersion); };

function lensNextVisualStateDigestTokens(state: any, contractVersion = digestContractVersion(state)): DigestToken[] {
  const parts: DigestToken[] = [];
  append(parts, "schemaVersion", field(state, "SchemaVersion", "schemaVersion")); append(parts, "projectId", field(state, "ProjectId", "projectId"));
  append(parts, "serverId", field(state, "ServerId", "serverId")); append(parts, "viewpointId", field(state, "ViewpointId", "viewpointId"));
  append(parts, "lifecycleStatus", field(state, "LifecycleStatus", "lifecycleStatus")); append(parts, "revisionNumber", field(state, "RevisionNumber", "revisionNumber"));
  append(parts, "modelFingerprint", field(state, "ModelFingerprint", "modelFingerprint"));
  const camera = field(state, "Camera", "camera");
  if (!camera) append(parts, "camera", "camera:null"); else {
    appendPoint(parts, "camera.position", field(camera, "Position", "position"), "point:null", contractVersion);
    const rotation = field(camera, "Rotation", "rotation");
    if (!rotation) append(parts, "camera.rotation", "rotation:null"); else { appendDouble(parts, "camera.rotation.a", field(rotation, "A", "a"), contractVersion); appendDouble(parts, "camera.rotation.b", field(rotation, "B", "b"), contractVersion); appendDouble(parts, "camera.rotation.c", field(rotation, "C", "c"), contractVersion); appendDouble(parts, "camera.rotation.d", field(rotation, "D", "d"), contractVersion); }
    appendPoint(parts, "camera.worldUpVector", field(camera, "WorldUpVector", "worldUpVector"), "point:null", contractVersion);
    append(parts, "camera.projection", field(camera, "Projection", "projection")); appendDouble(parts, "camera.focalDistance", field(camera, "FocalDistance", "focalDistance"), contractVersion);
    appendDouble(parts, "camera.horizontalExtentAtFocalDistance", field(camera, "HorizontalExtentAtFocalDistance", "horizontalExtentAtFocalDistance"), contractVersion); appendDouble(parts, "camera.verticalExtentAtFocalDistance", field(camera, "VerticalExtentAtFocalDistance", "verticalExtentAtFocalDistance"), contractVersion);
  }
  [...(field(state, "SelectedElements", "selectedElements") ?? [])].sort((a,b) => ordinal(elementKey(a), elementKey(b))).forEach((value, index) => appendElement(parts, "selected", "S", index, value));
  [...(field(state, "HiddenElements", "hiddenElements") ?? [])].sort((a,b) => ordinal(elementKey(a), elementKey(b))).forEach((value, index) => appendElement(parts, "hidden", "H", index, value));
  [...(field(state, "AppearanceOverrides", "appearanceOverrides") ?? [])].sort((a,b) => ordinal(elementKey(field(a,"Element","element")), elementKey(field(b,"Element","element")))).forEach((value, index) => {
    appendElement(parts, "appearance", "A", index, field(value, "Element", "element")); append(parts, `appearance[${index}].red`, field(value, "Red", "red")); append(parts, `appearance[${index}].green`, field(value, "Green", "green")); append(parts, `appearance[${index}].blue`, field(value, "Blue", "blue")); appendDouble(parts, `appearance[${index}].transparency`, field(value, "Transparency", "transparency"), contractVersion);
  });
  [...(field(state, "ModelReferences", "modelReferences") ?? [])].sort((a,b) => ordinal(String(field(a,"Source","source") ?? ""), String(field(b,"Source","source") ?? ""))).forEach((value, index) => {
    append(parts, `models[${index}].source`, field(value,"Source","source")); append(parts, `models[${index}].modelGuid`, field(value,"ModelGuid","modelGuid")); append(parts, `models[${index}].transformFingerprint`, field(value,"TransformFingerprint","transformFingerprint"));
  });
  append(parts, "sectioningJson", field(state,"SectioningJson","sectioningJson")); append(parts, "redlinesJson", field(state,"RedlinesJson","redlinesJson")); append(parts, "screenshotSha256", field(state,"ScreenshotSha256","screenshotSha256"));
  return parts;
}

const canonicalInput = (tokens: DigestToken[]) => tokens.map(token => `${token.value}\u001f`).join("");
const sha256 = (canonical: string) => createHash("sha256").update(canonical, "utf8").digest("hex");

export function lensNextVisualStateDigest(state: any): string {
  const contractVersion = digestContractVersion(state);
  const tokens = lensNextVisualStateDigestTokens(state, contractVersion);
  if (contractVersion === LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION) {
    const evidence = nativeCanonicalEvidence(state);
    if (evidence.canonical && legacyCanonicalMatchesState(tokens, evidence.tokens)) return sha256(evidence.canonical);
  }
  return sha256(canonicalInput(tokens));
}

const legacyFloatingPointField = (name: string) => /^camera\.(?:position\.[xyz]|rotation\.[abcd]|worldUpVector\.[xyz]|focalDistance|horizontalExtentAtFocalDistance|verticalExtentAtFocalDistance)$/.test(name)
  || /^appearance\[\d+\]\.transparency$/.test(name);

const equivalentLegacyFloat = (localValue: string, serverValue: string): boolean => {
  const local = Number(localValue);
  const server = Number(serverValue);
  if (!Number.isFinite(local) || !Number.isFinite(server)) return false;
  const scale = Math.max(1, Math.abs(local), Math.abs(server));
  return Math.abs(local - server) <= scale * 1e-14;
};

const legacyCanonicalMatchesState = (tokens: DigestToken[], localTokens: string[]): boolean => tokens.length === localTokens.length && tokens.every((token, index) =>
  token.value === localTokens[index] || (legacyFloatingPointField(token.field) && equivalentLegacyFloat(localTokens[index]!, token.value)),
);

const nativeCanonicalEvidence = (state: any): { canonical: string; tokens: string[]; computedDigest: string; algorithm: string; contractVersion: string; truncated: boolean } => {
  const native = field(state, "DigestDiagnostics", "digestDiagnostics") ?? {};
  const encoded = String(field(native, "CanonicalInputBase64", "canonicalInputBase64") ?? "");
  const canonical = encoded ? Buffer.from(encoded, "base64").toString("utf8") : "";
  return {
    canonical,
    tokens: canonical.endsWith("\u001f") ? canonical.split("\u001f").slice(0, -1) : [],
    computedDigest: String(field(native, "ComputedDigest", "computedDigest") ?? "").toLowerCase(),
    algorithm: String(field(native, "Algorithm", "algorithm") ?? ""),
    contractVersion: String(field(native, "ContractVersion", "contractVersion") ?? ""),
    truncated: Boolean(field(native, "Truncated", "truncated")),
  };
};

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
  const contractVersion = digestContractVersion(state);
  const embedded = String(field(state,"DigestSha256","digestSha256") ?? "").toLowerCase();
  const recomputed = lensNextVisualStateDigest(state);
  const evidence = nativeCanonicalEvidence(state);
  const serverTokens = lensNextVisualStateDigestTokens(state, contractVersion);
  const exactDigest = recomputed === embedded;
  const verifiedLegacyCanonical = contractVersion === LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION
    && evidence.algorithm === LENS_NEXT_DIGEST_ALGORITHM
    && evidence.contractVersion === LENS_NEXT_LEGACY_DIGEST_CONTRACT_VERSION
    && evidence.computedDigest === embedded
    && evidence.canonical.length > 0
    && sha256(evidence.canonical) === embedded
    && legacyCanonicalMatchesState(serverTokens, evidence.tokens);
  if (!/^[a-f0-9]{64}$/.test(embedded) || (!exactDigest && !verifiedLegacyCanonical)) {
    const diagnostics = digestMismatchDiagnostics(state, embedded, recomputed);
    console.warn("[LensNextDigestMismatch]", JSON.stringify(diagnostics));
    throw new LensNextLocalUploadError("visual_state_digest_mismatch", "The captured local visual-state digest is invalid.", 409, diagnostics);
  }
  if (Number(field(state,"ProjectId","projectId")) !== input.projectId || String(field(state,"ModelFingerprint","modelFingerprint")) !== input.modelFingerprint || Number(field(state,"ServerId","serverId")) !== 1)
    throw new LensNextLocalUploadError("visual_state_context_mismatch", "The captured local visual state does not match this project/model.", 409);
  state.ProjectId = input.projectId; state.ServerId = input.serverId; state.ViewpointId = input.viewpointId; state.LifecycleStatus = "active"; state.RevisionNumber = 1;
  const reboundTokens = verifiedLegacyCanonical ? [...evidence.tokens] : lensNextVisualStateDigestTokens(state, contractVersion).map(token => token.value);
  if (verifiedLegacyCanonical) {
    reboundTokens[1] = String(input.projectId);
    reboundTokens[2] = String(input.serverId);
    reboundTokens[3] = input.viewpointId;
    reboundTokens[4] = "active";
    reboundTokens[5] = "1";
  }
  const reboundCanonical = reboundTokens.map(value => `${value}\u001f`).join("");
  const digest = sha256(reboundCanonical);
  state.DigestDiagnostics = {
    Algorithm: LENS_NEXT_DIGEST_ALGORITHM,
    ContractVersion: contractVersion,
    CanonicalInputBase64: Buffer.from(reboundCanonical, "utf8").toString("base64"),
    CanonicalLength: reboundCanonical.length,
    ComputedDigest: digest,
    Truncated: evidence.truncated,
  };
  state.DigestSha256 = digest;
  const json = JSON.stringify(state);
  if (Buffer.byteLength(json, "utf8") > 4 * 1024 * 1024) throw new LensNextLocalUploadError("visual_state_too_large", "Lens visual state exceeds the 4 MiB limit.", 413);
  return { json, digest };
}
