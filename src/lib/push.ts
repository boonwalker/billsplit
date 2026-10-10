import { DEMO } from "./demo";
import { isIosBrowser } from "./handoff";
import { navigate } from "./router";
import { deviceKey } from "./storage";

/**
 * Push notifications: "Niklas hat Dir 8,00 € gesendet", "Anna hat bezahlt", … (see
 * server/push.ts). On the iPhone they only work in the app on the home screen (iOS 16.4+).
 */

export type PushState =
  /** The browser cannot do it at all (or this is the demo). */
  | "unsupported"
  /** iPhone/iPad in Safari: only the home-screen app can get notifications. */
  | "needs-app"
  /** Notifications were blocked in the settings. */
  | "denied"
  | "on"
  | "off";

const supported = () => !DEMO && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers the service worker (once) and follows taps on notifications while the app is open. */
function ready(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return Promise.resolve(null);
  registration ??= navigator.serviceWorker
    .register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null);
  return registration;
}

async function serverKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/key", { cache: "no-store" });
    return ((await res.json()) as { publicKey: string | null }).publicKey;
  } catch {
    return null;
  }
}

function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": deviceKey() }, body: JSON.stringify(body) });
}

function toBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (DEMO) return "unsupported";
  if (isIosBrowser()) return "needs-app";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await ready();
  return (await reg?.pushManager.getSubscription()) ? "on" : "off";
}

/** Asks for permission (must run in a tap) and subscribes this device. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const [reg, key] = await Promise.all([ready(), serverKey()]);
  if (!reg || !key) throw new Error("Benachrichtigungen lassen sich gerade nicht einschalten. Bitte später nochmal versuchen.");
  let sub: PushSubscription;
  try {
    sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) }));
  } catch {
    throw new Error("Dein Browser konnte Benachrichtigungen gerade nicht einrichten. Bitte versuch es später nochmal.");
  }
  const res = await post("/api/push/subscribe", sub.toJSON());
  if (!res.ok) throw new Error("Benachrichtigungen lassen sich gerade nicht einschalten. Bitte später nochmal versuchen.");
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await ready();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await post("/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "off";
}

/**
 * On start: if notifications are on, tell the server the current subscription again (it may
 * have changed, or the device key was moved here) and follow taps on notifications.
 */
export function startPush(): void {
  if (!supported()) return;
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<{ type?: string; path?: string }>) => {
    if (event.data?.type === "billsplit:navigate" && event.data.path) navigate(event.data.path);
  });
  // Registered right away, so turning notifications on later needs no extra wait.
  const reg = ready();
  if (Notification.permission !== "granted") return;
  void reg.then(async (reg) => {
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await post("/api/push/subscribe", sub.toJSON()).catch(() => undefined);
  });
}
