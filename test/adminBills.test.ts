import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { BillStore, participantIdFromKey } from "../server/store";
import type { BillData } from "../src/lib/bill";

const TOKEN = "admin-token-for-tests-123";
const ANNA = "anna-device-key-0123456789";
const NIKLAS = "niklas-device-key-0123456789";
const anna = participantIdFromKey(ANNA);
const niklas = participantIdFromKey(NIKLAS);

const bill = (title: string, total: number): BillData => ({
  title,
  date: "2026-10-21",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "nik" },
  items: [{ id: "a", name: "Pizza", qty: 1, total }],
});

describe("admin page: deleting a bill as if it had never existed", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "billsplit-admin-bills-"));
  const file = path.join(dir, "bills.json");
  const store = new BillStore(file);
  let server: Server;
  let base: string;
  let trattoria: string;
  let bar: string;

  beforeAll(async () => {
    await store.load();
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-admin-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head></head><body></body></html>");
    trattoria = store.createBill(bill("Trattoria", 950), niklas, "Niklas");
    bar = store.createBill(bill("Bar", 500), niklas, "Niklas");
    for (const id of [trattoria, bar]) {
      store.join(id, anna, "Anna");
      store.setClaims(id, anna, { a: [0] });
    }
    // Anna settles both with one payment.
    store.createTransfer(anna, {
      toId: niklas,
      amount: 1450,
      currency: "EUR",
      allocations: [
        { billId: trattoria, debtorId: anna, creditorId: niklas, amount: 950 },
        { billId: bar, debtorId: anna, creditorId: niklas, amount: 500 },
      ],
    });
    server = createServer(createApp(store, dist, { adminToken: TOKEN }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const remove = (fields: Record<string, string>) =>
    fetch(`${base}/api/admin/bill`, { method: "POST", body: new URLSearchParams({ token: TOKEN, ...fields }), redirect: "manual" });
  const call = async (key: string, method: string, url: string, body?: unknown) => {
    const res = await fetch(base + url, { method, headers: { "x-billsplit-key": key, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };

  it("needs the token and the tick", async () => {
    expect(await (await fetch(`${base}/api/admin?token=${TOKEN}`)).text()).toContain("Rechnung löschen");
    expect((await remove({ token: "wrong-token-1234567", id: trattoria, confirm: "ja" })).status).toBe(404);
    const unticked = await remove({ id: trattoria });
    expect(decodeURIComponent(unticked.headers.get("location")!)).toContain("Nichts geändert");
    expect(store.has(trattoria)).toBe(true);
  });

  it("removes the bill for everyone; the payment keeps only the other bill's share", async () => {
    const res = await remove({ id: trattoria, confirm: "ja" });
    expect(res.status).toBe(303);
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("Rechnung „Trattoria“");
    expect(store.has(trattoria)).toBe(false);

    // The app learns it was deleted (not lost) – the bill page and the list.
    expect((await call(ANNA, "GET", `/api/bills/${trattoria}`)).status).toBe(410);
    const batch = await call(ANNA, "POST", "/api/bills/batch", { ids: [trattoria, bar] });
    expect(batch.json.deleted).toEqual([trattoria]);
    expect(batch.json.bills[trattoria]).toBeNull();
    expect((await call(ANNA, "GET", "/api/my-bills")).json.bills.map((b: { id: string }) => b.id)).toEqual([bar]);

    // The balances: only the bar is left, settled by the (smaller) payment.
    const transfers = (await call(ANNA, "GET", "/api/transfers")).json.transfers;
    expect(transfers).toHaveLength(1);
    expect(transfers[0].amount).toBe(500);
    expect(transfers[0].allocations.map((a: { billId: string }) => a.billId)).toEqual([bar]);
    expect(store.network(anna).filter((e) => e.amount > 0)).toEqual([]);
  });

  it("stays deleted after a restart", async () => {
    const again = new BillStore(file);
    await again.load();
    expect(again.has(trattoria)).toBe(false);
    expect(again.wasDeleted(trattoria)).toBe(true);
    expect(again.has(bar)).toBe(true);
    expect(again.listTransfers(anna).map((t) => t.amount)).toEqual([500]);
    again.close();
  });
});

describe("BillCore.removeBill", () => {
  it("drops a payment that passed money on between others – it no longer adds up without the bill", () => {
    const store = new BillStore(null);
    const [katia, andy, nik] = ["katia", "andy", "nik"].map((n) => participantIdFromKey(`${n}-device-key-0123456789`));
    // Andy owes Katia 10 € (X), Niklas owes Andy 10 € (Y): Niklas pays Katia, which settles both.
    const x = store.createBill(bill("X", 1000), katia, "Katia");
    store.join(x, andy, "Andy");
    store.setClaims(x, andy, { a: [0] });
    store.join(x, nik, "Niklas");
    const y = store.createBill(bill("Y", 1000), andy, "Andy");
    store.join(y, nik, "Niklas");
    store.setClaims(y, nik, { a: [0] });
    store.createTransfer(nik, {
      toId: katia,
      amount: 1000,
      currency: "EUR",
      allocations: [
        { billId: y, debtorId: nik, creditorId: andy, amount: 1000 },
        { billId: x, debtorId: andy, creditorId: katia, amount: 1000 },
      ],
    });
    expect(store.network(andy).filter((e) => e.amount > 0)).toEqual([]);

    const result = store.removeBill(y);
    expect(result).toMatchObject({ adjusted: 0, dropped: 1 });
    expect(new Set(result.people)).toEqual(new Set([katia, andy, nik]));
    expect(store.listTransfers(katia)).toEqual([]);
    // Andy's share with Katia is open again – as without that payment.
    expect(store.network(andy).filter((e) => e.amount > 0)).toMatchObject([{ billId: x, amount: 1000 }]);
  });
});
