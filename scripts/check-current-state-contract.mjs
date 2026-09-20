import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8").replace(/\r\n?/g, "\n");
const parse = (relative) => JSON.parse(read(relative));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validate(snapshot) {
  const { release, lens, ledger, status, openLoop, platform, plugin, quality, migration, meeting, viewpoints, provider } = snapshot;
  assert(release.label === "v1.05.N18-P36", "release identity must match the Build 080 P36 candidate");
  assert(release.binaryVersion === "1.5.18.36", "binary identity must match P36");
  assert(lens.supportedProduct === "Lens Next" && lens.supportedProductCount === 1, "Lens Next must be the sole supported Lens product");
  assert(lens.legacyStatus === "migration-only", "Legacy Lens must be migration-only");
  assert(lens.customerFacingLegacyProduct === false && lens.parallelInstallationSupported === false && lens.legacyLoaderAllowedInAcceptedSetup === false, "Legacy Lens cannot remain customer-facing, parallel-installed, or loadable");
  assert(lens.currentPlatformVersion === release.label, "Lens product and release identities must agree");
  assert(ledger.status.completedBuilds === 119, "Build ledger must track completed stabilization Build 119");
  assert(ledger.status.remainingBuilds === 120 - ledger.status.completedBuilds, "Build ledger remaining count must reconcile");
  const expectedUnpublished = ledger.status.completedBuilds % ledger.releaseCadence.publishEveryBuilds;
  assert(ledger.status.currentUnpublishedBuilds === expectedUnpublished, "Build ledger unpublished count must follow the publication cadence");
  assert(ledger.status.nextBuild === 120, "Build ledger must advance to final closure Build 120");
  assert(ledger.status.nextPushAfterBuild === 120, "Final push boundary must remain Build 120");
  assert(ledger.status.nextPublicationAfterBuild === 120, "Final publication boundary must remain Build 120");
  assert(ledger.status.blocker === null, "Build 120 must not retain the owner-deferred 2025 confirmation as a blocker");
  for (const document of [status, platform, plugin]) assert(document.includes(release.label), "current release authorities must contain the exact release label");
  assert(quality.includes("Evidence and Release Quality Gate"), "QUALITY must retain the release-quality authority");
  assert(status.includes("Replit publication receipt `b8718795`"), "STATUS must retain the accepted P34 publication receipt");
  assert(platform.includes("Replit is the established BIMLog publication provider"), "PLATFORM must name the proven Replit provider path");
  assert(migration.includes("development-data copy off") && migration.includes("Replit Agents are prohibited"), "release documentation must preserve the proven database and provider boundaries");
  assert(!meeting.includes("Open Original Lens Viewpoint"), "customer meeting UI must not advertise Original Lens");
  assert(!viewpoints.includes("Use BIMLog Lens plugin") && !viewpoints.includes("Usa el plugin BIMLog Lens"), "customer viewpoint UI must name Lens Next");
  assert(!provider.includes('label: { en: "BIMLog Lens for Navisworks"'), "provider catalog must name Lens Next");
  const currentStatus = status.split("## Convention Builder", 1)[0];
  assert(!/PUSHED_NOT_PUBLISHED/i.test(currentStatus), "current STATUS authority cannot claim pushed-not-published");
  assert(openLoop.includes("OPEN_LOOP_DISPOSITIONS.json"), "OPEN_LOOP must bind historical unchecked items to the disposition inventory");
}

const snapshot = {
  release: parse("contracts/release-identity.json"),
  lens: parse("contracts/lens-product-status.json"),
  ledger: parse("evidence/stabilization-program-20260919/BUILD_LEDGER.json"),
  status: read("living-brief/STATUS.md"),
  openLoop: read("living-brief/OPEN_LOOP.md"),
  platform: read("living-brief/PLATFORM.md"),
  plugin: read("living-brief/PLUGIN.md"),
  quality: read("living-brief/QUALITY.md"),
  migration: read("docs/deployment/DATABASE_MIGRATION_SAFETY.md"),
  meeting: read("artifacts/bimlog/src/pages/project/MeetingsTab.tsx"),
  viewpoints: read("artifacts/bimlog/src/pages/project/LensViewpointsView.tsx"),
  provider: read("artifacts/api-server/src/lib/provider-governance.ts"),
};

validate(snapshot);
execFileSync(process.execPath, [path.join(root, "scripts", "open-loop-dispositions.mjs")], { cwd: root, stdio: "inherit" });

if (process.argv.includes("--self-test")) {
  const invalid = structuredClone(snapshot);
  invalid.lens.supportedProductCount = 2;
  let rejected = false;
  try { validate(invalid); } catch { rejected = true; }
  assert(rejected, "self-test must reject parallel Lens support");
}

console.log(JSON.stringify({ status: "PASS", release: snapshot.release.label, provider: "Replit", supportedLensProduct: snapshot.lens.supportedProduct, completedBuilds: snapshot.ledger.status.completedBuilds }));
