import { useEffect, useRef, useState } from "react";
import { collectPageAssistantContext, type AssistantLanguage, type PageAssistantContext } from "./page-assistant-context";

export type AssistantContextStatus="verifying"|"ready"|"unauthorized"|"unavailable"|"error";
export type AssistantContextState={status:AssistantContextStatus;context:PageAssistantContext;attempt:number;errorCode:string|null};

export function resolvedContextStatus(context:PageAssistantContext):AssistantContextStatus {
  const page=context.page.toLowerCase();
  if(/not authorized|access denied|sin autorización|acceso denegado/.test(page))return "unauthorized";
  if(/unavailable|no disponible/.test(page))return "unavailable";
  return context.page&&!/verifying project context|verificando contexto del proyecto/.test(page)?"ready":"verifying";
}

export function usePageAssistantContextState(language:AssistantLanguage){
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<AssistantContextState>(()=>({status:"verifying",context:collectPageAssistantContext(language),attempt:0,errorCode:null}));
  const generation=useRef(0);
  useEffect(()=>{
    const current=++generation.current;const started=Date.now();let route=`${location.pathname}${location.search}`;let settled=false;
    const evaluate=()=>{if(current!==generation.current)return;const next=collectPageAssistantContext(language);const status=resolvedContextStatus(next);if(status!=="verifying"){settled=true;setState({status,context:next,attempt,errorCode:null});return;}if(Date.now()-started>=5000){settled=true;setState({status:"error",context:next,attempt,errorCode:"CONTEXT_TIMEOUT"});}else setState({status:"verifying",context:next,attempt,errorCode:null});};
    const observer=new MutationObserver(()=>{const nextRoute=`${location.pathname}${location.search}`;if(nextRoute!==route){route=nextRoute;settled=false;}if(!settled)evaluate();});
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    const timer=window.setInterval(evaluate,250);evaluate();
    return()=>{generation.current+=1;observer.disconnect();window.clearInterval(timer);};
  },[language,attempt]);
  return {...state,retry:()=>setAttempt(value=>value+1)};
}
