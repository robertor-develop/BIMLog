export type ContractItemApuConnection = {
  billingHourlyRate?: string;
  apuPlanVersion?: number | null;
  [key: string]: unknown;
};

export function connectContractItemsToApu<T extends ContractItemApuConnection>(
  items: T[],
  apu: { version: number },
): T[] {
  return items.map((item) => ({
    ...item,
    apuPlanVersion: apu.version,
  }));
}
