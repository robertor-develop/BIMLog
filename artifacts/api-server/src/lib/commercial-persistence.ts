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

export type PersistentSubscriptionLifecycle=Readonly<{status:"pending"|"trialing"|"active"|"past_due"|"suspended"|"canceling"|"canceled";plan:"professional"|"team"|"business";billingCycle:"monthly"|"annual";seatQuantity:number;startedAt:string|null;canceledAt:string|null;updatedAt:string}>;
export async function readLatestSubscriptionLifecycle(client:CommercialQueryClient,companyId:number):Promise<PersistentSubscriptionLifecycle|null>{
  positiveInteger(companyId,"Company identity");
  const result=await client.query(`SELECT status,plan_code,billing_cycle,seat_quantity,started_at,canceled_at,updated_at FROM commercial_subscriptions WHERE company_id=$1 ORDER BY created_at DESC LIMIT 1`,[companyId]);
  const row=result.rows[0] as Record<string,unknown>|undefined;if(!row)return null;
  const statuses=["pending","trialing","active","past_due","suspended","canceling","canceled"] as const,plans=["professional","team","business"] as const,cycles=["monthly","annual"] as const;
  if(!statuses.includes(row.status as typeof statuses[number])||!plans.includes(row.plan_code as typeof plans[number])||!cycles.includes(row.billing_cycle as typeof cycles[number])||!Number.isSafeInteger(row.seat_quantity)||Number(row.seat_quantity)<1)throw new Error("Subscription lifecycle is invalid");
  const timestamp=(value:unknown,label:string,nullable=false)=>{if(nullable&&value===null)return null;if(typeof value!=="string"||!Number.isFinite(Date.parse(value)))throw new Error(`${label} is invalid`);return value;};
  return Object.freeze({status:row.status as typeof statuses[number],plan:row.plan_code as typeof plans[number],billingCycle:row.billing_cycle as typeof cycles[number],seatQuantity:Number(row.seat_quantity),startedAt:timestamp(row.started_at,"Subscription start",true),canceledAt:timestamp(row.canceled_at,"Subscription cancellation",true),updatedAt:timestamp(row.updated_at,"Subscription update")!});
}

export type PersistentSubscriptionSetupInput=Readonly<{companyId:number;userId:number;subscriptionId:string;bindingId:string;planCode:"professional"|"team"|"business";billingCycle:"monthly"|"annual";seatQuantity:number;providerEnvironment:"test"|"live";providerCustomerReference:string}>;
export async function persistSubscriptionSetup(client:CommercialQueryClient,input:PersistentSubscriptionSetupInput):Promise<Readonly<{subscriptionId:string;providerBindingId:string;replayed:boolean}>>{
  positiveInteger(input.companyId,"Company identity");positiveInteger(input.userId,"User identity");id(input.subscriptionId,"Subscription identity");id(input.bindingId,"Provider binding identity");
  if(!["professional","team","business"].includes(input.planCode)||!["monthly","annual"].includes(input.billingCycle)||!Number.isSafeInteger(input.seatQuantity)||input.seatQuantity<1||input.seatQuantity>10000)throw new Error("Subscription setup offer is invalid");
  if(!["test","live"].includes(input.providerEnvironment)||!/^cus_[A-Za-z0-9_]{6,}$/.test(input.providerCustomerReference))throw new Error("Subscription setup provider binding is invalid");
  await client.query("BEGIN");
  try{
    await client.query(`SELECT id FROM companies WHERE id=$1 FOR UPDATE`,[input.companyId]);
    const existing=await client.query(`SELECT s.id,s.plan_code,s.billing_cycle,s.seat_quantity,b.id provider_binding_id,b.environment,b.customer_reference FROM commercial_subscriptions s LEFT JOIN commercial_provider_bindings b ON b.company_id=s.company_id AND b.provider='stripe' AND b.status='active' WHERE s.company_id=$1 AND s.status IN ('pending','trialing','active','past_due','suspended','canceling') ORDER BY s.created_at DESC LIMIT 1`,[input.companyId]);
    if(existing.rows[0]){
      const row=existing.rows[0],matches=row.plan_code===input.planCode&&row.billing_cycle===input.billingCycle&&Number(row.seat_quantity)===input.seatQuantity&&row.environment===input.providerEnvironment&&row.customer_reference===input.providerCustomerReference;
      if(!matches)throw new Error("Company already has a different commercial subscription authority");
      await client.query("COMMIT");return Object.freeze({subscriptionId:id(row.id,"Existing subscription identity"),providerBindingId:id(row.provider_binding_id,"Existing provider binding identity"),replayed:true});
    }
    await client.query(`INSERT INTO commercial_subscriptions(id,company_id,plan_code,billing_cycle,status,currency,seat_quantity) VALUES($1,$2,$3,$4,'pending','USD',$5)`,[input.subscriptionId,input.companyId,input.planCode,input.billingCycle,input.seatQuantity]);
    await client.query(`INSERT INTO commercial_provider_bindings(id,company_id,provider,environment,customer_reference,status) VALUES($1,$2,'stripe',$3,$4,'active')`,[input.bindingId,input.companyId,input.providerEnvironment,input.providerCustomerReference]);
    await client.query("COMMIT");return Object.freeze({subscriptionId:input.subscriptionId,providerBindingId:input.bindingId,replayed:false});
  }catch(error){await client.query("ROLLBACK");throw error;}
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

export async function bindPersistentCheckoutSession(client:CommercialQueryClient,input:Readonly<{companyId:number;checkoutId:string;providerBindingId:string;providerSessionReference:string;expiresAt:string}>):Promise<Readonly<{checkoutId:string;status:"open"}>>{
  positiveInteger(input.companyId,"Company identity");id(input.checkoutId,"Checkout identity");id(input.providerBindingId,"Provider binding identity");
  if(!/^cs_[A-Za-z0-9_]+$/.test(input.providerSessionReference))throw new Error("Provider checkout session identity is invalid");
  const expiresAt=new Date(input.expiresAt);if(!Number.isFinite(expiresAt.getTime()))throw new Error("Provider checkout expiry is invalid");
  const updated=await client.query(`UPDATE commercial_checkout_attempts SET provider_session_reference=$4,status='open',expires_at=$5,updated_at=now() WHERE id=$1 AND company_id=$2 AND provider_binding_id=$3 AND status='creating' RETURNING id`,[input.checkoutId,input.companyId,input.providerBindingId,input.providerSessionReference,expiresAt.toISOString()]);
  if(!updated.rows[0])throw new Error("Checkout attempt is not ready for provider binding");
  return Object.freeze({checkoutId:id(updated.rows[0].id,"Checkout identity"),status:"open" as const});
}

export type PersistentCheckoutSummary=Readonly<{checkoutId:string;orderId:string;status:"creating"|"open"|"completed"|"expired"|"canceled"|"failed";expiresAt:string;completedAt:string|null;updatedAt:string}>;
export async function readLatestPersistentCheckout(client:CommercialQueryClient,companyId:number):Promise<PersistentCheckoutSummary|null>{
  positiveInteger(companyId,"Company identity");
  const result=await client.query(`SELECT id,order_id,status,expires_at,completed_at,updated_at FROM commercial_checkout_attempts WHERE company_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[companyId]);
  const row=result.rows[0];if(!row)return null;
  const status=String(row.status);if(!["creating","open","completed","expired","canceled","failed"].includes(status))throw new Error("Checkout status is invalid");
  const expiresAt=new Date(String(row.expires_at)),updatedAt=new Date(String(row.updated_at)),completedAt=row.completed_at===null?null:new Date(String(row.completed_at));
  if(!Number.isFinite(expiresAt.getTime())||!Number.isFinite(updatedAt.getTime())||(completedAt&&!Number.isFinite(completedAt.getTime())))throw new Error("Checkout timeline is invalid");
  return Object.freeze({checkoutId:id(row.id,"Checkout identity"),orderId:id(row.order_id,"Order identity"),status:status as PersistentCheckoutSummary["status"],expiresAt:expiresAt.toISOString(),completedAt:completedAt?.toISOString()??null,updatedAt:updatedAt.toISOString()});
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

export async function claimPersistentProviderReceipt(client:CommercialQueryClient,input:Readonly<{id:string;companyId:number;expectedEventType:string}>):Promise<Readonly<{id:string;rawPayload:string;payloadDigest:string}>>{
  id(input.id,"Receipt identity");positiveInteger(input.companyId,"Company identity");
  if(!/^[a-z][a-z0-9._]{2,119}$/.test(input.expectedEventType))throw new Error("Provider event type is invalid");
  const claimed=await client.query(`UPDATE commercial_provider_receipts SET processing_status='processing' WHERE id=$1 AND company_id=$2 AND provider='stripe' AND event_type=$3 AND processing_status='received' RETURNING id,raw_payload,payload_digest`,[input.id,input.companyId,input.expectedEventType]);
  const row=claimed.rows[0];if(!row)throw new Error("Provider receipt is unavailable or already claimed");
  const rawPayload=String(row.raw_payload??""),payloadDigest=String(row.payload_digest??"");
  if(!/^[0-9a-f]{64}$/.test(payloadDigest)||commercialPersistenceInternals.sha256(rawPayload)!==payloadDigest)throw new Error("Claimed provider receipt digest is invalid");
  return Object.freeze({id:id(row.id,"Receipt identity"),rawPayload,payloadDigest});
}

export async function applyPersistentCheckoutCompletion(client:CommercialQueryClient,input:Readonly<{companyId:number;receiptId:string;subscriptionId:string;orderId:string;checkoutId:string;completedAt:string}>):Promise<Readonly<{checkoutId:string;orderId:string;subscriptionId:string}>>{
  positiveInteger(input.companyId,"Company identity");for(const [value,label] of [[input.receiptId,"Receipt identity"],[input.subscriptionId,"Subscription identity"],[input.orderId,"Order identity"],[input.checkoutId,"Checkout identity"]] as const)id(value,label);
  const completedAt=new Date(input.completedAt);if(!Number.isFinite(completedAt.getTime()))throw new Error("Checkout completion time is invalid");
  await client.query("BEGIN");
  try{
    const result=await client.query(`SELECT r.raw_payload,r.payload_digest,c.provider_session_reference,b.customer_reference,o.currency,o.total_cents FROM commercial_provider_receipts r JOIN commercial_checkout_attempts c ON c.id=$2 AND c.company_id=r.company_id AND c.status='open' JOIN commercial_provider_bindings b ON b.id=c.provider_binding_id AND b.company_id=r.company_id AND b.provider='stripe' AND b.status='active' JOIN commercial_orders o ON o.id=$3 AND o.company_id=r.company_id AND o.subscription_id=$4 AND o.status IN ('ready','submitted') JOIN commercial_subscriptions s ON s.id=o.subscription_id AND s.company_id=r.company_id AND s.status IN ('pending','trialing') WHERE r.id=$1 AND r.company_id=$5 AND r.event_type='checkout.session.completed' AND r.processing_status='processing' FOR UPDATE`,[input.receiptId,input.checkoutId,input.orderId,input.subscriptionId,input.companyId]);
    const row=result.rows[0];if(!row)throw new Error("Checkout completion lineage is unavailable");
    const rawPayload=String(row.raw_payload??""),digest=String(row.payload_digest??"");if(commercialPersistenceInternals.sha256(rawPayload)!==digest)throw new Error("Checkout completion payload digest is invalid");
    let payload:{data?:{object?:{id?:unknown;customer?:unknown;subscription?:unknown;mode?:unknown;status?:unknown;payment_status?:unknown;currency?:unknown;amount_total?:unknown;metadata?:Record<string,unknown>}}};try{payload=JSON.parse(rawPayload);}catch{throw new Error("Checkout completion payload is invalid JSON");}
    const object=payload.data?.object;if(!object||object.id!==row.provider_session_reference||object.customer!==row.customer_reference||typeof object.subscription!=="string"||!object.subscription.startsWith("sub_")||object.mode!=="subscription"||object.status!=="complete"||object.payment_status!=="paid"||String(object.currency??"").toUpperCase()!==row.currency||object.amount_total!==Number(row.total_cents)||object.metadata?.company_id!==String(input.companyId)||object.metadata?.order_id!==input.orderId||object.metadata?.subscription_id!==input.subscriptionId)throw new Error("Checkout completion provider lineage is invalid");
    await client.query(`UPDATE commercial_checkout_attempts SET status='completed',completed_at=$2,updated_at=$2 WHERE id=$1`,[input.checkoutId,completedAt.toISOString()]);
    await client.query(`UPDATE commercial_orders SET status='completed',completed_at=$2,updated_at=$2 WHERE id=$1`,[input.orderId,completedAt.toISOString()]);
    await client.query(`UPDATE commercial_subscriptions SET status='active',started_at=COALESCE(started_at,$2),revision=revision+1,updated_at=$2 WHERE id=$1`,[input.subscriptionId,completedAt.toISOString()]);
    await client.query(`UPDATE commercial_provider_receipts SET processing_status='applied',processed_at=$2,failure_code=NULL WHERE id=$1`,[input.receiptId,completedAt.toISOString()]);
    await client.query("COMMIT");return Object.freeze({checkoutId:input.checkoutId,orderId:input.orderId,subscriptionId:input.subscriptionId});
  }catch(error){await client.query("ROLLBACK");throw error;}
}

const providerFailureCodes=["LINEAGE_NOT_FOUND","AMOUNT_MISMATCH","UNSUPPORTED_STATE","UNSUPPORTED_EVENT_TYPE","TRANSIENT_PROVIDER_FAILURE"] as const;
export async function settlePersistentProviderReceipt(client:CommercialQueryClient,input:Readonly<{id:string;companyId:number;outcome:"failed"|"ignored";failureCode:(typeof providerFailureCodes)[number];processedAt:string}>):Promise<Readonly<{id:string;status:"failed"|"ignored"}>>{
  id(input.id,"Receipt identity");positiveInteger(input.companyId,"Company identity");
  if(!providerFailureCodes.includes(input.failureCode))throw new Error("Provider failure code is invalid");
  if(input.outcome==="ignored"&&input.failureCode!=="UNSUPPORTED_EVENT_TYPE")throw new Error("Ignored provider receipts require the unsupported-event code");
  const processedAt=new Date(input.processedAt);if(!Number.isFinite(processedAt.getTime()))throw new Error("Provider receipt settlement time is invalid");
  const updated=await client.query(`UPDATE commercial_provider_receipts SET processing_status=$3,processed_at=$4,failure_code=$5 WHERE id=$1 AND company_id=$2 AND processing_status IN ('received','processing') RETURNING id,processing_status`,[input.id,input.companyId,input.outcome,processedAt.toISOString(),input.failureCode]);
  if(!updated.rows[0])throw new Error("Provider receipt cannot be settled from its current state");
  return Object.freeze({id:id(updated.rows[0].id,"Receipt identity"),status:input.outcome});
}

export type PersistentPaidInvoiceInput=Readonly<{id:string;companyId:number;subscriptionId:string;orderId:string;checkoutAttemptId:string;providerReceiptId:string;invoiceNumber:string;providerInvoiceReference:string;currency:string;subtotalCents:number;taxCents:number;issuedAt:string;paidAt:string}>;
export async function persistPaidInvoiceWithAudit(client:CommercialQueryClient,input:PersistentPaidInvoiceInput):Promise<Readonly<{invoiceId:string;auditSequence:number;eventDigest:string}>>{
  positiveInteger(input.companyId,"Company identity");for(const [value,label] of [[input.id,"Invoice identity"],[input.subscriptionId,"Subscription identity"],[input.orderId,"Order identity"],[input.checkoutAttemptId,"Checkout identity"],[input.providerReceiptId,"Provider receipt identity"],[input.invoiceNumber,"Invoice number"],[input.providerInvoiceReference,"Provider invoice identity"]] as const)id(value,label);
  if(!/^[A-Z]{3}$/.test(input.currency)||!Number.isSafeInteger(input.subtotalCents)||input.subtotalCents<0||!Number.isSafeInteger(input.taxCents)||input.taxCents<0)throw new Error("Invoice amount is invalid");
  const issuedAt=new Date(input.issuedAt),paidAt=new Date(input.paidAt);if(!Number.isFinite(issuedAt.getTime())||!Number.isFinite(paidAt.getTime())||paidAt<issuedAt)throw new Error("Invoice time is invalid");
  await client.query("BEGIN");
  try{
    const lineage=await client.query(`SELECT s.id FROM commercial_subscriptions s JOIN commercial_orders o ON o.id=$2 AND o.subscription_id=s.id AND o.company_id=s.company_id JOIN commercial_checkout_attempts c ON c.id=$3 AND c.order_id=o.id AND c.company_id=s.company_id AND c.status='completed' JOIN commercial_provider_receipts r ON r.id=$4 AND r.company_id=s.company_id AND r.processing_status IN ('processing','applied') WHERE s.id=$1 AND s.company_id=$5 FOR UPDATE`,[input.subscriptionId,input.orderId,input.checkoutAttemptId,input.providerReceiptId,input.companyId]);
    if(!lineage.rows[0])throw new Error("Paid invoice lineage is invalid");
    const totalCents=input.subtotalCents+input.taxCents;
    const invoice=await client.query(`INSERT INTO commercial_invoices(id,company_id,subscription_id,order_id,checkout_attempt_id,invoice_number,provider,provider_invoice_reference,currency,subtotal_cents,tax_cents,total_cents,status,issued_at,paid_at) VALUES($1,$2,$3,$4,$5,$6,'stripe',$7,$8,$9,$10,$11,'paid',$12,$13) ON CONFLICT(provider,provider_invoice_reference) DO NOTHING RETURNING id`,[input.id,input.companyId,input.subscriptionId,input.orderId,input.checkoutAttemptId,input.invoiceNumber,input.providerInvoiceReference,input.currency,input.subtotalCents,input.taxCents,totalCents,issuedAt.toISOString(),paidAt.toISOString()]);
    if(!invoice.rows[0])throw new Error("Provider invoice was already persisted");
    const prior=await client.query(`SELECT sequence,event_digest FROM commercial_audit_events WHERE company_id=$1 ORDER BY sequence DESC LIMIT 1 FOR UPDATE`,[input.companyId]);
    const auditSequence=prior.rows[0]?positiveInteger(prior.rows[0].sequence,"Prior audit sequence")+1:1;
    const previousEventDigest=prior.rows[0]?String(prior.rows[0].event_digest):null;
    const eventDigest=commercialPersistenceInternals.sha256(JSON.stringify({companyId:input.companyId,subscriptionId:input.subscriptionId,providerReceiptId:input.providerReceiptId,sequence:auditSequence,eventType:"invoice.paid",entityType:"commercial_invoice",entityId:input.id,previousEventDigest,occurredAt:paidAt.toISOString()}));
    await client.query(`INSERT INTO commercial_audit_events(id,company_id,subscription_id,provider_receipt_id,sequence,event_type,entity_type,entity_id,event_digest,previous_event_digest,occurred_at) VALUES($1,$2,$3,$4,$5,'invoice.paid','commercial_invoice',$6,$7,$8,$9)`,[`audit-${input.id}`,input.companyId,input.subscriptionId,input.providerReceiptId,auditSequence,input.id,eventDigest,previousEventDigest,paidAt.toISOString()]);
    await client.query(`UPDATE commercial_provider_receipts SET processing_status='applied',processed_at=$2,failure_code=NULL WHERE id=$1`,[input.providerReceiptId,paidAt.toISOString()]);
    await client.query("COMMIT");return Object.freeze({invoiceId:input.id,auditSequence,eventDigest});
  }catch(error){await client.query("ROLLBACK");throw error;}
}

export const commercialPersistenceInternals = Object.freeze({ id, positiveInteger, sha256: (value: string) => crypto.createHash("sha256").update(value).digest("hex") });
