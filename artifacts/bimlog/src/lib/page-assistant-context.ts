export type AssistantLanguage = "en" | "es";

export type PageAssistantContext = {
  route: string;
  page: string;
  section: string;
  projectId: number | null;
  language: AssistantLanguage;
  focusedControl: string | null;
  controls: string[];
  pageText: string[];
};

const clean = (value: unknown, maximum = 120) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, maximum);

function controlLabel(element: Element): string {
  const labelled = clean(element.getAttribute("aria-label") || element.getAttribute("title"));
  if (labelled) return labelled;
  const label = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
    ? element.labels?.[0]
    : null;
  if (label) {
    const explicit = clean(label.getAttribute("data-assistant-label"));
    if (explicit) return explicit;
    // A label's textContent also contains option values, help text and button
    // captions. Only its own leading text describes the control.
    const ownText = Array.from(label.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join(" ");
    if (clean(ownText)) return clean(ownText);
  }
  return clean(element.textContent || element.getAttribute("placeholder"));
}

function controlValue(element: Element): string {
  if (element instanceof HTMLSelectElement) return clean(element.selectedOptions[0]?.textContent, 120);
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return clean(element.value, 120);
  return "";
}

export function selectedAssistantControl(): string | null {
  const focused = document.activeElement;
  if (!focused?.matches("button,input,select,textarea,a[href]") || focused.closest("[data-page-assistant]")) return null;
  const label = controlLabel(focused);
  const value = controlValue(focused);
  if (!label && !value) return null;
  return value ? clean(`${label}: ${value}`, 240) : label;
}

export function collectPageAssistantContext(language: AssistantLanguage): PageAssistantContext {
  const route = `${window.location.pathname}${window.location.search}`.slice(0, 300);
  const project = window.location.pathname.match(/^\/projects\/(\d+)/);
  const heading = document.querySelector("main h1");
  const routePage = /^\/projects\/\d+\/intake\/?$/.test(window.location.pathname)
    ? (language === "es" ? "Ingreso y configuración del trabajo" : "Job Intake & Setup")
    : "";
  const focused = document.activeElement?.matches("button,input,select,textarea,a[href]") ? document.activeElement : null;
  const controls = Array.from(document.querySelectorAll("main button:not([disabled]), main input:not([type=password]), main select, main textarea, main a[href]"))
    .filter((element) => !element.closest("[data-page-assistant]"))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
    .map((element) => {
      const label = controlLabel(element);
      const value = controlValue(element);
      return value ? clean(`${label}: ${value}`, 240) : label;
    }).filter(Boolean);
  // Selected control values are the most useful page evidence. Do not flood the
  // payload with every unselected option, which can push current values out.
  const evidenceElements = Array.from(document.querySelectorAll("main [role=status], main [role=alert], main h1, main h2, main h3, main p, main summary"));
  const visibleValues = Array.from(document.querySelectorAll("main input:not([type=password]), main select, main textarea"))
    .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
    .filter((element) => !element.closest("[data-page-assistant]"))
    .map((element) => {
      const value = controlValue(element);
      return value ? clean(`${controlLabel(element)}: ${value}`, 240) : "";
    })
    .filter(Boolean);
  const pageText = evidenceElements
    .filter((element) => element instanceof HTMLOptionElement || (element instanceof HTMLElement && element.offsetParent !== null))
    .filter((element) => !element.closest("[data-page-assistant]"))
    .map((element) => clean(element.textContent, 240)).filter(Boolean);
  return {
    route,
    page: clean(routePage || heading?.textContent || document.title, 160),
    section: clean(focused?.closest("section,fieldset,details")?.querySelector("h2,h3,legend,summary")?.textContent, 160),
    projectId: project ? Number(project[1]) : null,
    language,
    focusedControl: focused ? selectedAssistantControl() : null,
    controls: [...new Set(controls)].slice(0, 80),
    pageText: [...new Set([...visibleValues, ...pageText])].slice(0, 120),
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
