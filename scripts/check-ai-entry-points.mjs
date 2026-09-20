import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "artifacts", "api-server", "src");
const outputPath = path.join(root, "evidence", "stabilization-program-20260919", "AI_ENTRY_POINT_INVENTORY.json");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  });
}

const entries = [];
const violations = [];
for (const absolute of walk(sourceRoot).sort()) {
  const source = fs.readFileSync(absolute, "utf8");
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!line.includes(".messages.create(")) return;
    const acquisition = source.includes("getAnthropicClientForUser")
      ? "getAnthropicClientForUser"
      : source.includes("getAgentAnthropicClient")
        ? "getAgentAnthropicClient"
        : "UNRESOLVED";
    if (acquisition === "UNRESOLVED") violations.push(`${relative}:${index + 1}: generation lacks governed client acquisition`);
    entries.push({
      file: relative,
      line: index + 1,
      provider: "anthropic",
      acquisition,
      sourceContext: relative.includes("/agents/") ? "project-scoped agent context" : "authenticated route or project-scoped import context",
      costControl: "AI usage entitlement, limit, and provider selection enforced by governed client acquisition",
      outputAuthority: "draft_or_extraction_only; downstream mutation requires separate authenticated route authority",
      storedOutput: "route-specific persistence or ephemeral response; never autonomous approval/certification",
    });
  });
  if (/new\s+Anthropic\s*\(/.test(source) && relative !== "artifacts/api-server/src/lib/ai-usage.ts") violations.push(`${relative}: direct Anthropic construction outside ai-usage`);
  if (source.includes("https://api.anthropic.com") && !["artifacts/api-server/src/lib/ai-control-plane.ts", "artifacts/api-server/src/lib/telegram-product-provider-broker.ts"].includes(relative)) violations.push(`${relative}: direct provider endpoint outside approved control plane`);
}

const inventory = {
  schemaVersion: 1,
  scope: "BIMLog API provider-generation entry points",
  governingRules: {
    silentInvocationProhibited: true,
    ungovernedProviderClientProhibited: true,
    autonomousApprovalOrCertificationProhibited: true,
  },
  count: entries.length,
  entries,
  approvedDirectProviderInfrastructure: [
    "artifacts/api-server/src/lib/ai-control-plane.ts",
    "artifacts/api-server/src/lib/telegram-product-provider-broker.ts",
  ],
};
const canonical = `${JSON.stringify(inventory, null, 2)}\n`;
if (process.argv.includes("--write")) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canonical, "utf8");
} else {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8").replace(/\r\n?/g, "\n") !== canonical) violations.push("AI entry-point inventory is missing or stale; run pnpm inventory:ai-entry-points");
}
if (violations.length) throw new Error(violations.join("\n"));
console.log(JSON.stringify({ status: "PASS", entryPoints: entries.length, inventory: path.relative(root, outputPath).replaceAll("\\", "/") }));
