import { ApiError } from "./apiError";
import type { BillData, BillSnapshot, ItemClaims } from "./bill";
import { checkForUpdate } from "./updates";
import { DEMO } from "./demo";
import { localApi } from "./localApi";
import { deviceKey } from "./storage";

export { ApiError };

export interface Api {
  createBill(data: BillData, name: string): Promise<BillSnapshot>;
  getBill(id: string): Promise<BillSnapshot>;
  updateBill(id: string, data: BillData): Promise<BillSnapshot>;
  join(id: string, name: string): Promise<BillSnapshot>;
  setClaims(id: string, claims: ItemClaims, splits: ItemClaims): Promise<BillSnapshot>;
  /** Stores the photo or screenshot the bill was read from (payer only). */
  uploadReceiptImage(id: string, jpeg: Blob): Promise<BillSnapshot>;
  /** Address of the stored receipt photo, or null if there is none. */
  receiptImageUrl(id: string): Promise<string | null>;
  pay(id: string): Promise<{ amount: number }>;
  setReceived(id: string, participantId: string, received: boolean): Promise<BillSnapshot>;
  /** A friend marks their own share as paid. */
  markPaid(id: string, paid: boolean): Promise<BillSnapshot>;
  /** Live updates of one bill; returns an unsubscribe function. */
  subscribe(id: string, onSnapshot: (s: BillSnapshot) => void, onLive: (live: boolean) => void): () => void;
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
        headers: { "content-type": "application/json", "x-billsplit-key": deviceKey() },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...init,
      });
      if (attempt < attempts && (res.status === 502 || res.status === 503)) {
        await wait(1500 * attempt);
        continue;
      }
      break;
    } catch {
      if (attempt === attempts) throw new ApiError("Keine Verbindung zum Server.", 0);
      await wait(1500 * attempt);
    }
  }
  if (!res) throw new ApiError("Keine Verbindung zum Server.", 0);
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || json === null) {
    const unavailable = res.status === 502 || res.status === 503 || res.status === 504;
    const fallback = unavailable
      ? "Der Server ist gerade kurz nicht erreichbar (vermutlich ein Update). Bitte gleich nochmal tippen."
      : `Fehler (HTTP ${res.status}).`;
    throw new ApiError(json?.error ?? fallback, res.status);
  }
  return json;
}

const bill = (id: string) => `/api/bills/${encodeURIComponent(id)}`;

const serverApi: Api = {
  createBill: (data, name) => request("POST", "/api/bills", { data, name }),
  getBill: (id) => request("GET", bill(id)),
  updateBill: (id, data) => request("PUT", bill(id), { data }),
  join: (id, name) => request("POST", `${bill(id)}/join`, { name }),
  setClaims: (id, claims, splits) => request("PUT", `${bill(id)}/claims`, { claims, splits }),
  async uploadReceiptImage(id, jpeg) {
    const res = await fetch(`${bill(id)}/receipt-image`, {
      method: "PUT",
      headers: { "content-type": "image/jpeg", "x-billsplit-key": deviceKey() },
      body: jpeg,
    });
    const json = (await res.json().catch(() => null)) as (BillSnapshot & { error?: string }) | null;
    if (!res.ok || !json) throw new ApiError(json?.error ?? `Fehler (HTTP ${res.status}).`, res.status);
    return json;
  },
  receiptImageUrl: async (id) => `${bill(id)}/receipt-image`,
  // keepalive lets the request finish while the browser switches to PayPal.
  pay: (id) => request("POST", `${bill(id)}/pay`, {}, { keepalive: true }),
  setReceived: (id, participantId, received) => request("POST", `${bill(id)}/received`, { participantId, received }),
  markPaid: (id, paid) => request("POST", `${bill(id)}/paid`, { paid }),
  subscribe(id, onSnapshot, onLive) {
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
    source.onerror = () => {
      dropped = true;
      onLive(false);
    };
    return () => source.close();
  },
};

export const api: Api = DEMO ? localApi : serverApi;
