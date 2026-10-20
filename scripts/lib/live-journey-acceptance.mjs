const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function result(errors) { return { ok: errors.length === 0, errors }; }
function checker() {
  const errors = [];
  return { errors, require(condition, field, message) { if (!condition) errors.push({ field, message }); } };
}
function requireIdentity(receipt, gate) {
  gate.require(COMMIT.test(receipt?.sourceCommit ?? ""), "sourceCommit", "exact deployed source is required");
  gate.require(SHA256.test(receipt?.assetManifestSha256 ?? ""), "assetManifestSha256", "exact deployed asset manifest is required");
  gate.require(typeof receipt?.packageId === "string" && receipt.packageId.length > 0, "packageId", "package identity is required");
  gate.require(typeof receipt?.schemaVersion === "string" && receipt.schemaVersion.length > 0, "schemaVersion", "schema identity is required");
  gate.require(Number.isFinite(Date.parse(receipt?.observedAt ?? "")), "observedAt", "observation timestamp is required");
}

export function validateAuthenticatedShellJourney(receipt) {
  const gate = checker(); requireIdentity(receipt, gate);
  gate.require(receipt?.kind === "authenticated-shell", "kind", "wrong journey kind");
  gate.require(receipt?.authenticated === true, "authenticated", "production user was not authenticated");
  gate.require(receipt?.visibleChrome === true, "visibleChrome", "journey must run in visible Chrome");
  gate.require(receipt?.consoleErrors === 0, "consoleErrors", "console errors occurred");
  gate.require(receipt?.pageErrors === 0, "pageErrors", "page errors occurred");
  const required = [[1440,900,"split"],[820,1180,"split"],[390,844,"fullscreen"]];
  for (const [width,height,mode] of required) {
    const view = receipt?.viewports?.find?.(item => item.width === width && item.height === height);
    gate.require(Boolean(view), `viewports.${width}x${height}`, "required viewport missing");
    gate.require(view?.mode === mode, `viewports.${width}x${height}.mode`, `expected ${mode}`);
    gate.require(view?.horizontalOverflow === false, `viewports.${width}x${height}.horizontalOverflow`, "horizontal overflow detected");
    gate.require(view?.mainVisible === (mode === "split"), `viewports.${width}x${height}.mainVisible`, "workspace visibility is wrong");
    gate.require(view?.agentVisible === true, `viewports.${width}x${height}.agentVisible`, "Agent is not visible");
  }
  return result(gate.errors);
}
