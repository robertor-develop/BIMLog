export type ConventionConsumerField = {
  label: string;
  fieldOrder: number;
  allowedValues?: string[] | null;
};

export type ConventionConsumer = {
  isActive?: boolean;
  separator?: string | null;
  fields?: ConventionConsumerField[] | null;
} | null | undefined;

export function activeConventionFields(convention: ConventionConsumer): ConventionConsumerField[] {
  if (!convention?.isActive || !Array.isArray(convention.fields)) return [];
  return [...convention.fields].sort((left, right) => left.fieldOrder - right.fieldOrder);
}

export function conventionSeparator(convention: ConventionConsumer): string {
  return convention?.separator === "_" ? "_" : "-";
}

export function suggestedConventionName(convention: ConventionConsumer): string | null {
  const fields = activeConventionFields(convention);
  if (!fields.length) return null;
  return fields
    .map(field => field.allowedValues?.[0] || "???")
    .join(conventionSeparator(convention));
}

export function selectedConventionName(
  convention: ConventionConsumer,
  selections: Record<string, string>,
  disabledFields: Record<string, boolean> = {},
): string {
  return activeConventionFields(convention)
    .filter(field => !disabledFields[field.label])
    .map(field => selections[field.label] || "")
    .filter(Boolean)
    .join(conventionSeparator(convention));
}
