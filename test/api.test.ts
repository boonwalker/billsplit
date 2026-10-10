import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { RateLimiter } from "../server/rateLimit";
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
  const hour = 60 * 60 * 1000;
  server = createServer(
    createApp(new BillStore(null), "/nonexistent", {
      limits: {
        receiptPerClient: new RateLimiter(10, hour),
        receiptTotal: new RateLimiter(100, hour),
        billsPerClient: new RateLimiter(8, hour),
      },
    }),
  );
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
  it("stores the receipt photo for everyone to look at, uploaded only by the payer", async () => {
    const created = await call<BillSnapshot>(OWNER, "POST", "/api/bills", { data, name: "Niklas" });
    const id = created.json.id;
    expect(created.json.hasReceiptImage).toBe(false);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const upload = (key: string, body: Buffer) =>
      fetch(`${base}/api/bills/${id}/receipt-image`, { method: "PUT", headers: { "content-type": "image/jpeg", "x-billsplit-key": key }, body: new Uint8Array(body) });
    expect((await upload(ANNA, jpeg)).status).toBe(403);
    expect((await upload(OWNER, Buffer.from("<svg/>"))).status).toBe(400);
    const res = await upload(OWNER, jpeg);
    expect(res.status).toBe(200);
    expect(((await res.json()) as BillSnapshot).hasReceiptImage).toBe(true);
    // Anyone with the link can view it.
    const image = await fetch(`${base}/api/bills/${id}/receipt-image`);
    expect(image.headers.get("content-type")).toBe("image/jpeg");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(jpeg);
  });

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
    expect(afterClaim.participants.find((p) => p.name === "Anna")?.claims).toEqual({ pizza: [0], bier: [0, 1] });

    const pay = await call<{ amount: number }>(ANNA, "POST", `/api/bills/${id}/pay`);
    expect(pay.json.amount).toBe(1850);

    const ownerView = await call<BillSnapshot>(OWNER, "GET", `/api/bills/${id}`);
    expect(ownerView.json.debtors?.[0].payAmount).toBe(1850);

    // Friends see the claims but not the payment overview.
    const annaView = await call<BillSnapshot>(ANNA, "GET", `/api/bills/${id}`);
    expect(annaView.json.debtors).toBeUndefined();
    expect(annaView.json.myPayment?.amount).toBe(1850);
  });

  it("accepts delivery fees", async () => {
    const res = await call<BillSnapshot>(OWNER, "POST", "/api/bills", {
      data: { ...data, tipSplitCount: 3, fees: [{ id: "f1", name: "Liefergebühr", amount: 299 }] },
      name: "Niklas",
    });
    expect(res.status).toBe(201);
    expect(res.json.data.fees).toEqual([{ id: "f1", name: "Liefergebühr", amount: 299 }]);
  });

  it("accepts a fixed tip", async () => {
    const res = await call<BillSnapshot>(OWNER, "POST", "/api/bills", { data: { ...data, tipAmount: 300 }, name: "Niklas" });
    expect(res.status).toBe(201);
    expect(res.json.data.tipAmount).toBe(300);
  });

  it("accepts large amounts, e.g. a luxury dinner in dirhams", async () => {
    const res = await call<BillSnapshot>(OWNER, "POST", "/api/bills", {
      data: {
        ...data,
        currency: "AED",
        items: [
          { id: "steak", name: "Golden Ottoman", qty: 2, total: 550_000 },
          { id: "wine", name: "Petrus 2009", qty: 4, total: 39_600_000 },
        ],
        fees: [{ id: "f1", name: "Service Charge", amount: 4_000_000 }],
        tipAmount: 2_500_000,
      },
      name: "Niklas",
    });
    expect(res.status).toBe(201);
    const tooHigh = await call<{ error: string }>(OWNER, "POST", "/api/bills", {
      data: { ...data, items: [{ id: "x", name: "Insel", qty: 1, total: 2_000_000_000 }] },
      name: "Niklas",
    });
    expect(tooHigh.status).toBe(400);
    expect(tooHigh.json.error).toBe("Ein Betrag ist zu hoch.");
  });

  it("rejects invalid input and unknown bills", async () => {
    expect((await call(OWNER, "POST", "/api/bills", { data: { ...data, items: [] }, name: "N" })).status).toBe(400);
    expect((await call(OWNER, "GET", "/api/bills/doesnotexist")).status).toBe(404);
    expect((await call("", "POST", "/api/bills", { data, name: "N" })).status).toBe(401);
  });

  it("limits how many bills one client creates", async () => {
    // The limit in this setup is 8 bills per hour and client.
    const statuses: number[] = [];
    let retryAfter = 0;
    for (let i = 0; i < 9; i++) {
      const res = await fetch(`${base}/api/bills`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-billsplit-key": OWNER },
        body: JSON.stringify({ data, name: "Niklas" }),
      });
      statuses.push(res.status);
      if (res.status === 429) retryAfter = Number(res.headers.get("retry-after"));
    }
    expect(statuses.at(-1)).toBe(429);
    expect(statuses.filter((st) => st === 201).length).toBeLessThanOrEqual(8);
    expect(retryAfter).toBeGreaterThan(0);
  });
});
