import { execFileSync } from "node:child_process";

export const targets = [
  { name: "product-default", branch: "codex/bimlog-product-defaults-block01-20260915" },
  { name: "next-200", branch: "codex/bimlog-next200-block01-20260915" },
];

export function classifyHistoryPath(candidate, file) {
  if (file.startsWith("living-brief/")) return { disposition: "SUPERSEDE", mappedBuilds: "021-025", reason: "current P33 Living Brief authority supersedes candidate narrative" };
  if (file.startsWith("evidence/")) return { disposition: "EVIDENCE_ONLY", mappedBuilds: null, reason: "preserve historical proof without promoting it as current behavior" };
  if (candidate === "product-default") {
    if (file.startsWith("docs/lens-next-mockup/")) return { disposition: "EVIDENCE_ONLY", mappedBuilds: "066-075", reason: "Lens mockup design evidence remains input to the governed Lens completion blocks" };
    if (/lens-next|LensNext/.test(file)) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "066-070", reason: "review against current Lens Next Platform behavior; do not merge the stale branch wholesale" };
    return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "031-120", reason: "non-Lens residue requires its named future acceptance block" };
  }
  if (file.startsWith("scripts/")) {
    if (/pdf/i.test(file)) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "081-085", reason: "PDF/report tooling belongs to artifact and handover quality" };
    if (/route|checkout|continuity|inventory|platform-audit/i.test(file)) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "031-035,061-065,106-115", reason: "release-harness, route-safety, or final acceptance tooling" };
    if (/next200|field-acceptance|release-register|rollback/i.test(file)) return { disposition: "EVIDENCE_ONLY", mappedBuilds: null, reason: "candidate-specific acceptance evidence is retained but not current authority" };
    return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "031-115", reason: "test/tooling correction is reviewed in its owning stabilization block" };
  }
  if (file.startsWith("artifacts/api-server/")) {
    if (/feedback/i.test(file)) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "076-080", reason: "feedback and delivery completion block" };
    if (/pdf-kit|reports|submittal/i.test(file)) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "061-065,081-085", reason: "coordination/report quality blocks" };
    if (/clash/i.test(file)) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "061-070", reason: "coordination and Lens Platform blocks" };
    return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "031-115", reason: "server correction requires current-lineage review in its owning block" };
  }
  if (file.startsWith("artifacts/bimlog/")) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "041-070", reason: "UI behavior belongs to shell, coordination, or Lens Platform acceptance" };
  if (file === "package.json" || file.endsWith("/package.json")) return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "031-035", reason: "test/release harness dependency surface" };
  return { disposition: "MAP_TO_PROGRAM", mappedBuilds: "031-120", reason: "preserve and review in the matching future acceptance block" };
}

export function inspectHistories({ cwd = process.cwd(), base = "HEAD" } = {}) {
  const git = (...args) => execFileSync("git", ["-c", `safe.directory=${cwd.replace(/\\/g, "/")}`, "-C", cwd, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
  return {
    schemaVersion: 1,
    baseCommit: git("rev-parse", base),
    candidates: targets.map(({ name, branch }) => {
      const [baseOnly, candidateOnly] = git("rev-list", "--left-right", "--count", `${base}...${branch}`).split(/\s+/).map(Number);
      const subjects = git("log", "--format=%H%x00%s", `${base}..${branch}`).split(/\r?\n/).filter(Boolean).map((line) => {
        const [commit, subject] = line.split("\0");
        return { commit, subject };
      });
      const files = git("diff", "--name-only", `${base}...${branch}`).split(/\r?\n/).filter(Boolean).map((file) => ({ file, ...classifyHistoryPath(name, file) }));
      const counts = Object.fromEntries(["MAP_TO_PROGRAM", "SUPERSEDE", "EVIDENCE_ONLY"].map((key) => [key, files.filter((item) => item.disposition === key).length]));
      return {
        name,
        branch,
        head: git("rev-parse", branch),
        baseOnly,
        candidateOnly,
        subjects,
        productDefaultNameMismatch: name === "product-default" && subjects.filter((item) => /Lens mockup/i.test(item.subject)).length >= 40,
        files,
        counts,
        wholesaleIntegrationAllowed: false,
      };
    }),
  };
}
