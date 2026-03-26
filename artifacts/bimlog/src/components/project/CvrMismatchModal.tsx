import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface CvrMismatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (reason: string) => void;
  fileName: string;
  cvrResult: "possible_mismatch" | "clear_mismatch";
  cvrReason: string;
  fileId: number;
  projectId: number;
}

export function CvrMismatchModal({
  isOpen, onClose, onProceed,
  fileName, cvrResult, cvrReason,
}: CvrMismatchModalProps) {
  const [reason, setReason] = useState("");

  const isClear = cvrResult === "clear_mismatch";
  const proceedDisabled = isClear && reason.trim().length < 20;

  const iconColor = isClear ? "hsl(var(--destructive))" : "#D97706";
  const iconBg = isClear ? "hsl(var(--destructive) / 0.08)" : "rgba(217,119,6,0.08)";
  const proceedBtnStyle: React.CSSProperties = isClear
    ? {}
    : { background: "#D97706", color: "#fff", borderColor: "#D97706" };

  function handleProceed() {
    onProceed(reason.trim());
    setReason("");
  }

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: iconBg, flexShrink: 0,
            }}>
              <AlertTriangle style={{ width: 18, height: 18, color: iconColor }} />
            </div>
            <DialogTitle style={{ color: isClear ? "hsl(var(--destructive))" : "#92400E" }}>
              {isClear ? "Content Mismatch — Action Required" : "Content Warning"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div style={{ fontSize: 13, color: "hsl(var(--foreground))", marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{fileName}</span>
        </div>

        <div style={{
          padding: "10px 12px", borderRadius: 6,
          background: iconBg, border: `1px solid ${iconColor}30`,
          fontSize: 12, color: "hsl(var(--foreground))", lineHeight: 1.6, marginBottom: 12,
        }}>
          {cvrReason || "AI detected a potential mismatch between the file name and its content."}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", display: "block", marginBottom: 6 }}>
            {isClear
              ? "You must explain why this file belongs on this project"
              : "Optional: explain why you're proceeding"}
            {isClear && <span style={{ color: "hsl(var(--destructive))", marginLeft: 4 }}>*</span>}
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={isClear
              ? "Minimum 20 characters required…"
              : "Optional explanation…"}
            style={{
              width: "100%", minHeight: 80, padding: "8px 10px",
              borderRadius: 6, border: "1px solid hsl(var(--border))",
              background: "hsl(var(--background))", fontSize: 12,
              color: "hsl(var(--foreground))", resize: "vertical",
              fontFamily: "inherit", outline: "none", boxSizing: "border-box",
            }}
          />
          {isClear && (
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
              {reason.trim().length} / 20 characters minimum
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>
          Your decision will be logged with full attribution and sent to the project administrator for review.
        </div>

        <DialogFooter style={{ gap: 8 }}>
          <Button variant="outline" onClick={handleClose}>
            Cancel Upload
          </Button>
          <Button
            onClick={handleProceed}
            disabled={proceedDisabled}
            style={proceedDisabled ? {} : proceedBtnStyle}
          >
            {isClear ? "Proceed — I Take Responsibility" : "Proceed Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
