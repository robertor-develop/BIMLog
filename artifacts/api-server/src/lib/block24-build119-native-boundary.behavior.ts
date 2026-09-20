import assert from "node:assert/strict";
import { requiresFocusedNavisworksSmoke } from "./block24-final-release-contract";

assert.equal(requiresFocusedNavisworksSmoke(["living-brief/STATUS.md", "evidence/BUILD_119.md"]), false);
assert.equal(requiresFocusedNavisworksSmoke(["plugins/BIMLogLensNext/PackageContents.xml"]), true);
assert.equal(requiresFocusedNavisworksSmoke(["plugins/BIMLogLensNext/Native2025/BIMLogLensNext.Native2025.csproj"]), true);
console.log("block24 build119 Native-change boundary: PASS no Native/installer mutation in final web block");
