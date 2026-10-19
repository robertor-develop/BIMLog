export type AssistantDockSide = "left" | "right";

export const ASSISTANT_WIDTH_MIN = 320;
export const ASSISTANT_WIDTH_DEFAULT = 352;
export const ASSISTANT_WIDTH_MAX = 680;
export const ASSISTANT_WIDTH_STEP = 20;
export const ASSISTANT_FULLSCREEN_BREAKPOINT = 760;
export const ASSISTANT_WORKSPACE_MIN = 320;

export function readAssistantOpen(storage: Pick<Storage, "getItem"> | null, userId: number | string | undefined) {
  if (userId == null) return false;
  try { return storage?.getItem(`bimlog:assistant-open:${userId}`) === "true"; }
  catch { return false; }
}

export function writeAssistantOpen(storage: Pick<Storage, "setItem"> | null, userId: number | string | undefined, open: boolean) {
  if (userId == null) return;
  try { storage?.setItem(`bimlog:assistant-open:${userId}`, String(open)); }
  catch { /* Storage restrictions must not prevent opening or closing the panel. */ }
}

export function clampAssistantWidth(width: number, viewportWidth = Number.POSITIVE_INFINITY) {
  const viewportLimit = Number.isFinite(viewportWidth) ? Math.max(ASSISTANT_WIDTH_MIN, viewportWidth - ASSISTANT_WORKSPACE_MIN) : ASSISTANT_WIDTH_MAX;
  return Math.round(Math.min(Math.max(width, ASSISTANT_WIDTH_MIN), ASSISTANT_WIDTH_MAX, viewportLimit));
}

export function assistantWidthFromPointer(clientX: number, viewportWidth: number, dock: AssistantDockSide) {
  return clampAssistantWidth(dock === "right" ? viewportWidth - clientX : clientX, viewportWidth);
}

export function stepAssistantWidth(width: number, key: "ArrowLeft" | "ArrowRight", dock: AssistantDockSide, viewportWidth: number) {
  const physicalDirection = key === "ArrowLeft" ? -1 : 1;
  return clampAssistantWidth(width + (dock === "right" ? -physicalDirection : physicalDirection) * ASSISTANT_WIDTH_STEP, viewportWidth);
}

export function fitAssistantWidthToViewport(width: number, viewportWidth: number) {
  return viewportWidth <= ASSISTANT_FULLSCREEN_BREAKPOINT ? width : clampAssistantWidth(width, viewportWidth);
}

export function assistantWorkspaceMode(viewportWidth: number) {
  return viewportWidth <= ASSISTANT_FULLSCREEN_BREAKPOINT ? "fullscreen" as const : "split" as const;
}

export function assistantMainWorkspaceWidth(panelWidth: number, viewportWidth: number) {
  return assistantWorkspaceMode(viewportWidth) === "fullscreen" ? 0 : viewportWidth - fitAssistantWidthToViewport(panelWidth, viewportWidth);
}

export function readAssistantWorkspace(storage: Pick<Storage, "getItem"> | null) {
  const rawWidth = Number(storage?.getItem("bimlog:assistant-width"));
  const rawDock = storage?.getItem("bimlog:assistant-dock");
  return {
    width: Number.isFinite(rawWidth) && rawWidth > 0 ? clampAssistantWidth(rawWidth) : ASSISTANT_WIDTH_DEFAULT,
    dock: rawDock === "left" ? "left" as const : "right" as const,
    collapsed: storage?.getItem("bimlog:assistant-collapsed") === "true",
  };
}

export function writeAssistantWorkspace(storage: Pick<Storage, "setItem"> | null, width: number, dock: AssistantDockSide, collapsed = false) {
  storage?.setItem("bimlog:assistant-width", String(clampAssistantWidth(width)));
  storage?.setItem("bimlog:assistant-dock", dock);
  storage?.setItem("bimlog:assistant-collapsed", String(collapsed));
}
