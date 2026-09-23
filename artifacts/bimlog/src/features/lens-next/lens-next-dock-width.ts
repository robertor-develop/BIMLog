export type LensNextDockWidth = "narrow" | "medium" | "wide";

// These are widths of the Lens content itself, not the Navisworks window.
export function lensNextDockWidth(width: number): LensNextDockWidth {
  if (!Number.isFinite(width) || width <= 0) return "narrow";
  if (width < 451) return "narrow";
  if (width < 800) return "medium";
  return "wide";
}
