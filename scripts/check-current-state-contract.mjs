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
  assert(release.label === "v1.05.N18-P34", "release identity must match the Build 040 P34 candidate");
  assert(release.binaryVersion === "1.5.18.34", "binary identity must match P34");
  assert(lens.supportedProduct === "Lens Next" && lens.supportedProductCount === 1, "Lens Next must be the sole supported Lens product");
  assert(lens.legacyStatus === "migration-only", "Legacy Lens must be migration-only");
  assert(lens.customerFacingLegacyProduct === false && lens.parallelInstallationSupported === false && lens.legacyLoaderAllowedInAcceptedSetup === false, "Legacy Lens cannot remain customer-facing, parallel-installed, or loadable");
  assert(lens.currentPlatformVersion === release.label, "Lens product and release identities must agree");
  assert(ledger.status.completedBuilds >= 41 && ledger.status.completedBuilds <= 45, "Build ledger must track stabilization Block 09");
  assert(ledger.status.remainingBuilds === 120 - ledger.status.completedBuilds, "Build ledger remaining count must reconcile");
  assert(ledger.status.currentUnpublishedBuilds === ledger.status.completedBuilds - 40, "Block 09 unpublished count must start after the accepted Build 040 publication");
  assert(ledger.status.nextBuild === ledger.status.completedBuilds + 1, "Build ledger must advance exactly one build");
  assert(ledger.status.nextPushAfterBuild === 45, "Build ledger next-push cadence must advance to Build 045");
  assert(ledger.status.nextPublicationAfterBuild === 50, "Build ledger next-publication cadence must advance to Build 050");
  for (const document of [status, platform, plugin, quality]) assert(document.includes(release.label), "current authority documents must contain the exact release label");
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
