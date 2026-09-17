// Candidate renderer contract only. No production route supplies geometry yet.
export type AreaPoint = { X: number; Y: number; Z: number };
export type AreaTriangle = { A: AreaPoint; B: AreaPoint; C: AreaPoint };
export type AreaElement = {
  ExactElementKey: string;
  Role: "clash-a" | "clash-b" | "context";
  Triangles: AreaTriangle[];
};
export type AreaPackage = {
  ProjectId: string;
  ServerId: string;
  ViewpointId: string;
  ModelFingerprint: string;
  ExactClashKey: string;
  SourceLinearUnit: string;
  Region: { Min: AreaPoint; Max: AreaPoint };
  Elements: AreaElement[];
  TriangleCount: number;
  EstimatedGeometryBytes: number;
};
export type AreaIdentity = Pick<AreaPackage, "ProjectId" | "ServerId" | "ViewpointId" | "ModelFingerprint" | "ExactClashKey">;

export type AreaOrbit = { yaw: number; pitch: number; distance: number };
export const DEFAULT_AREA_ORBIT: AreaOrbit = { yaw: -0.6, pitch: 0.35, distance: 3.5 };
export const AREA_MAX_ELEMENTS = 300;
export const AREA_MAX_TRIANGLES = 200_000;
export const AREA_MAX_BYTES = 8 * 1024 * 1024;
const SOURCE_UNITS = new Set(["Feet", "Inches", "Meters", "Centimeters", "Millimeters", "Yards", "Kilometers", "Miles", "Micrometers", "Mils", "Microinches"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function point(value: unknown): value is AreaPoint {
  return isRecord(value) && ["X", "Y", "Z"].every((axis) => typeof value[axis] === "number" && Number.isFinite(value[axis]));
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseAreaPackage(value: unknown, expected: AreaIdentity): AreaPackage {
  if (!isRecord(value) || !["ProjectId", "ServerId", "ViewpointId", "ModelFingerprint", "ExactClashKey", "SourceLinearUnit"].every((key) => nonempty(value[key]))) {
    throw new Error("Bounded area identity is incomplete.");
  }
  if (!expected || ["ProjectId", "ServerId", "ViewpointId", "ModelFingerprint", "ExactClashKey"].some((key) =>
      value[key] !== expected[key as keyof AreaIdentity])) {
    throw new Error("Bounded area does not match the selected clash and model.");
  }
  if (!/^[0-9a-f]{64}$/i.test(String(value.ModelFingerprint)) || !SOURCE_UNITS.has(String(value.SourceLinearUnit))) {
    throw new Error("Bounded area model fingerprint or source unit is invalid.");
  }
  const region = value.Region;
  if (!isRecord(region) || !point(region.Min) || !point(region.Max) ||
      region.Min.X >= region.Max.X || region.Min.Y >= region.Max.Y || region.Min.Z >= region.Max.Z) {
    throw new Error("Bounded area region is invalid.");
  }
  if (!Array.isArray(value.Elements) || value.Elements.length < 2 || value.Elements.length > AREA_MAX_ELEMENTS ||
      !Number.isInteger(value.TriangleCount) || (value.TriangleCount as number) < 2 || (value.TriangleCount as number) > AREA_MAX_TRIANGLES ||
      !Number.isInteger(value.EstimatedGeometryBytes) || (value.EstimatedGeometryBytes as number) <= 0 || (value.EstimatedGeometryBytes as number) > AREA_MAX_BYTES) {
    throw new Error("Bounded area exceeds preview limits or is empty.");
  }
  const roles = new Set<string>();
  const keys = new Set<string>();
  let triangles = 0;
  for (const candidate of value.Elements) {
    if (!isRecord(candidate) || !nonempty(candidate.ExactElementKey) || keys.has(candidate.ExactElementKey) ||
        !["clash-a", "clash-b", "context"].includes(String(candidate.Role)) || !Array.isArray(candidate.Triangles)) {
      throw new Error("Bounded area element is invalid or duplicated.");
    }
    keys.add(candidate.ExactElementKey);
    if (candidate.Role !== "context") {
      if (roles.has(String(candidate.Role))) throw new Error("Clash pair role is duplicated.");
      roles.add(String(candidate.Role));
    }
    if (candidate.Triangles.length === 0) throw new Error("Bounded area element has no geometry.");
    for (const triangle of candidate.Triangles) {
      if (!isRecord(triangle) || !point(triangle.A) || !point(triangle.B) || !point(triangle.C)) {
        throw new Error("Bounded area triangle is invalid.");
      }
      for (const vertex of [triangle.A, triangle.B, triangle.C]) {
        if (vertex.X < region.Min.X - 1e-6 || vertex.X > region.Max.X + 1e-6 ||
            vertex.Y < region.Min.Y - 1e-6 || vertex.Y > region.Max.Y + 1e-6 ||
            vertex.Z < region.Min.Z - 1e-6 || vertex.Z > region.Max.Z + 1e-6) {
          throw new Error("Bounded area triangle escapes its region.");
        }
      }
      triangles += 1;
      if (triangles > AREA_MAX_TRIANGLES) throw new Error("Bounded area triangle cap exceeded.");
    }
  }
  if (!roles.has("clash-a") || !roles.has("clash-b") || triangles !== value.TriangleCount) {
    throw new Error("Bounded area clash pair or triangle count is inconsistent.");
  }
  if (value.EstimatedGeometryBytes !== 512 + value.Elements.length * 256 + triangles * 72) {
    throw new Error("Bounded area byte estimate is inconsistent.");
  }
  return value as AreaPackage;
}

export function areaMesh(area: AreaPackage): Float32Array {
  const center = {
    X: (area.Region.Min.X + area.Region.Max.X) / 2,
    Y: (area.Region.Min.Y + area.Region.Max.Y) / 2,
    Z: (area.Region.Min.Z + area.Region.Max.Z) / 2,
  };
  const span = Math.max(
    area.Region.Max.X - area.Region.Min.X,
    area.Region.Max.Y - area.Region.Min.Y,
    area.Region.Max.Z - area.Region.Min.Z,
  );
  const output = new Float32Array(area.TriangleCount * 3 * 6);
  let offset = 0;
  for (const element of area.Elements) {
    const color = element.Role === "clash-a" ? [0.92, 0.23, 0.18] :
      element.Role === "clash-b" ? [0.15, 0.42, 0.95] : [0.57, 0.65, 0.7];
    for (const triangle of element.Triangles) {
      for (const vertex of [triangle.A, triangle.B, triangle.C]) {
        output.set([(vertex.X - center.X) / span, (vertex.Y - center.Y) / span,
          (vertex.Z - center.Z) / span, ...color], offset);
        offset += 6;
      }
    }
  }
  return output;
}

export function moveAreaOrbit(current: AreaOrbit, deltaX: number, deltaY: number, wheel = 0): AreaOrbit {
  if (![current.yaw, current.pitch, current.distance, deltaX, deltaY, wheel].every(Number.isFinite)) {
    throw new Error("Invalid area navigation input.");
  }
  return {
    yaw: current.yaw + deltaX * 0.006,
    pitch: Math.max(-1.4, Math.min(1.4, current.pitch + deltaY * 0.006)),
    distance: Math.max(1.2, Math.min(12, current.distance * Math.exp(wheel * 0.001))),
  };
}
