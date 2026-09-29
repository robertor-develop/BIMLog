import type { LensNextConnectionState } from "./lens-next-types";
export function lensNextPrerequisiteGuidance(bridge: LensNextConnectionState, modelName: string | null) {
  if (bridge !== "connected") return { state:"disconnected" as const, message:"Navisworks is disconnected. You can review BIMLog issue records, but capture, Working View, synchronization, and publishing actions require the local bridge." };
  if (!modelName) return { state:"no_model" as const, message:"The bridge is connected, but no Navisworks model is active. Open the intended model before capture, Working View, synchronization, or publishing." };
  return { state:"ready" as const, message:`Connected to ${modelName}. Confirm the BIMLog project and model before any governed action.` };
}
