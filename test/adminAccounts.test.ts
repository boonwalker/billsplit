import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountStore } from "../server/accounts";
import { createApp } from "../server/app";
import { BillStore, participantIdFromKey } from "../server/store";
import { ERASED_NAME } from "../src/lib/billCore";

const TOKEN = "admin-token-for-tests-123";
const ANNA = "anna-device-key-0123456789";
const NIKLAS = "niklas-device-key-0123456789";

describe("admin page: deleting, resetting and erasing accounts", () => {
  const store = new BillStore(null);
  const accounts = new AccountStore(null);
  let server: Server;
  let base: string;
  let annasBill: string;
  let niklasBill: string;

  beforeAll(async () => {
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-admin-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head></head><body></body></html>");
    const anna = participantIdFromKey(ANNA);
    const niklas = participantIdFromKey(NIKLAS);
    const data = { title: "Trattoria", date: "2026-10-21", currency: "EUR", tipPercent: 0, items: [{ id: "a", name: "Pizza", qty: 1, total: 950 }] };
    annasBill = store.createBill({ ...data, payment: { iban: "DE89370400440532013000", holder: "Anna" } }, anna, "Anna");
    niklasBill = store.createBill({ ...data, payment: { paypalMe: "nik" } }, niklas, "Niklas");
    store.join(niklasBill, anna, "Anna");
    accounts.create("anna@example.org", ANNA, { name: "Anna", iban: "DE89370400440532013000" });
    accounts.create("niklas@example.org", NIKLAS, { name: "Niklas" });
    server = createServer(createApp(store, dist, { accounts, adminToken: TOKEN, sendCode: async () => {}, sendWelcome: async () => {} }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const act = (fields: Record<string, string>) =>
    fetch(`${base}/api/admin/account`, { method: "POST", body: new URLSearchParams({ token: TOKEN, ...fields }), redirect: "manual" });
  const accountOf = async (key: string) => (await fetch(`${base}/api/account`, { headers: { "x-billsplit-key": key } })).json();

  it("shows the actions only with the token, and refuses a wrong one", async () => {
    const page = await (await fetch(`${base}/api/admin?token=${TOKEN}`)).text();
    expect(page).toContain("Profil zurücksetzen");
    expect(page).toContain("Alle Daten löschen");
    expect((await act({ token: "wrong-token-1234567", action: "delete", email: "anna@example.org", confirm: "anna@example.org" })).status).toBe(404);
    expect(accounts.get("anna@example.org")).not.toBeNull();
  });

  it("resets the profile kept in the account", async () => {
    const res = await act({ action: "reset", email: "anna@example.org" });
    expect(res.status).toBe(303);
    expect(decodeURIComponent(res.headers.get("location")!)).toContain("Profil von anna@example.org zurückgesetzt");
    expect(accounts.get("anna@example.org")?.profile).toEqual({});
  });

  it("deletes an account only when the address is typed in – and tells the device why", async () => {
    await act({ action: "delete", email: "niklas@example.org", confirm: "niklas@example.org " + "x" });
    expect(accounts.get("niklas@example.org")).not.toBeNull();
    await act({ action: "delete", email: "niklas@example.org", confirm: " Niklas@Example.org " });
    expect(accounts.get("niklas@example.org")).toBeNull();
    expect(await accountOf(NIKLAS)).toEqual({ account: null, removed: "deleted" });
    // The bills stay as they are.
    expect(store.snapshot(niklasBill, null).ownerName).toBe("Niklas");
  });

  it("erases all of a person's data: name, payment details of own bills, account", async () => {
    await act({ action: "erase", email: "anna@example.org", confirm: "anna@example.org" });
    expect(accounts.get("anna@example.org")).toBeNull();
    expect(await accountOf(ANNA)).toEqual({ account: null, removed: "erased" });
    const own = store.snapshot(annasBill, null);
    expect(own.ownerName).toBe(ERASED_NAME);
    expect(own.data.payment).toEqual({});
    // In Niklas' bill she stays with her share, under the new name.
    const other = store.snapshot(niklasBill, participantIdFromKey(NIKLAS));
    expect(other.debtors?.map((d) => d.name)).toEqual([ERASED_NAME]);
  });
});
