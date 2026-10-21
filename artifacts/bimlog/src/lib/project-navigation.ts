export function reconcileNavigationGroups(groupIds: string[], activeGroup: string, saved: Record<string, unknown> = {}) {
  return Object.fromEntries(groupIds.map(id => [id, id === activeGroup || saved[id] === true]));
}

export function toggleNavigationGroup(current: Record<string, boolean>, id: string, activeGroup: string) {
  return { ...current, [id]: id === activeGroup ? true : !current[id] };
}
