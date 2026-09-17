import { useEffect, useMemo, useRef, useState } from "react";
import { areaMesh, DEFAULT_AREA_ORBIT, moveAreaOrbit, parseAreaPackage, type AreaIdentity, type AreaOrbit } from "./lens-next-area-preview";

// Unmounted feasibility component. Never substitute a screenshot or whole-model proxy for this input.
export function LensNextAreaPreview({ packageData, expectedIdentity }: { packageData: unknown; expectedIdentity: AreaIdentity }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const orbitRef = useRef<AreaOrbit>(DEFAULT_AREA_ORBIT);
  const drawRef = useRef<(() => void) | null>(null);
  const [orbit, setOrbit] = useState<AreaOrbit>(DEFAULT_AREA_ORBIT);
  const [renderError, setRenderError] = useState<string | null>(null);
  const parsed = useMemo(() => {
    try { return { area: parseAreaPackage(packageData, expectedIdentity), error: null }; }
    catch (error) { return { area: null, error: error instanceof Error ? error.message : "Area preview cannot be opened." }; }
  }, [packageData, expectedIdentity]);
  const mesh = useMemo(() => parsed.area ? areaMesh(parsed.area) : null, [parsed.area]);

  useEffect(() => { orbitRef.current = orbit; drawRef.current?.(); }, [orbit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mesh) return;
    const gl = canvas.getContext("webgl2", { antialias: true });
    if (!gl) { setRenderError("Interactive 3D is unavailable in this browser."); return; }
    const vertex = `#version 300 es
      in vec3 aPosition;
      in vec3 aColor;
      uniform float uYaw;
      uniform float uPitch;
      uniform float uDistance;
      uniform float uAspect;
      out vec3 vColor;
      void main() {
        vec3 p = vec3(aPosition.x, aPosition.z, aPosition.y);
        float cy = cos(uYaw), sy = sin(uYaw);
        p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);
        float cp = cos(uPitch), sp = sin(uPitch);
        p = vec3(p.x, cp * p.y - sp * p.z, sp * p.y + cp * p.z);
        float depth = uDistance - p.z;
        gl_Position = vec4(p.x * 1.8 / uAspect, p.y * 1.8, depth * 0.5, depth);
        vColor = aColor;
      }`;
    const fragment = `#version 300 es
      precision highp float;
      in vec3 vColor;
      out vec4 fragColor;
      void main() { fragColor = vec4(vColor, 1.0); }`;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("3D shader allocation failed.");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "3D shader compilation failed.";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };
    let buffer: WebGLBuffer | null = null;
    let program: WebGLProgram | null = null;
    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let observer: ResizeObserver | null = null;
    try {
      vertexShader = compile(gl.VERTEX_SHADER, vertex);
      fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram();
      if (!program) throw new Error("3D program allocation failed.");
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "3D program link failed.");
      const activeProgram = program;
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("3D geometry buffer allocation failed.");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, "aPosition");
      const color = gl.getAttribLocation(program, "aColor");
      if (position < 0 || color < 0) throw new Error("3D vertex attributes are missing.");
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(color, 3, gl.FLOAT, false, 24, 12);
      gl.enableVertexAttribArray(color);
      gl.enable(gl.DEPTH_TEST);
      const draw = () => {
        const width = Math.max(1, Math.round(canvas.clientWidth * window.devicePixelRatio));
        const height = Math.max(1, Math.round(canvas.clientHeight * window.devicePixelRatio));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        gl.viewport(0, 0, width, height);
        gl.clearColor(0.94, 0.96, 0.98, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(gl.getUniformLocation(activeProgram, "uYaw"), orbitRef.current.yaw);
        gl.uniform1f(gl.getUniformLocation(activeProgram, "uPitch"), orbitRef.current.pitch);
        gl.uniform1f(gl.getUniformLocation(activeProgram, "uDistance"), orbitRef.current.distance);
        gl.uniform1f(gl.getUniformLocation(activeProgram, "uAspect"), width / height);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 6);
      };
      drawRef.current = draw;
      observer = new ResizeObserver(draw);
      observer.observe(canvas);
      draw();
      setRenderError(null);
    } catch (error) {
      setRenderError(error instanceof Error ? error.message : "Interactive 3D failed to initialize.");
    }
    return () => {
      drawRef.current = null;
      observer?.disconnect();
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
    };
  }, [mesh]);

  if (parsed.error) return <p role="alert">{parsed.error}</p>;
  return <section aria-label="Bounded clash area preview" style={{ position: "relative", minHeight: 240 }}>
    <canvas ref={canvasRef} aria-label="Interactive bounded clash geometry" role="img"
      style={{ width: "100%", height: "min(55vh, 480px)", minHeight: 240, display: "block", touchAction: "none", cursor: "grab" }}
      onPointerDown={(event) => { dragRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => {
        const prior = dragRef.current;
        if (!prior) return;
        dragRef.current = { x: event.clientX, y: event.clientY };
        setOrbit((current) => moveAreaOrbit(current, event.clientX - prior.x, event.clientY - prior.y));
      }}
      onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}
      onWheel={(event) => { event.preventDefault(); setOrbit((current) => moveAreaOrbit(current, 0, 0, event.deltaY)); }} />
    <div style={{ display: "flex", gap: 8, padding: 8 }}>
      <button type="button" onClick={() => setOrbit(DEFAULT_AREA_ORBIT)}>Reset view</button>
      <button type="button" onClick={() => setOrbit((current) => moveAreaOrbit(current, -40, 0))} aria-label="Rotate left">Left</button>
      <button type="button" onClick={() => setOrbit((current) => moveAreaOrbit(current, 40, 0))} aria-label="Rotate right">Right</button>
      <button type="button" onClick={() => setOrbit((current) => moveAreaOrbit(current, 0, 0, -120))} aria-label="Zoom in">Zoom in</button>
      <button type="button" onClick={() => setOrbit((current) => moveAreaOrbit(current, 0, 0, 120))} aria-label="Zoom out">Zoom out</button>
    </div>
    {renderError && <p role="alert">{renderError}</p>}
  </section>;
}
