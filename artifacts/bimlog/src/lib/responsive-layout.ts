export const supportedViewportWidths = [320, 390, 768, 1280] as const;

export function responsivePresentation(width: number) {
  if (width <= 390) return { navigation: "compact", columns: 1, table: "cards", actions: "stacked" } as const;
  if (width < 768) return { navigation: "compact", columns: 1, table: "cards", actions: "wrapped" } as const;
  if (width < 1280) return { navigation: "drawer", columns: 2, table: "scroll", actions: "wrapped" } as const;
  return { navigation: "sidebar", columns: 3, table: "full", actions: "inline" } as const;
}

export function needsCompactNavigation(width: number, zoom = 1) {
  return width / Math.max(zoom, 0.25) < 768;
}
