import { DEMO, friendName, getPersona, personaDeviceKey } from "./demo";

/** localStorage can throw (private mode, blocked storage); the app must keep working without it. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
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

export function saveProfile(p: Profile): void {
  if (DEMO && getPersona() !== "me") return;
  write(PROFILE_KEY, p);
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
}

export const loadRecent = (): RecentBill[] => read<RecentBill[]>(RECENT_KEY, []);

export function rememberBill(entry: RecentBill): void {
  const others = loadRecent().filter((b) => b.id !== entry.id);
  write(RECENT_KEY, [entry, ...others].slice(0, 30));
}

export function forgetBill(id: string): void {
  write(RECENT_KEY, loadRecent().filter((b) => b.id !== id));
}

export const loadDraft = <T>(): T | null => read<T | null>(DRAFT_KEY, null);
export const saveDraft = (draft: unknown) => write(DRAFT_KEY, draft);
export const clearDraft = () => remove(DRAFT_KEY);
