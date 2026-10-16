import { mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountStore } from "../server/accounts";
import { createApp } from "../server/app";
import { BillStore, participantIdFromKey } from "../server/store";
import { SESSION_GAP_MS, VisitLog } from "../server/visits";

describe("visits", () => {
  it("counts visits, devices per day and new devices – a device once per half hour", async () => {
    let now = new Date("2026-10-16T10:00:00Z");
    const file = join(await mkdtemp(join(tmpdir(), "visits-")), "visits.json");
    const log = new VisitLog(file, () => now);
    expect(log.visit("anna", { app: true, lang: "de" })).toBe(true);
    expect(log.visit("anna", { app: true })).toBe(false); // same session
    expect(log.visit("ben", { app: false, lang: "en" })).toBe(true);
    now = new Date(now.getTime() + SESSION_GAP_MS + 1000);
    expect(log.visit("anna", { app: true })).toBe(true); // back after a while
    expect(log.stats()[0]).toEqual({ day: "2026-10-16", visits: 3, devices: 2, newDevices: 2, appVisits: 2 });

    // Next day, after a restart: Anna is no longer new, the day starts over.
    await log.flush();
    now = new Date("2026-10-17T12:00:00Z");
    const again = new VisitLog(file, () => now);
    await again.load();
    again.visit("anna", { app: true });
    again.visit("carl", { app: false });
    expect(again.stats()[0]).toEqual({ day: "2026-10-17", visits: 2, devices: 2, newDevices: 1, appVisits: 1 });
    expect(again.device("anna")).toMatchObject({ visits: 3, firstSeen: "2026-10-16T10:00:00.000Z", lang: "de" });
    expect(again.activeWithin(1)).toBe(2); // Anna and Carl; Ben was last seen 26 hours ago
    expect(again.activeWithin(7)).toBe(3);
  });
});

describe("admin page: usage, accounts, devices, bills", () => {
  let server: Server;
  let base: string;
  const TOKEN = "admin-token-123456";
  const store = new BillStore(null);
  const accounts = new AccountStore(null);
  const visits = new VisitLog(null);
  const niklasKey = "niklas-key-1234567890";
  const niklas = participantIdFromKey(niklasKey);

  beforeAll(async () => {
    server = createServer(createApp(store, "/nonexistent", { adminToken: TOKEN, accounts, visits }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("shows visits, the account with its name, and the bills", async () => {
    const visit = (key: string, app: boolean) =>
      fetch(`${base}/api/visit`, { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": key }, body: JSON.stringify({ app, lang: "de" }) });
    expect((await visit(niklasKey, true)).status).toBe(200);
    await visit("anna-key-1234567890", false);
    const bill = store.createBill(
      { title: "C.C. <Kowalski>", date: "", currency: "EUR", tipPercent: 0, payment: { paypalMe: "nik" }, items: [{ id: "a", name: "Schnitzel", qty: 1, total: 3150 }] },
      niklas,
      "Niklas",
    );
    store.join(bill, participantIdFromKey("anna-key-1234567890"), "Anna");
    accounts.create("niklas@example.com", niklasKey, { name: "Niklas" });

    const html = await (await fetch(`${base}/api/admin?token=${TOKEN}`)).text();
    expect(html).toContain("Nutzung pro Tag");
    expect(visits.stats()[0]).toMatchObject({ visits: 2, devices: 2, newDevices: 2, appVisits: 1 });
    expect(html).toContain("C.C. &lt;Kowalski&gt;");
    expect(html).toContain("Anna");
    expect(html).toMatch(/31,50\s€/);
    // The account, with the name from its profile.
    expect(html).toMatch(/niklas@example\.com<\/td><td class="left">Niklas<\/td>/);
  });
});
