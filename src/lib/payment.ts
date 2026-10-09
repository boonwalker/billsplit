import { centsToDecimal, type Cents } from "./money";

/**
 * Extracts a PayPal.me username from user input. Accepts the plain name,
 * "paypal.me/name", "https://www.paypal.com/paypalme/name" or "@name".
 */
export function normalizePaypalUser(input: string): string {
  let s = input.trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^paypal\.me\//i, "").replace(/^paypal\.com\/paypalme\//i, "");
  s = s.replace(/^@/, "");
  s = s.split(/[/?#]/)[0];
  return s.replace(/[^A-Za-z0-9._-]/g, "");
}

/**
 * Builds a PayPal.me link with recipient and amount preset. On phones with the
 * PayPal app installed the link opens the app directly.
 */
export function paypalLink(user: string, amount: Cents, currency = "EUR"): string {
  const name = encodeURIComponent(normalizePaypalUser(user));
  if (amount <= 0) return `https://www.paypal.com/paypalme/${name}`;
  return `https://www.paypal.com/paypalme/${name}/${centsToDecimal(amount)}${currency}`;
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})/g, "$1 ").trim();
}

/** Validates an IBAN via its ISO 13616 mod-97 checksum. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
