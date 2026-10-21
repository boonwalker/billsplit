import { lang, t } from "./i18n";
import { ApiError } from "./apiError";
import type { BillData, BillSnapshot, Contact, ItemClaims, MyBill, NetworkEdge, TransferAllocation, TransferList } from "./bill";
import { checkForUpdate } from "./updates";
import { DEMO } from "./demo";
import { localApi } from "./localApi";
import { deviceKey, dropDeletedBill, type Profile } from "./storage";

export { ApiError };

export interface ReminderStatus {
  reachable: string[];
  remindedAt: Record<string, string>;
}

export type AccountVerify =
  | { status: "created" | "same"; email: string; profile?: Partial<Profile> }
  | { status: "login"; email: string; key: string; profile: Partial<Profile>; bills: MyBill[] };

export interface Api {
  createBill(data: BillData, name: string): Promise<BillSnapshot>;
  getBill(id: string): Promise<BillSnapshot>;
  /** Several bills in one request (home list, dashboard); null for bills that no longer exist. */
  getBills(ids: string[]): Promise<Record<string, BillSnapshot | null>>;
  updateBill(id: string, data: BillData): Promise<BillSnapshot>;
  join(id: string, name: string): Promise<BillSnapshot>;
  setClaims(id: string, claims: ItemClaims, splits: ItemClaims): Promise<BillSnapshot>;
  /** Payer: puts people from earlier bills straight into the bill with the units they take. */
  assign(id: string, people: { id: string; claims: ItemClaims }[]): Promise<BillSnapshot>;
  /** People I share bills with, most frequent first. */
  contacts(): Promise<Contact[]>;
  /** Stores the photo or screenshot the bill was read from (payer only). */
  uploadReceiptImage(id: string, jpeg: Blob): Promise<BillSnapshot>;
  /** Address of the stored receipt photo, or null if there is none. */
  receiptImageUrl(id: string): Promise<string | null>;
  pay(id: string): Promise<{ amount: number }>;
  setReceived(id: string, participantId: string, received: boolean): Promise<BillSnapshot>;
  /** The payer reminds a friend by notification (only when it reaches them; else the app opens WhatsApp). */
  remind(id: string, participantId: string): Promise<BillSnapshot>;
  /** Whom notifications reach among the people in my bills, and when I last reminded each. */
  reminders(): Promise<ReminderStatus>;
  /** One reminder notification about everything a person still owes me. */
  remindPerson(personId: string): Promise<ReminderStatus>;
  /** A friend marks their own share as paid. */
  markPaid(id: string, paid: boolean): Promise<BillSnapshot>;
  /** Open shares in all bills this device takes part in (for settling up). */
  network(): Promise<NetworkEdge[]>;
  /** Settlement payments this device made, received or is part of. */
  transfers(): Promise<TransferList>;
  /**
   * Records a settlement payment this device made (it waits for the recipient's confirmation) –
   * or, with `fromId`, one it received (confirmed right away).
   */
  createTransfer(input: { toId: string; fromId?: string; amount: number; currency: string; allocations: TransferAllocation[] }): Promise<TransferList>;
  /** The bills this device – or the device with `key` – takes part in (to rebuild the list on a new device). */
  myBills(key?: string): Promise<MyBill[]>;
  /** A one-time code (valid for a few minutes) that moves this device's key and profile to a new device. */
  createDeviceLink(profile: Profile): Promise<{ code: string; expiresAt: string }>;
  /** The home-screen app takes over what this person did in Safari (code from Safari's device link). */
  mergeDevice(code: string): Promise<{ merged: string[]; bills: MyBill[]; profile: Partial<Profile> }>;
  /** Trades such a code for the key and profile. */
  claimDeviceLink(code: string): Promise<{ key: string; profile: Partial<Profile> }>;
  /** At the new address: takes over the old address's key (see move.ts). */
  move(code: string): Promise<{ key: string; profile: Partial<Profile>; bills: MyBill[] }>;
  /** The optional e-mail account of this device (null: none). */
  /** removed: the account was deleted on the admin page ("erased": with all of the person's data). */
  account(): Promise<{ account: { email: string } | null; removed?: "deleted" | "erased" | null }>;
  /** Sends a six-digit sign-in code to the address. */
  requestCode(email: string, name?: string): Promise<{ ok: true }>;
  /**
   * Checks the code: creates the account for this device, or – when the address already has
   * one – signs this device in (it gets the account's key, profile and bills).
   */
  verifyCode(email: string, code: string, profile: Partial<Profile>): Promise<AccountVerify>;
  saveAccountProfile(profile: Partial<Profile>): Promise<{ ok: true }>;
  deleteAccount(): Promise<{ account: null }>;
  /** Recipient: confirm / reject · payer: cancel a waiting settlement payment. */
  decideTransfer(id: string, action: "confirm" | "reject" | "cancel"): Promise<TransferList>;
  /**
   * The app's own event stream while it is open: it marks this device as online and reports
   * changes in any of its bills. Returns a function that closes it.
   */
  subscribeEvents(onBillChanged: (billId: string) => void): () => void;
  /** Live updates of one bill (onDeleted: it was deleted on the admin page); returns an unsubscribe function. */
  subscribe(id: string, onSnapshot: (s: BillSnapshot) => void, onLive: (live: boolean) => void, onDeleted?: () => void): () => void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  // A sleeping or just redeploying server (Railway) answers with 502/503 or not at all for a
  // moment; reads and PUTs (which set a whole state, so repeating them is harmless) are
  // simply tried again a few times.
  const attempts = method === "GET" || method === "PUT" ? 4 : 1;
  let res: Response | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      res = await fetch(path, {
        method,
        headers: { "content-type": "application/json", "x-billsplit-key": deviceKey(), "x-billsplit-lang": lang },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...init,
      });
      if (attempt < attempts && (res.status === 502 || res.status === 503)) {
        await wait(1500 * attempt);
        continue;
      }
      break;
    } catch {
      if (attempt === attempts) throw new ApiError(t("Keine Verbindung zum Server."), 0);
      await wait(1500 * attempt);
    }
  }
  if (!res) throw new ApiError(t("Keine Verbindung zum Server."), 0);
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || json === null) {
    const unavailable = res.status === 502 || res.status === 503 || res.status === 504;
    const fallback = unavailable
      ? t("Der Server ist gerade kurz nicht erreichbar (vermutlich ein Update). Bitte gleich nochmal tippen.")
      : t("Fehler (HTTP {status}).", { status: res.status });
    throw new ApiError(json?.error ?? fallback, res.status);
  }
  return json;
}

const bill = (id: string) => `/api/bills/${encodeURIComponent(id)}`;

const serverApi: Api = {
  createBill: (data, name) => request("POST", "/api/bills", { data, name }),
  getBill: (id) => request("GET", bill(id)),
  // In parts of 100 (the server's limit per request): the dashboard asks for all bills.
  getBills: async (ids) => {
    const parts: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) parts.push(ids.slice(i, i + 100));
    const results = await Promise.all(
      parts.map((part) => request<{ bills: Record<string, BillSnapshot | null>; deleted?: string[] }>("POST", "/api/bills/batch", { ids: part })),
    );
    // Bills deleted on the admin page leave the device right here – list, dashboard, everywhere.
    for (const id of results.flatMap((r) => r.deleted ?? [])) dropDeletedBill(id);
    return Object.assign({}, ...results.map((r) => r.bills)) as Record<string, BillSnapshot | null>;
  },
  updateBill: (id, data) => request("PUT", bill(id), { data }),
  join: (id, name) => request("POST", `${bill(id)}/join`, { name }),
  setClaims: (id, claims, splits) => request("PUT", `${bill(id)}/claims`, { claims, splits }),
  assign: (id, people) => request("POST", `${bill(id)}/assign`, { people }),
  contacts: async () => (await request<{ contacts: Contact[] }>("GET", "/api/contacts")).contacts,
  async uploadReceiptImage(id, jpeg) {
    const res = await fetch(`${bill(id)}/receipt-image`, {
      method: "PUT",
      headers: { "content-type": "image/jpeg", "x-billsplit-key": deviceKey(), "x-billsplit-lang": lang },
      body: jpeg,
    });
    const json = (await res.json().catch(() => null)) as (BillSnapshot & { error?: string }) | null;
    if (!res.ok || !json) throw new ApiError(json?.error ?? t("Fehler (HTTP {status}).", { status: res.status }), res.status);
    return json;
  },
  receiptImageUrl: async (id) => `${bill(id)}/receipt-image`,
  // keepalive lets the request finish while the browser switches to PayPal.
  pay: (id) => request("POST", `${bill(id)}/pay`, {}, { keepalive: true }),
  setReceived: (id, participantId, received) => request("POST", `${bill(id)}/received`, { participantId, received }),
  markPaid: (id, paid) => request("POST", `${bill(id)}/paid`, { paid }),
  remind: (id, participantId) => request("POST", `${bill(id)}/remind`, { participantId }),
  reminders: () => request("GET", "/api/reminders"),
  remindPerson: (personId) => request("POST", "/api/reminders", { personId }),
  network: async () => (await request<{ edges: NetworkEdge[] }>("GET", "/api/network")).edges,
  transfers: () => request("GET", "/api/transfers"),
  createTransfer: (input) => request("POST", "/api/transfers", input),
  decideTransfer: (id, action) => request("POST", `/api/transfers/${encodeURIComponent(id)}/${action}`, {}),
  myBills: async (key) =>
    (await request<{ bills: MyBill[] }>("GET", "/api/my-bills", undefined, key ? { headers: { "x-billsplit-key": key, "x-billsplit-lang": lang } } : undefined)).bills,
  createDeviceLink: (profile) => request("POST", "/api/device-link", { profile }),
  claimDeviceLink: (code) => request("POST", `/api/device-link/${encodeURIComponent(code)}`, {}),
  mergeDevice: (code) => request("POST", "/api/merge-device", { code }),
  move: (code) => request("POST", "/api/move", { code }),
  account: () => request("GET", "/api/account"),
  requestCode: (email, name) => request("POST", "/api/account/code", { email, ...(name ? { name } : {}) }),
  verifyCode: (email, code, profile) => request("POST", "/api/account/verify", { email, code, profile }),
  saveAccountProfile: (profile) => request("PUT", "/api/account/profile", { profile }),
  deleteAccount: () => request("DELETE", "/api/account"),
  subscribeEvents(onBillChanged) {
    const source = new EventSource(`/api/events?key=${encodeURIComponent(deviceKey())}`);
    source.addEventListener("changed", (e) => {
      const { billId } = JSON.parse((e as MessageEvent<string>).data) as { billId: string };
      onBillChanged(billId);
    });
    return () => source.close();
  },
  subscribe(id, onSnapshot, onLive, onDeleted) {
    // EventSource cannot send headers, so the device key goes into the query.
    const source = new EventSource(`${bill(id)}/events?key=${encodeURIComponent(deviceKey())}`);
    let dropped = false;
    source.addEventListener("snapshot", (e) => {
      // A dropped connection often means a new version was deployed.
      if (dropped) void checkForUpdate();
      dropped = false;
      onSnapshot(JSON.parse((e as MessageEvent<string>).data) as BillSnapshot);
      onLive(true);
    });
    source.addEventListener("deleted", () => {
      source.close();
      onDeleted?.();
    });
    source.onerror = () => {
      dropped = true;
      onLive(false);
    };
    return () => source.close();
  },
};

export const api: Api = DEMO ? localApi : serverApi;
