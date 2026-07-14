import { useEffect, useState } from "react";
import { Crop, RefreshCw, Scissors, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RfiImageSelectionSurface, type NormalizedCrop } from "./RfiImageCropEditor";

export function RfiSnippingWorkspace({ src, fileName, lang, onComplete, onRetake, onCancel }: {
  src: string;
  fileName: string;
  lang: string;
  onComplete: (file: File) => void;
  onRetake: () => void;
  onCancel: () => void;
}) {
  const [selection, setSelection] = useState<NormalizedCrop | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState("");
  const [committing, setCommitting] = useState(false);
  const es = lang === "es";

  const createSnip = async () => {
    if (committing) return;
    try {
      setCommitting(true);
      setError("");
      if (!selection || !size || selection.width <= 0 || selection.height <= 0) {
        throw new Error(es ? "Seleccione un area valida." : "Select a valid area.");
      }
      const image = new Image();
      image.src = src;
      await image.decode();
      const width = Math.max(1, Math.round(selection.width * image.naturalWidth));
      const height = Math.max(1, Math.round(selection.height * image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error(es ? "No se pudo crear el recorte." : "Canvas conversion failed.");
      context.drawImage(
        image,
        selection.x * image.naturalWidth,
        selection.y * image.naturalHeight,
        selection.width * image.naturalWidth,
        selection.height * image.naturalHeight,
        0,
        0,
        width,
        height,
      );
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      context.clearRect(0, 0, width, height);
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error(es ? "No se pudo convertir el recorte." : "Canvas conversion failed.");
      onComplete(new File([blob], fileName, { type: "image/png" }));
    } catch (reason) {
      setCommitting(false);
      setError(reason instanceof Error ? reason.message : (es ? "No se pudo crear el recorte." : "Could not create snip."));
    }
  };

  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) void createSnip();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const pixels = selection && size
    ? `${Math.round(selection.width * size.width)} x ${Math.round(selection.height * size.height)} px`
    : es ? "Sin seleccion" : "No selection";

  return <div role="dialog" aria-modal="true" aria-label={es ? "Herramienta de Recortes BIMLog" : "BIMLog Snipping Tool"} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(2,6,23,.95)", color: "white", display: "grid", gridTemplateRows: "auto 1fr auto" }}>
    <header style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", borderBottom: "1px solid #334155" }}>
      <Scissors />
      <div><strong>{es ? "Herramienta de Recortes BIMLog" : "BIMLog Snipping Tool"}</strong><div style={{ fontSize: 12, color: "#CBD5E1" }}>{es ? "Dibuje el rectangulo exacto que desea conservar." : "Draw the exact rectangle you want to keep."}</div></div>
      <Button variant="outline" size="icon" onClick={onCancel} aria-label={es ? "Cancelar" : "Cancel"} style={{ marginLeft: "auto" }}><X /></Button>
    </header>
    <main style={{ overflow: "auto", padding: 18, textAlign: "center" }}>
      <RfiImageSelectionSurface src={src} alt={es ? "Fotograma capturado temporal" : "Temporary captured frame"} value={selection} onChange={setSelection} naturalSize={size} onNaturalSize={setSize} lang={lang} />
      <div aria-live="polite" aria-label={es ? "Dimensiones del recorte" : "Snip dimensions"} style={{ marginTop: 10 }}>{pixels}</div>
      {error && <p role="alert" style={{ color: "#FCA5A5" }}>{error}</p>}
    </main>
    <footer style={{ padding: 14, display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid #334155" }}>
      <Button onClick={() => void createSnip()} disabled={!selection || committing}><Crop />{es ? "Continuar a Recorte" : "Continue to Crop"}</Button>
      <Button variant="outline" onClick={() => setSelection(null)} disabled={!selection || committing}><Scissors />{es ? "Redibujar Seleccion" : "Redraw Selection"}</Button>
      <Button variant="outline" onClick={onRetake} disabled={committing}><RefreshCw />{es ? "Repetir Captura" : "Retake Screen Capture"}</Button>
      <Button variant="outline" onClick={onCancel} disabled={committing}>{es ? "Cancelar" : "Cancel"}</Button>
    </footer>
  </div>;
}
