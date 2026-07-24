import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const databaseUrlPattern = /\bpostgres(?:ql)?:\/\/[^\s"'`]+/iu;
const secretKeyPattern =
  /(?:^|_)(?:PASSWORD|TOKEN|SECRET|API_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY)(?:$|_)/u;
const assignmentPattern =
  /^\s*["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.*?)\s*,?\s*$/u;

function git(args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function isTrackedConfiguration(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalized).toLowerCase();
  const explicitBasenames = new Set([
    ".gitmodules",
    ".npmrc",
    ".pnpmfile.cjs",
    ".replit",
    ".yarnrc",
    ".yarnrc.yml",
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
    "fly.toml",
    "netlify.toml",
    "pnpm-workspace.yaml",
    "render.yaml",
    "replit.nix",
    "vercel.json",
  ]);
  const recognizedToolConfig =
    /^(?:astro|babel|drizzle|eslint|jest|next|orval|playwright|postcss|prettier|rollup|tailwind|vite|vitest|webpack)\.config\.(?:cjs|js|json|mjs|ts)$/u;
  return (
    explicitBasenames.has(basename) ||
    basename.startsWith(".env") ||
    /^dockerfile(?:\.[a-z0-9_-]+)?$/u.test(basename) ||
    /^tsconfig(?:\.[a-z0-9_-]+)?\.json$/u.test(basename) ||
    recognizedToolConfig.test(basename) ||
    (/^\.github\/workflows\/[^/]+\.(?:yaml|yml)$/u.test(normalized.toLowerCase()))
  );
}

function isVariableReference(rawValue) {
  const value = rawValue.trim().replace(/^["']|["']$/gu, "").trim();
  return (
    value.length === 0 ||
    /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/u.test(value) ||
    /^\$[A-Za-z_][A-Za-z0-9_]*$/u.test(value) ||
    /^\{\{\s*(?:env|secrets)\.[A-Za-z_][A-Za-z0-9_.-]*\s*\}\}$/iu.test(value) ||
    /^(?:process\.)?env\.[A-Za-z_][A-Za-z0-9_.-]*$/iu.test(value) ||
    /^secrets\.[A-Za-z_][A-Za-z0-9_.-]*$/iu.test(value)
  );
}

function lineHasExposure(line) {
  if (databaseUrlPattern.test(line)) return true;

  const assignment = line.match(assignmentPattern);
  if (!assignment) return false;
  const key = assignment[1].replaceAll(/([a-z])([A-Z])/gu, "$1_$2").toUpperCase();
  const isDatabaseUrlKey = key === "DATABASE_URL" || key === "PROD_DATABASE_URL";
  if (!isDatabaseUrlKey && !secretKeyPattern.test(key)) return false;
  return !isVariableReference(assignment[2]);
}

function summarize(findings) {
  const counts = new Map();
  for (const finding of findings) {
    counts.set(finding.path, (counts.get(finding.path) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([filePath, count]) => `${filePath} (${count})`)
    .join(", ");
}

function scanTrackedFiles() {
  const trackedPaths = git(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .filter(isTrackedConfiguration);
  const findings = [];

  for (const filePath of trackedPaths) {
    let contents;
    try {
      contents = readFileSync(path.join(repositoryRoot, filePath), "utf8");
    } catch {
      findings.push({ path: filePath });
      continue;
    }
    for (const line of contents.split(/\r?\n/gu)) {
      if (lineHasExposure(line)) findings.push({ path: filePath });
    }
  }

  return { trackedPaths, findings };
}

function scanWorkingDiff(
  diff = [
    git(["diff", "--unified=0", "--no-color", "--", "."]),
    git(["diff", "--cached", "--unified=0", "--no-color", "--", "."]),
  ].join("\n"),
) {
  const introduced = [];
  const removed = [];
  let currentPath = null;

  for (const line of diff.split(/\r?\n/gu)) {
    if (line.startsWith("+++ b/")) {
      currentPath = line.slice(6);
      continue;
    }
    if (line.startsWith("+++ /dev/null")) {
      currentPath = null;
      continue;
    }
    if (!currentPath || !isTrackedConfiguration(currentPath)) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (lineHasExposure(line.slice(1))) introduced.push({ path: currentPath });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      if (lineHasExposure(line.slice(1))) removed.push({ path: currentPath });
    }
  }

  return { introduced, removed };
}

function fail(message) {
  console.error(`Tracked secret exposure gate failed: ${message}`);
  process.exitCode = 1;
}

function runSelfTest() {
  const unsafeLines = [
    'DATABASE_URL = "postgresql://example.invalid/database"',
    'PROD_DATABASE_URL: "literal-value"',
    'SERVICE_API_KEY = "literal-value"',
    'password = "literal-value"',
  ];
  const safeLines = [
    'DATABASE_URL = "${DATABASE_URL}"',
    "PROD_DATABASE_URL: $PROD_DATABASE_URL",
    "databaseUrl: process.env.DATABASE_URL",
    "serviceToken: secrets.SERVICE_TOKEN",
    'run = "BIMLOG_SCHEMA_TARGET=development pnpm run sync-development"',
  ];
  const includedConfigurationPaths = [
    ".replit",
    ".env",
    ".env.production",
    "replit.nix",
    "lib/db/drizzle.config.ts",
    "artifacts/bimlog/vite.config.ts",
    "tsconfig.base.json",
    ".github/workflows/release.yml",
  ];
  const excludedSourcePaths = [
    "artifacts/api-server/src/routes/config.ts",
    "artifacts/api-server/src/middlewares/config-validator.ts",
    "artifacts/bimlog/src/components/settings/FeaturePolicySettingsPanel.tsx",
    "artifacts/bimlog/src/pages/NotificationSettings.tsx",
    "lib/db/src/schema/config.ts",
    "lib/db/src/schema/platform-settings.ts",
    "artifacts/sync-agent/settings.html",
    "src/config/router.ts",
  ];
  const fixtureDiff = [
    "diff --git a/.replit b/.replit",
    "--- a/.replit",
    "+++ b/.replit",
    "@@ -1 +1 @@",
    '-DATABASE_URL = "postgresql://removed.invalid/database"',
    '+DATABASE_URL = "${DATABASE_URL}"',
  ].join("\n");
  const fixtureResult = scanWorkingDiff(fixtureDiff);

  if (
    unsafeLines.some((line) => !lineHasExposure(line)) ||
    safeLines.some((line) => lineHasExposure(line)) ||
    includedConfigurationPaths.some((filePath) => !isTrackedConfiguration(filePath)) ||
    excludedSourcePaths.some((filePath) => isTrackedConfiguration(filePath)) ||
    fixtureResult.introduced.length !== 0 ||
    fixtureResult.removed.length !== 1
  ) {
    fail("internal fixtures did not enforce literal rejection and variable-reference allowance.");
    return;
  }
  console.log("Tracked secret exposure gate self-test passed.");
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  const tracked = scanTrackedFiles();
  const workingDiff = scanWorkingDiff();

  if (tracked.findings.length > 0) {
    fail(
      `${tracked.findings.length} tracked finding(s) in ${summarize(tracked.findings)}; values were not displayed.`,
    );
  } else {
    console.log(
      `Tracked configuration exposure audit passed: 0 findings across ${tracked.trackedPaths.length} tracked configuration files.`,
    );
  }

  if (workingDiff.introduced.length > 0) {
    fail(
      `${workingDiff.introduced.length} introduced diff finding(s) in ${summarize(workingDiff.introduced)}; values were not displayed.`,
    );
  } else {
    console.log(
      `Working diff exposure audit passed: 0 introduced finding(s), ${workingDiff.removed.length} removed finding(s)${
        workingDiff.removed.length > 0 ? ` in ${summarize(workingDiff.removed)}` : ""
      }; values were not displayed.`,
    );
  }
}
