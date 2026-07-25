import path from "path";
import { fileURLToPath } from "url";
import { builtinModules } from "node:module";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { build as esbuild } from "esbuild";
import {
  access,
  cp,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "fs/promises";
import { generatePlatformMd } from "./scripts/generate-platform-md";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../..");
const execFileAsync = promisify(execFile);

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

function packageRoot(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function isNodeBuiltin(specifier: string): boolean {
  const bare = specifier.replace(/^node:/, "").split("/", 1)[0];
  return specifier.startsWith("node:") || builtinModules.includes(bare);
}

async function assertContainedLinks(directory: string, runtimeRoot: string) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const stats = await lstat(entryPath);
    if (stats.isSymbolicLink()) {
      const resolved = await realpath(entryPath);
      const relative = path.relative(runtimeRoot, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(
          `Production dependency link escapes the artifact: ${path.relative(runtimeRoot, entryPath)}`,
        );
      }
      continue;
    }
    if (stats.isDirectory()) {
      await assertContainedLinks(entryPath, runtimeRoot);
    }
  }
}

async function copyRelocatableDeployment(
  sourceRoot: string,
  destinationRoot: string,
  currentSource = sourceRoot,
) {
  const relativeDirectory = path.relative(sourceRoot, currentSource);
  const currentDestination = path.join(destinationRoot, relativeDirectory);
  await mkdir(currentDestination, { recursive: true });
  const entries = await readdir(currentSource, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(currentSource, entry.name);
    const destinationPath = path.join(currentDestination, entry.name);
    const sourceStats = await lstat(sourcePath);
    if (sourceStats.isSymbolicLink()) {
      const resolvedSource = await realpath(sourcePath);
      const relativeTarget = path.relative(sourceRoot, resolvedSource);
      if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
        throw new Error(
          `Deployed dependency link escapes its staging tree: ${path.relative(sourceRoot, sourcePath)}`,
        );
      }
      const destinationTarget = path.join(destinationRoot, relativeTarget);
      const targetStats = await stat(resolvedSource);
      const linkTarget =
        process.platform === "win32"
          ? destinationTarget
          : path.relative(path.dirname(destinationPath), destinationTarget);
      await symlink(
        linkTarget,
        destinationPath,
        targetStats.isDirectory()
          ? process.platform === "win32"
            ? "junction"
            : "dir"
          : "file",
      );
      continue;
    }
    if (sourceStats.isDirectory()) {
      await copyRelocatableDeployment(sourceRoot, destinationRoot, sourcePath);
      continue;
    }
    await copyFile(sourcePath, destinationPath);
  }
}

async function deployRuntimeClosure(
  runtimeDir: string,
  externalSpecifiers: string[],
) {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) {
    throw new Error(
      "npm_execpath is required to create the production artifact.",
    );
  }

  const configuredTempRoot = process.env.BIMLOG_BUILD_TEMP_ROOT;
  if (
    configuredTempRoot &&
    process.platform === "win32" &&
    !path.resolve(configuredTempRoot).toUpperCase().startsWith("F:\\BIMLOG\\")
  ) {
    throw new Error("BIMLOG_BUILD_TEMP_ROOT must remain under F:\\BIMLog.");
  }
  const tempRoot = path.resolve(configuredTempRoot ?? tmpdir());
  await mkdir(tempRoot, { recursive: true });
  const stagingParent = await mkdtemp(
    path.join(tempRoot, "bimlog-api-deploy-"),
  );
  const deployWorkspace = path.join(stagingParent, "workspace");
  const stagingDir = path.join(stagingParent, "runtime");
  try {
    const filesToCopy = [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "vendor/sheetjs/xlsx-0.20.3.tgz",
      "artifacts/api-server/package.json",
      "artifacts/api-server/dist/index.cjs",
      "artifacts/api-server/dist/index.meta.json",
      "lib/api-zod/package.json",
      "lib/db/package.json",
    ];
    for (const relativePath of filesToCopy) {
      const destination = path.join(deployWorkspace, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(path.join(workspaceRoot, relativePath), destination);
    }
    await cp(
      path.join(workspaceRoot, "lib/api-zod/src"),
      path.join(deployWorkspace, "lib/api-zod/src"),
      { recursive: true },
    );
    await cp(
      path.join(workspaceRoot, "lib/db/src"),
      path.join(deployWorkspace, "lib/db/src"),
      { recursive: true },
    );

    await execFileAsync(
      process.execPath,
      [
        pnpmCli,
        "--dir",
        deployWorkspace,
        "--filter",
        "@workspace/api-server",
        "deploy",
        "--prod",
        "--legacy",
        stagingDir,
      ],
      {
        cwd: deployWorkspace,
        env: { ...process.env, CI: "true" },
        maxBuffer: 20 * 1024 * 1024,
      },
    );

    const deployedSelfLink = path.join(
      stagingDir,
      "node_modules",
      ".pnpm",
      "node_modules",
      "@workspace",
      "api-server",
    );
    await unlink(deployedSelfLink).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    await copyRelocatableDeployment(stagingDir, runtimeDir);
  } finally {
    await rm(stagingParent, { recursive: true, force: true });
  }

  const requiredPackages = [
    ...new Set([
      ...externalSpecifiers.map(packageRoot),
      ...requiredWorkspacePackages,
    ]),
  ].sort();
  for (const packageName of requiredPackages) {
    const packagePath = path.join(runtimeDir, "node_modules", packageName);
    await access(packagePath);
    const resolved = await realpath(packagePath);
    const relative = path.relative(runtimeDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Runtime package escapes the artifact: ${packageName}`);
    }
  }

  await assertContainedLinks(path.join(runtimeDir, "node_modules"), runtimeDir);
  console.log(
    `verified production runtime closure (${requiredPackages.length} direct packages)`,
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
  await deployRuntimeClosure(runtimeDir, externalSpecifiers);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
