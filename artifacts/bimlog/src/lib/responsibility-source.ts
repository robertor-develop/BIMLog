export type ResponsibilitySourceItem = { key: string; title: string; action: { openLink: string } };
export type ResponsibilitySourceGroup<T> = { current: T; relatedCount: number; sourceIdentity: string };

function sourceIdentity(item: ResponsibilitySourceItem): string {
  const route = item.action.openLink.split("?")[0].replace(/\/$/, "");
  return route || item.key;
}

/** Groups only records that resolve to the same authorized source route. */
export function groupCurrentResponsibilitySources<T extends ResponsibilitySourceItem>(items: readonly T[]): ResponsibilitySourceGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const identity = sourceIdentity(item);
    groups.set(identity, [...(groups.get(identity) ?? []), item]);
  }
  return [...groups.entries()].map(([identity, records]) => ({
    current: records[0],
    relatedCount: records.length,
    sourceIdentity: identity,
  }));
}

export function responsibilitySourceLabel(openLink: string, lang: string): string {
  const es = lang === "es";
  if (openLink.includes("/rfis")) return es ? "RFI fuente" : "Source RFI";
  if (openLink.includes("/submittals")) return es ? "Submittal fuente" : "Source submittal";
  if (openLink.includes("/meetings")) return es ? "Minuta fuente" : "Source meeting minute";
  if (openLink.includes("/coordination")) return es ? "Registro de coordinación" : "Coordination record";
  return es ? "Registro fuente" : "Source record";
}
