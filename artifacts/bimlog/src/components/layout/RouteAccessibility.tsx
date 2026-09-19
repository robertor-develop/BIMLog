import { useEffect } from "react";
import { useLocation } from "wouter";

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

  return null;
}
