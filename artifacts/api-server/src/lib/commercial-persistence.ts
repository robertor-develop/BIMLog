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

export type PersistentCheckoutInput = Readonly<{ companyId: number; userId: number; subscriptionId: string; providerBindingId: string; orderId: string; checkoutId: string; requestKey: string; idempotencyKey: string; fingerprint: string; currency: string; subtotalCents: number; taxCents: number; expiresAt: string }>;

export async function createPersistentOrderCheckout(client: CommercialQueryClient, input: PersistentCheckoutInput): Promise<Readonly<{ orderId: string; checkoutId: string; replayed: boolean }>> {
  positiveInteger(input.companyId, "Company identity"); positiveInteger(input.userId, "User identity");
  for (const [value, label] of [[input.subscriptionId,"Subscription identity"],[input.providerBindingId,"Provider binding identity"],[input.orderId,"Order identity"],[input.checkoutId,"Checkout identity"],[input.requestKey,"Order request identity"],[input.idempotencyKey,"Checkout idempotency identity"]] as const) id(value,label);
  if (!/^[0-9a-f]{64}$/.test(input.fingerprint)) throw new Error("Commercial request fingerprint is invalid");
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Commercial currency is invalid");
  if (!Number.isSafeInteger(input.subtotalCents) || input.subtotalCents < 0 || !Number.isSafeInteger(input.taxCents) || input.taxCents < 0) throw new Error("Commercial amount is invalid");
  const expiresAt = new Date(input.expiresAt); if (!Number.isFinite(expiresAt.getTime())) throw new Error("Checkout expiry is invalid");
  await client.query("BEGIN");
  try {
    const authority = await client.query(`SELECT s.id FROM commercial_subscriptions s JOIN commercial_provider_bindings b ON b.id=$2 AND b.company_id=s.company_id AND b.status='active' WHERE s.id=$1 AND s.company_id=$3 AND s.status IN ('pending','trialing') FOR UPDATE`, [input.subscriptionId,input.providerBindingId,input.companyId]);
    if (!authority.rows[0]) throw new Error("Commercial checkout authority is unavailable");
    const existing = await client.query(`SELECT id,fingerprint FROM commercial_orders WHERE company_id=$1 AND request_key=$2 FOR UPDATE`, [input.companyId,input.requestKey]);
    if (existing.rows[0] && existing.rows[0].fingerprint !== input.fingerprint) throw new Error("Commercial order request conflicts with prior intent");
    const replayed = Boolean(existing.rows[0]);
    const orderId = existing.rows[0] ? id(existing.rows[0].id,"Existing order identity") : input.orderId;
    if (!replayed) await client.query(`INSERT INTO commercial_orders(id,company_id,subscription_id,request_key,fingerprint,status,currency,subtotal_cents,tax_cents,total_cents,created_by_user_id) VALUES($1,$2,$3,$4,$5,'ready',$6,$7,$8,$9,$10)`, [orderId,input.companyId,input.subscriptionId,input.requestKey,input.fingerprint,input.currency,input.subtotalCents,input.taxCents,input.subtotalCents+input.taxCents,input.userId]);
    const checkout = await client.query(`INSERT INTO commercial_checkout_attempts(id,company_id,order_id,provider_binding_id,idempotency_key,request_fingerprint,status,expires_at) VALUES($1,$2,$3,$4,$5,$6,'creating',$7) ON CONFLICT(company_id,idempotency_key) DO UPDATE SET updated_at=now() WHERE commercial_checkout_attempts.order_id=EXCLUDED.order_id AND commercial_checkout_attempts.request_fingerprint=EXCLUDED.request_fingerprint RETURNING id`, [input.checkoutId,input.companyId,orderId,input.providerBindingId,input.idempotencyKey,input.fingerprint,expiresAt.toISOString()]);
    if (!checkout.rows[0]) throw new Error("Commercial checkout replay conflicts with prior intent");
    await client.query("COMMIT");
    return Object.freeze({ orderId, checkoutId:id(checkout.rows[0].id,"Persistent checkout identity"), replayed });
  } catch (error) { await client.query("ROLLBACK"); throw error; }
}

export type PersistentProviderReceiptInput = Readonly<{ id:string; companyId:number; providerBindingId:string; providerEventReference:string; eventType:string; rawPayload:string; payloadDigest:string; signatureVerifiedAt:string }>;
export async function persistVerifiedProviderReceipt(client:CommercialQueryClient,input:PersistentProviderReceiptInput):Promise<Readonly<{id:string;replayed:boolean}>>{
  positiveInteger(input.companyId,"Company identity");id(input.id,"Receipt identity");id(input.providerBindingId,"Provider binding identity");id(input.providerEventReference,"Provider event identity");
  if(!/^[a-z][a-z0-9._]{2,119}$/.test(input.eventType))throw new Error("Provider event type is invalid");
  if(!input.rawPayload||Buffer.byteLength(input.rawPayload,"utf8")>1048576)throw new Error("Provider payload is invalid");
  if(!/^[0-9a-f]{64}$/.test(input.payloadDigest)||commercialPersistenceInternals.sha256(input.rawPayload)!==input.payloadDigest)throw new Error("Provider payload digest is invalid");
  const verifiedAt=new Date(input.signatureVerifiedAt);if(!Number.isFinite(verifiedAt.getTime()))throw new Error("Provider signature time is invalid");
  const binding=await client.query(`SELECT id FROM commercial_provider_bindings WHERE id=$1 AND company_id=$2 AND provider='stripe' AND status='active'`,[input.providerBindingId,input.companyId]);
  if(!binding.rows[0])throw new Error("Provider binding is unavailable");
  const existing=await client.query(`SELECT id,payload_digest,event_type FROM commercial_provider_receipts WHERE provider='stripe' AND provider_event_reference=$1`,[input.providerEventReference]);
  if(existing.rows[0]){
    if(existing.rows[0].payload_digest!==input.payloadDigest||existing.rows[0].event_type!==input.eventType)throw new Error("Provider event replay conflicts with verified evidence");
    return Object.freeze({id:id(existing.rows[0].id,"Existing receipt identity"),replayed:true});
  }
  const inserted=await client.query(`INSERT INTO commercial_provider_receipts(id,company_id,provider_binding_id,provider,provider_event_reference,event_type,payload_digest,raw_payload,signature_verified_at,processing_status) VALUES($1,$2,$3,'stripe',$4,$5,$6,$7,$8,'received') RETURNING id`,[input.id,input.companyId,input.providerBindingId,input.providerEventReference,input.eventType,input.payloadDigest,input.rawPayload,verifiedAt.toISOString()]);
  if(!inserted.rows[0])throw new Error("Provider receipt was not persisted");
  return Object.freeze({id:id(inserted.rows[0].id,"Persistent receipt identity"),replayed:false});
}

export const commercialPersistenceInternals = Object.freeze({ id, positiveInteger, sha256: (value: string) => crypto.createHash("sha256").update(value).digest("hex") });
