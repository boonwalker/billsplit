import { DEMO, friendName, getPersona, personaDeviceKey } from "./demo";

/**
 * localStorage can throw (blocked storage) or be wiped when the tab closes (private
 * mode). Values are also kept in memory, so the app works at least for this visit.
 */
const memory = new Map<string, string>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // storage blocked – use the in-memory copy
  }
  raw ??= memory.get(key) ?? null;
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the browser refused to store the value permanently. */
function write(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

function remove(key: string): void {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Asks the browser not to evict this site's data under storage pressure (best effort). */
function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // not supported
  }
}

export interface Profile {
  name: string;
  paypalMe: string;
  paypalEmail: string;
}

const PROFILE_KEY = "billsplit.profile";
const DEVICE_KEY = "billsplit.deviceKey";
const RECENT_KEY = "billsplit.recent";
const DRAFT_KEY = "billsplit.draft";

export function loadProfile(): Profile {
  // In the demo, friends are simulated personas with a fixed name.
  const friend = DEMO ? friendName(getPersona()) : null;
  if (friend) return { name: friend, paypalMe: "", paypalEmail: "" };
  return { name: "", paypalMe: "", paypalEmail: "", ...read<Partial<Profile>>(PROFILE_KEY, {}) };
}

/** The device owner's own profile, regardless of the demo persona. */
export function loadOwnProfile(): Profile {
  return { name: "", paypalMe: "", paypalEmail: "", ...read<Partial<Profile>>(PROFILE_KEY, {}) };
}

/** Saves the profile; returns false when the browser does not allow storing it. */
export function saveProfile(p: Profile): boolean {
  if (DEMO && getPersona() !== "me") return true;
  requestPersistence();
  return write(PROFILE_KEY, p);
}

/** Creating a bill needs a name and a way to get paid. */
export function profileReady(): boolean {
  const p = loadProfile();
  return Boolean(p.name.trim() && (p.paypalMe.trim() || p.paypalEmail.trim()));
}

let memoryKey: string | null = null;
/** Random secret that identifies this device towards the server. */
export function deviceKey(): string {
  if (DEMO) return personaDeviceKey(getPersona());
  const stored = read<string | null>(DEVICE_KEY, null);
  if (stored) return stored;
  memoryKey ??= crypto.randomUUID() + crypto.randomUUID();
  write(DEVICE_KEY, memoryKey);
  return memoryKey;
}

export interface RecentBill {
  id: string;
  title: string;
  role: "owner" | "guest";
  createdAt: string;
  /** Guest only: they marked their share as paid. */
  markedPaid?: boolean;
  /** Payer only: friends joined and nothing is missing any more. */
  settled?: boolean;
  /** Payer only: what is still missing ("Dir fehlen noch"), in cents of `currency`. */
  missing?: number;
  currency?: string;
}

export const loadRecent = (): RecentBill[] => read<RecentBill[]>(RECENT_KEY, []);

export function rememberBill(entry: RecentBill): void {
  const others = loadRecent().filter((b) => b.id !== entry.id);
  write(RECENT_KEY, [entry, ...others].slice(0, 30));
}

/** Updates a remembered bill in place (keeps its position in the list). */
export function updateRecent(id: string, patch: Partial<RecentBill>): void {
  write(RECENT_KEY, loadRecent().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

export function forgetBill(id: string): void {
  write(RECENT_KEY, loadRecent().filter((b) => b.id !== id));
}

export const loadDraft = <T>(): T | null => read<T | null>(DRAFT_KEY, null);
export const saveDraft = (draft: unknown) => write(DRAFT_KEY, draft);
export const clearDraft = () => remove(DRAFT_KEY);
