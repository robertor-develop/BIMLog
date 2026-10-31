export function safeProcoreIntakeReturn(value: unknown): string | null {
  return typeof value === 'string' && /^\/projects\/[1-9]\d*\/integrations(?:#procore-guided-intake)?$/.test(value) ? value : null;
}
