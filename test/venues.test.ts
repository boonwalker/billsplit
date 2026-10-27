import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { BillStore, participantIdFromKey } from "../server/store";
import { VenueStore } from "../server/venues";
import type { Venue } from "../src/lib/bill";

const RESTAURANT = "brauhaus-device-key-0123456789";
const GUEST = "anna-device-key-0123456789";

describe("restaurant mode: tables with QR codes and the bill open at each", () => {
  const store = new BillStore(null);
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-venues-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head></head><body></body></html>");
    server = createServer(createApp(store, dist, { venues: new VenueStore(null) }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const call = async <T = Record<string, unknown>>(key: string, method: string, url: string, body?: unknown) => {
    const res = await fetch(base + url, { method, headers: { "x-billsplit-key": key, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as T };
  };
  const bill = (owner: string) =>
    store.createBill(
      { title: "Brauhaus", date: "2026-10-27", currency: "EUR", tipPercent: 0, payment: {}, items: [{ id: "k", name: "Kölsch", qty: 4, total: 1000 }] },
      participantIdFromKey(owner),
      "Brauhaus",
    );

  it("creates a restaurant with its tables, a QR code leads to the bill open at the table", async () => {
    const created = await call<Venue>(RESTAURANT, "POST", "/api/venues", { name: "Brauhaus am Dom", tables: 3 });
    expect(created.status).toBe(201);
    expect(created.json.tables.map((t) => t.name)).toEqual(["Tisch 1", "Tisch 2", "Tisch 3"]);
    const table = created.json.tables[1];
    expect((await call<{ venues: Venue[] }>(RESTAURANT, "GET", "/api/venues")).json.venues).toHaveLength(1);
    expect((await call<{ venues: Venue[] }>(GUEST, "GET", "/api/venues")).json.venues).toEqual([]);

    // No bill yet: the QR code leads to the waiting page.
    let res = await fetch(`${base}/t/${table.id}`, { redirect: "manual" });
    expect(res.headers.get("location")).toBe(`/#/tisch/${table.id}`);
    expect((await call(GUEST, "GET", `/api/tables/${table.id}`)).json).toEqual({ venue: "Brauhaus am Dom", table: "Tisch 2", billId: null });

    // The staff opens a bill there.
    const id = bill(RESTAURANT);
    expect((await call(RESTAURANT, "POST", `/api/venues/tables/${table.id}`, { billId: id })).status).toBe(200);
    res = await fetch(`${base}/t/${table.id}`, { redirect: "manual" });
    expect(res.headers.get("location")).toBe(`/b/${id}`);
    expect((await call(GUEST, "GET", `/api/tables/${table.id}`)).json.billId).toBe(id);

    // Freed: back to waiting.
    await call(RESTAURANT, "POST", `/api/venues/tables/${table.id}`, { billId: null });
    res = await fetch(`${base}/t/${table.id}`, { redirect: "manual" });
    expect(res.headers.get("location")).toBe(`/#/tisch/${table.id}`);
  });

  it("only the restaurant changes its tables, and only with its own bills", async () => {
    const venue = (await call<Venue>(RESTAURANT, "POST", "/api/venues", { name: "Zweites Lokal", tables: 1 })).json;
    const table = venue.tables[0];
    expect((await call(GUEST, "POST", `/api/venues/tables/${table.id}`, { billId: bill(GUEST) })).status).toBe(403);
    expect((await call(RESTAURANT, "POST", `/api/venues/tables/${table.id}`, { billId: bill(GUEST) })).status).toBe(403);
    expect((await call(RESTAURANT, "POST", "/api/venues/tables/unknown-table", { billId: null })).status).toBe(404);
    expect((await fetch(`${base}/t/unknown-table`, { redirect: "manual" })).headers.get("location")).toBe("/");
  });
});
