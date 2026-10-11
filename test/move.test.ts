import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountStore } from "../server/accounts";
import { createApp, originOf } from "../server/app";
import { BillStore, participantIdFromKey } from "../server/store";
import type { BillData, BillSnapshot } from "../src/lib/bill";
import { currentPath, moveUrl, safeTarget } from "../src/lib/move";
import { parseHash } from "../src/lib/router";

describe("moving to klicksplit.de", () => {
  const OLD = "safari-old-address-key-0123456789";
  const NEW = "safari-new-address-key-0123456789";
  const OWNER = "owner-device-key-0123456789";
  const accounts = new AccountStore(null);
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const dist = mkdtempSync(path.join(tmpdir(), "billsplit-move-"));
    writeFileSync(path.join(dist, "index.html"), "<html><head><title>klicksplit</title></head><body></body></html>");
    const noMail = async () => {};
    server = createServer(createApp(new BillStore(null), dist, { accounts, sendCode: noMail, sendWelcome: noMail, homeUrl: "https://klicksplit.de/" }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  async function call<T>(key: string, method: string, url: string, body?: unknown): Promise<{ status: number; json: T }> {
    const res = await fetch(base + url, {
      method,
      headers: { "content-type": "application/json", "x-billsplit-key": key },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as T };
  }

  const data = (title: string): BillData => ({
    title,
    date: "2026-10-11",
    currency: "EUR",
    tipPercent: 0,
    payment: { paypalMe: "niklas" },
    items: [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }],
  });

  it("names the new address in the page", async () => {
    const html = await (await fetch(`${base}/#/b/abc`)).text();
    expect(html).toContain('<meta name="klicksplit-home" content="https://klicksplit.de"></head>');
    expect(originOf(" https://klicksplit.de/ ")).toBe("https://klicksplit.de");
    expect(originOf("")).toBeNull();
    expect(originOf("keine adresse")).toBeNull();
  });

  it("takes the old address's key along, with what was done at the new one so far", async () => {
    const paid = await call<BillSnapshot>(OLD, "POST", "/api/bills", { data: data("Trattoria"), name: "Niklas" });
    const friends = await call<BillSnapshot>(OWNER, "POST", "/api/bills", { data: data("Kino"), name: "Carl" });
    await call(NEW, "POST", `/api/bills/${friends.json.id}/join`, { name: "Niklas" });

    const { code } = (await call<{ code: string }>(OLD, "POST", "/api/device-link", { profile: { name: "Niklas", paypalMe: "niklas" } })).json;
    const moved = await call<{ key: string; profile: Record<string, string>; bills: { id: string; role: string }[] }>(NEW, "POST", "/api/move", { code });
    expect(moved.status).toBe(200);
    expect(moved.json.key).toBe(OLD);
    expect(moved.json.profile).toEqual({ name: "Niklas", paypalMe: "niklas" });
    // The payer's role stays (the code proves the old key), the bill joined at the new address comes along.
    expect(moved.json.bills.map((b) => [b.id, b.role]).sort()).toEqual(
      [
        [paid.json.id, "owner"],
        [friends.json.id, "guest"],
      ].sort(),
    );
    const kino = await call<BillSnapshot>(OLD, "GET", `/api/bills/${friends.json.id}`);
    expect(kino.json.me).toBe(participantIdFromKey(OLD));

    // A code works once.
    expect((await call(NEW, "POST", "/api/move", { code })).status).toBe(410);
  });

  it("keeps the key of an account that is signed in at the new address", async () => {
    const SIGNED_IN = "signed-in-new-key-0123456789";
    accounts.create("anna@example.de", SIGNED_IN, { name: "Anna" });
    const OLD_ANNA = "anna-old-address-key-0123456789";
    const bill = await call<BillSnapshot>(OLD_ANNA, "POST", "/api/bills", { data: data("Bar"), name: "Anna" });
    const { code } = (await call<{ code: string }>(OLD_ANNA, "POST", "/api/device-link", { profile: { name: "Anna" } })).json;
    const moved = await call<{ key: string; bills: { id: string; role: string }[] }>(SIGNED_IN, "POST", "/api/move", { code });
    expect(moved.json.key).toBe(SIGNED_IN);
    expect(moved.json.bills).toMatchObject([{ id: bill.json.id, role: "owner" }]);
  });

  it("builds the link to the new address and keeps the page that was open", () => {
    expect(currentPath("#/b/abc?an=x")).toBe("/b/abc?an=x");
    expect(currentPath("")).toBe("/");
    const url = moveUrl("https://klicksplit.de", "abcdefghijklmnopqrstuvwx", "/b/abc?an=x", true);
    expect(url).toBe("https://klicksplit.de/#/umzug/abcdefghijklmnopqrstuvwx?ziel=%2Fb%2Fabc%3Fan%3Dx&app=1");
    expect(parseHash(url.slice(url.indexOf("#")))).toEqual({ name: "move", code: "abcdefghijklmnopqrstuvwx", target: "/b/abc?an=x", app: true });
    expect(safeTarget("//evil.example")).toBe("/");
    expect(safeTarget("https://evil.example")).toBe("/");
    expect(safeTarget(undefined)).toBe("/");
  });
});
