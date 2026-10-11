import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AccountStore, CODE_TTL_MS } from "../server/accounts";
import { createApp } from "../server/app";
import { codeMail, greeting, senderName, welcomeMail } from "../server/mail";
import { BillStore } from "../server/store";
import type { BillData, BillSnapshot } from "../src/lib/bill";

describe("AccountStore codes", () => {
  it("accepts the right code once, counts wrong ones and lets codes expire", () => {
    let now = 0;
    const accounts = new AccountStore(null, () => now);
    const code = accounts.newCode("Anna@Example.de ");
    expect(accounts.verify("anna@example.de", code === "000000" ? "000001" : "000000")).toEqual({ ok: false, reason: "wrong" });
    expect(accounts.verify("anna@example.de", code)).toEqual({ ok: true });
    expect(accounts.verify("anna@example.de", code)).toEqual({ ok: false, reason: "expired" });

    const late = accounts.newCode("ben@example.de");
    now = CODE_TTL_MS + 1;
    expect(accounts.verify("ben@example.de", late)).toEqual({ ok: false, reason: "expired" });
  });

  it("stops a code after five wrong guesses", () => {
    const accounts = new AccountStore(null);
    const code = accounts.newCode("anna@example.de");
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 4; i++) expect(accounts.verify("anna@example.de", wrong).ok).toBe(false);
    expect(accounts.verify("anna@example.de", wrong)).toEqual({ ok: false, reason: "expired" });
    expect(accounts.verify("anna@example.de", code)).toEqual({ ok: false, reason: "expired" });
  });
});

describe("code mail", () => {
  it("takes the product name from the sender", () => {
    expect(senderName("klicksplit <code@klicksplit.de>")).toBe("klicksplit");
    expect(senderName('"billsplit" <code@klicksplit.de>')).toBe("billsplit");
    expect(senderName("code@klicksplit.de")).toBe("klicksplit");
    expect(codeMail("482913", "klicksplit <code@klicksplit.de>").subject).toBe("Dein klicksplit-Code: 482913");
  });

  it("greets with „Hi,“ and shows the code in the app's look", () => {
    const mail = codeMail("482913", "klicksplit <code@klicksplit.de>", "https://app.example/icon-192.png");
    expect(mail.text.startsWith("Hi,\n\nhier ist Dein Code für klicksplit: 482913")).toBe(true);
    expect(mail.html).toContain(">Hi,</p>");
    expect(codeMail("482913", undefined, undefined, " Niklas ").html).toContain(">Hi Niklas,</p>");
    expect(greeting("")).toBe("Hi,");
    // The app's line at the end: three empty lines above, the name, then "Einer zahlt." / "Alle splitten." (green).
    expect(mail.html).toContain("<br><br><br>");
    expect(mail.html).toMatch(/color:#3ddc97">Alle splitten\.<\/div>/);
    expect(mail.text.endsWith("klicksplit •\nEiner zahlt.\nAlle splitten.\n")).toBe(true);
    expect(mail.html).toContain(">482913</span>");
    expect(mail.html).toContain('src="https://app.example/icon-192.png"');
    expect(mail.html).toContain('klick<b style="font-weight:700;color:#0f7a4d">split</b>');
    expect(codeMail("482913", undefined).html).not.toContain("<img");
  });

  it("welcomes a new account holder and shows how to sign in from anywhere", () => {
    const mail = welcomeMail("klicksplit <code@klicksplit.de>", "https://klicksplit.de", undefined, "Anna");
    expect(mail.subject).toBe("Willkommen bei klicksplit!");
    expect(mail.html).toContain(">Hi Anna,</p>");
    expect(mail.html).toContain('href="https://klicksplit.de"');
    expect(mail.html).toContain("<b>klicksplit.de</b> im Browser öffnen");
    expect(mail.text).toContain("1. klicksplit.de im Browser öffnen");
  });
});

describe("/api/account", () => {
  const PHONE = "anna-phone-key-0123456789";
  const LAPTOP = "anna-laptop-key-0123456789";
  const OWNER = "owner-device-key-0123456789";
  const sent: { email: string; code: string; name?: string }[] = [];
  const welcomed: { email: string; name?: string }[] = [];
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const sendCode = async (email: string, code: string, name?: string) => void sent.push({ email, code, name });
    const sendWelcome = async (email: string, name?: string) => void welcomed.push({ email, name });
    server = createServer(createApp(new BillStore(null), "/nonexistent", { accounts: new AccountStore(null), sendCode, sendWelcome }));
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

  async function signIn(key: string, email: string, profile?: Record<string, string>) {
    expect((await call(key, "POST", "/api/account/code", { email, ...(profile?.name ? { name: profile.name } : {}) })).status).toBe(200);
    const code = sent.at(-1)!.code;
    return call<{ status: string; key?: string; profile?: Record<string, string>; bills?: { id: string }[] }>(key, "POST", "/api/account/verify", {
      email,
      code,
      profile,
    });
  }

  it("creates an account and signs another device into it, bills included", async () => {
    const data: BillData = {
      title: "Trattoria",
      date: "2026-10-11",
      currency: "EUR",
      tipPercent: 0,
      payment: { paypalMe: "niklas" },
      items: [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }],
    };
    const bill = await call<BillSnapshot>(OWNER, "POST", "/api/bills", { data, name: "Niklas" });
    await call(PHONE, "POST", `/api/bills/${bill.json.id}/join`, { name: "Anna" });

    // The phone creates the account.
    expect((await call(PHONE, "GET", "/api/account")).json).toEqual({ account: null });
    const created = await signIn(PHONE, "Anna@Example.de", { name: "Anna", paypalMe: "anna" });
    expect(created.json.status).toBe("created");
    expect(sent.at(-1)).toMatchObject({ email: "anna@example.de", name: "Anna" });
    // The first sign-in creates the account: a welcome mail goes out (once).
    expect(welcomed).toEqual([{ email: "anna@example.de", name: "Anna" }]);
    expect((await call(PHONE, "GET", "/api/account")).json).toEqual({ account: { email: "anna@example.de" } });

    // Wrong codes are refused.
    await call(LAPTOP, "POST", "/api/account/code", { email: "anna@example.de" });
    const right = sent.at(-1)!.code;
    const wrong = await call<{ error: string }>(LAPTOP, "POST", "/api/account/verify", { email: "anna@example.de", code: right === "000000" ? "111111" : "000000" });
    expect(wrong.status).toBe(400);

    // The laptop signs in: it gets the phone's key, the profile and the bill.
    const login = await call<{ status: string; key: string; profile: Record<string, string>; bills: { id: string }[] }>(LAPTOP, "POST", "/api/account/verify", {
      email: "anna@example.de",
      code: right,
    });
    expect(login.json.status).toBe("login");
    expect(login.json.key).toBe(PHONE);
    expect(login.json.profile).toEqual({ name: "Anna", paypalMe: "anna" });
    expect(login.json.bills.map((b) => b.id)).toContain(bill.json.id);
  });

  it("keeps the profile up to date and deletes the account", async () => {
    expect((await call(PHONE, "PUT", "/api/account/profile", { profile: { name: "Anna", wero: "+49 170 1" } })).status).toBe(200);
    const again = await signIn("anna-tablet-key-0123456789", "anna@example.de");
    expect(again.json.profile).toEqual({ name: "Anna", wero: "+49 170 1" });

    expect((await call(PHONE, "DELETE", "/api/account")).json).toEqual({ account: null });
    expect((await call(PHONE, "GET", "/api/account")).json).toEqual({ account: null });
    expect((await call(PHONE, "PUT", "/api/account/profile", { profile: {} })).status).toBe(404);
  });

  it("does not connect a device that already has another account", async () => {
    const BEN = "ben-phone-key-0123456789";
    expect((await signIn(BEN, "ben@example.de")).json.status).toBe("created");
    expect((await signIn(BEN, "ben@example.de")).json.status).toBe("same");
    expect((await signIn(BEN, "anna@example.de")).status).toBe(409);
  });

  it("refuses invalid addresses and limits codes per address", async () => {
    expect((await call(PHONE, "POST", "/api/account/code", { email: "keine-adresse" })).status).toBe(400);
    let status = 200;
    for (let i = 0; i < 6 && status === 200; i++) status = (await call(PHONE, "POST", "/api/account/code", { email: "viel@example.de" })).status;
    expect(status).toBe(429);
  });
});
