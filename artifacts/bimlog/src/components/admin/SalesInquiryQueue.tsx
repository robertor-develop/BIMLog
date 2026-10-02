import {useCallback,useEffect,useState} from "react";
import {parseSalesInquiryList,SALES_INQUIRY_STATUSES,type SalesInquiry,type SalesInquiryStatus} from "@/lib/sales-inquiry-client";

const API_BASE=(import.meta.env.VITE_API_URL as string|undefined)??"";
const statusColor:Record<SalesInquiryStatus,string>={new:"#2563eb",acknowledged:"#d97706",qualified:"#16a34a",closed:"#64748b"};

export function SalesInquiryQueue({token}:{token:string}){
  const [items,setItems]=useState<SalesInquiry[]>([]),[status,setStatus]=useState<""|SalesInquiryStatus>("");
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const query=status?`?status=${status}`:"";const response=await fetch(`${API_BASE}/api/v1/admin/sales-inquiries${query}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error("request_failed");setItems(parseSalesInquiryList(await response.json()).items);}catch{setError("Sales inquiries could not be loaded.");}finally{setLoading(false);}},[status,token]);
  useEffect(()=>{void load();},[load]);
  return <section aria-labelledby="sales-inquiry-queue-title" data-testid="sales-inquiry-queue">
    <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",marginBottom:16}}>
      <div><h2 id="sales-inquiry-queue-title" style={{margin:0,fontSize:20}}>Sales inquiries</h2><p style={{margin:"4px 0 0",color:"#64748b",fontSize:13}}>Pricing and contact requests saved by BIMLog.</p></div>
      <div style={{display:"flex",gap:8}}><label style={{fontSize:12,fontWeight:700}}>Status <select aria-label="Filter sales inquiries by status" value={status} onChange={event=>setStatus(event.target.value as ""|SalesInquiryStatus)} style={{marginLeft:6,padding:"7px 10px",border:"1px solid #cbd5e1",borderRadius:7}}><option value="">All</option>{SALES_INQUIRY_STATUSES.map(value=><option key={value} value={value}>{value}</option>)}</select></label><button onClick={()=>void load()} style={{padding:"7px 12px",border:"1px solid #cbd5e1",borderRadius:7,background:"white"}}>Refresh</button></div>
    </div>
    {loading&&<p role="status">Loading sales inquiries…</p>}
    {error&&<div role="alert" style={{padding:12,border:"1px solid #fecaca",borderRadius:8,color:"#b91c1c"}}>{error} <button onClick={()=>void load()}>Retry</button></div>}
    {!loading&&!error&&items.length===0&&<p style={{padding:20,border:"1px dashed #cbd5e1",borderRadius:10}}>No inquiries match this status.</p>}
    {!loading&&!error&&items.length>0&&<div style={{overflowX:"auto",border:"1px solid #e2e8f0",borderRadius:10}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:760}}><thead><tr><th>Received</th><th>Contact</th><th>Company</th><th>Interest</th><th>Status</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td><strong>{item.fullName}</strong><br/><span>{item.email}</span></td><td>{item.companyName}<br/><span>{item.country}</span></td><td>{item.plan?[item.plan,item.billingCycle].filter(Boolean).join(" · "):item.interest}</td><td><span style={{color:statusColor[item.status],fontWeight:800}}>{item.status}</span></td></tr>)}</tbody></table></div>}
  </section>;
}
