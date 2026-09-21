import { useEffect } from "react";
import { useLocation } from "wouter";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableElements(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(focusableSelector)]
    .filter(element => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

const exactTitles: Record<string, string> = {
  "/dashboard": "BIMLog Headquarters",
  "/pending": "Pending Items",
  "/lens-next": "Lens Next",
  "/help": "BIMLog Help Center",
  "/setup-guide": "BIMLog Setup Guide",
  "/profile": "BIMLog Profile",
  "/settings/company-profile": "Company Profile",
  "/settings/notifications": "Notification Settings",
  "/settings/financial-controls": "Financial Controls",
  "/admin": "Project Administration",
  "/admin/feedback": "Feedback Administration",
  "/company-catalogs": "Company Catalogs",
  "/company-workflows": "Delivery Workflows",
  "/company-workflow-governance": "Workflow Governance",
  "/company-pricing-templates": "Company Pricing Templates",
  "/knowledge": "Coordination Knowledge Library",
  "/total-control": "BIMLog Total Control",
  "/living-brief": "BIMLog Living Brief",
};

export function authenticatedRouteTitle(pathname: string) {
  if (exactTitles[pathname]) return exactTitles[pathname];
  if (/^\/projects\/\d+\//.test(pathname)) return "BIMLog Project Workspace";
  return null;
}

export function RouteAccessibility() {
  const [location] = useLocation();

  useEffect(() => {
    const title = authenticatedRouteTitle(location);
    if (!title) return;
    document.title = `${title} | BIMLog`;
    requestAnimationFrame(() => document.getElementById("main-content")?.focus({ preventScroll: true }));
  }, [location]);

  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let restoreFocus: HTMLElement | null = null;

    const refreshDialog = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')]
        .filter(dialog => dialog.isConnected && dialog.getAttribute("aria-hidden") !== "true");
      const nextDialog = dialogs.at(-1) ?? null;
      if (nextDialog === activeDialog) return;

      if (!nextDialog) {
        const target = restoreFocus;
        activeDialog = null;
        restoreFocus = null;
        if (target?.isConnected) requestAnimationFrame(() => target.focus({ preventScroll: true }));
        return;
      }

      if (!activeDialog) restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      activeDialog = nextDialog;
      if (!activeDialog.hasAttribute("tabindex")) activeDialog.tabIndex = -1;
      requestAnimationFrame(() => {
        if (!activeDialog || activeDialog.contains(document.activeElement)) return;
        (focusableElements(activeDialog)[0] ?? activeDialog).focus({ preventScroll: true });
      });
    };

    const observer = new MutationObserver(refreshDialog);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal", "aria-hidden", "role"] });
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !activeDialog) return;
      const focusable = focusableElements(activeDialog);
      if (!focusable.length) {
        event.preventDefault();
        activeDialog.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", containFocus);
    refreshDialog();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", containFocus);
    };
  }, []);

  return null;
}
