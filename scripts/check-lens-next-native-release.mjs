import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const json = relative => JSON.parse(read(relative));
const identity = json("contracts/release-identity.json");
const plugin = "plugins/BIMLogLensNext";

assert.match(identity.label, /^v1\.05\.N\d{2}-P\d{2}$/);
assert.match(identity.binaryVersion, /^\d+\.\d+\.\d+\.\d+$/);

for (const relative of [
  `${plugin}/ReleaseIdentity.g.props`,
  `${plugin}/src/ReleaseIdentity.g.cs`,
  `${plugin}/README-ROBERTO-RUBEN.txt`,
  `${plugin}/FIELD-ACCEPTANCE-CHECKLIST.txt`,
]) {
  const source = read(relative);
  assert.ok(source.includes(identity.label), `${relative} must contain ${identity.label}`);
  if (!relative.endsWith(".txt")) {
    assert.ok(source.includes(identity.binaryVersion), `${relative} must contain ${identity.binaryVersion}`);
  }
}

const sharedInstaller = read(`${plugin}/Install-BIMLogLensNext.ps1`);
const canonicalBuilder = read(`${plugin}/Build-CanonicalLensNextPackages.ps1`);
assert.ok(sharedInstaller.includes(`$manifest.release -ne '${identity.label}'`), "shared installer release guard");
assert.ok(sharedInstaller.includes(`$manifest.binaryVersion -ne '${identity.binaryVersion}'`), "shared installer binary guard");
assert.ok(sharedInstaller.includes("Navisworks Manage $Year\\Plugins\\BIMLogNavisPlugin"), "shared installer must retire the historical direct-load Original Lens path");
assert.ok(sharedInstaller.includes("retired direct-load Original Lens plugin remains active"), "shared installer must fail if the retired direct loader survives cutover");
assert.ok(canonicalBuilder.includes("$isPulseBinary"), "canonical staging must include the Pulse-only DLL and PDB instead of producing a manifest-only Pulse bundle");

for (const year of [2021, 2025]) {
  const packageXml = read(`${plugin}/native/${year}/PackageContents.xml`);
  assert.ok(packageXml.includes(`AppVersion="${identity.binaryVersion}"`), `${year} manifest binary version`);
  assert.ok(packageXml.includes(`BIMLog Lens Next ${year}`), `${year} manifest product name`);
  assert.ok(packageXml.includes(`BIMLogLensNext.Native${year}.dll`), `${year} manifest native module`);

  const installer = read(`${plugin}/Install-BIMLogLensNext${year}.ps1`);
  assert.ok(installer.includes(`Install-BIMLogLensNext.ps1`), `${year} installer must use the verified shared installer`);
  assert.ok(installer.includes(`-Year ${year}`), `${year} installer must bind the exact product year`);

  const receipt = json(`${plugin}/evidence/build-package-receipt-${year}.json`);
  assert.equal(receipt.productYear, year);
  assert.equal(receipt.release, identity.label);
  assert.equal(receipt.binaryVersion, identity.binaryVersion);
  assert.equal(receipt.installPerformed, false);
  assert.equal(receipt.tests.releaseIdentityConsistency, "passed");

  const zipName = `BIMLog-Lens-Next-Navisworks${year}-${identity.label}.zip`;
  const zipPath = path.join(root, plugin, zipName);
  assert.ok(fs.statSync(zipPath).size > 0, `${year} package ZIP must be non-empty`);
  const sidecar = read(`${plugin}/${zipName}.sha256`).trim().split(/\s+/);
  assert.match(sidecar[0], /^[A-F0-9]{64}$/i);
  assert.equal(sidecar.at(-1), zipName);
  assert.equal(receipt.zipSha256.toUpperCase(), sidecar[0].toUpperCase());
}

console.log(`Lens Next Native release identity PASS: ${identity.label} / ${identity.binaryVersion}`);
