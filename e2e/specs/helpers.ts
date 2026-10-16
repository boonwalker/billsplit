import type { Browser, Page } from "@playwright/test";

/** Helpers for the click tests: bills are set up through the API, everything else is clicked. */

export const BASE = "http://localhost:4173";

let counter = 0;
/** A fresh device key per person and test (participant ids derive from it). */
export const key = (name: string) => `${name}-e2e-key-${Date.now().toString(36)}-${counter++}`;

export async function api<T = Record<string, unknown>>(deviceKey: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", "x-billsplit-key": deviceKey },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export interface Item {
  id: string;
  name: string;
  qty: number;
  total: number;
}

/** Creates a bill paid by `owner` (PayPal.Me name `paypal`); returns its id. */
export async function createBill(owner: { key: string; name: string; paypal: string }, title: string, items: Item[]): Promise<string> {
  const snap = await api<{ id: string }>(owner.key, "POST", "/api/bills", {
    name: owner.name,
    data: { title, date: "2026-10-10", currency: "EUR", items, tipPercent: 0, payment: { paypalMe: owner.paypal } },
  });
  return snap.id;
}

/** Joins and takes the given units (item id → unit numbers). */
export async function joinAndClaim(person: { key: string; name: string }, billId: string, claims: Record<string, number[]>): Promise<void> {
  await api(person.key, "POST", `/api/bills/${billId}/join`, { name: person.name });
  await api(person.key, "PUT", `/api/bills/${billId}/claims`, { claims });
}

/**
 * A phone of its own (separate storage). With a profile the name prompt is skipped; the
 * explainer animations of the given bills count as seen, so they do not get in the way.
 */
export async function phone(
  browser: Browser,
  deviceKey: string,
  options: {
    profile?: { name: string; paypalMe?: string };
    /** Newest first (each one a minute older than the one before). */
    recent?: { id: string; title: string; role: "owner" | "guest"; createdAt?: string }[];
    seen?: string[];
    /** Let a friend be asked "Wie willst Du bezahlt werden?" after paying (off by default). */
    askProfile?: boolean;
    userAgent?: string;
  } = {},
): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], ...(options.userAgent ? { userAgent: options.userAgent } : {}) });
  await context.addInitScript(
    ([k, profile, recent, seen, askProfile]) => {
      if (localStorage.getItem("billsplit.deviceKey")) return;
      localStorage.setItem("billsplit.deviceKey", JSON.stringify(k));
      if (profile) localStorage.setItem("billsplit.profile", JSON.stringify({ paypalMe: "", paypalEmail: "", ...profile }));
      localStorage.setItem("billsplit.recent", JSON.stringify(recent.map((b, i) => ({ ...b, createdAt: b.createdAt ?? new Date(Date.now() - i * 60_000).toISOString() }))));
      for (const id of seen) for (const flag of ["claimDemo", "tapDemo", "peekShown"]) localStorage.setItem(`billsplit.${flag}.${id}`, "1");
      localStorage.setItem("billsplit.pushAsked", "1");
      if (!askProfile) localStorage.setItem("billsplit.profileAsked", "1");
    },
    [deviceKey, options.profile ?? null, options.recent ?? [], options.seen ?? [], Boolean(options.askProfile)] as const,
  );
  return context.newPage();
}

/** Clicks a link that opens PayPal in a new tab and closes that tab again. */
export async function followPaypal(page: Page, name: RegExp): Promise<string> {
  const link = page.getByRole("link", { name });
  const href = (await link.getAttribute("href")) ?? "";
  const [popup] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
  await popup.close();
  return href;
}

/** The app goes to the background (e.g. to PayPal) and comes back. */
export async function leaveAndReturn(page: Page): Promise<void> {
  await page.evaluate(() => {
    const set = (state: string) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    set("hidden");
    set("visible");
  });
}

/** The latest sign-in code sent to an address (the test server writes them to MAIL_OUTBOX). */
export async function mailedCode(email: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  for (let attempt = 0; attempt < 40; attempt++) {
    const lines = (await readFile(process.env.MAIL_OUTBOX!, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
    const mail = lines.map((l) => JSON.parse(l) as { email: string; code: string }).filter((m) => m.email === email && m.code).at(-1);
    if (mail) return mail.code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Kein Code an ${email}`);
}
