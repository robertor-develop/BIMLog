import crypto from "node:crypto";

export type CommercialQueryResult<Row extends Record<string, unknown>> = Readonly<{ rows: Row[]; rowCount: number | null }>;
export type CommercialQueryClient = Readonly<{ query(text: string, values?: readonly unknown[]): Promise<CommercialQueryResult<Record<string, unknown>>> }>;

const id = (value: unknown, label: string) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value)) throw new Error(`${label} is invalid`);
  return value;
};
const positiveInteger = (value: unknown, label: string) => {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(`${label} is invalid`);
  return Number(value);
};

export type PersistentCommercialAuthority = Readonly<{
  subscription: Record<string, unknown>;
  terms: readonly Record<string, unknown>[];
  seats: readonly Record<string, unknown>[];
  providerBindings: readonly Record<string, unknown>[];
}>;

export async function readPersistentCommercialAuthority(client: CommercialQueryClient, companyId: number): Promise<PersistentCommercialAuthority | null> {
  positiveInteger(companyId, "Company identity");
  const subscription = await client.query(`SELECT * FROM commercial_subscriptions WHERE company_id=$1 AND status IN ('pending','trialing','active','past_due','suspended','canceling') ORDER BY created_at DESC LIMIT 1`, [companyId]);
  if (!subscription.rows[0]) return null;
  const subscriptionId = id(subscription.rows[0].id, "Subscription identity");
  const [terms, seats, bindings] = await Promise.all([
    client.query(`SELECT * FROM commercial_subscription_terms WHERE subscription_id=$1 ORDER BY sequence`, [subscriptionId]),
    client.query(`SELECT * FROM commercial_subscription_seats WHERE subscription_id=$1 AND company_id=$2 ORDER BY seat_number`, [subscriptionId, companyId]),
    client.query(`SELECT * FROM commercial_provider_bindings WHERE company_id=$1 AND status='active' ORDER BY provider, environment`, [companyId]),
  ]);
  return Object.freeze({ subscription: Object.freeze(subscription.rows[0]), terms: Object.freeze(terms.rows.map(Object.freeze)), seats: Object.freeze(seats.rows.map(Object.freeze)), providerBindings: Object.freeze(bindings.rows.map(Object.freeze)) });
}

export const commercialPersistenceInternals = Object.freeze({ id, positiveInteger, sha256: (value: string) => crypto.createHash("sha256").update(value).digest("hex") });
