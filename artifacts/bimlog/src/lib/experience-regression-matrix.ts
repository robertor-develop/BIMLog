export const experienceStates = ["loading", "empty", "error", "read", "edit"] as const;
export type ExperienceRegressionState = typeof experienceStates[number];

export const adoptedExperienceSurfaces = [
  { key: "project-setup", route: "/projects/:id/intake", required: experienceStates },
  { key: "operations", route: "/projects/:id/operations", required: experienceStates },
  { key: "rfi-control", route: "/projects/:id/rfis", required: experienceStates },
  { key: "submittal-control", route: "/projects/:id/submittals", required: experienceStates },
  { key: "personal-settings", route: "/profile", required: experienceStates },
  { key: "company-library", route: "/settings/company-pricing", required: experienceStates },
] as const;

export function regressionMatrixCases() {
  return adoptedExperienceSurfaces.flatMap(surface =>
    surface.required.map(state => ({ surface: surface.key, route: surface.route, state })),
  );
}

export function missingRegressionStates(surface: { required: readonly ExperienceRegressionState[] }) {
  return experienceStates.filter(state => !surface.required.includes(state));
}
