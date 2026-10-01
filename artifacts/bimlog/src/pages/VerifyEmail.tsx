import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function VerifyEmail(){
  const [status,setStatus]=useState<"loading"|"verified"|"error">("loading"),[message,setMessage]=useState("");
  useEffect(()=>{const token=new URLSearchParams(location.search).get("token")||"";fetch("/api/v1/onboarding/email-verification/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(async response=>{const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||"Verification failed");setStatus("verified");}).catch(error=>{setMessage(error.message);setStatus("error");});},[]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">{status==="loading"&&<p>Verifying your BIMLog email…</p>}{status==="verified"&&<><CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600"/><h1 className="text-xl font-bold">Email verified</h1><p className="my-4 text-slate-600">Return to setup and refresh the verification status.</p><Link href="/dashboard"><Button>Continue to BIMLog</Button></Link></>}{status==="error"&&<><AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600"/><h1 className="text-xl font-bold">Verification link unavailable</h1><p className="my-4 text-slate-600">{message}</p><Link href="/dashboard"><Button variant="outline">Return to BIMLog</Button></Link></>}</section></main>;
}
