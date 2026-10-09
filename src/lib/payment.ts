import { centsToDecimal, type Cents } from "./money";
import type { PaymentInfo } from "./bill";

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
