import { useEffect } from "react";
import { useLocation } from "wouter";

const SITE_URL = "https://bimlog.app";

const publicMetadata: Record<string, { title: string; description: string }> = {
  "/": {
    title: "BIMLog | Accountable Construction Coordination",
    description: "Connect coordination records, RFIs, Submittals, files, and Navisworks viewpoints in one traceable BIMLog project history.",
  },
  "/features": {
    title: "BIMLog Features | Project Records and Navisworks Workflow",
    description: "Review BIMLog capabilities for controlled project records, RFIs, Submittals, reporting, and the verified Lens Next Navisworks workflow.",
  },
  "/pricing": {
    title: "BIMLog Pricing | Construction Coordination Plans",
    description: "Compare BIMLog plans for construction coordination, controlled project records, reporting, and team access.",
  },
  "/about": {
    title: "About BIMLog | Verified Project Memory",
    description: "Learn how BIMLog creates traceable project memory for construction coordination, accountability, reporting, and handover.",
  },
  "/contact": {
    title: "Contact BIMLog | Construction Coordination Platform",
    description: "Contact the BIMLog team about accountable construction coordination and verified project-record workflows.",
  },
};

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function PublicRouteMetadata() {
  const [location] = useLocation();

  useEffect(() => {
    const metadata = publicMetadata[location];
    if (!metadata) return;

    const canonicalUrl = `${SITE_URL}${location === "/" ? "" : location}`;
    document.title = metadata.title;
    upsertMeta('meta[name="description"]', "name", "description", metadata.description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", metadata.title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", metadata.description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [location]);

  return null;
}
