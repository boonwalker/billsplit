import { DEMO } from "./demo";
import { isStandalone } from "./handoff";
import { lang } from "./i18n";
import { deviceKey } from "./storage";

/**
 * Tells the server that the app was opened – on start and when it comes back after a while –
 * for the visit numbers on the admin page (server/visits.ts). Only the device key (as on every
 * request), whether it runs as the home-screen app, and the language.
 */
const GAP_MS = 30 * 60 * 1000;
let last = 0;

function report(): void {
  if (Date.now() - last < GAP_MS) return;
  last = Date.now();
  void fetch("/api/visit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-billsplit-key": deviceKey() },
    body: JSON.stringify({ app: isStandalone(), lang }),
    keepalive: true,
  }).catch(() => {});
}

export function trackVisits(): void {
  if (DEMO) return;
  report();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") report();
  });
}
