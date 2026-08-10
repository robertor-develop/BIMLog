import { useEffect, useState } from "react";
import { BookOpen, HelpCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { helpTopicForContext } from "@/lib/help-content";

const STORAGE_KEY = "bimlog_guide_enabled";

function currentHelpHref(topicId: string) {
  const from = typeof window === "undefined" ? "/dashboard" : `${window.location.pathname}${window.location.search}`;
  return `/help?topic=${encodeURIComponent(topicId)}&view=manual&from=${encodeURIComponent(from)}`;
}

function GuideDialog({ activeTab, onClose }: { activeTab: string; onClose: () => void }) {
  const { lang } = useI18n();
  const topic = helpTopicForContext(activeTab);
  const es = lang === "es";
  return <div role="dialog" aria-label={`${es ? "Guía rápida" : "Quick Guide"} - ${es ? topic.title.es : topic.title.en}`} style={{position:"fixed",left:228,top:88,zIndex:1000,width:350,maxWidth:"calc(100vw - 260px)",background:"white",border:"1px solid hsl(var(--border))",borderRadius:10,boxShadow:"0 20px 40px -12px rgba(15,23,42,.25)",overflow:"hidden"}}>
    <div style={{padding:"12px 14px",background:"#EFF6FF",borderBottom:"1px solid hsl(var(--border))",display:"flex",alignItems:"center",gap:8}}><HelpCircle style={{width:16,height:16,color:"#1D4ED8",flexShrink:0}}/><div style={{flex:1,fontSize:13,fontWeight:800,color:"#1E3A8A"}}>{es ? topic.title.es : topic.title.en}</div><button type="button" onClick={onClose} aria-label={es ? "Cerrar guía" : "Close guide"} style={{padding:4,border:"none",background:"transparent",cursor:"pointer",color:"#1E40AF",display:"flex",borderRadius:4}}><X style={{width:14,height:14}}/></button></div>
    <div style={{padding:"13px 14px",fontSize:12,color:"#374151",lineHeight:1.6}}>{es ? topic.quickTip.es : topic.quickTip.en}</div>
    <div style={{padding:"10px 14px",fontSize:11,color:"#1D4ED8",borderTop:"1px solid hsl(var(--border))",background:"#F8FAFC",lineHeight:1.5}}><strong>{es ? "Primer paso:" : "First step:"}</strong> {es ? topic.steps[0]?.title.es : topic.steps[0]?.title.en}</div>
    <a href={currentHelpHref(topic.id)} style={{padding:"10px 14px",fontSize:11,fontWeight:750,color:"#174DA8",borderTop:"1px solid hsl(var(--border))",display:"flex",alignItems:"center",gap:6,textDecoration:"none"}}><BookOpen style={{width:14,height:14}}/>{es ? "Abrir instrucciones completas" : "Open complete instructions"}</a>
  </div>;
}

export function SmartGuide({ activeTab }: { activeTab: string }) {
  const { lang } = useI18n();
  const [isOpen, setIsOpen] = useState(() => { try { const stored = localStorage.getItem(STORAGE_KEY); return stored === null ? true : stored === "true"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, String(isOpen)); } catch { /* Browser storage can be unavailable. */ } }, [isOpen]);
  return <>{isOpen && <GuideDialog activeTab={activeTab} onClose={() => setIsOpen(false)}/>}<button type="button" onClick={() => setIsOpen((value) => !value)} aria-pressed={isOpen} style={{position:"fixed",left:24,bottom:24,zIndex:1000,display:"inline-flex",alignItems:"center",gap:7,padding:"10px 14px",height:40,borderRadius:999,fontSize:13,fontWeight:700,cursor:"pointer",background:isOpen?"#2563EB":"white",color:isOpen?"white":"#1D4ED8",border:"1px solid #1D4ED8",boxShadow:"0 10px 25px -8px rgba(15,23,42,.25)"}}><HelpCircle style={{width:16,height:16}}/>{lang === "es" ? "Guía" : "Guide"}</button></>;
}

export function SmartGuideSidebarButton({ activeTab }: { activeTab: string }) {
  const { lang } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  return <><button type="button" className="sidebar-utility-button" onClick={() => setIsOpen(true)} aria-label={lang === "es" ? "Abrir guía rápida" : "Open quick guide"}><HelpCircle style={{width:13,height:13}}/>{lang === "es" ? "Guía" : "Guide"}</button>{isOpen && <GuideDialog activeTab={activeTab} onClose={() => setIsOpen(false)}/>}</>;
}
