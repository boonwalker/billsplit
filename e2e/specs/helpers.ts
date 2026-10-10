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
  options: { profile?: { name: string; paypalMe?: string }; recent?: { id: string; title: string; role: "owner" | "guest" }[]; seen?: string[] } = {},
): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  await context.addInitScript(
    ([k, profile, recent, seen]) => {
      if (localStorage.getItem("billsplit.deviceKey")) return;
      localStorage.setItem("billsplit.deviceKey", JSON.stringify(k));
      if (profile) localStorage.setItem("billsplit.profile", JSON.stringify({ paypalMe: "", paypalEmail: "", ...profile }));
      localStorage.setItem("billsplit.recent", JSON.stringify(recent.map((b) => ({ ...b, createdAt: new Date().toISOString() }))));
      for (const id of seen) for (const flag of ["claimDemo", "tapDemo", "peekShown"]) localStorage.setItem(`billsplit.${flag}.${id}`, "1");
      localStorage.setItem("billsplit.pushAsked", "1");
    },
    [deviceKey, options.profile ?? null, options.recent ?? [], options.seen ?? []] as const,
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
