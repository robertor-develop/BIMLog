/** Display-only resolution matching the server selection rules; never rewrites the draft. */
export function intakeWorkflowPreview<T extends { versionId: string; source: string; definition: { deliverableTypes: string[] } }>(
  options: T[], type: string, savedVersionId: string,
): { matches: T[]; selected: T | undefined; unavailableSavedVersion: boolean } {
  const matches = options.filter(option => option.definition.deliverableTypes.includes(type));
  if (savedVersionId) {
    const selected = matches.find(option => option.versionId === savedVersionId);
    return { matches, selected, unavailableSavedVersion: !selected };
  }
  const company = matches.filter(option => option.source === "company");
  const defaults = matches.filter(option => option.source === "bimlog");
  const selected = company.length === 1 ? company[0] : company.length === 0 && defaults.length === 1 ? defaults[0] : undefined;
  return { matches, selected, unavailableSavedVersion: false };
}
