export const acceptanceViewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

export const accessibilityJourneys = ["headquarters", "project-home", "intake", "operations", "files", "rfis", "agent"] as const;

export function hasViewportCoverage(widths: number[]) {
  return acceptanceViewports.every(viewport => widths.includes(viewport.width));
}
