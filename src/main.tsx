import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { startPush } from "./lib/push";
import { watchForUpdates } from "./lib/updates";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/caveat/latin-600.css";
import "./styles.css";

watchForUpdates();
startPush();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
