import { DEMO } from "./demo";

/**
 * Tells the server about errors in the app (see the admin page) – so a crash on a friend's
 * phone does not go unnoticed. Each message is sent once per visit, at most a few in total.
 */
const sent = new Set<string>();
const MAX_PER_VISIT = 10;

export function reportError(error: unknown, extra?: string): void {
  if (DEMO) return;
  const message = (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 900) + (extra ? ` – ${extra}` : "");
  if (sent.has(message) || sent.size >= MAX_PER_VISIT) return;
  sent.add(message);
  const body = JSON.stringify({
    message,
    stack: error instanceof Error ? error.stack?.slice(0, 3500) : undefined,
    path: window.location.hash.replace(/[A-Za-z0-9_-]{16,}/g, "…").slice(0, 300) || "/",
    device: navigator.userAgent.slice(0, 300),
  });
  void fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

/** Uncaught errors and rejected promises anywhere in the app. */
export function watchErrors(): void {
  if (DEMO) return;
  window.addEventListener("error", (e) => reportError(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason));
}
