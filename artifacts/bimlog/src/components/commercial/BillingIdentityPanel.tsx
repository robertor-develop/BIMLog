import {useEffect,useState} from "react";
import {Link} from "wouter";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useI18n} from "@/lib/i18n";
import {readCommercialBillingIdentity,saveCommercialBillingIdentity,type CommercialBillingIdentityDto} from "@/lib/commercial-billing-identity-client";

export function BillingIdentityPanel({token,fromBilling}:{token:string;fromBilling:boolean}){
  const {tt}=useI18n();
  const [data,setData]=useState<CommercialBillingIdentityDto|null>(null),[address,setAddress]=useState(""),[phone,setPhone]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");readCommercialBillingIdentity(token,(url,init)=>fetch(url,{...init,signal:controller.signal})).then(value=>{setData(value);setAddress(value.address);setPhone(value.phone);}).catch(reason=>{if(reason?.name!=="AbortError")setError(reason instanceof Error?reason.message:String(reason));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[token]);
  const save=async()=>{setSaving(true);setError("");setSaved(false);try{const value=await saveCommercialBillingIdentity(token,{address,phone});setData(value);setAddress(value.address);setPhone(value.phone);setSaved(true);}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setSaving(false);}};
  return <section aria-labelledby="billing-identity-title" style={{background:"white",border:"1px solid hsl(var(--border))",borderRadius:10,padding:"18px 20px",marginBottom:18}}>
    <h2 id="billing-identity-title" style={{fontSize:16,margin:"0 0 6px"}}>{tt("Billing identity","Identidad de facturación")}</h2>
    <p style={{fontSize:13,color:"#64748B",margin:"0 0 14px"}}>{tt("Billing administrators complete the canonical company details used for invoices and checkout readiness. These values do not rename the company or change project access.","Los administradores de facturación completan los datos canónicos de la empresa usados en facturas y la preparación del pago. Estos valores no cambian el nombre de la empresa ni el acceso a proyectos.")}</p>
    {fromBilling&&<p role="status" style={{padding:10,border:"1px solid #BFDBFE",background:"#EFF6FF",borderRadius:8}}>{tt("Complete the missing billing details, save, then return to Billing & Support.","Complete los datos de facturación faltantes, guarde y vuelva a Facturación y Soporte.")}</p>}
    {loading&&<p role="status">{tt("Loading billing identity…","Cargando identidad de facturación…")}</p>}
    {error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}
    {data&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:14}}>
      <div><Label>{tt("Legal company name","Nombre legal de la empresa")}</Label><Input value={data.legalName} disabled aria-describedby="billing-legal-name-help"/><small id="billing-legal-name-help">{tt("Read-only canonical company identity.","Identidad canónica de la empresa de solo lectura.")}</small></div>
      <div><Label htmlFor="billing-phone">{tt("Billing phone","Teléfono de facturación")}</Label><Input id="billing-phone" value={phone} onChange={event=>setPhone(event.target.value)} autoComplete="tel"/></div>
      <div style={{gridColumn:"1 / -1"}}><Label htmlFor="billing-address">{tt("Billing address","Dirección de facturación")}</Label><Input id="billing-address" value={address} onChange={event=>setAddress(event.target.value)} autoComplete="street-address"/></div>
    </div>
    <div role="status" style={{marginTop:12,color:data.status==="complete"?"#047857":"#92400E",fontWeight:700}}>{data.status==="complete"?tt("Billing identity complete","Identidad de facturación completa"):tt(`Missing: ${data.missingFields.join(", ")}`,`Falta: ${data.missingFields.map(field=>field==="address"?"dirección":"teléfono").join(", ")}`)}</div>
    {saved&&<p role="status" style={{color:"#047857"}}>{tt("Billing identity saved.","Identidad de facturación guardada.")}</p>}
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:14}}>{(fromBilling||data.status==="complete")&&<Button variant="outline" asChild><Link href="/settings/billing-support">{tt("Return to Billing & Support","Volver a Facturación y Soporte")}</Link></Button>}<Button onClick={()=>void save()} disabled={saving}>{saving?tt("Saving…","Guardando…"):tt("Save billing identity","Guardar identidad de facturación")}</Button></div></>}
  </section>;
}
