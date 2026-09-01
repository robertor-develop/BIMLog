import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lensNextVisualStateCanonicalInput, lensNextVisualStateDigest } from "../src/lib/lens-next-local-upload";

const contractVersion = "lens-next-visual-digest.v3";
const model = (patch: Record<string, unknown> = {}) => ({
  ReferenceVersion: "lens-next-model-reference.v2",
  ModelGuid: "11111111-2222-3333-4444-555555555555",
  SourceGuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  SourceFileNameNormalized: "1185 river ave model.rvt",
  CurrentFileNameNormalized: "1185 river ave model.nwd",
  TransformFingerprint: "f64:3ff0000000000000,f64:0000000000000000,f64:8000000000000000",
  ModelInstanceDiscriminator: "instance-01",
  ...patch,
});
const element = (strategy: string, patch: Record<string, unknown> = {}) => ({
  ReferenceVersion: "lens-next-element-reference.v2",
  PersistenceScope: "source-reload-stable",
  Strategy: strategy,
  Model: model(),
  InstanceGuid: null,
  StableCategoryId: null,
  SourceElementId: null,
  HierarchyIndexPath: null,
  Confirmation: { ClassName: "Autodesk.Navisworks.Api.ModelItem", DisplayName: "Supply Дuct", StablePropertyFingerprint: "sha256:" + "ab".repeat(32) },
  ...patch,
});
const base = () => ({
  SchemaVersion: "bimlog.lens_next.visual_state.v1",
  ProjectId: 29,
  ServerId: 1,
  ViewpointId: "local-v3-golden",
  LifecycleStatus: "active",
  RevisionNumber: 1,
  ModelFingerprint: "12".repeat(32),
  Camera: null,
  SelectedElements: [] as unknown[],
  HiddenElements: [] as unknown[],
  AppearanceOverrides: [] as unknown[],
  ModelReferences: [] as unknown[],
  SectioningJson: null,
  RedlinesJson: null,
  ScreenshotSha256: null,
  DigestDiagnostics: { Algorithm: "SHA-256", ContractVersion: contractVersion, Truncated: false },
});

const cases: Array<{ id: string; label: string; state: any }> = [];
const add = (id: string, label: string, mutate: (state: any) => void) => { const state = base(); mutate(state); cases.push({ id, label, state }); };
add("A", "InstanceGuid element identity", state => { state.SelectedElements = [element("instance-guid", { PersistenceScope: "same-document-reopen", InstanceGuid: "{ABCDEFAB-1234-5678-90AB-ABCDEFABCDEF}" })]; });
add("B", "Autodesk stable-ID element identity", state => { state.HiddenElements = [element("autodesk-stable-id", { PersistenceScope: "source-version-stable", StableCategoryId: { CategoryName: "LcOaNode", ValueKind: "int64", Value: "9007199254740991" } })]; });
add("C", "source-element-ID identity", state => { state.AppearanceOverrides = [{ Element: element("source-element-id", { SourceElementId: { Namespace: "revit", CategoryName: "Element", PropertyName: "Id", ValueType: "string", Value: "Узел-42" } }), Red: 12, Green: 34, Blue: 56, Transparency: 0.375 }]; });
add("D", "exact-tree-path fallback", state => { state.SelectedElements = [element("exact-tree-path", { PersistenceScope: "same-document-reopen", HierarchyIndexPath: [0, 17, 4, 2147483647] })]; });
add("E", "duplicate model metadata with discriminator", state => { state.ModelReferences = [model({ ModelInstanceDiscriminator: "instance-02" }), model({ ModelInstanceDiscriminator: "instance-01" })]; });
add("F", "Guid.Empty source object", state => { state.ModelReferences = [model({ SourceGuid: "00000000-0000-0000-0000-000000000000" })]; });
add("G", "null optional fields", state => { state.SelectedElements = [element("exact-tree-path", { Model: model({ ModelGuid: null, SourceGuid: null, CurrentFileNameNormalized: null, TransformFingerprint: null }), Confirmation: null, HierarchyIndexPath: [] })]; });
add("H", "populated transform and IEEE-754 camera", state => { state.Camera = { Position: { X: 1.5, Y: -0, Z: 1e100 }, Rotation: { A: 0, B: 0.5, C: -0.25, D: 1 }, WorldUpVector: { X: 0, Y: 1, Z: 0 }, Projection: "Perspective", FocalDistance: 42.125, HorizontalExtentAtFocalDistance: 100.25, VerticalExtentAtFocalDistance: 50.125 }; state.ModelReferences = [model({ TransformFingerprint: "m44:f64:3ff0000000000000,f64:8000000000000000,f64:400921fb54442d18" })]; });
add("I", "empty authoritative arrays", () => {});
add("J", "Unicode and normalized path strings", state => { state.ModelReferences = [model({ SourceFileNameNormalized: "c:\\проекты\\élara\\1185 河.rvt", CurrentFileNameNormalized: "d:/bim/ñ/1185 河.nwd", ModelInstanceDiscriminator: "модель-一" })]; state.SectioningJson = "{\"Enabled\":true,\"Planes\":[],\"Nested\":{\"Linked\":false}}"; });

const materialized = cases.map(item => {
  const canonical = lensNextVisualStateCanonicalInput(item.state);
  return { id: item.id, label: item.label, state: item.state, canonicalInputBase64: Buffer.from(canonical, "utf8").toString("base64"), canonicalByteLength: Buffer.byteLength(canonical, "utf8"), sha256: lensNextVisualStateDigest(item.state) };
});
const originalA = materialized.find(item => item.id === "A")!;
const tamperedElement = structuredClone(originalA.state);
tamperedElement.SelectedElements[0].Model.ModelInstanceDiscriminator = "instance-tampered";
const originalE = materialized.find(item => item.id === "E")!;
const tamperedModel = structuredClone(originalE.state);
tamperedModel.ModelReferences[0].TransformFingerprint = "m44:tampered";
const tamperCases = [
  { id: "K", label: "tampered ElementReference", sourceVector: "A", mutationPath: "SelectedElements[0].Model.ModelInstanceDiscriminator", mutationValue: "instance-tampered", originalSha256: originalA.sha256, tamperedSha256: lensNextVisualStateDigest(tamperedElement) },
  { id: "L", label: "tampered ModelReference", sourceVector: "E", mutationPath: "ModelReferences[0].TransformFingerprint", mutationValue: "m44:tampered", originalSha256: originalE.sha256, tamperedSha256: lensNextVisualStateDigest(tamperedModel) },
];
const fixture = { contractVersion, algorithm: "SHA-256", encoding: "UTF-8", separator: "U+001F after every token", vectors: materialized, tamperCases };
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, "../../../contracts/lens-next/lens-next-visual-digest-v3-vectors.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(fixture, null, 2) + "\n", "utf8");
console.log(output);
