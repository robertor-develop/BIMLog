export type CommercialBillingIdentity = Readonly<{
  companyId: number;
  legalName: string;
  address: string;
  phone: string;
  status: "complete" | "incomplete";
  missingFields: readonly ("address" | "phone")[];
}>;

const clean = (value: unknown, field: "address" | "phone", min: number, max: number) => {
  if (typeof value !== "string") throw new Error(`Billing ${field} is required`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) throw new Error(`Billing ${field} is invalid`);
  if(/[\u0000-\u001F\u007F]/.test(normalized))throw new Error(`Billing ${field} is invalid`);
  if(field==="phone"&&!/^\+?[0-9][0-9 ().-]{5,38}[0-9]$/.test(normalized))throw new Error("Billing phone is invalid");
  return normalized;
};

export function deriveCommercialBillingIdentity(input: {
  companyId: unknown;
  legalName: unknown;
  address: unknown;
  phone: unknown;
}): CommercialBillingIdentity {
  if (!Number.isSafeInteger(input.companyId) || Number(input.companyId) < 1) throw new Error("Billing company identity is invalid");
  if (typeof input.legalName !== "string" || !input.legalName.trim()) throw new Error("Billing legal name is invalid");
  const address = typeof input.address === "string" ? input.address.trim().replace(/\s+/g, " ") : "";
  const phone = typeof input.phone === "string" ? input.phone.trim().replace(/\s+/g, " ") : "";
  const missingFields: ("address" | "phone")[] = [];
  if (!address||address.length<5||address.length>300||/[\u0000-\u001F\u007F]/.test(address)) missingFields.push("address");
  if (!phone||phone.length<7||phone.length>40||!/^\+?[0-9][0-9 ().-]{5,38}[0-9]$/.test(phone)) missingFields.push("phone");
  return Object.freeze({
    companyId: Number(input.companyId),
    legalName: input.legalName.trim(),
    address,
    phone,
    status: missingFields.length ? "incomplete" : "complete",
    missingFields: Object.freeze(missingFields),
  });
}

export function parseCommercialBillingIdentityUpdate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Billing identity update is invalid");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["address", "phone"].includes(key))) throw new Error("Billing identity update contains unsupported fields");
  return Object.freeze({address: clean(row.address, "address", 5, 300), phone: clean(row.phone, "phone", 7, 40)});
}
