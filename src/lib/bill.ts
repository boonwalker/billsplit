import LZString from "lz-string";
import type { Cents } from "./money";

export interface BillItem {
  name: string;
  /** Number of units on the receipt line, e.g. 3 for "3x Bier". */
  qty: number;
  /** Total price of the whole line in cents (qty × unit price). */
  total: Cents;
}

export interface PaymentMethods {
  /** PayPal.me username of the payer. */
  paypal?: string;
  /** IBAN for a regular bank transfer. */
  iban?: string;
  /** Account holder for the bank transfer. */
  accountHolder?: string;
  /** Payer also accepts cash. */
  cash?: boolean;
}

export interface Bill {
  title: string;
  /** ISO date (YYYY-MM-DD) or empty. */
  date: string;
  currency: string;
  payerName: string;
  /** Tip in percent that is added on top of every share. */
  tipPercent: number;
  items: BillItem[];
  payment: PaymentMethods;
}

/** Version tag of the compact wire format below. Bump when the layout changes. */
const FORMAT_VERSION = 1;

type WireItem = [name: string, qty: number, total: number];
type WirePayment = { p?: string; i?: string; h?: string; c?: 1 };
type WireBill = [
  version: number,
  title: string,
  date: string,
  currency: string,
  payerName: string,
  tipPercent: number,
  payment: WirePayment,
  items: WireItem[],
];

/**
 * Serializes a bill into a compact, URL-safe string. The whole bill lives in the
 * link (and therefore in the QR code), so no server-side storage is needed.
 */
export function encodeBill(bill: Bill): string {
  const payment: WirePayment = {};
  if (bill.payment.paypal) payment.p = bill.payment.paypal;
  if (bill.payment.iban) payment.i = bill.payment.iban;
  if (bill.payment.accountHolder) payment.h = bill.payment.accountHolder;
  if (bill.payment.cash) payment.c = 1;
  const wire: WireBill = [
    FORMAT_VERSION,
    bill.title,
    bill.date,
    bill.currency,
    bill.payerName,
    bill.tipPercent,
    payment,
    bill.items.map((it) => [it.name, it.qty, it.total]),
  ];
  return LZString.compressToEncodedURIComponent(JSON.stringify(wire));
}

export function decodeBill(data: string): Bill | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(data);
    if (!json) return null;
    const wire = JSON.parse(json) as unknown;
    if (!Array.isArray(wire) || wire[0] !== FORMAT_VERSION || wire.length !== 8) return null;
    const [, title, date, currency, payerName, tipPercent, payment, items] = wire as WireBill;
    if (!Array.isArray(items)) return null;
    const p = (payment ?? {}) as WirePayment;
    return {
      title: String(title ?? ""),
      date: String(date ?? ""),
      currency: typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
      payerName: String(payerName ?? ""),
      tipPercent: Number.isFinite(tipPercent) ? Number(tipPercent) : 0,
      payment: {
        paypal: typeof p.p === "string" ? p.p : undefined,
        iban: typeof p.i === "string" ? p.i : undefined,
        accountHolder: typeof p.h === "string" ? p.h : undefined,
        cash: p.c === 1,
      },
      items: items
        .filter((it) => Array.isArray(it) && it.length === 3)
        .map(([name, qty, total]) => ({
          name: String(name),
          qty: Math.max(1, Math.floor(Number(qty)) || 1),
          total: Math.round(Number(total)) || 0,
        })),
    };
  } catch {
    return null;
  }
}

/** Short stable identifier for a bill, used as key for locally stored selections. */
export function billId(encoded: string): string {
  // FNV-1a 32 bit
  let h = 0x811c9dc5;
  for (let i = 0; i < encoded.length; i++) {
    h ^= encoded.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function billUrl(encoded: string, base: string): string {
  return `${base.replace(/#.*$/, "")}#/b/${encoded}`;
}

export function subtotal(items: BillItem[]): Cents {
  return items.reduce((sum, it) => sum + it.total, 0);
}

/** What a participant has claimed of one bill line. */
export interface Claim {
  /** Number of units taken (0..qty). */
  units: number;
  /** The claimed units are shared with this many people in total (1 = alone). */
  shareCount: number;
}

export type Claims = Record<number, Claim>;

export function claimAmount(item: BillItem, claim: Claim | undefined): Cents {
  if (!claim || claim.units <= 0) return 0;
  const units = Math.min(claim.units, item.qty);
  const share = Math.max(1, claim.shareCount);
  return Math.round((item.total * units) / item.qty / share);
}

export interface ShareSummary {
  subtotal: Cents;
  tip: Cents;
  total: Cents;
}

export function computeShare(bill: Bill, claims: Claims): ShareSummary {
  const sub = bill.items.reduce((sum, item, idx) => sum + claimAmount(item, claims[idx]), 0);
  const tip = Math.round((sub * bill.tipPercent) / 100);
  return { subtotal: sub, tip, total: sub + tip };
}
