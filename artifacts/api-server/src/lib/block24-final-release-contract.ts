export type FinalReleaseCandidate = {
  release: string;
  sourceCommit: string;
  sourceTree: string;
  databaseAction: "NONE";
  destructiveStatements: number;
  provider: "replit";
  replitAgentsUsed: false;
  packages: Array<{ year: 2021 | 2025; sha256: string }>;
};

export type FinalBrowserAcceptance = {
  visibleChrome: true;
  authenticatedSuperAdmin: true;
  healthStatus: 200;
  readyStatus: 200;
  liveSourceCommit: string;
  expectedSourceCommit: string;
  dashboard: true;
  projectWorkspace: true;
  lensNext: true;
  sessionReload: true;
  twoTabContinuity: true;
  consoleErrors: 0;
  pageErrors: 0;
};

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/i;

export function validateFinalReleaseCandidate(candidate: FinalReleaseCandidate): string[] {
  const errors: string[] = [];
  if (candidate.release !== "v1.05.N18-P36") errors.push("release identity mismatch");
  if (!SHA40.test(candidate.sourceCommit)) errors.push("source commit must be exact");
  if (!SHA40.test(candidate.sourceTree)) errors.push("source tree must be exact");
  if (candidate.databaseAction !== "NONE" || candidate.destructiveStatements !== 0) errors.push("database plan is not zero-mutation");
  if (candidate.provider !== "replit" || candidate.replitAgentsUsed !== false) errors.push("provider path is not governed Replit Shell/Publish");
  for (const year of [2021, 2025] as const) {
    const pkg = candidate.packages.find((entry) => entry.year === year);
    if (!pkg || !SHA64.test(pkg.sha256)) errors.push(`Navisworks ${year} package hash missing`);
  }
  return errors;
}

export function validateFinalBrowserAcceptance(receipt: FinalBrowserAcceptance): string[] {
  const errors: string[] = [];
  if (!receipt.visibleChrome || !receipt.authenticatedSuperAdmin) errors.push("visible authenticated Chrome proof missing");
  if (receipt.healthStatus !== 200 || receipt.readyStatus !== 200) errors.push("live health/readiness failed");
  if (!SHA40.test(receipt.expectedSourceCommit) || receipt.liveSourceCommit !== receipt.expectedSourceCommit) errors.push("live source identity mismatch");
  if (!receipt.dashboard || !receipt.projectWorkspace || !receipt.lensNext) errors.push("critical live route failed");
  if (!receipt.sessionReload || !receipt.twoTabContinuity) errors.push("session continuity failed");
  if (receipt.consoleErrors !== 0 || receipt.pageErrors !== 0) errors.push("browser errors occurred");
  return errors;
}

export function requiresFocusedNavisworksSmoke(changedPaths: string[]): boolean {
  return changedPaths.some((entry) => /(?:plugins\/BIMLogLensNext|BIMLogLensNext\.Native|Install-BIMLogLensNext|PackageContents\.xml)/i.test(entry.replaceAll("\\", "/")));
}
