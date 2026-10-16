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
  write(RECENT_KEY, bills.slice(0, 30));
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
}

export const loadRecent = (): RecentBill[] => read<RecentBill[]>(RECENT_KEY, []);

export function rememberBill(entry: RecentBill): void {
  const others = loadRecent().filter((b) => b.id !== entry.id);
  write(RECENT_KEY, [entry, ...others].slice(0, 30));
  // Opened again: it belongs in the list again.
  if (loadHidden().includes(entry.id)) write(HIDDEN_KEY, loadHidden().filter((id) => id !== entry.id));
}

const loadHidden = (): string[] => read<string[]>(HIDDEN_KEY, []);

/** The user removed a bill from the list (✕). */
export function hideBill(id: string): void {
  forgetBill(id);
  write(HIDDEN_KEY, [id, ...loadHidden().filter((x) => x !== id)].slice(0, 200));
}

/**
 * Brings bills this device takes part in into the list that it does not know yet – above all
 * expenses a friend assigned to me ("Ausgabe eingeben"), which I never opened myself. Bills
 * removed with ✕ stay out. True when something was added.
 */
export function syncRecentBills(mine: MyBill[]): boolean {
  const known = new Set([...loadRecent().map((b) => b.id), ...loadHidden()]);
  const fresh = mine.filter((b) => !known.has(b.id));
  addRecentBills(fresh.map((b) => ({ id: b.id, title: b.title, role: b.role, createdAt: b.createdAt, currency: b.currency })));
  return fresh.length > 0;
}

/** Adds bills that are not in the list yet (newest first among them), keeping the others as they are. */
export function addRecentBills(bills: RecentBill[]): void {
  const known = loadRecent();
  const fresh = bills.filter((b) => !known.some((k) => k.id === b.id));
  if (!fresh.length) return;
  write(RECENT_KEY, [...known, ...fresh].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30));
}

/** Updates a remembered bill in place (keeps its position in the list). */
export function updateRecent(id: string, patch: Partial<RecentBill>): void {
  write(RECENT_KEY, loadRecent().map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

/** Bills are deleted on the server after 60 days (server/store.ts). */
const BILL_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * The server does not know a bill: an expired one leaves the list, any other stays, marked as
 * no longer available – a server that lost its data (16.10.2026) must not empty everyone's list.
 * True when it was marked (not expired).
 */
export function markGone(id: string, now = Date.now()): boolean {
  const entry = loadRecent().find((b) => b.id === id);
  if (!entry) return false;
  if (now - Date.parse(entry.createdAt) > BILL_LIFETIME_MS) {
    forgetBill(id);
    return false;
  }
  if (!entry.gone) updateRecent(id, { gone: true, open: false });
  return !entry.gone;
}

export function forgetBill(id: string): void {
  write(RECENT_KEY, loadRecent().filter((b) => b.id !== id));
}

export const loadDraft = <T>(): T | null => read<T | null>(DRAFT_KEY, null);
export const saveDraft = (draft: unknown) => write(DRAFT_KEY, draft);
export const clearDraft = () => remove(DRAFT_KEY);
