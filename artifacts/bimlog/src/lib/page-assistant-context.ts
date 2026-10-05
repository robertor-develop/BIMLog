export type AssistantLanguage = "en" | "es";

export type PageAssistantContext = {
  route: string;
  page: string;
  section: string;
  projectId: number | null;
  language: AssistantLanguage;
  focusedControl: string | null;
  controls: string[];
};

const clean = (value: unknown, maximum = 120) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, maximum);

function controlLabel(element: Element): string {
  const labelled = clean(element.getAttribute("aria-label") || element.getAttribute("title"));
  if (labelled) return labelled;
  if (element instanceof HTMLInputElement && element.labels?.[0]) return clean(element.labels[0].textContent);
  if (element instanceof HTMLSelectElement && element.labels?.[0]) return clean(element.labels[0].textContent);
  if (element instanceof HTMLTextAreaElement && element.labels?.[0]) return clean(element.labels[0].textContent);
  return clean(element.textContent || element.getAttribute("placeholder"));
}

export function collectPageAssistantContext(language: AssistantLanguage): PageAssistantContext {
  const route = `${window.location.pathname}${window.location.search}`.slice(0, 300);
  const project = window.location.pathname.match(/^\/projects\/(\d+)/);
  const heading = document.querySelector("main h1, main h2");
  const focused = document.activeElement?.matches("button,input,select,textarea,a[href]") ? document.activeElement : null;
  const controls = Array.from(document.querySelectorAll("main button:not([disabled]), main input:not([type=password]), main select, main textarea, main a[href]"))
    .filter((element) => !element.closest("[data-page-assistant]"))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
    .map(controlLabel).filter(Boolean);
  return {
    route,
    page: clean(heading?.textContent || document.title, 160),
    section: clean(focused?.closest("section,fieldset,details")?.querySelector("h2,h3,legend,summary")?.textContent, 160),
    projectId: project ? Number(project[1]) : null,
    language,
    focusedControl: focused ? controlLabel(focused) || null : null,
    controls: [...new Set(controls)].slice(0, 60),
  };
}

export function highlightAssistantControls(labels: string[]): number {
  const wanted = new Set(labels.map((label) => clean(label)).filter(Boolean));
  let count = 0;
  document.querySelectorAll("[data-assistant-highlight]").forEach((element) => element.removeAttribute("data-assistant-highlight"));
  if (!wanted.size) return count;
  for (const element of document.querySelectorAll("main button, main input, main select, main textarea, main a[href]")) {
    if (!wanted.has(controlLabel(element))) continue;
    const target = element.closest("label") || element;
    target.setAttribute("data-assistant-highlight", "true");
    if (count === 0 && element instanceof HTMLElement) element.scrollIntoView({ block: "center", behavior: "smooth" });
    count += 1;
  }
  return count;
}
