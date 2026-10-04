import type {CommercialLiveCheck} from "./commercial-stripe-live-verification";import type {CommercialVerificationTransport} from "./commercial-launch-verification-transport";
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"?value as Record<string,unknown>:{};
export async function verifyStripeWebhookAndPortal(environment:NodeJS.ProcessEnv,transport:CommercialVerificationTransport):Promise<readonly CommercialLiveCheck[]>{
  const key=(environment.STRIPE_SECRET_KEY??"").trim(),portalId=(environment.STRIPE_PORTAL_CONFIGURATION_ID??"").trim(),origin=(environment.BIMLOG_APP_ORIGIN??"").trim();
  if(!/^sk_(test|live)_[A-Za-z0-9_]{12,}$/.test(key)||!/^bpc_[A-Za-z0-9_]{3,}$/.test(portalId)||!origin)return Object.freeze([{id:"stripe_webhook",status:"failed",code:"service_configuration_invalid"},{id:"stripe_portal",status:"failed",code:"service_configuration_invalid"}]);
  let expectedUrl="";try{expectedUrl=`${new URL(origin).origin}/api/v1/commercial/providers/stripe/webhook`;}catch{return Object.freeze([{id:"stripe_webhook",status:"failed",code:"service_configuration_invalid"},{id:"stripe_portal",status:"failed",code:"service_configuration_invalid"}]);}
  const [webhookResponse,portalResponse]=await Promise.all([
    transport({provider:"stripe",path:"/v1/webhook_endpoints?limit=100",authorization:`Bearer ${key}`}),
    transport({provider:"stripe",path:`/v1/billing_portal/configurations/${encodeURIComponent(portalId)}`,authorization:`Bearer ${key}`}),
  ]),webhookBody=object(webhookResponse.body),portal=object(portalResponse.body),endpoints=Array.isArray(webhookBody.data)?webhookBody.data.map(object):[];
  const webhook=endpoints.find(item=>item.url===expectedUrl&&item.status==="enabled"),events=Array.isArray(webhook?.enabled_events)?webhook.enabled_events:[],webhookVerified=webhookResponse.status===200&&Boolean(webhook)&&(events.includes("*")||events.includes("checkout.session.completed"));
  const portalVerified=portalResponse.status===200&&portal.object==="billing_portal.configuration"&&portal.active===true;
  return Object.freeze([Object.freeze({id:"stripe_webhook",status:webhookVerified?"verified":"failed",code:webhookVerified?"webhook_verified":"webhook_unusable"}),Object.freeze({id:"stripe_portal",status:portalVerified?"verified":"failed",code:portalVerified?"portal_verified":"portal_unusable"})]);
}
