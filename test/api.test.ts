import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { BillStore } from "../server/store";
import type { BillData, BillSnapshot } from "../src/lib/bill";

const data: BillData = {
  title: "Trattoria",
  date: "2026-10-08",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "niklas", paypalEmail: "niklas@web.de" },
  items: [
    { id: "pizza", name: "Pizza", qty: 1, total: 950 },
    { id: "bier", name: "Bier", qty: 3, total: 1350 },
  ],
};

const OWNER = "owner-device-key-0123456789";
const ANNA = "anna-device-key-0123456789";

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer(createApp(new BillStore(null), "/nonexistent"));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call<T>(key: string, method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", "x-billsplit-key": key },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as T };
}

/** Reads server-sent snapshots until one matches. */
async function waitForSnapshot(key: string, billId: string, match: (s: BillSnapshot) => boolean, trigger: () => Promise<unknown>) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/bills/${billId}/events?key=${key}`, { signal: controller.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let triggered = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended");
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        const snap = JSON.parse(dataLine.slice(6)) as BillSnapshot;
        if (match(snap)) return snap;
        if (!triggered) {
          triggered = true;
          await trigger();
        }
      }
    }
  } finally {
    controller.abort();
  }
}

describe("bills API", () => {
  it("syncs friends, claims and pay clicks live to the payer", async () => {
    const created = await call<BillSnapshot>(OWNER, "POST", "/api/bills", { data, name: "Niklas" });
    expect(created.status).toBe(201);
    expect(created.json.isOwner).toBe(true);
    const id = created.json.id;

    // The payer is watching live while Anna scans the QR code.
    const afterJoin = await waitForSnapshot(OWNER, id, (s) => (s.debtors?.length ?? 0) > 0, () =>
      call(ANNA, "POST", `/api/bills/${id}/join`, { name: "Anna" }),
    );
    expect(afterJoin.debtors?.[0].name).toBe("Anna");

    // Anna's claims show up live for the payer, too.
    const afterClaim = await waitForSnapshot(OWNER, id, (s) => s.debtors?.[0].amount === 1850, () =>
      call(ANNA, "PUT", `/api/bills/${id}/claims`, { claims: { pizza: 1, bier: 2 } }),
    );
    expect(afterClaim.participants.find((p) => p.name === "Anna")?.claims).toEqual({ pizza: 1, bier: 2 });

    const pay = await call<{ amount: number }>(ANNA, "POST", `/api/bills/${id}/pay`);
    expect(pay.json.amount).toBe(1850);

    const ownerView = await call<BillSnapshot>(OWNER, "GET", `/api/bills/${id}`);
    expect(ownerView.json.debtors?.[0].payAmount).toBe(1850);

    // Friends see the claims but not the payment overview.
    const annaView = await call<BillSnapshot>(ANNA, "GET", `/api/bills/${id}`);
    expect(annaView.json.debtors).toBeUndefined();
    expect(annaView.json.myPayment?.amount).toBe(1850);
  });

  it("rejects invalid input and unknown bills", async () => {
    expect((await call(OWNER, "POST", "/api/bills", { data: { ...data, items: [] }, name: "N" })).status).toBe(400);
    expect((await call(OWNER, "GET", "/api/bills/doesnotexist")).status).toBe(404);
    expect((await call("", "POST", "/api/bills", { data, name: "N" })).status).toBe(401);
  });
});
