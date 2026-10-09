import type { Claims, PaymentMethods } from "./bill";

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

export interface Settings {
  name: string;
  payment: PaymentMethods;
}

const SETTINGS_KEY = "billsplit.settings";
const MY_BILLS_KEY = "billsplit.myBills";
const DRAFT_KEY = "billsplit.draft";
const claimsKey = (id: string) => `billsplit.claims.${id}`;
const paidKey = (id: string) => `billsplit.paid.${id}`;

export const loadSettings = (): Settings => read<Settings>(SETTINGS_KEY, { name: "", payment: {} });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

export interface SavedBill {
  encoded: string;
  title: string;
  total: number;
  currency: string;
  createdAt: string;
}

export const loadMyBills = (): SavedBill[] => read<SavedBill[]>(MY_BILLS_KEY, []);

export function addMyBill(entry: SavedBill): void {
  const others = loadMyBills().filter((b) => b.encoded !== entry.encoded);
  write(MY_BILLS_KEY, [entry, ...others].slice(0, 30));
}

export function removeMyBill(encoded: string): void {
  write(MY_BILLS_KEY, loadMyBills().filter((b) => b.encoded !== encoded));
}

export const loadDraft = <T>(): T | null => read<T | null>(DRAFT_KEY, null);
export const saveDraft = (draft: unknown) => write(DRAFT_KEY, draft);
export const clearDraft = () => remove(DRAFT_KEY);

export const loadClaims = (id: string): Claims => read<Claims>(claimsKey(id), {});
export const saveClaims = (id: string, claims: Claims) => write(claimsKey(id), claims);

export interface PaidInfo {
  amount: number;
  method: "paypal" | "transfer" | "cash";
  at: string;
}
export const loadPaid = (id: string): PaidInfo | null => read<PaidInfo | null>(paidKey(id), null);
export const savePaid = (id: string, info: PaidInfo | null) => (info ? write(paidKey(id), info) : remove(paidKey(id)));
