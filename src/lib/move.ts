import { refreshAccount } from "./account";
import { api } from "./api";
import { DEMO } from "./demo";
import { addRecentBills, adoptDevice, deviceKey, hasDeviceData, loadOwnProfile, saveProfile } from "./storage";

/**
 * Moving to a new address (klicksplit.de): the server names the app's address in a meta tag
 * (PUBLIC_URL). Opened anywhere else, the browser moves there right away and takes its key,
 * profile and bills along with a one-time code; old links keep working because the old address
 * serves the same app. The home-screen app at the old address shows a notice instead (it cannot
 * leave its address by itself).
 */

/** The app's address when this page is opened at another (old) one, else null. */
export function newHome(): string | null {
  if (DEMO) return null;
  const home = document.querySelector<HTMLMetaElement>('meta[name="klicksplit-home"]')?.content;
  return home && home !== window.location.origin ? home : null;
}

/** Where the current page lives at the new address ("/b/abc", "/geraet/…", "/"). */
export function currentPath(hash: string = window.location.hash): string {
  const path = hash.replace(/^#/, "");
  return path.startsWith("/") ? path : "/";
}

/** The page at the new address that takes over this browser's data (`app`: came from the home-screen app). */
export function moveUrl(home: string, code: string, path: string, app = false): string {
  const params = new URLSearchParams({ ziel: path });
  if (app) params.set("app", "1");
  return `${home}/#/umzug/${code}?${params}`;
}

/** A one-time code for this browser's key – null when there is nothing to take along. */
export async function moveCode(): Promise<string | null> {
  if (!hasDeviceData()) return null;
  return (await api.createDeviceLink(loadOwnProfile())).code;
}

/** In a browser at the old address: off to the new one, data included. */
export async function moveNow(home: string): Promise<void> {
  const code = await moveCode();
  const path = currentPath();
  window.location.replace(code ? moveUrl(home, code, path) : `${home}/#${path}`);
}

/** Only paths inside the app (no other sites). */
export function safeTarget(target: string | undefined): string {
  return target && target.startsWith("/") && !target.startsWith("//") ? target : "/";
}

/** At the new address: takes over the old address's key, profile and bills. */
export async function finishMove(code: string): Promise<void> {
  const { key, profile, bills } = await api.move(code);
  const recent = bills.map((b) => ({ id: b.id, title: b.title, role: b.role, createdAt: b.createdAt, currency: b.currency }));
  const ownName = loadOwnProfile().name.trim();
  if (key !== deviceKey()) {
    adoptDevice(key, ownName ? null : profile, recent);
  } else {
    addRecentBills(recent);
    if (!ownName && profile.name) saveProfile({ ...loadOwnProfile(), ...profile });
  }
  await refreshAccount();
}
