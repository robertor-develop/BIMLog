export type PublishRoutingDefinition = {
  selectors: { tagKey: string; tagValue: string; blueprintName: string }[];
  tierMappings: { tagKey: string; blueprintName: string; values: { tagValue: string; item: string }[] }[];
};

/** Expose saved vocabulary only. Selection never guesses a blueprint or tag value. */
export function folderWizardPublishOptions(definition: PublishRoutingDefinition | undefined, tags: Record<string, string>) {
  if (!definition) return [];
  const matched = new Set(definition.selectors.filter((entry) => tags[entry.tagKey] === entry.tagValue).map((entry) => entry.blueprintName));
  const options = new Map<string, Set<string>>();
  const add = (key: string, value: string) => {
    if (!options.has(key)) options.set(key, new Set());
    options.get(key)!.add(value);
  };
  for (const selector of definition.selectors) add(selector.tagKey, selector.tagValue);
  for (const mapping of definition.tierMappings) {
    if (matched.size === 1 && !matched.has(mapping.blueprintName)) continue;
    for (const value of mapping.values) add(mapping.tagKey, value.tagValue);
  }
  return [...options].map(([key, values]) => ({ key, values: [...values] }));
}

export function pruneFolderWizardTags(definition: PublishRoutingDefinition | undefined, tags: Record<string, string>) {
  const options = folderWizardPublishOptions(definition, tags);
  return Object.fromEntries(Object.entries(tags).filter(([key, value]) => options.some((option) => option.key === key && option.values.includes(value))));
}
