export type CommercialVerificationRequest=Readonly<{provider:"stripe"|"sendgrid";path:string;authorization:string}>;
export type CommercialVerificationResponse=Readonly<{status:number;body:unknown}>;
export type CommercialVerificationTransport=(request:CommercialVerificationRequest)=>Promise<CommercialVerificationResponse>;

export function createCommercialVerificationTransport(input:{fetchImpl?:typeof fetch;timeoutMs?:number;maxResponseBytes?:number}={}):CommercialVerificationTransport{
  const fetchImpl=input.fetchImpl??fetch,timeoutMs=input.timeoutMs??8_000,maxResponseBytes=input.maxResponseBytes??524_288;
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1_000||timeoutMs>20_000)throw new Error("Commercial verification timeout is invalid");
  if(!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1_024||maxResponseBytes>1_048_576)throw new Error("Commercial verification response limit is invalid");
  return async request=>{
    if(!/^\/[A-Za-z0-9_?&=.,%/-]+$/.test(request.path)||request.path.includes(".."))throw new Error("Commercial verification path is invalid");
    if(request.provider==="stripe"&&!request.path.startsWith("/v1/")||request.provider==="sendgrid"&&!request.path.startsWith("/v3/"))throw new Error("Commercial verification provider path is invalid");
    const origin=request.provider==="stripe"?"https://api.stripe.com":"https://api.sendgrid.com",controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetchImpl(`${origin}${request.path}`,{method:"GET",headers:{Authorization:request.authorization,Accept:"application/json"},signal:controller.signal});
      const length=Number(response.headers.get("content-length")??"0");if(Number.isFinite(length)&&length>maxResponseBytes)throw new Error("Commercial verification response is too large");
      const text=await response.text();if(Buffer.byteLength(text,"utf8")>maxResponseBytes)throw new Error("Commercial verification response is too large");
      let body:unknown=null;if(text)try{body=JSON.parse(text);}catch{throw new Error("Commercial verification response is invalid");}
      return Object.freeze({status:response.status,body});
    }catch(error){if(error instanceof Error&&error.name==="AbortError")throw new Error("Commercial verification timed out");throw error;}finally{clearTimeout(timeout);}
  };
}
