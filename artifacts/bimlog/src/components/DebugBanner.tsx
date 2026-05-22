import { useState, useEffect, useCallback } from "react";
import { isDebug, toggleDebug } from "@/lib/debug";

export function DebugBanner() {
  const [debug, setDebug] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setDebug(isDebug());
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setShowConfirm(true);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (debug) {
      // Push page content down for top bar and up for bottom panel
      document.body.style.paddingTop = "24px";
      document.body.style.paddingBottom = "220px";
      return () => {
        document.body.style.paddingTop = "";
        document.body.style.paddingBottom = "";
      };
    }
  }, [debug]);

  const confirm = useCallback((yes: boolean) => {
    setShowConfirm(false);
    if (yes) {
      const newState = toggleDebug();
      setDebug(newState);
    }
  }, []);

  return (
    <>
      {showConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 999999
        }}>
          <div style={{
            background: "white", borderRadius: 12, padding: 28,
            maxWidth: 380, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            textAlign: "center"
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#DC2626",
              marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em"
            }}>
              Developer Tools
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: "#111827" }}>
              {debug ? "Turn OFF Debug Mode?" : "Turn ON Debug Mode?"}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.6 }}>
              {debug
                ? "Debug mode will be disabled. Errors will show generic messages."
                : "Debug mode will show full technical error details on screen. For developers only."}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => confirm(true)} style={{
                background: debug ? "#DC2626" : "#2563EB", color: "white",
                border: "none", borderRadius: 8, padding: "10px 24px",
                fontWeight: 700, fontSize: 14, cursor: "pointer"
              }}>
                {debug ? "Yes, Turn Off" : "Yes, Turn On"}
              </button>
              <button onClick={() => confirm(false)} style={{
                background: "#F3F4F6", color: "#374151",
                border: "none", borderRadius: 8, padding: "10px 24px",
                fontWeight: 700, fontSize: 14, cursor: "pointer"
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {debug && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 99998,
          background: "#DC2626", color: "white", textAlign: "center",
          padding: "4px 12px", fontSize: 11, fontWeight: 700,
          letterSpacing: "0.05em", cursor: "pointer"
        }} onClick={() => setShowConfirm(true)}>
          DEBUG MODE ON — Press F2 or click here to turn off
        </div>
      )}
    </>
  );
}
