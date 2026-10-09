import { ApiError } from "./apiError";
import type { BillData, BillSnapshot, ItemClaims } from "./bill";
import { DEMO } from "./demo";
import { localApi } from "./localApi";
import { deviceKey } from "./storage";

export { ApiError };

export interface Api {
  createBill(data: BillData, name: string): Promise<BillSnapshot>;
  getBill(id: string): Promise<BillSnapshot>;
  updateBill(id: string, data: BillData): Promise<BillSnapshot>;
  join(id: string, name: string): Promise<BillSnapshot>;
  setClaims(id: string, claims: ItemClaims): Promise<BillSnapshot>;
  pay(id: string): Promise<{ amount: number }>;
  setReceived(id: string, participantId: string, received: boolean): Promise<BillSnapshot>;
  /** Live updates of one bill; returns an unsubscribe function. */
  subscribe(id: string, onSnapshot: (s: BillSnapshot) => void, onLive: (live: boolean) => void): () => void;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  // A sleeping server (e.g. Railway "Serverless") answers the first request with 502/503
  // or not at all while it wakes up; reads are simply tried again a few times.
  const attempts = method === "GET" ? 4 : 1;
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
  if (!res.ok || json === null) throw new ApiError(json?.error ?? `Fehler (HTTP ${res.status}).`, res.status);
  return json;
}

const bill = (id: string) => `/api/bills/${encodeURIComponent(id)}`;

const serverApi: Api = {
  createBill: (data, name) => request("POST", "/api/bills", { data, name }),
  getBill: (id) => request("GET", bill(id)),
  updateBill: (id, data) => request("PUT", bill(id), { data }),
  join: (id, name) => request("POST", `${bill(id)}/join`, { name }),
  setClaims: (id, claims) => request("PUT", `${bill(id)}/claims`, { claims }),
  // keepalive lets the request finish while the browser switches to PayPal.
  pay: (id) => request("POST", `${bill(id)}/pay`, {}, { keepalive: true }),
  setReceived: (id, participantId, received) => request("POST", `${bill(id)}/received`, { participantId, received }),
  subscribe(id, onSnapshot, onLive) {
    // EventSource cannot send headers, so the device key goes into the query.
    const source = new EventSource(`${bill(id)}/events?key=${encodeURIComponent(deviceKey())}`);
    source.addEventListener("snapshot", (e) => {
      onSnapshot(JSON.parse((e as MessageEvent<string>).data) as BillSnapshot);
      onLive(true);
    });
    source.onerror = () => onLive(false);
    return () => source.close();
  },
};

export const api: Api = DEMO ? localApi : serverApi;
