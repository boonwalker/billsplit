import { centsToDecimal, type Cents } from "./money";
import type { PaymentInfo } from "./bill";
import type { Profile } from "./storage";

/**
 * Extracts a PayPal.Me username from user input. Accepts the plain name,
 * "paypal.me/name", "https://www.paypal.com/paypalme/name" or "@name".
 */
export function normalizePaypalMe(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^paypal\.me\//i, "").replace(/^paypal\.com\/paypalme\//i, "");
  s = s.replace(/^@/, "");
  s = s.split(/[/?#]/)[0];
  return s.replace(/[^A-Za-z0-9._-]/g, "");
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/**
 * PayPal.Me link with recipient and amount preset. On phones with the PayPal app
 * installed it opens the app; after logging in, the friend lands on the prefilled
 * "send money" step and only has to confirm.
 */
export function paypalMeLink(user: string, amount: Cents, currency = "EUR"): string {
  const name = encodeURIComponent(normalizePaypalMe(user));
  if (amount <= 0) return `https://www.paypal.com/paypalme/${name}`;
  return `https://www.paypal.com/paypalme/${name}/${centsToDecimal(amount)}${currency}`;
}

/** PayPal's generic "send money" page, used when only an e-mail address is known. */
export const PAYPAL_SEND_URL = "https://www.paypal.com/myaccount/transfer/homepage/pay";

export type PayAction =
  | { kind: "paypalMe"; url: string }
  | { kind: "email"; url: string; email: string }
  | { kind: "none" };

/** Combines the recipient from the bill with the friend's individual amount. */
export function payAction(payment: PaymentInfo, amount: Cents, currency: string): PayAction {
  if (payment.paypalMe) return { kind: "paypalMe", url: paypalMeLink(payment.paypalMe, amount, currency) };
  if (payment.paypalEmail) return { kind: "email", url: PAYPAL_SEND_URL, email: payment.paypalEmail };
  return { kind: "none" };
}

/** IBAN as typed (with spaces, lower case) → compact upper-case form. */
export function normalizeIban(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** Checks country code, length and the ISO 13616 check digits (mod 97). */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00". */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}

/** Wero is registered with a mobile number or an e-mail address. */
export function isValidWero(input: string): boolean {
  const s = input.trim();
  return isValidEmail(s) || /^\+?[\d\s/()-]{7,20}$/.test(s);
}

/** The payment details of the profile, as they go into a new bill. */
export function paymentFromProfile(p: Profile): PaymentInfo {
  return {
    paypalMe: p.paypalMe || undefined,
    paypalEmail: p.paypalEmail || undefined,
    iban: p.iban ? normalizeIban(p.iban) : undefined,
    holder: p.iban ? p.holder?.trim() || p.name.trim() || undefined : undefined,
    wero: p.wero?.trim() || undefined,
  };
}

export function samePayment(a: PaymentInfo, b: PaymentInfo): boolean {
  return a.paypalMe === b.paypalMe && a.paypalEmail === b.paypalEmail && a.iban === b.iban && a.holder === b.holder && a.wero === b.wero;
}

/** Ways to pay besides PayPal that the bill offers, in the order they are shown. */
export type OtherMethod = "bank" | "wero";
export function otherMethods(payment: PaymentInfo): OtherMethod[] {
  return [...(payment.iban ? (["bank"] as const) : []), ...(payment.wero ? (["wero"] as const) : [])];
}
