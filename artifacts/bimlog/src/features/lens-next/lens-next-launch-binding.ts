import type {
  LensNextBridgeProjectContext,
  LensNextProjectOption,
} from "./lens-next-types.ts";

export type LensNextLaunchMode = "browser" | "navisworks";
export type LensNextLaunchBindingStatus =
  | "browser"
  | "waiting_for_bridge"
  | "bound"
  | "unauthorized_project";

export interface LensNextLaunchProjectResolution {
  projectId: number | null;
  locked: boolean;
  status: LensNextLaunchBindingStatus;
  message: string | null;
}

function authorized(projectId: number | null, projects: readonly LensNextProjectOption[]): boolean {
  return projectId !== null && projects.some((project) => project.id === projectId);
}

export function lensNextLaunchModeFromSearch(search: string): LensNextLaunchMode {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("launch") === "navisworks" ? "navisworks" : "browser";
}

export function resolveLensNextLaunchProject(
  projects: readonly LensNextProjectOption[],
  currentProjectId: number | null,
  bridgeContext: LensNextBridgeProjectContext | null,
  launchMode: LensNextLaunchMode,
): LensNextLaunchProjectResolution {
  if (bridgeContext) {
    if (!authorized(bridgeContext.projectId, projects)) {
      return Object.freeze({
        projectId: null,
        locked: true,
        status: "unauthorized_project" as const,
        message: `Navisworks is bound to BIMLog Project ${bridgeContext.projectId}, but this signed-in account is not authorized for that project.`,
      });
    }
    return Object.freeze({
      projectId: bridgeContext.projectId,
      locked: true,
      status: "bound" as const,
      message: null,
    });
  }

  if (launchMode === "navisworks") {
    return Object.freeze({
      projectId: null,
      locked: true,
      status: "waiting_for_bridge" as const,
      message: "Connecting to the active Navisworks Lens Next session…",
    });
  }

  return Object.freeze({
    projectId: authorized(currentProjectId, projects)
      ? currentProjectId
      : (projects[0]?.id ?? null),
    locked: false,
    status: "browser" as const,
    message: null,
  });
}
