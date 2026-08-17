import path from "path";
import { fileURLToPath } from "url";
import { builtinModules } from "node:module";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import { build as esbuild } from "esbuild";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import { generatePlatformMd } from "./scripts/generate-platform-md";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../..");
const livingBriefSourceRoot = path.join(workspaceRoot, "living-brief");

type LivingBriefBuildInput = {
  sourceRoot: string;
  sourceCommit: string;
  catalogSha256: string;
  bundleSha256: string;
  files: string[];
};

function canonicalText(value: Buffer | string): string {
  return (Buffer.isBuffer(value) ? value.toString("utf8") : value).replace(/\r\n?/g, "\n");
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(canonicalText(value)).digest("hex");
}

async function loadVerifiedLivingBriefBuildInput(): Promise<LivingBriefBuildInput> {
  const catalogBytes = await readFile(path.join(livingBriefSourceRoot, "catalog.json"));
  const stateBytes = await readFile(path.join(livingBriefSourceRoot, "state.json"));
  const catalog = JSON.parse(catalogBytes.toString("utf8")) as {
    schemaVersion: number;
    documents: Array<{ key: string; file: string }>;
  };
  const state = JSON.parse(stateBytes.toString("utf8")) as {
    schemaVersion: number;
    reconciledThroughCommit: string;
    catalogSha256: string;
    bundleSha256: string;
    documents: Array<{ key: string; file: string; sha256: string }>;
  };
  if (catalog.schemaVersion !== 1 || state.schemaVersion !== 1) {
    throw new Error("Unsupported Living Brief metadata schema.");
  }
  if (catalog.documents.length !== 11 || state.documents.length !== 11) {
    throw new Error("Production Living Brief closure requires exactly 11 documents.");
  }
  if (sha256(catalogBytes) !== state.catalogSha256) {
    throw new Error("Living Brief catalog hash does not match state.json.");
  }
  const metadataByKey = new Map(state.documents.map(document => [document.key, document]));
  for (const document of catalog.documents) {
    if (!/^[A-Z0-9_]+\.md$/.test(document.file) || path.basename(document.file) !== document.file) {
      throw new Error(`Unsafe Living Brief document path: ${document.file}`);
    }
    const metadata = metadataByKey.get(document.key);
    if (!metadata || metadata.file !== document.file) {
      throw new Error(`Living Brief state metadata is missing for ${document.key}.`);
    }
    const content = await readFile(path.join(livingBriefSourceRoot, document.file));
    if (sha256(content) !== metadata.sha256) {
      throw new Error(`Living Brief document hash mismatch: ${document.file}.`);
    }
  }
  const calculatedBundleSha256 = createHash("sha256")
    .update(state.documents.map(document => `${document.key}:${document.sha256}`).join("\n"))
    .digest("hex");
  if (calculatedBundleSha256 !== state.bundleSha256) {
    throw new Error("Living Brief bundle hash does not match state.json.");
  }
  const sourceCommit = execFileSync(
    "git",
    ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "-C", workspaceRoot, "rev-parse", "HEAD"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Build source commit is not a full Git commit.");
  try {
    execFileSync(
      "git",
      ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "-C", workspaceRoot, "diff", "--quiet", "HEAD", "--"],
      { stdio: "ignore" },
    );
    const untracked = execFileSync(
      "git",
      ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "-C", workspaceRoot, "ls-files", "--others", "--exclude-standard"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (untracked) throw new Error("untracked files are present");
  } catch {
    throw new Error("Production runtime assembly requires a clean, committed source tree.");
  }
  execFileSync(
    "git",
    ["-c", `safe.directory=${workspaceRoot.replaceAll("\\", "/")}`, "-C", workspaceRoot, "merge-base", "--is-ancestor", state.reconciledThroughCommit, sourceCommit],
    { stdio: "ignore" },
  );
  return {
    sourceRoot: livingBriefSourceRoot,
    sourceCommit,
    catalogSha256: state.catalogSha256,
    bundleSha256: state.bundleSha256,
    files: ["catalog.json", "state.json", ...catalog.documents.map(document => document.file)],
  };
}

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times without risking some
// packages that are not bundle compatible
const allowlist = [
  "@google/generative-ai",
  "@anthropic-ai/sdk",
  "@sendgrid/mail",
  "adm-zip",
  "axios",
  "bcryptjs",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "docx",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pdf-lib",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

const explicitRuntimeExternals = ["pg"];
const requiredWorkspacePackages = ["@workspace/api-zod", "@workspace/db"];
const requiredRuntimePackages = [
  "@anthropic-ai/sdk",
  "@napi-rs/canvas",
  "@sendgrid/mail",
  ...requiredWorkspacePackages,
  "adm-zip",
  "bcryptjs",
  "docx",
  "pdf-lib",
  "pdf-parse",
  "pdfkit",
  "pg",
  "sharp",
];

function packageRoot(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isNodeBuiltin(specifier: string): boolean {
  const bare = specifier.replace(/^node:/, "").split("/", 1)[0];
  return specifier.startsWith("node:") || builtinModules.includes(bare);
}

async function assembleRuntimeFromInstalledGraph(
  sourceWorkspaceRoot: string,
  runtimeDir: string,
  requiredPackages: string[],
  livingBrief: LivingBriefBuildInput,
  signal?: AbortSignal,
  onPhaseChange?: (phase: "assembly-copy" | "assembly-hash") => void | Promise<void>,
) {
  const apiRoot = path.join(sourceWorkspaceRoot, "artifacts", "api-server");
  const installedNodeModules = path.join(apiRoot, "node_modules");
  const installedRootReal = await realpath(installedNodeModules);
  const repositoryNodeModules = path.join(sourceWorkspaceRoot, "node_modules");
  const repositoryInstalledRootReal = await realpath(repositoryNodeModules);
  const lockfileText = await readFile(path.join(sourceWorkspaceRoot, "pnpm-lock.yaml"), "utf8");
  const workspaceSources = new Map<string, string>([
    ["@workspace/api-zod", path.join(sourceWorkspaceRoot, "lib", "api-zod")],
    ["@workspace/db", path.join(sourceWorkspaceRoot, "lib", "db")],
  ]);
  const workspaceRealRoots = new Map<string, string>();
  for (const [packageName, packagePath] of workspaceSources) {
    workspaceRealRoots.set(packageName, await realpath(packagePath));
  }
  const isContained = (root: string, candidate: string) => {
    const relative = path.relative(root, candidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  };
  const assertNotCancelled = () => {
    if (signal?.aborted) throw new Error("Runtime graph assembly was cancelled.");
  };
  const assertApprovedSource = (packageName: string, resolved: string) => {
    const workspaceReal = workspaceRealRoots.get(packageName);
    const workspaceMatches = workspaceReal && resolved === workspaceReal;
    const installedMatches = isContained(installedRootReal, resolved) || isContained(repositoryInstalledRootReal, resolved);
    if (workspaceReal ? !workspaceMatches : !installedMatches) {
      throw new Error(`Installed package source escapes the approved graph: ${packageName}`);
    }
  };
  const assertPackageName = (packageName: string) => {
    if (!/^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/i.test(packageName)) {
      throw new Error(`Installed dependency graph contains an invalid package name: ${packageName}`);
    }
  };
  const resolveInstalledPackage = async (packageName: string, issuer?: string) => {
    assertPackageName(packageName);
    const explicitWorkspace = workspaceSources.get(packageName);
    const issuerNodeModules = issuer
      ? path.basename(path.dirname(issuer)).startsWith("@")
        ? path.dirname(path.dirname(issuer))
        : path.dirname(issuer)
      : undefined;
    const candidates = explicitWorkspace
      ? [explicitWorkspace]
      : [
          ...(issuer ? [path.join(issuer, "node_modules", packageName)] : []),
          ...(issuerNodeModules ? [path.join(issuerNodeModules, packageName)] : []),
          path.join(installedNodeModules, packageName),
        ];
    for (const candidate of candidates) {
      try {
        const resolved = await realpath(candidate);
        assertApprovedSource(packageName, resolved);
        const stats = await stat(resolved);
        if (!stats.isDirectory()) throw new Error(`Installed package source is not a directory: ${packageName}`);
        return resolved;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    throw new Error(
      `Installed package is missing from the approved graph: ${packageName}; issuer ${issuer ?? "root"}; tried ${candidates.join(", ")}`,
    );
  };

  let materialFileCount = 0;
  const graphBindings: Array<{
    name: string;
    version: string;
    declaredSpec: string;
    sourceRealpath: string;
    contentSha256: string;
    lockKey: string;
    packageLockKey: string;
    snapshotLockKey: string;
  }> = [];
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lockLines = lockfileText.split(/\r?\n/);
  const unquoteYaml = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, "$2");
  const findYamlBlock = (lines: string[], indent: number, key: string) => {
    const prefix = " ".repeat(indent);
    const start = lines.findIndex(line => {
      if (!line.startsWith(prefix) || line.startsWith(`${prefix} `)) return false;
      const trimmed = line.slice(indent).trimEnd();
      return trimmed.endsWith(":") && unquoteYaml(trimmed.slice(0, -1)) === key;
    });
    if (start < 0) return null;
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      if (lines[index].trim() === "") continue;
      const currentIndent = lines[index].length - lines[index].trimStart().length;
      if (currentIndent <= indent) {
        end = index;
        break;
      }
    }
    return lines.slice(start + 1, end);
  };
  const hasYamlEntry = (lines: string[], indent: number, key: string) => {
    const prefix = " ".repeat(indent);
    return lines.some(line => {
      if (!line.startsWith(prefix) || line.startsWith(`${prefix} `)) return false;
      const trimmed = line.slice(indent).trimEnd();
      return trimmed.startsWith(`${key}:`) || trimmed.startsWith(`'${key}':`) || trimmed.startsWith(`"${key}":`);
    });
  };
  const readYamlScalar = (lines: string[], indent: number, key: string) => {
    const prefix = " ".repeat(indent);
    for (const line of lines) {
      if (!line.startsWith(prefix) || line.startsWith(`${prefix} `)) continue;
      const separator = line.indexOf(":", indent);
      if (separator < 0 || unquoteYaml(line.slice(indent, separator)) !== key) continue;
      const value = line.slice(separator + 1).trim();
      return value ? unquoteYaml(value) : null;
    }
    return undefined;
  };
  const parseSemver = (value: string) => {
    const match = value.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
    return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? "" } : null;
  };
  const compareSemver = (left: ReturnType<typeof parseSemver>, right: ReturnType<typeof parseSemver>) => {
    if (!left || !right) throw new Error("Cannot compare invalid semantic versions.");
    for (const key of ["major", "minor", "patch"] as const) {
      if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
    }
    if (left.prerelease === right.prerelease) return 0;
    if (!left.prerelease) return 1;
    if (!right.prerelease) return -1;
    return left.prerelease.localeCompare(right.prerelease);
  };
  const satisfiesComparator = (version: ReturnType<typeof parseSemver>, comparator: string) => {
    const match = comparator.match(/^(<=|>=|<|>|=|\^|~)?\s*(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?/);
    if (!match || !version) return false;
    const operator = match[1] ?? "=";
    const minorWildcard = !match[3] || /^(?:x|\*)$/i.test(match[3]);
    const patchWildcard = !match[4] || /^(?:x|\*)$/i.test(match[4]);
    const base = { major: Number(match[2]), minor: minorWildcard ? 0 : Number(match[3]), patch: patchWildcard ? 0 : Number(match[4]), prerelease: "" };
    const comparison = compareSemver(version, base);
    if (operator === "=" && minorWildcard) return version.major === base.major;
    if (operator === "=" && patchWildcard) return version.major === base.major && version.minor === base.minor;
    if (operator === "^") {
      const upper = base.major > 0
        ? { major: base.major + 1, minor: 0, patch: 0, prerelease: "" }
        : base.minor > 0
          ? { major: 0, minor: base.minor + 1, patch: 0, prerelease: "" }
          : { major: 0, minor: 0, patch: base.patch + 1, prerelease: "" };
      return comparison >= 0 && compareSemver(version, upper) < 0;
    }
    if (operator === "~") {
      const upper = { major: base.major, minor: base.minor + 1, patch: 0, prerelease: "" };
      return comparison >= 0 && compareSemver(version, upper) < 0;
    }
    return operator === ">=" ? comparison >= 0
      : operator === ">" ? comparison > 0
        : operator === "<=" ? comparison <= 0
          : operator === "<" ? comparison < 0
            : comparison === 0;
  };
  const satisfiesDeclaredSpec = (version: string, spec: string) => {
    if (!/^[v0-9xX*~^<>=|.\s-]+$/.test(spec)) return true;
    const parsed = parseSemver(version);
    if (!parsed) return false;
    return spec.split("||").some(disjunction => {
      const trimmed = disjunction.trim();
      const hyphen = trimmed.match(/^(\d+\.\d+\.\d+)\s+-\s+(\d+\.\d+\.\d+)$/);
      if (hyphen) {
        return satisfiesComparator(parsed, `>=${hyphen[1]}`) && satisfiesComparator(parsed, `<=${hyphen[2]}`);
      }
      const comparators = trimmed.split(/\s+/).filter(Boolean);
      return comparators.length > 0 && comparators.every(comparator => satisfiesComparator(parsed, comparator));
    });
  };
  type IssuerBinding = { type: "importer"; key: string } | { type: "package"; lockKey: string };
  type LockBinding = { packageLockKey: string; snapshotLockKey: string };
  const lockedReferenceMatchesVersion = (lockedReference: string, version: string) =>
    lockedReference === version || lockedReference.startsWith(`${version}(`);
  const assertDependencyEdge = (issuer: IssuerBinding, packageName: string, declaredSpec: string, version: string) => {
    if (issuer.type === "importer") {
      const importers = findYamlBlock(lockLines, 0, "importers");
      const importer = importers && findYamlBlock(importers, 2, issuer.key);
      if (!importer) throw new Error(`pnpm-lock.yaml importer is missing: ${issuer.key}.`);
      for (const sectionName of ["dependencies", "optionalDependencies", "devDependencies"]) {
        const section = findYamlBlock(importer, 4, sectionName);
        const edge = section && findYamlBlock(section, 6, packageName);
        if (!edge) continue;
        const lockedSpecifier = readYamlScalar(edge, 8, "specifier");
        const lockedVersion = readYamlScalar(edge, 8, "version");
        if (lockedSpecifier !== declaredSpec) {
          throw new Error(`pnpm-lock.yaml importer spec mismatch for ${packageName}: expected ${declaredSpec}, received ${lockedSpecifier ?? "missing"}.`);
        }
        if (!lockedVersion || (!lockedVersion.startsWith("link:") && !lockedVersion.startsWith("file:") && !lockedReferenceMatchesVersion(lockedVersion, version))) {
          throw new Error(`pnpm-lock.yaml importer version mismatch for ${packageName}@${version}.`);
        }
        return lockedVersion;
      }
      throw new Error(`pnpm-lock.yaml importer edge is missing: ${issuer.key} -> ${packageName}.`);
    }
    const snapshots = findYamlBlock(lockLines, 0, "snapshots");
    const issuerSnapshot = snapshots && findYamlBlock(snapshots, 2, issuer.lockKey);
    if (!issuerSnapshot) throw new Error(`pnpm-lock.yaml issuer snapshot is missing: ${issuer.lockKey}.`);
    for (const sectionName of ["dependencies", "optionalDependencies"]) {
      const section = findYamlBlock(issuerSnapshot, 4, sectionName);
      if (!section) continue;
      const lockedEdge = readYamlScalar(section, 6, packageName);
      if (lockedEdge === undefined) continue;
      if (!lockedEdge || (!lockedEdge.startsWith("link:") && !lockedEdge.startsWith("file:") && !lockedReferenceMatchesVersion(lockedEdge, version))) {
        throw new Error(
          `pnpm-lock.yaml dependency edge mismatch: ${issuer.lockKey} -> ${packageName}; locked ${JSON.stringify(lockedEdge)}, installed ${JSON.stringify(version)}.`,
        );
      }
      return lockedEdge;
    }
    throw new Error(`pnpm-lock.yaml dependency edge is missing: ${issuer.lockKey} -> ${packageName}.`);
  };
  const assertLockBinding = (packageName: string, version: string, declaredSpec: string, issuer: IssuerBinding): LockBinding => {
    if (workspaceSources.has(packageName)) {
      if (!declaredSpec.startsWith("workspace:") && !declaredSpec.startsWith("link:")) {
        throw new Error(`Workspace dependency does not use a workspace/link spec: ${packageName}@${declaredSpec}`);
      }
      const workspaceLeaf = packageName.slice(packageName.lastIndexOf("/") + 1);
      const workspaceLockPattern = new RegExp(
        `^\\s{6}['\"]?${escapeRegExp(packageName)}['\"]?:[\\s\\S]{0,160}?^\\s{8}version:\\s+link:\\.\\./\\.\\./lib/${escapeRegExp(workspaceLeaf)}\\s*$`,
        "m",
      );
      if (!workspaceLockPattern.test(lockfileText)) {
        throw new Error(`Workspace package is not bound to pnpm-lock.yaml: ${packageName}.`);
      }
      const lockedReference = assertDependencyEdge(issuer, packageName, declaredSpec, version);
      const workspaceKey = `workspace:${packageName}@${lockedReference}`;
      return { packageLockKey: workspaceKey, snapshotLockKey: workspaceKey };
    }
    if (!satisfiesDeclaredSpec(version, declaredSpec)) {
      throw new Error(`Installed package version does not satisfy its declared spec: ${packageName} expected ${declaredSpec}, received ${version}.`);
    }
    const lockedReference = assertDependencyEdge(issuer, packageName, declaredSpec, version);
    const lockKeyPattern = new RegExp(
      `^  ['\"]?${escapeRegExp(packageName)}@${escapeRegExp(version)}(?:\\([^\\r\\n]+\\))?['\"]?:\\s*$`,
      "m",
    );
    const packages = findYamlBlock(lockLines, 0, "packages") ?? [];
    const match = packages.join("\n").match(lockKeyPattern);
    let packageLockKey = match
      ? match[0].trim().replace(/:$/, "").replace(/^(['"])(.*)\1$/, "$2")
      : undefined;
    const descriptorCandidates: string[] = [];
    if (!packageLockKey) for (const line of packages) {
      const trimmed = line.trimEnd();
      if (!line.startsWith("  ") || line.startsWith("   ") || !trimmed.endsWith(":")) continue;
      const key = unquoteYaml(trimmed.trim().slice(0, -1));
      if (!key.startsWith(`${packageName}@`)) continue;
      const block = findYamlBlock(packages, 2, key);
      const lockedManifestVersion = block && readYamlScalar(block, 4, "version");
      const suffix = key.slice(packageName.length + 1);
      if (lockedManifestVersion === version && suffix === lockedReference) descriptorCandidates.push(key);
    }
    if (!packageLockKey) {
      const uniqueCandidates = [...new Set(descriptorCandidates)];
      if (uniqueCandidates.length !== 1) {
        throw new Error(`Installed package is not unambiguously bound to pnpm-lock.yaml: ${packageName}@${version}.`);
      }
      packageLockKey = uniqueCandidates[0];
    }
    const snapshotLockKey = `${packageName}@${lockedReference}`;
    const snapshots = findYamlBlock(lockLines, 0, "snapshots");
    if (!snapshots || !hasYamlEntry(snapshots, 2, snapshotLockKey)) {
      throw new Error(`pnpm-lock.yaml exact snapshot is missing: ${snapshotLockKey}.`);
    }
    return { packageLockKey, snapshotLockKey };
  };
  const hashMaterializedPackage = async (packageRoot: string) => {
    await onPhaseChange?.("assembly-hash");
    if (signal?.aborted) throw new Error("Runtime graph hashing was cancelled.");
    const digest = createHash("sha256");
    const walk = async (current: string): Promise<void> => {
      assertNotCancelled();
      for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        assertNotCancelled();
        if (entry.name === "node_modules") continue;
        const entryPath = path.join(current, entry.name);
        const relative = path.relative(packageRoot, entryPath).replaceAll(path.sep, "/");
        const stats = await lstat(entryPath);
        if (stats.isSymbolicLink()) throw new Error(`Materialized package retained a link: ${relative}`);
        if (stats.isDirectory()) {
          digest.update(`D\0${relative}\n`);
          await walk(entryPath);
        } else if (stats.isFile()) {
          digest.update(`F\0${relative}\0${stats.size}\0`);
          const stream = createReadStream(entryPath, { signal });
          try {
            for await (const chunk of stream) {
              assertNotCancelled();
              digest.update(chunk as Buffer);
            }
          } catch (error) {
            if (signal?.aborted) throw new Error("Runtime graph hashing was cancelled.");
            throw error;
          }
          digest.update("\n");
        } else {
          throw new Error(`Materialized package contains a non-regular entry: ${relative}`);
        }
      }
    };
    await walk(packageRoot);
    return digest.digest("hex");
  };
  const copyAbortableFile = async (source: string, destination: string) => {
    assertNotCancelled();
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await pipeline(
        createReadStream(source),
        createWriteStream(destination, { flags: "wx" }),
        { signal },
      );
    } catch (error) {
      if (signal?.aborted) throw new Error("Runtime graph copy was cancelled.");
      throw error;
    }
    assertNotCancelled();
  };
  const copyRegularTree = async (
    sourceRoot: string,
    destinationRoot: string,
    currentSource = sourceRoot,
  ): Promise<void> => {
    assertNotCancelled();
    const sourceStats = await lstat(currentSource);
    let resolvedSource = currentSource;
    if (sourceStats.isSymbolicLink()) {
      resolvedSource = await realpath(currentSource);
      if (!isContained(sourceRoot, resolvedSource)) {
        throw new Error(`Package content link escapes its package: ${path.relative(sourceRoot, currentSource)}`);
      }
    }
    const resolvedStats = await stat(resolvedSource);
    const relative = path.relative(sourceRoot, currentSource);
    const destination = path.join(destinationRoot, relative);
    if (resolvedStats.isDirectory()) {
      await mkdir(destination, { recursive: true });
      for (const entry of (await readdir(resolvedSource, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === "node_modules") continue;
        await copyRegularTree(sourceRoot, destinationRoot, path.join(resolvedSource, entry.name));
      }
      return;
    }
    if (!resolvedStats.isFile()) {
      throw new Error(`Package content is not a regular file or directory: ${relative}`);
    }
    await copyAbortableFile(resolvedSource, destination);
    materialFileCount += 1;
  };

  const activeSources = new Set<string>();
  const materializePackage = async (
    packageName: string,
    sourcePackage: string,
    destinationPackage: string,
    declaredSpec: string,
    issuer: IssuerBinding,
  ): Promise<void> => {
    assertNotCancelled();
    assertPackageName(packageName);
    if (!isContained(runtimeDir, path.resolve(destinationPackage))) {
      throw new Error(`Runtime package destination escapes the artifact: ${packageName}`);
    }
    const sourceKey = process.platform === "win32" ? sourcePackage.toUpperCase() : sourcePackage;
    if (activeSources.has(sourceKey)) {
      throw new Error(`Installed dependency graph contains an unsupported cycle at ${packageName}.`);
    }
    activeSources.add(sourceKey);
    try {
      await copyRegularTree(sourcePackage, destinationPackage);
      const manifestPath = path.join(sourcePackage, "package.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      if (manifest.name !== packageName) {
        throw new Error(`Installed package identity mismatch: expected ${packageName}, received ${manifest.name ?? "missing"}.`);
      }
      if (typeof manifest.version !== "string" || manifest.version.length === 0) {
        throw new Error(`Installed package version is missing: ${packageName}.`);
      }
      const lockBinding = assertLockBinding(packageName, manifest.version, declaredSpec, issuer);
      graphBindings.push({
        name: packageName,
        version: manifest.version,
        declaredSpec,
        sourceRealpath: sourcePackage,
        contentSha256: await hashMaterializedPackage(destinationPackage),
        lockKey: lockBinding.snapshotLockKey,
        packageLockKey: lockBinding.packageLockKey,
        snapshotLockKey: lockBinding.snapshotLockKey,
      });
      const dependencies = Object.keys(manifest.dependencies ?? {}).sort();
      const optionalDependencies = new Set(Object.keys(manifest.optionalDependencies ?? {}));
      const dependencyIssuer: IssuerBinding = workspaceSources.has(packageName)
        ? {
            type: "importer",
            key: path.relative(sourceWorkspaceRoot, workspaceSources.get(packageName)!).split(path.sep).join("/"),
          }
        : { type: "package", lockKey: lockBinding.snapshotLockKey };
      for (const dependencyName of [...new Set([...dependencies, ...optionalDependencies])].sort()) {
        let dependencySource: string;
        try {
          dependencySource = await resolveInstalledPackage(dependencyName, sourcePackage);
        } catch (error) {
          if (optionalDependencies.has(dependencyName) && (error as Error).message.includes("is missing")) continue;
          throw error;
        }
        await materializePackage(
          dependencyName,
          dependencySource,
          path.join(destinationPackage, "node_modules", dependencyName),
          manifest.dependencies?.[dependencyName] ?? manifest.optionalDependencies?.[dependencyName],
          dependencyIssuer,
        );
      }
    } finally {
      activeSources.delete(sourceKey);
    }
  };

  assertNotCancelled();
  await onPhaseChange?.("assembly-copy");
  await mkdir(runtimeDir, { recursive: false });
  await mkdir(path.join(runtimeDir, "dist"), { recursive: true });
  await copyAbortableFile(path.join(apiRoot, "dist", "index.cjs"), path.join(runtimeDir, "dist", "index.cjs"));
  await copyAbortableFile(path.join(apiRoot, "dist", "index.meta.json"), path.join(runtimeDir, "dist", "index.meta.json"));
  const runtimeLivingBrief = path.join(runtimeDir, "living-brief");
  await mkdir(runtimeLivingBrief, { recursive: false });
  for (const file of livingBrief.files) {
    await copyAbortableFile(path.join(livingBrief.sourceRoot, file), path.join(runtimeLivingBrief, file));
  }
  await writeFile(
    path.join(runtimeDir, "deployment-source.json"),
    `${JSON.stringify({ schemaVersion: 1, sourceCommit: livingBrief.sourceCommit, livingBriefCatalogSha256: livingBrief.catalogSha256, livingBriefBundleSha256: livingBrief.bundleSha256 }, null, 2)}\n`,
  );
  const sourceManifest = JSON.parse(await readFile(path.join(apiRoot, "package.json"), "utf8"));
  const runtimeDependencies: Record<string, string> = {};
  for (const packageName of requiredPackages) {
    runtimeDependencies[packageName] =
      sourceManifest.dependencies?.[packageName] ??
      sourceManifest.optionalDependencies?.[packageName] ??
      "workspace:*";
  }
  await writeFile(
    path.join(runtimeDir, "package.json"),
    `${JSON.stringify({ name: sourceManifest.name, version: sourceManifest.version, type: sourceManifest.type, main: "dist/index.cjs", dependencies: runtimeDependencies }, null, 2)}\n`,
  );
  for (const packageName of requiredPackages) {
    const packageSource = await resolveInstalledPackage(packageName);
    await materializePackage(
      packageName,
      packageSource,
      path.join(runtimeDir, "node_modules", packageName),
      runtimeDependencies[packageName],
      { type: "importer", key: "artifacts/api-server" },
    );
  }
  return {
    materialFileCount,
    requiredPackageCount: requiredPackages.length,
    lockfileSha256: createHash("sha256").update(lockfileText).digest("hex"),
    graphBindings: graphBindings.sort((left, right) =>
      `${left.name}@${left.version}:${left.sourceRealpath}`.localeCompare(`${right.name}@${right.version}:${right.sourceRealpath}`),
    ),
  };
}

export async function deployRuntimeClosure(
  runtimeDir: string,
  externalSpecifiers: string[],
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    workspaceRoot?: string;
    evidenceDir?: string;
    livingBrief?: LivingBriefBuildInput;
    onPhaseChange?: (phase: "assembly-copy" | "assembly-hash" | "validation") => void | Promise<void>;
  } = {},
) {
  const sourceWorkspaceRoot = options.workspaceRoot ?? workspaceRoot;
  const timeoutMs = options.timeoutMs ?? 600_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
    throw new Error("Runtime closure timeout must be an integer from 1 to 600000 milliseconds.");
  }

  const evidenceDir = options.evidenceDir ?? path.join(path.dirname(runtimeDir), "runtime-closure-evidence");
  await mkdir(evidenceDir, { recursive: true });
  const stdoutPath = path.join(evidenceDir, "runtime-assembly.stdout.log");
  const stderrPath = path.join(evidenceDir, "runtime-assembly.stderr.log");
  const receiptPath = path.join(evidenceDir, "runtime-closure-receipt.json");
  const hashFile = async (filePath: string) =>
    createHash("sha256").update(await readFile(filePath)).digest("hex");
  const isContained = (root: string, candidate: string) => {
    const relative = path.relative(root, candidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  };
  const assertRegularFile = async (filePath: string, label: string) => {
    const stats = await lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0) {
      throw new Error(`${label} must be a nonempty regular file: ${filePath}`);
    }
    return stats;
  };
  const assertRegularDirectory = async (directory: string, label: string) => {
    const stats = await lstat(directory);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`${label} must be a regular directory: ${directory}`);
    }
    return stats;
  };
  const validateRuntimeClosure = async (root: string, requiredPackages: string[], signal?: AbortSignal) => {
    const assertValidationActive = async () => {
      await options.onPhaseChange?.("validation");
      if (signal?.aborted) throw new Error("Runtime closure validation was cancelled.");
    };
    await assertValidationActive();
    await assertRegularDirectory(root, "Production runtime root");
    await assertValidationActive();
    const runtimeReal = await realpath(root);
    const packageJsonPath = path.join(root, "package.json");
    await assertRegularFile(packageJsonPath, "Runtime package.json");
    const runtimePackage = JSON.parse(await readFile(packageJsonPath, "utf8"));
    if (runtimePackage.name !== "@workspace/api-server") {
      throw new Error("Runtime package.json must identify @workspace/api-server.");
    }
    const dependencies = Object.keys(runtimePackage.dependencies ?? {}).sort();
    if (dependencies.length === 0) {
      throw new Error("Runtime package.json must contain nonzero production dependencies.");
    }
    for (const packageName of requiredPackages) {
      await assertValidationActive();
      if (!dependencies.includes(packageName)) {
        throw new Error(`Runtime package.json does not declare required dependency: ${packageName}`);
      }
    }

    const nodeModules = path.join(root, "node_modules");
    await assertRegularDirectory(nodeModules, "Runtime node_modules");
    await assertRegularFile(path.join(root, "dist", "index.cjs"), "Runtime server bundle");
    await assertRegularFile(path.join(root, "dist", "index.meta.json"), "Runtime server metafile");
    const deploymentSourcePath = path.join(root, "deployment-source.json");
    await assertRegularFile(deploymentSourcePath, "Runtime deployment source identity");
    const deploymentSource = JSON.parse(await readFile(deploymentSourcePath, "utf8"));
    if (!/^[0-9a-f]{40}$/.test(deploymentSource.sourceCommit ?? "")) {
      throw new Error("Runtime deployment source identity is not a full Git commit.");
    }
    const packagedLivingBrief = path.join(root, "living-brief");
    await assertRegularDirectory(packagedLivingBrief, "Runtime Living Brief bundle");
    const packagedCatalog = await readFile(path.join(packagedLivingBrief, "catalog.json"));
    const packagedState = JSON.parse(await readFile(path.join(packagedLivingBrief, "state.json"), "utf8"));
    const packagedCatalogJson = JSON.parse(packagedCatalog.toString("utf8"));
    if (packagedCatalogJson.documents?.length !== 11 || packagedState.documents?.length !== 11) {
      throw new Error("Runtime Living Brief bundle must contain exactly 11 documents.");
    }
    if (sha256(packagedCatalog) !== deploymentSource.livingBriefCatalogSha256) {
      throw new Error("Runtime Living Brief catalog does not match deployment source identity.");
    }
    for (const document of packagedCatalogJson.documents) {
      const metadata = packagedState.documents.find((entry: { key: string }) => entry.key === document.key);
      if (!metadata || metadata.file !== document.file) throw new Error(`Runtime Living Brief metadata is missing for ${document.key}.`);
      if (sha256(await readFile(path.join(packagedLivingBrief, document.file))) !== metadata.sha256) {
        throw new Error(`Runtime Living Brief document hash mismatch: ${document.file}.`);
      }
    }

    const visited = new Set<string>();
    let materialFileCount = 0;
    const inspectTree = async (entryPath: string): Promise<void> => {
      await assertValidationActive();
      const resolved = await realpath(entryPath);
      if (!isContained(runtimeReal, resolved)) {
        throw new Error(`Runtime entry escapes the artifact: ${path.relative(root, entryPath)}`);
      }
      const stats = await stat(resolved);
      if (stats.isFile()) {
        materialFileCount += 1;
        return;
      }
      if (!stats.isDirectory()) {
        throw new Error(`Runtime entry is not a file or directory: ${path.relative(root, entryPath)}`);
      }
      const key = process.platform === "win32" ? resolved.toUpperCase() : resolved;
      if (visited.has(key)) return;
      visited.add(key);
      for (const entry of await readdir(entryPath)) {
        await assertValidationActive();
        await inspectTree(path.join(entryPath, entry));
      }
    };
    await inspectTree(root);

    const countContainedFiles = async (entryPath: string, seen = new Set<string>()): Promise<number> => {
      await assertValidationActive();
      const resolved = await realpath(entryPath);
      if (!isContained(runtimeReal, resolved)) {
        throw new Error(`Runtime source entry escapes the artifact: ${path.relative(root, entryPath)}`);
      }
      const stats = await stat(resolved);
      if (stats.isFile()) return 1;
      if (!stats.isDirectory()) return 0;
      const key = process.platform === "win32" ? resolved.toUpperCase() : resolved;
      if (seen.has(key)) return 0;
      seen.add(key);
      let count = 0;
      for (const entry of await readdir(entryPath)) {
        await assertValidationActive();
        count += await countContainedFiles(path.join(entryPath, entry), seen);
      }
      return count;
    };

    const workspaceSourceCounts: Record<string, number> = {};
    for (const packageName of requiredPackages) {
      await assertValidationActive();
      const packagePath = path.join(nodeModules, packageName);
      const resolved = await realpath(packagePath);
      if (!isContained(runtimeReal, resolved)) {
        throw new Error(`Runtime package escapes the artifact: ${packageName}`);
      }
      const packageManifestPath = path.join(packagePath, "package.json");
      await assertRegularFile(packageManifestPath, `${packageName} package.json`);
      const packageManifest = JSON.parse(await readFile(packageManifestPath, "utf8"));
      if (packageManifest.name !== packageName) {
        throw new Error(`Runtime package identity mismatch: ${packageName}`);
      }
      if (requiredWorkspacePackages.includes(packageName)) {
        const sourceDirectory = path.join(packagePath, "src");
        await assertRegularDirectory(sourceDirectory, `${packageName} source`);
        const sourceFileCount = await countContainedFiles(sourceDirectory);
        if (sourceFileCount === 0) {
          throw new Error(`Runtime workspace source contains no regular files: ${packageName}`);
        }
        workspaceSourceCounts[packageName] = sourceFileCount;
      }
    }
    await assertValidationActive();
    return {
      dependencyCount: dependencies.length,
      requiredPackageCount: requiredPackages.length,
      materialFileCount,
      workspaceSourceCounts,
    };
  };

  const configuredTempRoot = process.env.BIMLOG_BUILD_TEMP_ROOT;
  if (
    configuredTempRoot &&
    process.platform === "win32" &&
    !path.resolve(configuredTempRoot).toUpperCase().startsWith("F:\\BIMLOG\\")
  ) {
    throw new Error("BIMLOG_BUILD_TEMP_ROOT must remain under F:\\BIMLog.");
  }
  const tempRoot = path.resolve(configuredTempRoot ?? tmpdir());
  await lstat(runtimeDir)
    .then(() => {
      throw new Error(`Runtime target must not already exist: ${runtimeDir}`);
    })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  await mkdir(tempRoot, { recursive: true });
  const stagingParent = await mkdtemp(
    path.join(tempRoot, "bimlog-api-deploy-"),
  );
  let processTreeClosed = true;
  let closure: Awaited<ReturnType<typeof validateRuntimeClosure>> | undefined;
  let assembly: Awaited<ReturnType<typeof assembleRuntimeFromInstalledGraph>> | undefined;
  const assemblyStartedAt = Date.now();
  let assemblyTimedOut = false;
  const assemblyController = new AbortController();
  const cancelAssembly = () => assemblyController.abort();
  if (options.signal?.aborted) assemblyController.abort();
  else options.signal?.addEventListener("abort", cancelAssembly, { once: true });
  const assemblyTimer = setTimeout(() => {
    assemblyTimedOut = true;
    assemblyController.abort();
  }, timeoutMs);
  let failure: unknown;
  try {
    const requiredPackages = [
      ...new Set([
        ...externalSpecifiers.map(packageRoot),
        ...requiredRuntimePackages,
      ]),
    ].sort();
    assembly = await assembleRuntimeFromInstalledGraph(
      sourceWorkspaceRoot,
      runtimeDir,
      requiredPackages,
      options.livingBrief ?? await loadVerifiedLivingBriefBuildInput(),
      assemblyController.signal,
      phase => options.onPhaseChange?.(phase),
    );
    closure = await validateRuntimeClosure(runtimeDir, requiredPackages, assemblyController.signal);
    if (assemblyTimedOut || options.signal?.aborted || assemblyController.signal.aborted) {
      throw new Error("Runtime closure timed out or was cancelled before validation completed.");
    }
  } catch (error) {
    failure = assemblyTimedOut
      ? new Error(`Runtime graph assembly timed out after ${Date.now() - assemblyStartedAt}ms.`)
      : options.signal?.aborted && !(error instanceof Error)
        ? new Error(`Runtime graph assembly was cancelled after ${Date.now() - assemblyStartedAt}ms.`)
        : error;
    processTreeClosed = true;
  }
  clearTimeout(assemblyTimer);
  options.signal?.removeEventListener("abort", cancelAssembly);
  if (!failure && (assemblyTimedOut || options.signal?.aborted || assemblyController.signal.aborted)) {
    failure = new Error("Runtime closure timed out or was cancelled before the terminal PASS guard.");
  }

  let stagingPreserved = !processTreeClosed;
  if (processTreeClosed) {
    try {
      await rm(stagingParent, { recursive: true, force: true });
    } catch (error) {
      failure ??= error;
      stagingPreserved = true;
    }
  } else {
    console.error(`Runtime closure staging preserved because process-tree closure is unproven: ${stagingParent}`);
  }

  const stdoutIdentity = await stat(stdoutPath)
    .then(async stats => ({ bytes: stats.size, sha256: await hashFile(stdoutPath) }))
    .catch(() => null);
  const stderrIdentity = await stat(stderrPath)
    .then(async stats => ({ bytes: stats.size, sha256: await hashFile(stderrPath) }))
    .catch(() => null);
  const receipt = {
    schemaVersion: 1,
    status: failure ? "FAIL" : "PASS",
    stagingParent,
    stagingPreserved,
    timeoutMs,
    process: null,
    assembly: {
      strategy: "installed-package-graph",
      timeoutSemantics: "abortable-stream-copy",
      childProcessCount: 0,
      processTreeClosed: true,
      timedOut: assemblyTimedOut,
      cancelled: Boolean(options.signal?.aborted),
      elapsedMs: Date.now() - assemblyStartedAt,
      ...(assembly ?? {}),
    },
    stdout: stdoutIdentity,
    stderr: stderrIdentity,
    closure: closure ?? null,
    failure: failure instanceof Error ? failure.message : failure ? String(failure) : null,
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2));
  if (failure) throw failure;
  console.log(
    `verified production runtime closure (${closure!.requiredPackageCount} direct packages, ${closure!.dependencyCount} dependencies, ${closure!.materialFileCount} files; deterministic assembly ${Date.now() - assemblyStartedAt}ms)`,
  );
}

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  const runtimeDir = path.join(distDir, "runtime");
  const metafilePath = path.join(distDir, "index.meta.json");
  await rm(distDir, { recursive: true, force: true });

  // Generate deterministic structural documentation. It writes only when structure changes.
  console.log("checking deterministic PLATFORM.md...");
  generatePlatformMd();

  console.log("building server...");
  const livingBrief = await loadVerifiedLivingBriefBuildInput();
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = [
    ...allDeps.filter(
      (dep) =>
        !allowlist.includes(dep) &&
        !pkg.dependencies?.[dep]?.startsWith("workspace:"),
    ),
    ...explicitRuntimeExternals,
  ];

  const result = await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "index.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.BIMLOG_BUILD_SOURCE_COMMIT": JSON.stringify(livingBrief.sourceCommit),
    },
    minify: true,
    external: [...new Set(externals)],
    metafile: true,
    logLevel: "info",
  });
  await writeFile(metafilePath, JSON.stringify(result.metafile, null, 2));

  const externalSpecifiers = [
    ...new Set(
      Object.values(result.metafile.outputs)
        .flatMap((output) => output.imports)
        .filter((entry) => entry.external && !isNodeBuiltin(entry.path))
        .map((entry) => entry.path),
    ),
  ].sort();
  await deployRuntimeClosure(runtimeDir, externalSpecifiers, { livingBrief });
}

if (path.resolve(process.argv[1] ?? "") === __filename) {
  buildAll().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
