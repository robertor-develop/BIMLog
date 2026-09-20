import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { requiresFocusedNavisworksSmoke } from "./block24-final-release-contract";

assert.equal(requiresFocusedNavisworksSmoke(["living-brief/STATUS.md", "evidence/BUILD_119.md"]), false);
assert.equal(requiresFocusedNavisworksSmoke(["plugins/BIMLogLensNext/PackageContents.xml"]), true);
assert.equal(requiresFocusedNavisworksSmoke(["plugins/BIMLogLensNext/Native2025/BIMLogLensNext.Native2025.csproj"]), true);
const evidence = fs.readFileSync(path.resolve(process.cwd(), "../../evidence/stabilization-program-20260919/BUILD_119_NATIVE_BOUNDARY.md"), "utf8");
assert.match(evidence, /PASS_WITH_OWNER_ACCEPTED_2025_FIELD_CONFIRMATION_DEFERRED/);
assert.match(evidence, /-2146959355/);
assert.match(evidence, /assigned the later physical 2025 confirmation to Ruben/);
assert.match(evidence, /does not block Build 120/);
console.log("block24 build119 boundary contract: PASS; 2021 live and dual-year installer proof accepted, physical 2025 confirmation deferred");
