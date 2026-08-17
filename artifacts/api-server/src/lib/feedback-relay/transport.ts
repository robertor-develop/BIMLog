import https from "node:https";
import tls from "node:tls";
import { X509Certificate, createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { RelayProtocolError, sha256 } from "./protocol.js";

export type TransportPins={leafSha256?:string;spkiSha256?:string};
export type TransportResponse={status:number;headers:Readonly<Record<string,string|string[]|undefined>>;body:Buffer;sha256:string};
export type RequestFactory=(url:URL,options:https.RequestOptions,onResponse:(response:IncomingMessage)=>void)=>ReturnType<typeof https.request>;
export function assertCertificatePins(actual:{leafSha256:string;spkiSha256:string},pins:TransportPins){if((pins.leafSha256&&pins.leafSha256!==actual.leafSha256)||(pins.spkiSha256&&pins.spkiSha256!==actual.spkiSha256))return new Error("FEEDBACK_RELAY_CERTIFICATE_PIN_MISMATCH");return undefined;}
export function pinnedServerIdentity(hostname:string,cert:tls.PeerCertificate,pins:TransportPins){
  const normal=tls.checkServerIdentity(hostname,cert);if(normal)return normal;
  if(!cert.raw)return new Error("FEEDBACK_RELAY_CERTIFICATE_MISSING");
  const leaf=createHash("sha256").update(cert.raw).digest("hex");
  const spki=createHash("sha256").update(new X509Certificate(cert.raw).publicKey.export({type:"spki",format:"der"})).digest("base64");
  return assertCertificatePins({leafSha256:leaf,spkiSha256:`sha256-${spki}`},pins);
}
export class NativeHttpsRelayTransport{
  private readonly origin:string;
  constructor(origin:string,private readonly pins:TransportPins,private readonly requestFactory:RequestFactory=https.request){const url=new URL(origin);if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")throw new RelayProtocolError("FEEDBACK_RELAY_ORIGIN_INVALID","Relay origin must be a credential-free HTTPS origin");if(!pins.leafSha256&&!pins.spkiSha256)throw new RelayProtocolError("FEEDBACK_RELAY_PIN_REQUIRED","A leaf or SPKI pin is required");if(pins.leafSha256&&!/^[a-f0-9]{64}$/.test(pins.leafSha256))throw new RelayProtocolError("FEEDBACK_RELAY_PIN_INVALID","Leaf pin is invalid");if(pins.spkiSha256&&!/^sha256-[A-Za-z0-9+/]{43}=$/.test(pins.spkiSha256))throw new RelayProtocolError("FEEDBACK_RELAY_PIN_INVALID","SPKI pin is invalid");this.origin=url.origin;}
  async request(input:{method:string;path:string;headers?:Record<string,string>;body?:Buffer;expectedResponseSha256?:string;maxResponseBytes:number}):Promise<TransportResponse>{
    const url=new URL(input.path,this.origin);if(url.origin!==this.origin||url.protocol!=="https:"||url.username||url.password||url.hash)throw new RelayProtocolError("FEEDBACK_RELAY_DESTINATION_DENIED","Relay destination escaped its pinned origin");
    return await new Promise((resolve,reject)=>{let settled=false;const fail=(e:unknown)=>{if(settled)return;settled=true;reject(e instanceof RelayProtocolError?e:new RelayProtocolError("FEEDBACK_RELAY_TRANSPORT_FAILED","Feedback relay transport failed"));};
      const req=this.requestFactory(url,{method:input.method,headers:{...input.headers,"content-length":String(input.body?.length??0)},rejectUnauthorized:true,checkServerIdentity:(host,cert)=>pinnedServerIdentity(host,cert,this.pins)},response=>{
        if(response.statusCode&&response.statusCode>=300&&response.statusCode<400){fail(new RelayProtocolError("FEEDBACK_RELAY_REDIRECT_DENIED","Feedback relay redirects are forbidden"));response.resume();return;}
        const chunks:Buffer[]=[];let total=0;response.on("data",chunk=>{const b=Buffer.from(chunk);total+=b.length;if(total>input.maxResponseBytes){response.destroy();fail(new RelayProtocolError("FEEDBACK_RELAY_RESPONSE_TOO_LARGE","Feedback relay response exceeded its byte limit"));return;}chunks.push(b);});response.on("error",fail);response.on("end",()=>{if(settled)return;const body=Buffer.concat(chunks);const digest=sha256(body);if(input.expectedResponseSha256&&digest!==input.expectedResponseSha256){fail(new RelayProtocolError("FEEDBACK_RELAY_RESPONSE_HASH_MISMATCH","Feedback relay response hash did not match"));return;}settled=true;resolve({status:response.statusCode??0,headers:response.headers,body,sha256:digest});});
      });req.on("error",fail);if(input.body)req.write(input.body);req.end();
    });
  }
}
