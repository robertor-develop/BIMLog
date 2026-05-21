import { useState, useEffect } from "react";
import { isDebug } from "@/lib/debug";

export function DebugBanner() {
  const [debug, setDebug] = useState(false);
  useEffect(() => { setDebug(isDebug()); }, []);
  if (!debug) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      background: "#DC2626", color: "white", textAlign: "center",
      padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em"
    }}>
      DEBUG MODE ON — errors show full details —
      type: localStorage.removeItem('bimlog_debug') to turn off
    </div>
  );
}
