const REPLIT_TEXT_PATTERNS = [
  "share your feedback",
  "help improve this app",
  "sign in",
  "replit",
];

function looksLikeReplitOverlay(el: Element) {
  const text = (el.textContent || "").toLowerCase();
  if (!text.includes("share your feedback") && !text.includes("help improve this app")) return false;
  return REPLIT_TEXT_PATTERNS.some((pattern) => text.includes(pattern));
}

function hideReplitOverlay() {
  const candidates = Array.from(document.querySelectorAll("body *"));
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (looksLikeReplitOverlay(el)) {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("visibility", "hidden", "important");
      el.setAttribute("aria-hidden", "true");
    }
  }
}

export function installReplitOverlayGuard() {
  if (typeof window === "undefined") return;
  hideReplitOverlay();

  const observer = new MutationObserver(() => hideReplitOverlay());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("load", hideReplitOverlay, { once: true });
}
