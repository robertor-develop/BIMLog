import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const contractPath = path.join(repositoryRoot, "contracts", "release-identity.json");

export function validateReleaseIdentity(identity) {
  const { major, minor, native, platform } = identity.release ?? {};
  const expectedLabel = `v${major}.${String(minor).padStart(2, "0")}.N${String(native).padStart(2, "0")}-P${String(platform).padStart(2, "0")}`;
  const expectedBinary = `${major}.${minor}.${native}.${platform}`;
  if (identity.schemaVersion !== "bimlog-release-identity-v1") throw new Error("Unsupported release identity schema");
  if (![major, minor, native, platform].every(Number.isInteger)) throw new Error("Release identity components must be integers");
  if (identity.label !== expectedLabel) throw new Error(`Release label mismatch: expected ${expectedLabel}`);
  if (identity.binaryVersion !== expectedBinary) throw new Error(`Binary version mismatch: expected ${expectedBinary}`);
  return Object.freeze(identity);
}

export function readReleaseIdentity(sourcePath = contractPath) {
  return validateReleaseIdentity(JSON.parse(fs.readFileSync(sourcePath, "utf8")));
}

export function generatedReleaseFiles(identity = readReleaseIdentity()) {
  const json = JSON.stringify(identity, null, 2);
  return new Map([
    ["lib/api-zod/src/release-identity.ts", `// Generated from contracts/release-identity.json. Do not edit.\nexport const BIMLOG_RELEASE_IDENTITY = ${json} as const;\nexport const BIMLOG_RELEASE_VERSION = BIMLOG_RELEASE_IDENTITY.label;\nexport const BIMLOG_BINARY_VERSION = BIMLOG_RELEASE_IDENTITY.binaryVersion;\n`],
    ["plugins/BIMLogLensNext/ReleaseIdentity.g.props", `<Project>\n  <!-- Generated from contracts/release-identity.json. Do not edit. -->\n  <PropertyGroup>\n    <Version>${identity.binaryVersion}</Version>\n    <AssemblyVersion>${identity.binaryVersion}</AssemblyVersion>\n    <FileVersion>${identity.binaryVersion}</FileVersion>\n    <InformationalVersion>${identity.label}</InformationalVersion>\n  </PropertyGroup>\n</Project>\n`],
    ["plugins/BIMLogLensNext/src/ReleaseIdentity.g.cs", `// Generated from contracts/release-identity.json. Do not edit.\nnamespace BIMLogLensNext\n{\n    public static class ReleaseIdentity\n    {\n        public const string ProductVersionLabel = "${identity.label}";\n        public const string BinaryVersion = "${identity.binaryVersion}";\n    }\n}\n`],
    ...[2021, 2025].map((year) => {
      const series = year === 2021 ? "Nw18" : "Nw22";
      return [`plugins/BIMLogLensNext/native/${year}/PackageContents.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<ApplicationPackage SchemaVersion="1.0" AutodeskProduct="Navisworks" Name="BIMLog Lens Next ${year}" Description="BIMLog Lens Next ${identity.label} for Navisworks Manage ${year}" AppVersion="${identity.binaryVersion}" ProductCode="{D91F6111-A9B8-4B05-91BA-8F2DCAD3${year}}" UpgradeCode="{722C5931-DB3B-4C69-A7C0-6D1B7313${year}}">\n  <CompanyDetails Name="IgniteSmart" />\n  <Components Description="Navisworks Manage ${year}">\n    <RuntimeRequirements OS="Win64" Platform="NAVMAN" SeriesMin="${series}" SeriesMax="${series}" />\n    <ComponentEntry AppName="BIMLog Lens Next ${year}" AppType="ManagedPlugin" ModuleName="./Contents/BIMLogLensNext.Native${year}.dll" />\n  </Components>\n</ApplicationPackage>\n`];
    }),
  ]);
}
