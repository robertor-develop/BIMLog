import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LENS_NEXT_DIGEST_CONTRACT_VERSION_V3,
  LensNextLocalUploadError,
  lensNextVisualStateCanonicalInput,
  lensNextVisualStateDigest,
  validateAndRebindLocalVisualState,
  validatePersistedLensNextVisualState,
} from "./lens-next-local-upload";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(here, "../../../../contracts/lens-next/lens-next-visual-digest-v3-vectors.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
assert.equal(fixture.contractVersion, LENS_NEXT_DIGEST_CONTRACT_VERSION_V3);
assert.deepEqual(fixture.vectors.map((vector: any) => vector.id), ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
for (const vector of fixture.vectors) {
  const canonical = lensNextVisualStateCanonicalInput(vector.state);
  assert.equal(Buffer.from(canonical, "utf8").toString("base64"), vector.canonicalInputBase64, `${vector.id} canonical bytes`);
  assert.equal(Buffer.byteLength(canonical, "utf8"), vector.canonicalByteLength, `${vector.id} byte length`);
  assert.equal(lensNextVisualStateDigest(vector.state), vector.sha256, `${vector.id} digest`);
  const state = structuredClone(vector.state);
  state.DigestSha256 = vector.sha256;
  const rebound = validateAndRebindLocalVisualState(state, { projectId: 29, serverId: 700 + vector.id.charCodeAt(0), viewpointId: `V3-${vector.id}`, modelFingerprint: "12".repeat(32) });
  validatePersistedLensNextVisualState(rebound.json, rebound.digest, { projectId: 29, serverId: 700 + vector.id.charCodeAt(0), viewpointId: `V3-${vector.id}`, lifecycleStatus: "active", revisionNumber: 1 });
}

const byId = (id: string) => fixture.vectors.find((vector: any) => vector.id === id);
for (const tamper of fixture.tamperCases) {
  const original = byId(tamper.sourceVector);
  const state = structuredClone(original.state);
  const pathParts = tamper.mutationPath.replace(/\[(\d+)\]/g, ".$1").split(".");
  let target = state;
  for (const part of pathParts.slice(0, -1)) target = target[part];
  target[pathParts.at(-1)!] = tamper.mutationValue;
  assert.equal(lensNextVisualStateDigest(state), tamper.tamperedSha256, `${tamper.id} tampered digest`);
  assert.notEqual(tamper.originalSha256, tamper.tamperedSha256, `${tamper.id} must change digest`);
}

const authoritativeMutations: Array<[string, (element: any) => void]> = [
  ["referenceVersion", element => { element.ReferenceVersion = "lens-next-element-reference.v2-tampered"; }],
  ["persistenceScope", element => { element.PersistenceScope = "source-version-stable"; }],
  ["strategy", element => { element.Strategy = "exact-tree-path"; element.HierarchyIndexPath = [4]; }],
  ["model.referenceVersion", element => { element.Model.ReferenceVersion = "lens-next-model-reference.v2-tampered"; }],
  ["model.modelGuid", element => { element.Model.ModelGuid = "99999999-2222-3333-4444-555555555555"; }],
  ["model.sourceGuid", element => { element.Model.SourceGuid = "99999999-bbbb-cccc-dddd-eeeeeeeeeeee"; }],
  ["model.sourceFileNameNormalized", element => { element.Model.SourceFileNameNormalized += "-tampered"; }],
  ["model.currentFileNameNormalized", element => { element.Model.CurrentFileNameNormalized += "-tampered"; }],
  ["model.transformFingerprint", element => { element.Model.TransformFingerprint += "-tampered"; }],
  ["model.modelInstanceDiscriminator", element => { element.Model.ModelInstanceDiscriminator += "-tampered"; }],
  ["instanceGuid", element => { element.InstanceGuid = "99999999-1234-5678-90ab-abcdefabcdef"; }],
  ["stableCategoryId.categoryName", element => { element.StableCategoryId = { CategoryName: "Tampered", ValueKind: "string", Value: "x" }; }],
  ["stableCategoryId.valueKind", element => { element.StableCategoryId = { CategoryName: "C", ValueKind: "int64", Value: "1" }; }],
  ["stableCategoryId.value", element => { element.StableCategoryId = { CategoryName: "C", ValueKind: "string", Value: "tampered" }; }],
  ["sourceElementId.namespace", element => { element.SourceElementId = { Namespace: "x", CategoryName: "C", PropertyName: "P", ValueType: "string", Value: "V" }; }],
  ["sourceElementId.categoryName", element => { element.SourceElementId = { Namespace: "n", CategoryName: "x", PropertyName: "P", ValueType: "string", Value: "V" }; }],
  ["sourceElementId.propertyName", element => { element.SourceElementId = { Namespace: "n", CategoryName: "C", PropertyName: "x", ValueType: "string", Value: "V" }; }],
  ["sourceElementId.valueType", element => { element.SourceElementId = { Namespace: "n", CategoryName: "C", PropertyName: "P", ValueType: "int64", Value: "1" }; }],
  ["sourceElementId.value", element => { element.SourceElementId = { Namespace: "n", CategoryName: "C", PropertyName: "P", ValueType: "string", Value: "x" }; }],
  ["hierarchyIndexPath", element => { element.HierarchyIndexPath = [1, 2, 3]; }],
  ["confirmation.className", element => { element.Confirmation.ClassName += "x"; }],
  ["confirmation.displayName", element => { element.Confirmation.DisplayName += "x"; }],
  ["confirmation.stablePropertyFingerprint", element => { element.Confirmation.StablePropertyFingerprint += "x"; }],
];
const vectorA = byId("A");
const originalWarn = console.warn;
console.warn = () => undefined;
for (const [fieldName, mutate] of authoritativeMutations) {
  const state = structuredClone(vectorA.state);
  state.DigestSha256 = vectorA.sha256;
  mutate(state.SelectedElements[0]);
  let changedOrStructurallyRejected = false;
  try { changedOrStructurallyRejected = lensNextVisualStateDigest(state) !== vectorA.sha256; }
  catch (error) { changedOrStructurallyRejected = error instanceof LensNextLocalUploadError && error.code === "visual_state_identity_invalid"; }
  assert.equal(changedOrStructurallyRejected, true, `${fieldName} must be authoritative`);
  assert.throws(
    () => validateAndRebindLocalVisualState(state, { projectId: 29, serverId: 901, viewpointId: "tampered", modelFingerprint: "12".repeat(32) }),
    (error: unknown) => error instanceof LensNextLocalUploadError && ["visual_state_digest_mismatch", "visual_state_identity_invalid"].includes(error.code),
    `${fieldName} stale digest rejection`,
  );
}
console.warn = originalWarn;

console.log(`Lens Next digest v3 golden vectors PASS (${fixture.vectors.length} positive, ${fixture.tamperCases.length} named tamper, ${authoritativeMutations.length} authoritative-field mutations)`);
