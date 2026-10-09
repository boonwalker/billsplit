import type { Api } from "./api";
import { ApiError } from "./apiError";
import type { BillSnapshot } from "./bill";
import { BillCore, BillError, type StoredBill } from "./billCore";
import { PERSONA_EVENT } from "./demo";
import { deviceKey } from "./storage";

const BILLS_KEY = "billsplit.demo.bills";

/** Bills kept in this browser (demo build). Tabs of the same browser stay in sync. */
class LocalStore extends BillCore {
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    super();
    this.reload();
    window.addEventListener("storage", (e) => {
      if (e.key !== BILLS_KEY) return;
      this.reload();
      this.notifyAll();
    });
    // Switching the persona changes who is looking at every bill.
    window.addEventListener(PERSONA_EVENT, () => this.notifyAll());
  }

  private reload(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(BILLS_KEY) ?? "[]") as StoredBill[];
      this.bills = new Map(raw.map((b) => [b.id, b]));
    } catch {
      // storage unavailable – keep what is in memory
    }
  }

  protected override changed(billId: string): void {
    try {
      localStorage.setItem(BILLS_KEY, JSON.stringify([...this.bills.values()]));
    } catch {
      // ignore – the demo keeps working in memory
    }
    for (const fn of this.listeners.get(billId) ?? []) fn();
  }

  private notifyAll(): void {
    for (const set of this.listeners.values()) for (const fn of set) fn();
  }

  listen(billId: string, fn: () => void): () => void {
    let set = this.listeners.get(billId);
    if (!set) this.listeners.set(billId, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
}

let instance: LocalStore | null = null;
/** Created on first use, so the server build never touches it. */
export function localStore(): LocalStore {
  return (instance ??= new LocalStore());
}

export function newBillId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

/** Runs a store operation like a request: async, with the same error type as the server API. */
function call<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof BillError ? new ApiError(e.message, e.status) : e);
  }
}

const me = () => deviceKey();
const view = (id: string): BillSnapshot => localStore().snapshot(id, me());

export const localApi: Api = {
  createBill: (data, name) => call(() => view(localStore().create(newBillId(), data, me(), name))),
  getBill: (id) => call(() => view(id)),
  updateBill: (id, data) => call(() => (localStore().updateData(id, me(), data), view(id))),
  join: (id, name) => call(() => (localStore().join(id, me(), name), view(id))),
  setClaims: (id, claims) => call(() => (localStore().setClaims(id, me(), claims), view(id))),
  pay: (id) => call(() => ({ amount: localStore().recordPayClick(id, me()) })),
  setReceived: (id, participantId, received) => call(() => (localStore().setReceived(id, me(), participantId, received), view(id))),
  subscribe(id, onSnapshot, onLive) {
    const push = () => {
      if (localStore().has(id)) onSnapshot(view(id));
    };
    onLive(true);
    return localStore().listen(id, push);
  },
};
