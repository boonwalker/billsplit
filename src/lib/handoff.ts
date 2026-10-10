import { DEMO } from "./demo";

/**
 * Hand-over from Safari to the home-screen app on the iPhone (see server/handoff.ts):
 * Safari copies the link and notes the hand-over; the app offers to open the copied link
 * only when a hand-over is waiting.
 */

/** Running as the app from the home screen (not in a browser tab). */
export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPhone or iPad browser – where links never open the home-screen app by themselves. */
export function isIosBrowser(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !isStandalone() && !DEMO;
}

const ENDPOINT = "/api/handoff";

export function announceHandoff(): void {
  fetch(ENDPOINT, { method: "POST" }).catch(() => {});
}

export async function handoffPending(): Promise<boolean> {
  if (DEMO) return false;
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    return res.ok && ((await res.json()) as { pending?: boolean }).pending === true;
  } catch {
    return false;
  }
}

export function finishHandoff(): void {
  fetch(ENDPOINT, { method: "DELETE" }).catch(() => {});
}
