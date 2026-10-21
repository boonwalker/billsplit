import { DEMO, friendName, getPersona, personaDeviceKey } from "./demo";
import type { MyBill } from "./bill";

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
  /** Bank transfer: IBAN and account holder (defaults to the profile name). */
  iban?: string;
  holder?: string;
  /** Wero: mobile number or e-mail address. */
  wero?: string;
}

const PROFILE_KEY = "billsplit.profile";
const DEVICE_KEY = "billsplit.deviceKey";
const RECENT_KEY = "billsplit.recent";
const DRAFT_KEY = "billsplit.draft";
const ACCOUNT_KEY = "billsplit.account";
/** The account address the server suddenly no longer knew (see refreshAccount): offered for signing in again. */
const ACCOUNT_LOST_KEY = "billsplit.accountLost";
/** Bills the user removed from the list (✕): the sync with the server does not bring them back. */
const HIDDEN_KEY = "billsplit.hidden";
/** Fired when this device takes on another identity (sign-in, new device, sign-out). */
export const DEVICE_CHANGED = "billsplit:device-changed";

/**
 * How the app was opened this time, read before anything is stored: without a device key the
 * storage is empty – a new phone, a new home-screen app, or the browser deleted its data (Safari
 * does after 7 days without a visit). Only then can "Schon ein Konto?" bring bills back.
 */
export const startedFresh = (() => {
  try {
    return !localStorage.getItem(DEVICE_KEY);
  } catch {
    return false;
  }
})();
/** Opened on the start page itself (not through a bill link, where a guest wants to pay first). */
export const startedOnHome = typeof window !== "undefined" && ["", "#", "#/"].includes(window.location.hash);

const SESSIONS_KEY = "billsplit.sessions";
const SESSION_GAP_MS = 30 * 60 * 1000;

/** Counts one use of the app (a start, or coming back after half an hour); returns how many there were. */
export function countSession(now = Date.now()): number {
  const { count, at } = read<{ count: number; at: number }>(SESSIONS_KEY, { count: 0, at: 0 });
  if (now - at < SESSION_GAP_MS) {
    write(SESSIONS_KEY, { count, at: now });
    return count;
  }
  write(SESSIONS_KEY, { count: count + 1, at: now });
  return count + 1;
}

export const sessionCount = (): number => read<{ count: number }>(SESSIONS_KEY, { count: 0 }).count;

/** Questions asked only once per device. */
export const wasAsked = (name: string): boolean => read<boolean>(`billsplit.asked.${name}`, false);
export const markAsked = (name: string) => write(`billsplit.asked.${name}`, true);

/** Settlement payments whose outcome (confirmed, rejected, …) was shown once on the dashboard. */
const SEEN_TRANSFERS_KEY = "billsplit.seenTransfers";
export const loadSeenTransfers = (): string[] => read<string[]>(SEEN_TRANSFERS_KEY, []);
export function markTransfersSeen(ids: string[]): void {
  const known = loadSeenTransfers();
  if (ids.every((id) => known.includes(id))) return;
  write(SEEN_TRANSFERS_KEY, [...new Set([...ids, ...known])].slice(0, 300));
}

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

/** Whether the profile has at least one way to get paid (PayPal, bank transfer or Wero). */
export function hasPaymentMethod(p: Profile): boolean {
  return Boolean(p.paypalMe.trim() || p.paypalEmail.trim() || p.iban?.trim() || p.wero?.trim());
}

/** Creating a bill needs a name and a way to get paid. */
export function profileReady(): boolean {
  const p = loadProfile();
  return Boolean(p.name.trim() && hasPaymentMethod(p));
}

/**
 * Before the first own bill the assistant asks for the name and how to get paid. The way to
 * get paid can be skipped ("Überspringen") – then it is not asked again; friends mark their
 * share as paid, and it can be added in the profile any time.
 */
export function profileDue(): boolean {
  const p = loadProfile();
  return !p.name.trim() || (!hasPaymentMethod(p) && !wasAsked("payment"));
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

/** Whether this browser has used klicksplit already (without making up a key for it). */
export function hasDeviceData(): boolean {
  return read<string | null>(DEVICE_KEY, null) !== null || loadRecent().length > 0 || Boolean(loadOwnProfile().name.trim());
}

/** Device keys are random (two UUIDs); anything else cannot be one. */
export const isDeviceKey = (key: string) => /^[A-Za-z0-9_-]{16,128}$/.test(key);

/**
 * Takes over the identity of another device – when moving to a new phone (QR code) or
 * restoring with the recovery code: its key, its profile (if given) and its bills.
 */
export function adoptDevice(key: string, profile: Partial<Profile> | null, bills: RecentBill[]): void {
  requestPersistence();
  memoryKey = key;
  write(DEVICE_KEY, key);
  if (profile) write(PROFILE_KEY, { name: "", paypalMe: "", paypalEmail: "", ...profile });
  write(RECENT_KEY, newestFirst(bills));
  window.dispatchEvent(new Event(DEVICE_CHANGED));
}

/** The e-mail address of this device's account (as last confirmed by the server), or null. */
export const loadAccountEmail = (): string | null => read<string | null>(ACCOUNT_KEY, null);
export function saveAccountEmail(email: string | null): void {
  if (email) {
    write(ACCOUNT_KEY, email);
    remove(ACCOUNT_LOST_KEY);
  } else remove(ACCOUNT_KEY);
}

export const loadAccountLost = (): string | null => read<string | null>(ACCOUNT_LOST_KEY, null);

/** The account was deleted on the admin page: said once on the start page (see refreshAccount). */
const ACCOUNT_REMOVED_KEY = "billsplit.accountRemoved";
export interface AccountRemoved {
  email: string;
  /** All of the person's data was erased, not just the account. */
  erased: boolean;
}
export const loadAccountRemoved = (): AccountRemoved | null => read<AccountRemoved | null>(ACCOUNT_REMOVED_KEY, null);
export const saveAccountRemoved = (removed: AccountRemoved | null) => (removed ? write(ACCOUNT_REMOVED_KEY, removed) : remove(ACCOUNT_REMOVED_KEY));
export const saveAccountLost = (email: string) => write(ACCOUNT_LOST_KEY, email);

/** Signing out: this device starts over with a new identity (the account keeps everything). */
export function resetDevice(): void {
  memoryKey = null;
  for (const key of [DEVICE_KEY, PROFILE_KEY, RECENT_KEY, ACCOUNT_KEY, DRAFT_KEY, HIDDEN_KEY, ACCOUNT_LOST_KEY]) remove(key);
  window.dispatchEvent(new Event(DEVICE_CHANGED));
}

export interface RecentBill {
  id: string;
  title: string;
  role: "owner" | "guest";
  createdAt: string;
  /** Guest only: they marked their share as paid. */
  markedPaid?: boolean;
  /** Guest only: what is still open of their share ("Du schuldest"), in cents of `currency`. */
  owed?: number;
  /** Payer: friends joined and nothing is missing any more · guest: the share is settled (received or offset). */
  settled?: boolean;
  /** Payer only: what is still missing ("Dir fehlen noch"), in cents of `currency`. */
  missing?: number;
  currency?: string;
  /** Money is still open or a payment waits for my confirmation: ✕ cannot remove it (see stillOpen). */
  open?: boolean;
  /** The server did not know the bill (any more) – shown as "nicht mehr verfügbar" instead of vanishing. */
  gone?: boolean;
  /** Came into the list without being opened on this device (e.g. an expense assigned to me) – until it is opened. */
  unread?: boolean;
  /** Came from the server's list of my bills (see syncRecentBills), not from opening it here. */
  synced?: boolean;
}

/** The list is always by date, newest first – opening a bill again does not move it (no limit on its length). */
const newestFirst = (bills: RecentBill[]) => [...bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const loadRecent = (): RecentBill[] => newestFirst(read<RecentBill[]>(RECENT_KEY, []));

export function rememberBill(entry: RecentBill): void {
  const others = loadRecent().filter((b) => b.id !== entry.id);
  write(RECENT_KEY, newestFirst([entry, ...others]));
  // Opened again: it belongs in the list again.
  if (loadHidden().includes(entry.id)) write(HIDDEN_KEY, loadHidden().filter((id) => id !== entry.id));
}

const loadHidden = (): string[] => read<string[]>(HIDDEN_KEY, []);

/** The user removed a bill from the list (✕). */
export function hideBill(id: string): void {
  forgetBill(id);
  write(HIDDEN_KEY, [id, ...loadHidden().filter((x) => x !== id)]);
}

/**
 * Brings bills this device takes part in into the list that it does not know yet – above all
 * expenses a friend assigned to me ("Ausgabe zuweisen"), which I never opened myself. Bills
 * removed with ✕ stay out. True when something was added.
 */
export function syncRecentBills(mine: MyBill[]): boolean {
  const known = new Set([...loadRecent().map((b) => b.id), ...loadHidden()]);
  const fresh = mine.filter((b) => !known.has(b.id));
  addRecentBills(fresh.map((b) => ({ id: b.id, title: b.title, role: b.role, createdAt: b.createdAt, currency: b.currency, unread: true, synced: true })));
  return fresh.length > 0;
}

/** Adds bills that are not in the list yet (newest first among them), keeping the others as they are. */
export function addRecentBills(bills: RecentBill[]): void {
  const known = loadRecent();
  const fresh = bills.filter((b) => !known.some((k) => k.id === b.id));
  if (!fresh.length) return;
  write(RECENT_KEY, newestFirst([...known, ...fresh]));
}

/** Updates a remembered bill in place (keeps its position in the list). */
export function updateRecent(id: string, patch: Partial<RecentBill>): void {
  write(RECENT_KEY, loadRecent().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

/**
 * The server does not know a bill: it stays in the list, marked as no longer available – a
 * server that lost its data (16.10.2026) must not empty everyone's list. Bills never expire,
 * so this is never normal. True when it was marked just now.
 */
export function markGone(id: string): boolean {
  const entry = loadRecent().find((b) => b.id === id);
  if (!entry || entry.gone) return false;
  updateRecent(id, { gone: true, open: false });
  return true;
}

export function forgetBill(id: string): void {
  write(RECENT_KEY, loadRecent().filter((b) => b.id !== id));
}

export const loadDraft = <T>(): T | null => read<T | null>(DRAFT_KEY, null);
export const saveDraft = (draft: unknown) => write(DRAFT_KEY, draft);
export const clearDraft = () => remove(DRAFT_KEY);
