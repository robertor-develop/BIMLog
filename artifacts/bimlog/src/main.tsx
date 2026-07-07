import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installReplitOverlayGuard } from "./lib/replit-overlay-guard";

installReplitOverlayGuard();
createRoot(document.getElementById("root")!).render(<App />);
