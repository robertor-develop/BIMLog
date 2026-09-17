import assert from "node:assert/strict";
import { areaMesh, DEFAULT_AREA_ORBIT, moveAreaOrbit, parseAreaPackage } from "./lens-next-area-preview";

// Geometry fixture is test-only. It is never served as a customer/model result.
const triangle = { A: { X: -1, Y: 0, Z: 0 }, B: { X: 0, Y: 0, Z: 0 }, C: { X: 0, Y: 1, Z: 0 } };
const fixture = {
  ProjectId: "26", ServerId: "101", ViewpointId: "exact-viewpoint", ModelFingerprint: "a".repeat(64),
  ExactClashKey: "exact-clash", SourceLinearUnit: "Meters",
  Region: { Min: { X: -2, Y: -2, Z: -2 }, Max: { X: 2, Y: 2, Z: 2 } },
  Elements: [
    { ExactElementKey: "a", Role: "clash-a", Triangles: [triangle] },
    { ExactElementKey: "b", Role: "clash-b", Triangles: [triangle] },
    { ExactElementKey: "c", Role: "context", Triangles: [triangle] },
  ],
  TriangleCount: 3, EstimatedGeometryBytes: 512 + 3 * 256 + 3 * 72,
};
const expected = { ProjectId: fixture.ProjectId, ServerId: fixture.ServerId, ViewpointId: fixture.ViewpointId,
  ModelFingerprint: fixture.ModelFingerprint, ExactClashKey: fixture.ExactClashKey };
const area = parseAreaPackage(fixture, expected);
const mesh = areaMesh(area);
assert.equal(mesh.length, 54);
assert.deepEqual(Array.from(mesh.slice(3, 6)).map((v) => Math.round(v * 100)), [92, 23, 18]);
assert.deepEqual(Array.from(mesh.slice(21, 24)).map((v) => Math.round(v * 100)), [15, 42, 95]);
assert.deepEqual(Array.from(mesh.slice(39, 42)).map((v) => Math.round(v * 100)), [57, 65, 70]);
assert.equal(mesh[0], -0.25);
assert.equal(moveAreaOrbit(DEFAULT_AREA_ORBIT, 100, 0).yaw, DEFAULT_AREA_ORBIT.yaw + 0.6);
assert.equal(moveAreaOrbit(DEFAULT_AREA_ORBIT, 0, 10000).pitch, 1.4);
assert.equal(moveAreaOrbit(DEFAULT_AREA_ORBIT, 0, 0, -100000).distance, 1.2);
assert.throws(() => moveAreaOrbit(DEFAULT_AREA_ORBIT, Number.NaN, 0));
assert.throws(() => parseAreaPackage({ ...fixture, TriangleCount: 2 }, expected), /inconsistent/);
assert.throws(() => parseAreaPackage({ ...fixture, EstimatedGeometryBytes: 1 }, expected), /inconsistent/);
assert.throws(() => parseAreaPackage({ ...fixture, ModelFingerprint: "" }, expected), /identity/);
assert.throws(() => parseAreaPackage({ ...fixture, SourceLinearUnit: "Unknown" }, expected), /source unit/);
assert.throws(() => parseAreaPackage(fixture, { ...expected, ProjectId: "another" }), /does not match/);
assert.throws(() => parseAreaPackage({ ...fixture, Elements: fixture.Elements.slice(1) }, expected), /pair/);
assert.throws(() => parseAreaPackage({ ...fixture, Elements: [fixture.Elements[0], fixture.Elements[0], fixture.Elements[1]] }, expected), /duplicated/);
assert.throws(() => parseAreaPackage({ ...fixture, Elements: [
  { ...fixture.Elements[0], Triangles: [{ ...triangle, A: { X: 999, Y: 0, Z: 0 } }] },
  fixture.Elements[1], fixture.Elements[2],
] }, expected), /escapes/);
console.log("lens-next-area-preview: PASS (synthetic geometry contract only)");
