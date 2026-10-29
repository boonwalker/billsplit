import { DEMO } from "./demo";
import { deviceKey } from "./storage";

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

/** Safari: a hand-over waits – for this bill, which the app opens by itself if it is in it already. */
export function announceHandoff(billId?: string): void {
  fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(billId ? { billId } : {}) }).catch(() => {});
}

/** The app: whether a hand-over waits – with the bill when this device is in it (no pasting needed then). */
export async function handoffStatus(): Promise<{ pending: boolean; billId?: string }> {
  if (DEMO) return { pending: false };
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store", headers: { "x-billsplit-key": deviceKey() } });
    if (!res.ok) return { pending: false };
    const body = (await res.json()) as { pending?: boolean; billId?: string };
    return { pending: body.pending === true, billId: body.billId };
  } catch {
    return { pending: false };
  }
}

export function finishHandoff(): void {
  fetch(ENDPOINT, { method: "DELETE" }).catch(() => {});
}
