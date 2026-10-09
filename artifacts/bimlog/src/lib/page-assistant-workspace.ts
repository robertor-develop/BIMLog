export type AssistantDockSide = "left" | "right";

export const ASSISTANT_WIDTH_MIN = 360;
export const ASSISTANT_WIDTH_DEFAULT = 440;
export const ASSISTANT_WIDTH_MAX = 680;
export const ASSISTANT_WIDTH_STEP = 20;

export function clampAssistantWidth(width: number, viewportWidth = Number.POSITIVE_INFINITY) {
  const viewportLimit = Number.isFinite(viewportWidth) ? Math.max(ASSISTANT_WIDTH_MIN, viewportWidth - 320) : ASSISTANT_WIDTH_MAX;
  return Math.round(Math.min(Math.max(width, ASSISTANT_WIDTH_MIN), ASSISTANT_WIDTH_MAX, viewportLimit));
}

export function assistantWidthFromPointer(clientX: number, viewportWidth: number, dock: AssistantDockSide) {
  return clampAssistantWidth(dock === "right" ? viewportWidth - clientX : clientX, viewportWidth);
}

export function stepAssistantWidth(width: number, key: "ArrowLeft" | "ArrowRight", dock: AssistantDockSide, viewportWidth: number) {
  const physicalDirection = key === "ArrowLeft" ? -1 : 1;
  return clampAssistantWidth(width + (dock === "right" ? -physicalDirection : physicalDirection) * ASSISTANT_WIDTH_STEP, viewportWidth);
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
