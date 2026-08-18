import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, Camera, FilePlus2, MessageSquare, Mic, Pause, Play, RotateCcw, Send, Square, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/data-retention",
  "/pricing",
  "/features",
  "/about",
  "/contact",
]);

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "workflow", label: "Workflow issue" },
  { value: "idea", label: "Idea" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
  { value: "low", label: "Low" },
];

function getProjectId(path: string) {
  const match = path.match(/^\/projects\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getModule(path: string) {
  if (path.startsWith("/admin")) return "Admin";
  if (path.startsWith("/dashboard")) return "Dashboard";
  if (path.startsWith("/pending")) return "Pending Items";
  if (path.startsWith("/living-brief")) return "Living Brief";
  const projectMatch = path.match(/^\/projects\/\d+\/([^/?#]+)/);
  if (!projectMatch) return "Project";
  return projectMatch[1]
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function FeedbackWidget() {
  const [location] = useLocation();
  const { token, user } = useAuthStore();
  const { language } = useI18n();
  const es = language === "es";
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("bug");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "paused" | "ready">("idle");
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [uploadState, setUploadState] = useState("");
  const [crop, setCrop] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [reviewing, setReviewing] = useState(false);
  const [mine, setMine] = useState<Array<{ id:number;stableId:string;message:string;status:string;version:number;dispositionReason?:string;targetRelease?:string;relay?:{state:string;version:number;createdAt:string;updatedAt:string;reason?:string|null;history:Array<{sequence:number;state:string;at:string;reason?:string|null}>}|null;transcription?:{id:number;state:string;result?:string|null;reviewState:string}|null }>>([]);
  const [history, setHistory] = useState<Array<{ id: number; eventType: string; reason?: string; createdAt: string }>>([]);
  const [reportedAssets, setReportedAssets] = useState<Array<{ id: number; kind:string;name: string; scanState: string; origin?:string|null;transcriptionConsentId?:string|null;downloadUrl?: string }>>([]);
  const [selectedFeedbackId,setSelectedFeedbackId]=useState<number|null>(null);
  const [captureConsents, setCaptureConsents] = useState<{ audio?: string; screenshot?: string }>({});
  const fileIdsRef = useRef(new WeakMap<File,string>());
  const fileOriginsRef = useRef(new WeakMap<File,"browser-microphone"|"browser-display-capture"|"user-file-import">());
  const [uploadResults,setUploadResults]=useState<Record<string,{state:"uploading"|"success"|"error";message:string}>>({});
  const [submittedFeedbackId,setSubmittedFeedbackId]=useState<number|null>(null);
  const [transformations, setTransformations] = useState<Record<string, Record<string, unknown>>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const idempotencyRef = useRef(randomKey());

  const tt = (en: string, spanish: string) => es ? spanish : en;
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);
  useEffect(() => { if (!token) terminateMedia(); }, [token]);
  useEffect(() => { if(error) errorRef.current?.focus(); }, [error]);
  useEffect(() => () => terminateMedia(), [location]);
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeFeedback(); if (event.key === "Tab" && dialogRef.current) { const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),audio[controls],a[href],summary,[tabindex]:not([tabindex="-1"])')).filter(node => node.offsetParent !== null); if (!focusable.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } };
    window.addEventListener("keydown", closeOnEscape);
    const restored: Array<[HTMLElement, boolean, string | null]> = []; let child: HTMLElement | null = dialogRef.current;
    while (child?.parentElement && child.parentElement !== document.body) { for (const sibling of Array.from(child.parentElement.children)) if (sibling !== child && sibling instanceof HTMLElement) { restored.push([sibling, sibling.inert, sibling.getAttribute("aria-hidden")]); sibling.inert = true; sibling.setAttribute("aria-hidden", "true"); } child = child.parentElement; }
    return () => { window.removeEventListener("keydown", closeOnEscape); for (const [node, inert, hidden] of restored) { node.inert = inert; if (hidden === null) node.removeAttribute("aria-hidden"); else node.setAttribute("aria-hidden", hidden); } };
  }, [open]);

  const projectId = useMemo(() => getProjectId(location), [location]);
  const moduleName = useMemo(() => getModule(location), [location]);

  if (!token || PUBLIC_PATHS.has(location)) return null;

  function randomKey() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
  function fileId(file:File){let id=fileIdsRef.current.get(file);if(!id){id=randomKey();fileIdsRef.current.set(file,id);}return id;}
  function fileGroup(file:File):"audio"|"screenshot"|"attachment"{if(file.type.startsWith("audio/")||/\.(webm|ogg|wav|m4a)$/i.test(file.name))return "audio";if(fileOriginsRef.current.get(file)==="browser-display-capture")return "screenshot";return "attachment";}
  const stateLabel=(value:string)=>({new:tt("New","Nuevo"),triaged:tt("Triaged","Clasificado"),accepted:tt("Accepted","Aceptado"),in_progress:tt("In progress","En curso"),blocked:tt("Blocked","Bloqueado"),fixed:tt("Fixed","Corregido"),verified:tt("Verified","Verificado"),rejected:tt("Rejected","Rechazado"),deferred:tt("Deferred","Aplazado"),clean:tt("Approved","Aprobado"),quarantined:tt("Quarantined","En cuarentena"),pending:tt("Pending","Pendiente"),completed:tt("Completed","Completada"),queued:tt("Queued","En cola"),transferring:tt("Transferring","Transfiriendo"),"receipt-verified":tt("Receipt verified","Recibo verificado"),"cleanup-pending":tt("Cleanup pending","Limpieza pendiente"),delivered:tt("Delivered","Entregado"),held:tt("On hold","Retenido"),"manual-review":tt("Manual review","Revisión manual"),expired:tt("Expired","Vencido"),recording:tt("Recording","Grabando"),paused:tt("Paused","Pausado"),ready:tt("Ready","Listo"),idle:tt("Idle","Inactivo")}[value]||tt("Unavailable","No disponible"));
  const eventLabel=(value:string)=>({created:tt("Created","Creado"),assets_added:tt("Evidence added","Evidencia agregada"),transcription_requested:tt("Transcription requested","Transcripción solicitada"),transcription_reviewed:tt("Transcription reviewed","Transcripción revisada"),triage_updated:tt("Review updated","Revisión actualizada"),reopened:tt("Reopened","Reabierto")}[value]||tt("Update","Actualización"));
  function terminateMedia() { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; const recorder = recorderRef.current; if (recorder && recorder.state !== "inactive") { recorder.onstop = null; try { recorder.stop(); } catch { /* already stopping */ } } recorderRef.current = null; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; }
  async function revokeCaptureConsents() { const entries=Object.entries(captureConsents) as Array<["audio"|"screenshot",string]>;const failed:{audio?:string;screenshot?:string}={};await Promise.all(entries.map(async([kind,id])=>{try{const response=await fetch(`${API_BASE}/api/v1/feedback/capture-consents/${id}/revoke`,{method:"POST",headers:{Authorization:`Bearer ${token}`}});if(!response.ok)failed[kind]=id;}catch{failed[kind]=id;}}));setCaptureConsents(failed);if(Object.keys(failed).length){setError(tt("Consent revocation failed. Retry before closing or discarding evidence.","No se pudo revocar el consentimiento. Reintente antes de cerrar o descartar la evidencia."));return false;}return true; }
  function clearReviewScope() { setMine([]); setHistory([]); setReportedAssets([]); setSelectedFeedbackId(null);setReviewing(false); }
  async function closeFeedback() { if ((message.trim() || files.length) && !window.confirm(tt("Discard this unsent feedback and retained evidence?", "¿Descartar este comentario sin enviar y la evidencia conservada?"))) return; if(!await revokeCaptureConsents())return;terminateMedia();setRecordingState(audioUrl?"ready":"idle");setOpen(false);window.setTimeout(()=>openerRef.current?.focus(),0); }
  async function grantCaptureConsent(captureKind: "audio" | "screenshot") { const purpose = tt("Attach user-initiated evidence to this feedback for authorized review. You can revoke by discarding it before submission.", "Adjuntar evidencia iniciada por usted a este comentario para revisión autorizada. Puede revocarla descartándola antes de enviar."); if (!window.confirm(`${tt("Capture consent", "Consentimiento de captura")}\n\n${purpose}`)) return; const response = await fetch(`${API_BASE}/api/v1/feedback/capture-consents`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ captureKind, purpose, accepted: true }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error || tt("Consent could not be recorded.", "No se pudo registrar el consentimiento.")); return; } setCaptureConsents(current => ({ ...current, [captureKind]: data.consent.id })); }
  async function loadMine() { setError(""); const response = await fetch(`${API_BASE}/api/v1/feedback/mine`, { headers: { Authorization: `Bearer ${token}` } }); const data = await response.json().catch(() => ({})); if (!response.ok) { if([401,403].includes(response.status))clearReviewScope(); setError(data.error || tt("Your feedback could not be loaded.", "No se pudieron cargar sus comentarios.")); return; } setMine(data.feedback || []); setHistory([]); setReportedAssets([]); setReviewing(true); }
  async function loadHistory(id: number) { const headers = { Authorization: `Bearer ${token}` }; const [historyResponse, assetResponse] = await Promise.all([fetch(`${API_BASE}/api/v1/feedback/${id}/history`, { headers }), fetch(`${API_BASE}/api/v1/feedback/${id}/assets`, { headers })]); const data = await historyResponse.json().catch(() => ({})); const assetData = await assetResponse.json().catch(() => ({})); if (!historyResponse.ok || !assetResponse.ok) { if([historyResponse.status,assetResponse.status].some(status=>[401,403].includes(status)))clearReviewScope(); setError(data.error || assetData.error || tt("History is unavailable.", "El historial no está disponible.")); return; } setSelectedFeedbackId(id);setHistory(data.history || []); setReportedAssets(assetData.assets || []); }
  async function reopen(item: { id: number; version: number }) { const reason = window.prompt(tt("Why should this feedback be reopened?", "¿Por qué se debe reabrir este comentario?")); if (!reason?.trim()) return; const response = await fetch(`${API_BASE}/api/v1/feedback/${item.id}/reopen`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ observedVersion: item.version, reason }) }); const data = await response.json().catch(() => ({})); if (!response.ok) { setError(data.error || tt("Feedback was not reopened.", "No se reabrió el comentario.")); return; } await loadMine(); }
  async function reviewTranscription(feedbackId:number,jobId:number,reviewState:"accepted"|"rejected"){const reason=reviewState==="rejected"?window.prompt(tt("Why is this transcript incorrect?","¿Por qué es incorrecta esta transcripción?"))||"":"";if(reviewState==="rejected"&&!reason.trim())return;const response=await fetch(`${API_BASE}/api/v1/feedback/${feedbackId}/transcription/${jobId}/review`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({reviewState,reason})});const data=await response.json().catch(()=>({}));if(!response.ok){setError(data.error||tt("Transcript review failed.","Falló la revisión de la transcripción."));return;}await loadMine();}
  async function requestTranscription(feedbackId:number,asset:{id:number;transcriptionConsentId?:string|null}){let consentId=asset.transcriptionConsentId;if(!consentId){const purpose=tt("Transcribe this imported audio for authorized review. The original audio remains retained and the transcript requires your review.","Transcribir este audio importado para revisión autorizada. El audio original se conserva y la transcripción requiere su revisión.");if(!window.confirm(`${tt("Transcription consent","Consentimiento de transcripción")}\n\n${purpose}`))return;const consentResponse=await fetch(`${API_BASE}/api/v1/feedback/capture-consents`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({captureKind:"transcription",purpose,accepted:true})});const consentData=await consentResponse.json().catch(()=>({}));if(!consentResponse.ok){setError(consentData.error||tt("Transcription consent could not be recorded.","No se pudo registrar el consentimiento de transcripción."));return;}consentId=consentData.consent.id;}const response=await fetch(`${API_BASE}/api/v1/feedback/${feedbackId}/transcription`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,"Idempotency-Key":`transcription:${feedbackId}:${asset.id}`},body:JSON.stringify({assetId:asset.id,consentId})});const data=await response.json().catch(()=>({}));if(!response.ok&&response.status!==424){setError(data.error||tt("Transcription request failed.","Falló la solicitud de transcripción."));return;}setSuccess(response.status===424?tt("Transcription is safely queued but the provider is not activated.","La transcripción está en cola segura, pero el proveedor no está activado."):tt("Transcription requested.","Transcripción solicitada."));await loadMine();}
  async function downloadAsset(asset:{name:string;downloadUrl?:string}){if(!asset.downloadUrl)return;const response=await fetch(`${API_BASE}${asset.downloadUrl}`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok){const data=await response.json().catch(()=>({}));setError(data.error||tt("Download failed.","Falló la descarga."));return;}const url=URL.createObjectURL(await response.blob());const anchor=document.createElement("a");anchor.href=url;anchor.download=asset.name;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),0);}
  function addFiles(incoming: File[], origin:"browser-microphone"|"browser-display-capture"|"user-file-import"="user-file-import") {
    const supported = /\.(pdf|docx?|xlsx?|csv|pptx?|png|jpe?g|txt|log|json|webm|ogg|wav|m4a)$/i;
    const accepted = incoming.filter(file => file.size > 0 && file.size <= 20 * 1024 * 1024 && supported.test(file.name));
    if (accepted.length !== incoming.length) setError(tt("Some files were refused. Use a supported type up to 20 MB.", "Se rechazaron algunos archivos. Use un tipo compatible de hasta 20 MB."));
    for (const file of accepted) { fileId(file); fileOriginsRef.current.set(file,origin); }
    setFiles(current => [...current, ...accepted].slice(0, 10));
  }

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(tt("Audio recording is not supported in this browser.", "La grabación de audio no es compatible con este navegador.")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; chunksRef.current = []; durationRef.current = 0; setDuration(0);
      const recorder = new MediaRecorder(stream); recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 20 * 1024 * 1024 || durationRef.current > 300) { setError(tt("Recording exceeds the 5 minute or 20 MB limit.", "La grabación supera el límite de 5 minutos o 20 MB.")); discardRecording(); return; }
        const extension = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : blob.type.includes("wav") ? "wav" : "webm";
        const file = new File([blob], `feedback-audio-${Date.now()}.${extension}`, { type: blob.type }); addFiles([file],"browser-microphone"); setAudioUrl(URL.createObjectURL(blob)); setRecordingState("ready");
      };
      recorder.start(500); setRecordingState("recording"); timerRef.current = window.setInterval(() => setDuration(value => { durationRef.current = value + 1; if (durationRef.current >= 300) stopRecording(); return durationRef.current; }), 1000);
    } catch (cause) { terminateMedia(); setRecordingState("idle"); setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? tt("Microphone permission was denied.", "Se denegó el permiso del micrófono.") : tt("No microphone is available. Check the device and retry.", "No hay micrófono disponible. Revise el dispositivo e intente de nuevo.")); }
  }
  function pauseRecording() { const recorder = recorderRef.current; if (!recorder) return; if (recorder.state === "recording") { recorder.pause(); setRecordingState("paused"); } else if (recorder.state === "paused") { recorder.resume(); setRecordingState("recording"); } }
  function stopRecording() { if (timerRef.current) window.clearInterval(timerRef.current); timerRef.current = null; recorderRef.current?.stop(); streamRef.current?.getTracks().forEach(track => track.stop()); }
  async function discardRecording() { const consent=captureConsents.audio;if(consent&&!await revokeCaptureConsents())return;if(timerRef.current)window.clearInterval(timerRef.current);const recorder=recorderRef.current;if(recorder&&recorder.state!=="inactive"){recorder.onstop=null;recorder.stop();}streamRef.current?.getTracks().forEach(track=>track.stop());setFiles(current=>current.filter(file=>!file.name.startsWith("feedback-audio-")));if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioUrl("");setDuration(0);setRecordingState("idle"); }

  async function captureScreen() {
    setError("");
    if (!navigator.mediaDevices?.getDisplayMedia) { setError(tt("Screen capture is not supported in this browser.", "La captura de pantalla no es compatible con este navegador.")); return; }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video"); video.srcObject = stream; await video.play();
      const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0); const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("capture"); const capture = new File([blob], `feedback-capture-${Date.now()}.png`, { type: "image/png" }); addFiles([capture],"browser-display-capture"); setTransformations(current => ({ ...current, [fileId(capture)]: { originalWidth: canvas.width, originalHeight: canvas.height, capturedAt: new Date().toISOString() } }));
    } catch (cause) { setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? tt("Screen sharing was cancelled or denied. Nothing was captured.", "Se canceló o denegó compartir pantalla. No se capturó nada.") : tt("Screen capture failed. Retry or import an image.", "Falló la captura. Intente de nuevo o importe una imagen.")); }
    finally { stream?.getTracks().forEach(track => track.stop()); }
  }

  async function cropScreenshot() {
    const source = [...files].reverse().find(file => fileOriginsRef.current.get(file)==="browser-display-capture");
    if (!source) { setError(tt("Capture or import a screenshot first.", "Capture o importe una imagen primero.")); return; }
    try {
      const originalSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await source.arrayBuffer()))).map(value => value.toString(16).padStart(2, "0")).join("");
      const image = await createImageBitmap(source); const canvas = document.createElement("canvas");
      const sx = Math.round(image.width * crop.x / 100), sy = Math.round(image.height * crop.y / 100);
      const sw = Math.round(image.width * crop.width / 100), sh = Math.round(image.height * crop.height / 100);
      if (sw < 32 || sh < 32 || sx + sw > image.width || sy + sh > image.height) throw new Error("bounds");
      canvas.width = sw; canvas.height = sh; canvas.getContext("2d")?.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png")); image.close(); if (!blob) throw new Error("crop");
      const cropped = new File([blob], `feedback-capture-${Date.now()}-cropped.png`, { type: "image/png" });
      fileOriginsRef.current.set(cropped,"browser-display-capture");fileId(cropped);
      setFiles(current => [...current.filter(file => file !== source), cropped]);
      setTransformations(current => ({ ...current, [fileId(cropped)]: { ...(current[fileId(source)] || {}), sourceName: source.name, sourceSha256: originalSha256, cropPercent: crop, cropPixels: { x: sx, y: sy, width: sw, height: sh }, outputWidth: sw, outputHeight: sh, transformedAt: new Date().toISOString() } }));
    } catch { setError(tt("Crop bounds are invalid. Keep the rectangle inside the image.", "Los límites del recorte no son válidos. Mantenga el rectángulo dentro de la imagen.")); }
  }

  async function uploadOne(feedbackId:number,file:File){const group=fileGroup(file),origin=fileOriginsRef.current.get(file)||"user-file-import",clientFileId=fileId(file),uploadKey=`${idempotencyRef.current}:${clientFileId}`;setUploadResults(current=>({...current,[clientFileId]:{state:"uploading",message:tt("Uploading","Cargando")}}));const form=new FormData();form.append("files",file);form.append("kind",group);form.append("origin",origin);if(origin!=="user-file-import"){const consentId=captureConsents[group as "audio"|"screenshot"];if(!consentId){setUploadResults(current=>({...current,[clientFileId]:{state:"error",message:tt("Capture consent expired; renew it before retrying this file.","El consentimiento venció; renuévelo antes de reintentar este archivo.")}}));return false;}form.append("consentId",consentId);}form.append("transformations",JSON.stringify({[uploadKey]:transformations[clientFileId]||null}));const uploaded=await fetch(`${API_BASE}/api/v1/feedback/${feedbackId}/assets`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Idempotency-Key":uploadKey},body:form});const payload=await uploaded.json().catch(()=>({}));if(!uploaded.ok){setUploadResults(current=>({...current,[clientFileId]:{state:"error",message:payload.error||tt("Upload failed; retry this file.","La carga falló; reintente este archivo.")}}));return false;}setUploadResults(current=>({...current,[clientFileId]:{state:"success",message:payload.replayed?tt("Identical evidence already linked","La evidencia idéntica ya estaba vinculada"):tt("Uploaded","Cargado")}}));return true;}
  async function retryFile(file:File){if(!submittedFeedbackId){setError(tt("Submit the feedback record before retrying evidence.","Envíe el comentario antes de reintentar la evidencia."));return;}setError("");if(!await uploadOne(submittedFeedbackId,file))setError(tt("This file still needs attention.","Este archivo aún requiere atención."));}

  async function submitFeedback() {
    const trimmed = message.trim();
    if (!trimmed) {
      setError(tt("Describe what happened or what should improve.", "Describa lo ocurrido o lo que debe mejorar."));
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyRef.current,
        },
        body: JSON.stringify({
          feedbackType,
          priority,
          message: trimmed,
          module: moduleName,
          projectId,
          pageUrl: window.location.href,
          metadata: {
            path: location,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            language: navigator.language,
            userEmail: user?.email ?? null,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || tt("Feedback was not submitted.", "No se envió el comentario."));
      const feedbackId = Number(data.feedback?.id);
      setSubmittedFeedbackId(feedbackId||null);
      let uploadFailed=false;
      if (files.length && feedbackId) {
        setUploadState(tt("Uploading governed evidence…", "Cargando evidencia controlada…"));
        for (const group of ["audio", "screenshot", "attachment"] as const) {
          const selected = files.filter(file => fileGroup(file) === group);
          for (const file of selected) {
            const clientFileId=fileId(file);if(uploadResults[clientFileId]?.state==="success")continue;if(!await uploadOne(feedbackId,file))uploadFailed=true;
          }
        }
      }
      if(uploadFailed)throw new Error(tt("Some evidence failed. Retry failed files; completed files will not be duplicated.","Parte de la evidencia falló. Reintente los archivos fallidos; los completados no se duplicarán."));
      setMessage("");
      setFiles([]);setUploadResults({});setSubmittedFeedbackId(null); terminateMedia(); if(audioUrl)URL.revokeObjectURL(audioUrl); setAudioUrl("");setDuration(0);setRecordingState("idle");setCaptureConsents({}); idempotencyRef.current = randomKey(); setUploadState("");
      setSuccess(tt(`Sent as ${data.feedback?.stableId || "feedback"}.`, `Enviado como ${data.feedback?.stableId || "comentario"}.`));
      setTimeout(() => { terminateMedia(); setOpen(false); window.setTimeout(() => openerRef.current?.focus(), 0); }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : tt("Feedback was not submitted.", "No se envió el comentario."));
    } finally {
      setSubmitting(false);
    }
  }

  const selectStyle: CSSProperties = {
    width: "100%",
    border: "1px solid hsl(var(--border))",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    background: "hsl(var(--background))",
  };

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tt("Send BIMLog feedback", "Enviar comentarios a BIMLog")}
        title={tt("Send BIMLog feedback", "Enviar comentarios a BIMLog")}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 70,
          width: 48,
          height: 48,
          borderRadius: 8,
          border: "1px solid #1d4ed8",
          background: "#1d4ed8",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.24)",
          cursor: "pointer",
        }}
      >
        <MessageSquare size={21} />
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15, 23, 42, 0.28)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: 20,
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={tt("BIMLog feedback", "Comentarios de BIMLog")}
            style={{
              width: "min(420px, calc(100vw - 40px))",
              background: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              boxShadow: "0 18px 48px rgba(15, 23, 42, 0.28)",
              maxHeight: "calc(100dvh - 24px)",
              overflowY: "auto",
            }}
          >
            <div style={{ background: "#1e3a5f", color: "white", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{tt("BIMLog Feedback", "Comentarios de BIMLog")}</div>
              <div style={{ fontSize: 11, opacity: 0.82 }}>{moduleName} - {location}</div>
              </div>
              <button
                type="button"
                onClick={closeFeedback}
                aria-label={tt("Close feedback", "Cerrar comentarios")}
                style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}><button type="button" onClick={() => setReviewing(false)} aria-pressed={!reviewing}>{tt("New feedback", "Nuevo comentario")}</button><button type="button" onClick={loadMine} aria-pressed={reviewing}>{tt("My feedback", "Mis comentarios")}</button></div>
              {reviewing ? <section aria-label={tt("My feedback backlog", "Mi lista de comentarios")}>
                {!mine.length ? <p>{tt("No feedback has been reported.", "No se han reportado comentarios.")}</p> : mine.map(item => <article key={item.id} style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: 10, marginBottom: 8 }}><strong>{item.stableId}</strong> · {stateLabel(item.status)}{item.relay&&<> · {stateLabel(item.relay.state)} v{item.relay.version}</>}<p style={{ margin: "5px 0" }}>{item.message}</p>{item.relay&&<details><summary>{tt("Relay status history","Historial del estado de retransmisión")}</summary><p>{new Date(item.relay.updatedAt).toLocaleString(language)}{item.relay.reason?` — ${item.relay.reason}`:""}</p><ol>{item.relay.history.map(event=><li key={event.sequence}>{stateLabel(event.state)} · {new Date(event.at).toLocaleString(language)}{event.reason?` — ${event.reason}`:""}</li>)}</ol></details>}{item.dispositionReason && <p>{tt("Decision", "Decisión")}: {item.dispositionReason}</p>}{item.targetRelease && <p>{tt("Target", "Objetivo")}: {item.targetRelease}</p>}{item.transcription&&<details><summary>{tt("Transcript", "Transcripción")} · {stateLabel(item.transcription.state)}</summary><p>{item.transcription.result||tt("No transcript is available yet.","Aún no hay transcripción disponible.")}</p>{item.transcription.state==="completed"&&item.transcription.reviewState==="pending"&&<><button type="button" onClick={()=>reviewTranscription(item.id,item.transcription!.id,"accepted")}>{tt("Accept transcript","Aceptar transcripción")}</button><button type="button" onClick={()=>reviewTranscription(item.id,item.transcription!.id,"rejected")}>{tt("Reject transcript","Rechazar transcripción")}</button></>}</details>}<button type="button" onClick={() => loadHistory(item.id)}>{tt("History", "Historial")}</button>{["verified", "rejected", "deferred"].includes(item.status) && <button type="button" onClick={() => reopen(item)}>{tt("Reopen", "Reabrir")}</button>}</article>)}
                {!!history.length && <ol aria-label={tt("Feedback history", "Historial del comentario")}>{history.map(event => <li key={event.id}>{eventLabel(event.eventType)} · {new Date(event.createdAt).toLocaleString(language)}{event.reason ? ` — ${event.reason}` : ""}</li>)}</ol>}
                {!!reportedAssets.length && <ul aria-label={tt("Feedback attachments", "Archivos del comentario")}>{reportedAssets.map(asset => <li key={asset.id}>{asset.downloadUrl?<button type="button" onClick={()=>downloadAsset(asset)}>{asset.name}</button>:asset.name} · {stateLabel(asset.scanState)}{selectedFeedbackId&&asset.kind==="audio"&&asset.scanState==="clean"&&<button type="button" onClick={()=>requestTranscription(selectedFeedbackId,asset)}>{tt("Request transcription","Solicitar transcripción")}</button>}</li>)}</ul>}
              </section> : <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  {tt("Type", "Tipo")}
                  <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
                    {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{es ? ({ bug: "Error", workflow: "Problema de flujo", idea: "Idea", question: "Pregunta", other: "Otro" } as Record<string,string>)[option.value] : option.label}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, fontWeight: 700 }}>
                  {tt("Priority", "Prioridad")}
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...selectStyle, marginTop: 5 }}>
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{es ? ({ normal: "Normal", high: "Alta", urgent: "Urgente", low: "Baja" } as Record<string,string>)[option.value] : option.label}</option>)}
                  </select>
                </label>
              </div>

              <label style={{ fontSize: 12, fontWeight: 700 }}>
                {tt("What should we know?", "¿Qué debemos saber?")}
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  spellCheck
                  rows={6}
                  placeholder={tt("Describe the bug, workflow issue, or improvement.", "Describa el error, problema de flujo o mejora.")}
                  style={{
                    width: "100%",
                    marginTop: 5,
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    padding: 10,
                    fontSize: 13,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <section aria-label={tt("Evidence", "Evidencia")} style={{ marginTop: 12, border: "1px solid hsl(var(--border))", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{tt("Evidence (optional)", "Evidencia (opcional)")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <label style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "7px 9px", fontSize: 11, cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <FilePlus2 size={14} />{tt("Add files", "Agregar archivos")}
                    <input type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.log,.json,.webm,.ogg,.wav,.m4a,audio/*" onChange={event => { addFiles(Array.from(event.target.files || []),"user-file-import"); event.currentTarget.value = ""; }} />
                  </label>
                  <button type="button" onClick={captureConsents.screenshot ? captureScreen : () => grantCaptureConsent("screenshot")} style={{ border: "1px solid hsl(var(--border))", background: "white", borderRadius: 6, padding: "7px 9px", fontSize: 11, display: "inline-flex", gap: 5, alignItems: "center" }}><Camera size={14}/>{captureConsents.screenshot ? tt("Capture screen", "Capturar pantalla") : tt("Review screen consent", "Revisar consentimiento de pantalla")}</button>
                  {recordingState === "idle" || recordingState === "ready" ? <button type="button" onClick={captureConsents.audio ? startRecording : () => grantCaptureConsent("audio")} style={{ border: "1px solid hsl(var(--border))", background: "white", borderRadius: 6, padding: "7px 9px", fontSize: 11, display: "inline-flex", gap: 5, alignItems: "center" }}><Mic size={14}/>{captureConsents.audio ? tt("Record voice", "Grabar voz") : tt("Review voice consent", "Revisar consentimiento de voz")}</button> : <>
                    <button type="button" onClick={pauseRecording} aria-label={recordingState === "paused" ? tt("Resume recording", "Reanudar grabación") : tt("Pause recording", "Pausar grabación")}><Pause size={14}/>{recordingState === "paused" ? tt("Resume", "Reanudar") : tt("Pause", "Pausar")}</button>
                    <button type="button" onClick={stopRecording}><Square size={14}/>{tt("Stop", "Detener")}</button>
                  </>}
                </div>
                {files.some(file => file.name.startsWith("feedback-capture-")) && <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(48px, 1fr)) auto", gap: 5, marginTop: 8, alignItems: "end" }}>
                  {(["x", "y", "width", "height"] as const).map(key => <label key={key} style={{ fontSize: 9 }}>{key.toUpperCase()} %<input aria-label={`${key} percent`} type="number" min="0" max="100" value={crop[key]} onChange={event => setCrop(current => ({ ...current, [key]: Number(event.target.value) }))} style={{ width: "100%", boxSizing: "border-box" }}/></label>)}
                  <button type="button" onClick={cropScreenshot} style={{ height: 28, whiteSpace: "nowrap" }}><RotateCcw size={12}/>{tt("Apply crop", "Aplicar recorte")}</button>
                </div>}
                {recordingState !== "idle" && <div aria-live="polite" style={{ fontSize: 11, marginTop: 8 }}>{tt("Recording", "Grabación")}: {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")} · {stateLabel(recordingState)}</div>}
                {audioUrl && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}><audio controls src={audioUrl} style={{ maxWidth: "260px" }}><Play/></audio><button type="button" onClick={discardRecording} aria-label={tt("Discard recording", "Descartar grabación")}><Trash2 size={14}/></button></div>}
                {!!files.length && <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 11 }}>{files.map((file, index) => <li key={fileId(file)}>{file.name} · {(file.size / 1024).toFixed(1)} KB <button type="button" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={tt(`Remove ${file.name}`, `Quitar ${file.name}`)}><X size={12}/></button> {uploadResults[fileId(file)]&&<span role="status">{uploadResults[fileId(file)].message}</span>} {uploadResults[fileId(file)]?.state==="error"&&<button type="button" onClick={()=>retryFile(file)}>{tt("Retry this file","Reintentar este archivo")}</button>}</li>)}</ul>}
                <p style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", margin: "8px 0 0" }}>{tt("Up to 10 supported files, 20 MB each. Files remain quarantined until the governed scanner approves them. Screen sharing starts only after your browser consent and stops immediately after capture.", "Hasta 10 archivos compatibles de 20 MB cada uno. Permanecen en cuarentena hasta la aprobación del escáner controlado. Compartir pantalla comienza solo con su consentimiento y termina inmediatamente después de capturar.")}</p>
                <p style={{ fontSize: 10 }} aria-live="polite">{tt("Capture notice feedback-capture-v1", "Aviso de captura feedback-capture-v1")} · {captureConsents.audio ? tt("voice consent recorded", "consentimiento de voz registrado") : tt("voice not authorized", "voz no autorizada")} · {captureConsents.screenshot ? tt("screen consent recorded", "consentimiento de pantalla registrado") : tt("screen not authorized", "pantalla no autorizada")}</p>
              </section>

              <div style={{ marginTop: 10, padding: "8px 10px", border: "1px solid #dbeafe", background: "#eff6ff", borderRadius: 6, fontSize: 11, color: "#1d4ed8", display: "flex", gap: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{tt("BIMLog will include this page, module, browser, and build context so authorized reviewers can reproduce the issue.", "BIMLog incluirá el contexto de página, módulo, navegador y versión para que revisores autorizados reproduzcan el problema.")}</span>
              </div>

              {error && <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" style={{ color: "#b91c1c", fontSize: 12, marginTop: 10 }}>{error}</div>}
              {success && <div role="status" aria-live="polite" style={{ color: "#15803d", fontSize: 12, marginTop: 10 }}>{success}</div>}
              {uploadState && <div role="status" style={{ fontSize: 12, marginTop: 10 }}>{uploadState}</div>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={closeFeedback} style={{ border: "1px solid hsl(var(--border))", background: "white", borderRadius: 6, padding: "8px 12px", cursor: "pointer" }}>
                  {tt("Cancel", "Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={submitting}
                  style={{ border: "1px solid #1d4ed8", background: "#1d4ed8", color: "white", borderRadius: 6, padding: "8px 12px", cursor: submitting ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 700 }}
                >
                  <Send size={14} />
                  {submitting ? tt("Sending…", "Enviando…") : tt("Send", "Enviar")}
                </button>
              </div>
              </>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
