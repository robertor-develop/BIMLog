import { createRoot } from "react-dom/client";
import { TaskJourneyGuide } from "./components/TaskJourneyGuide";
const params = new URLSearchParams(window.location.search);
const language = params.get("lang") === "es" ? "es" : "en";
document.documentElement.lang = language;
createRoot(document.getElementById("root")!).render(<main style={{ maxWidth: 1120, margin: "24px auto", padding: 12 }}><p>Component verification fixture — no authentication or project data.</p><TaskJourneyGuide language={language} from={params.get("from") ?? ""}/></main>);
