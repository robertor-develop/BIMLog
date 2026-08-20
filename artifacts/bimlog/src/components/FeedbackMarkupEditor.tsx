import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Circle, Crop, Eraser, Highlighter, Minus, Pencil, Redo2, RotateCcw, Save, Square, Type, Undo2, X } from "lucide-react";

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type Tool = "crop" | "pen" | "pencil" | "highlight" | "line" | "arrow" | "rectangle" | "square" | "circle" | "text" | "eraser";
type StrokeOperation = { kind: "pen" | "pencil" | "highlight"; points: Point[]; color: string; width: number };
type ShapeOperation = { kind: "line" | "arrow" | "rectangle" | "square" | "circle"; start: Point; end: Point; color: string; width: number };
type TextOperation = { kind: "text"; at: Point; value: string; color: string; size: number };
type Operation = StrokeOperation | ShapeOperation | TextOperation;

type Props = {
  file: File;
  language: "en" | "es";
  onCancel: () => void;
  onSave: (rendered: File, metadata: Record<string, unknown>) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizedRect = (start: Point, end: Point): Rect => ({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });

function drawArrow(context: CanvasRenderingContext2D, start: Point, end: Point, width: number) {
  context.moveTo(start.x, start.y); context.lineTo(end.x, end.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x), head = Math.max(12, width * 4);
  context.moveTo(end.x, end.y); context.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
  context.moveTo(end.x, end.y); context.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
}

function drawOperation(context: CanvasRenderingContext2D, operation: Operation) {
  context.save(); context.lineCap = "round"; context.lineJoin = "round"; context.strokeStyle = operation.color;
  if (operation.kind === "text") { context.fillStyle = operation.color; context.font = `700 ${operation.size}px Arial, sans-serif`; context.textBaseline = "top"; context.fillText(operation.value, operation.at.x, operation.at.y); context.restore(); return; }
  context.lineWidth = operation.width; context.globalAlpha = operation.kind === "highlight" ? 0.32 : 1; context.beginPath();
  if (operation.kind === "pen" || operation.kind === "pencil" || operation.kind === "highlight") {
    operation.points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  } else if (operation.kind === "line") { context.moveTo(operation.start.x, operation.start.y); context.lineTo(operation.end.x, operation.end.y); }
  else if (operation.kind === "arrow") drawArrow(context, operation.start, operation.end, operation.width);
  else if (operation.kind === "rectangle" || operation.kind === "square" || operation.kind === "circle") {
    const rect = normalizedRect(operation.start, operation.end);
    if (operation.kind === "square") { const side = Math.min(rect.width, rect.height); context.rect(rect.x, rect.y, side, side); }
    else if (operation.kind === "rectangle") context.rect(rect.x, rect.y, rect.width, rect.height);
    else context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
  }
  context.stroke(); context.restore();
}

export function FeedbackMarkupEditor({ file, language, onCancel, onSave }: Props) {
  const es = language === "es", tt = (en: string, spanish: string) => es ? spanish : en;
  const dialogRef = useRef<HTMLDivElement | null>(null), canvasRef = useRef<HTMLCanvasElement | null>(null), imageRef = useRef<ImageBitmap | null>(null), gestureRef = useRef<{ start: Point; operationIndex?: number } | null>(null), draftRef = useRef<Operation | null>(null), onCancelRef = useRef(onCancel);
  const [tool, setTool] = useState<Tool>("crop"), [color, setColor] = useState("#ef4444"), [width, setWidth] = useState(5), [text, setText] = useState("");
  const [operations, setOperations] = useState<Operation[]>([]), [redo, setRedo] = useState<Operation[]>([]), [cropRect, setCropRect] = useState<Rect | null>(null), [draft, setDraft] = useState<Operation | null>(null), [ready, setReady] = useState(false), [editorError, setEditorError] = useState("");

  const toolbar: Array<[Tool, typeof Crop, string, string]> = useMemo(() => [
    ["crop", Crop, "Cut", "Recortar"], ["pen", Pencil, "Pen", "Pluma"], ["pencil", Pencil, "Pencil", "Lápiz"], ["highlight", Highlighter, "Marker", "Marcador"],
    ["line", Minus, "Line", "Línea"], ["arrow", ArrowRight, "Arrow", "Flecha"], ["rectangle", Square, "Rectangle", "Rectángulo"], ["square", Square, "Square", "Cuadrado"],
    ["circle", Circle, "Circle", "Círculo"], ["text", Type, "Text", "Texto"], ["eraser", Eraser, "Erase last", "Borrar último"],
  ], [es]);

  useEffect(() => {
    let active = true; createImageBitmap(file).then(image => { if (!active) return image.close(); imageRef.current = image; const canvas = canvasRef.current; if (canvas) { canvas.width = image.width; canvas.height = image.height; setCropRect({ x: 0, y: 0, width: image.width, height: image.height }); setReady(true); dialogRef.current?.querySelector<HTMLElement>("button")?.focus(); } }).catch(() => { if (active) setEditorError(tt("The captured image could not be decoded. Cancel and capture it again.", "No se pudo decodificar la imagen capturada. Cancele y vuelva a capturarla.")); });
    return () => { active = false; imageRef.current?.close(); imageRef.current = null; };
  }, [file]);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => {
    const restored: Array<[HTMLElement, boolean, string | null]> = []; let child: HTMLElement | null = dialogRef.current;
    while (child?.parentElement && child.parentElement !== document.body) { for (const sibling of Array.from(child.parentElement.children)) if (sibling !== child && sibling instanceof HTMLElement) { restored.push([sibling, sibling.inert, sibling.getAttribute("aria-hidden")]); sibling.inert = true; sibling.setAttribute("aria-hidden", "true"); } child = child.parentElement; }
    return () => { for (const [node, inert, hidden] of restored) { node.inert = inert; if (hidden === null) node.removeAttribute("aria-hidden"); else node.setAttribute("aria-hidden", hidden); } };
  }, []);
  useEffect(() => { const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null; const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onCancelRef.current(); return; } if (event.key !== "Tab" || !dialogRef.current) return; const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),canvas[tabindex]')).filter(node => node.offsetParent !== null); if (!nodes.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; document.addEventListener("keydown", key, true); return () => { document.removeEventListener("keydown", key, true); window.setTimeout(() => restore?.focus(), 0); }; }, []);

  useEffect(() => {
    const canvas = canvasRef.current, image = imageRef.current; if (!canvas || !image || !ready) return; const context = canvas.getContext("2d"); if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); operations.forEach(operation => drawOperation(context, operation)); if (draft) drawOperation(context, draft);
    if (cropRect && tool === "crop") { context.save(); context.fillStyle = "rgba(15,23,42,.52)"; context.fillRect(0, 0, canvas.width, canvas.height); context.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height); context.drawImage(image, cropRect.x, cropRect.y, cropRect.width, cropRect.height, cropRect.x, cropRect.y, cropRect.width, cropRect.height); operations.forEach(operation => drawOperation(context, operation)); context.strokeStyle = "#38bdf8"; context.lineWidth = Math.max(2, canvas.width / 500); context.setLineDash([10, 7]); context.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height); context.restore(); }
  }, [operations, draft, cropRect, ready, tool]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): Point => { const canvas = event.currentTarget, box = canvas.getBoundingClientRect(); return { x: clamp((event.clientX - box.left) * canvas.width / box.width, 0, canvas.width), y: clamp((event.clientY - box.top) * canvas.height / box.height, 0, canvas.height) }; };
  const begin = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId); const at = point(event); setRedo([]);
    if (tool === "eraser") { setOperations(current => current.slice(0, -1)); return; }
    if (tool === "text") { if (text.trim()) { setOperations(current => [...current, { kind: "text", at, value: text.trim().slice(0, 200), color, size: Math.max(18, width * 5) }]); setText(""); } return; }
    gestureRef.current = { start: at };
    if (tool === "crop") setCropRect({ x: at.x, y: at.y, width: 1, height: 1 });
    else if (operations.length >= 200) setEditorError(tt("The markup limit is 200 operations.", "El límite de marcado es de 200 operaciones."));
    else if (tool === "pen" || tool === "pencil" || tool === "highlight") { const next: Operation = { kind: tool, points: [at], color, width: tool === "pencil" ? Math.max(1, width / 2) : tool === "highlight" ? width * 3 : width }; draftRef.current = next; setDraft(next); }
    else { const next = { kind: tool, start: at, end: at, color, width } as ShapeOperation; draftRef.current = next; setDraft(next); }
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!gestureRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return; const at = point(event), start = gestureRef.current.start;
    if (tool === "crop") setCropRect(normalizedRect(start, at));
    else setDraft(current => { if (!current) return current; const next = current.kind === "pen" || current.kind === "pencil" || current.kind === "highlight" ? { ...current, points: current.points.length < 5000 ? [...current.points, at] : current.points } : { ...current, end: at }; draftRef.current = next; return next; });
  };
  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => { const at = point(event); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); const currentDraft = draftRef.current; let finalDraft: Operation | null = currentDraft; if (currentDraft && (currentDraft.kind === "pen" || currentDraft.kind === "pencil" || currentDraft.kind === "highlight")) finalDraft = currentDraft.points.length < 5000 ? { ...currentDraft, points: [...currentDraft.points, at] } : currentDraft; else if (currentDraft && (currentDraft.kind === "line" || currentDraft.kind === "arrow" || currentDraft.kind === "rectangle" || currentDraft.kind === "square" || currentDraft.kind === "circle")) finalDraft = { ...currentDraft, end: at }; if (finalDraft) setOperations(current => [...current, finalDraft!]); draftRef.current = null; setDraft(null); gestureRef.current = null; };
  const undo = () => setOperations(current => { if (!current.length) return current; setRedo(items => [current[current.length - 1], ...items]); return current.slice(0, -1); });
  const redoOne = () => setRedo(current => { if (!current.length) return current; setOperations(items => [...items, current[0]]); return current.slice(1); });
  const save = async () => {
    const image = imageRef.current, source = canvasRef.current; if (!image || !source || !cropRect || cropRect.width < 2 || cropRect.height < 2) return;
    const rect = { x: Math.round(cropRect.x), y: Math.round(cropRect.y), width: Math.round(cropRect.width), height: Math.round(cropRect.height) }, output = document.createElement("canvas"); output.width = rect.width; output.height = rect.height;
    const context = output.getContext("2d"); if (!context) return; context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height); context.save(); context.translate(-rect.x, -rect.y); operations.forEach(operation => drawOperation(context, operation)); context.restore();
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, "image/png")); if (!blob) return; const stem = file.name.replace(/\.[^.]+$/, "").slice(0, 100), rendered = new File([blob], `${stem}-marked.png`, { type: "image/png" });
    const operationSummary = operations.map(operation => operation.kind), operationSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(operations))))).map(value => value.toString(16).padStart(2, "0")).join("");
    onSave(rendered, { toolVersion: "bimlog-cutting-markup-v1", originalName: file.name, originalWidth: image.width, originalHeight: image.height, cropPixels: rect, outputWidth: output.width, outputHeight: output.height, operationCount: operations.length, operationKinds: operationSummary, operationSha256, transformedAt: new Date().toISOString() });
  };

  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={tt("BIMLog cutting and markup tool", "Herramienta BIMLog de recorte y marcado")} style={{ position: "fixed", inset: 0, zIndex: 100000, background: "rgba(2,6,23,.88)", display: "grid", gridTemplateRows: "auto 1fr auto", color: "white" }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 10, background: "#0f172a", borderBottom: "1px solid #334155" }}>
      <strong style={{ marginRight: 8 }}>{tt("BIMLog Cut & Markup", "Recorte y marcado BIMLog")}</strong>
      {toolbar.map(([value, Icon, en, spanish]) => <button key={value} type="button" aria-pressed={tool === value} title={tt(en, spanish)} onClick={() => setTool(value)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 8px", borderRadius: 6, border: tool === value ? "2px solid #38bdf8" : "1px solid #475569", background: tool === value ? "#0c4a6e" : "#1e293b", color: "white" }}><Icon size={15}/><span>{tt(en, spanish)}</span></button>)}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>{tt("Color", "Color")}<input type="color" value={color} onChange={event => setColor(event.target.value)}/></label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>{tt("Size", "Tamaño")}<input type="range" min="1" max="18" value={width} onChange={event => setWidth(Number(event.target.value))}/></label>
      {tool === "text" && <input value={text} onChange={event => setText(event.target.value)} maxLength={200} placeholder={tt("Type text, then click image", "Escriba texto y haga clic en la imagen")} style={{ minWidth: 220, padding: 7 }}/>} 
      <button type="button" onClick={undo} disabled={!operations.length}><Undo2 size={15}/></button><button type="button" onClick={redoOne} disabled={!redo.length}><Redo2 size={15}/></button>
      <button type="button" onClick={() => { setOperations([]); setRedo([]); setCropRect(imageRef.current ? { x: 0, y: 0, width: imageRef.current.width, height: imageRef.current.height } : null); }}><RotateCcw size={15}/>{tt("Reset", "Restablecer")}</button>
    </div>
    <div style={{ overflow: "auto", display: "grid", placeItems: "center", padding: 18 }}><canvas ref={canvasRef} tabIndex={0} aria-label={tt("Captured image editing canvas", "Lienzo de edición de la imagen capturada")} aria-describedby="feedback-markup-instructions" onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} style={{ maxWidth: "100%", maxHeight: "calc(100vh - 175px)", boxShadow: "0 20px 50px rgba(0,0,0,.5)", touchAction: "none", cursor: tool === "text" ? "text" : "crosshair" }}/></div>
    <div style={{ padding: 12, background: "#0f172a", borderTop: "1px solid #334155" }}><span id="feedback-markup-instructions" style={{ fontSize: 12, color: "#cbd5e1" }}>{tt("Choose a tool, then drag on the image. The untouched capture and this marked version remain linked in one feedback package.", "Elija una herramienta y arrastre sobre la imagen. La captura original y esta versión marcada permanecen vinculadas en un solo paquete de comentarios.")}</span>{editorError && <div role="alert" style={{ color: "#fecaca", marginTop: 6 }}>{editorError}</div>}<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}><button type="button" onClick={onCancel}><X size={15}/>{tt("Cancel", "Cancelar")}</button><button type="button" onClick={save} disabled={!ready || !cropRect || cropRect.width < 2 || cropRect.height < 2} style={{ background: "#2563eb", color: "white", fontWeight: 700 }}><Save size={15}/>{tt("Attach marked capture", "Adjuntar captura marcada")}</button></div></div>
  </div>;
}
