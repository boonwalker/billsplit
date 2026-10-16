import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { watchErrors } from "./lib/errorReport";
import { isStandalone } from "./lib/handoff";
import { moveNow, newHome } from "./lib/move";
import { startPush } from "./lib/push";
import { watchForUpdates } from "./lib/updates";
import { trackVisits } from "./lib/visits";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/caveat/latin-600.css";
import "./styles.css";

watchErrors();

function start() {
  watchForUpdates();
  startPush();
  trackVisits();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// klicksplit moved: a browser at the old address goes on to the new one, data included
// (the home-screen app stays and shows a notice). If that fails, the old address still works.
const home = newHome();
if (home && !isStandalone()) moveNow(home).catch(start);
else start();
