import type { BillData, BillSnapshot, ItemClaims } from "./bill";
import { deviceKey } from "./storage";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-billsplit-key": deviceKey() },
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
    });
  } catch {
    throw new ApiError("Keine Verbindung zum Server.", 0);
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || json === null) throw new ApiError(json?.error ?? `Fehler (HTTP ${res.status}).`, res.status);
  return json;
}

const bill = (id: string) => `/api/bills/${encodeURIComponent(id)}`;

export const api = {
  createBill: (data: BillData, name: string) => request<BillSnapshot>("POST", "/api/bills", { data, name }),
  getBill: (id: string) => request<BillSnapshot>("GET", bill(id)),
  updateBill: (id: string, data: BillData) => request<BillSnapshot>("PUT", bill(id), { data }),
  join: (id: string, name: string) => request<BillSnapshot>("POST", `${bill(id)}/join`, { name }),
  setClaims: (id: string, claims: ItemClaims) => request<BillSnapshot>("PUT", `${bill(id)}/claims`, { claims }),
  /** keepalive lets the request finish while the browser switches to PayPal. */
  pay: (id: string) => request<{ amount: number }>("POST", `${bill(id)}/pay`, {}, { keepalive: true }),
  setReceived: (id: string, participantId: string, received: boolean) =>
    request<BillSnapshot>("POST", `${bill(id)}/received`, { participantId, received }),
  eventsUrl: (id: string) => `${bill(id)}/events?key=${encodeURIComponent(deviceKey())}`,
};
