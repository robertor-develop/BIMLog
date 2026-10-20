const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TOKEN = /^[A-Za-z0-9._:-]{1,200}$/;
const VIEWPORTS = Object.freeze(["desktop", "tablet", "mobile"]);

export function validateReleaseCandidateReceipt(receipt, expectedCommit) {
  const errors = [];
  const require = (condition, field, message) => { if (!condition) errors.push({ field, message }); };
  require(receipt?.schemaVersion === "bimlog-release-candidate-receipt-v1", "schemaVersion", "unsupported schema");
  require(receipt?.state === "BUILD_VERIFIED", "state", "candidate must remain BUILD_VERIFIED before publication");
  require(COMMIT.test(receipt?.source?.commit ?? ""), "source.commit", "exact full commit is required");
  require(!expectedCommit || receipt?.source?.commit === expectedCommit, "source.commit", "does not match the reviewed candidate");
  require(COMMIT.test(receipt?.source?.tree ?? ""), "source.tree", "exact full tree is required");
  require(TOKEN.test(receipt?.package?.id ?? ""), "package.id", "package identity is required");
  require(SHA256.test(receipt?.assets?.manifestSha256 ?? ""), "assets.manifestSha256", "asset manifest digest is required");
  require(TOKEN.test(receipt?.database?.schemaVersion ?? ""), "database.schemaVersion", "database schema identity is required");
  require(receipt?.deployment?.publicationReceiptId === null, "deployment.publicationReceiptId", "unpublished candidate cannot claim a publication receipt");
  require(receipt?.deployment?.liveVerified === false, "deployment.liveVerified", "unpublished candidate cannot claim live verification");
  require(receipt?.acceptance?.independentAccepted === false, "acceptance.independentAccepted", "independent acceptance cannot be self-certified");
  require(receipt?.acceptance?.customerAccepted === false, "acceptance.customerAccepted", "customer acceptance cannot be self-certified");
  require(Number.isFinite(Date.parse(receipt?.timestamps?.builtAt ?? "")), "timestamps.builtAt", "build timestamp is required");
  for (const viewport of VIEWPORTS) {
    const journey = receipt?.journeys?.[viewport];
    require(Boolean(journey), `journeys.${viewport}`, "viewport journey is required");
    require(journey?.status === "PASS", `journeys.${viewport}.status`, "viewport journey did not pass");
    require(Array.isArray(journey?.checks) && journey.checks.length > 0, `journeys.${viewport}.checks`, "viewport checks are required");
  }
  return { ok: errors.length === 0, errors };
}
