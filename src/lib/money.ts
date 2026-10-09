/** All amounts are stored as integer minor units (cents) to avoid float errors. */
export type Cents = number;

export function formatMoney(cents: Cents, currency = "EUR"): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

/**
 * Parses user or OCR input like "12,50", "12.50", "1.234,50", "-3,00" or "12" into cents.
 * Returns null when the input is not a number.
 */
export function parseMoney(input: string): Cents | null {
  let s = input.trim().replace(/\s/g, "").replace(/[€$£]|EUR/gi, "");
  if (!s) return null;
  const negative = s.startsWith("-") || s.endsWith("-");
  s = s.replace(/^-|-$/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const decimalIdx = Math.max(lastComma, lastDot);
  // A single separator followed by exactly three digits is a thousands separator ("1.234").
  const isThousandsOnly = decimalIdx >= 0 && s.length - decimalIdx - 1 === 3 && !/[.,].*[.,]/.test(s);
  let normalized: string;
  if (decimalIdx < 0 || isThousandsOnly) {
    normalized = s.replace(/[.,]/g, "");
  } else {
    normalized = s.slice(0, decimalIdx).replace(/[.,]/g, "") + "." + s.slice(decimalIdx + 1);
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const cents = Math.round(parseFloat(normalized) * 100);
  return negative ? -cents : cents;
}

/** Formats cents for an input field, e.g. 1250 -> "12,50". */
export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Formats cents with a dot decimal separator, as payment providers expect, e.g. 1250 -> "12.50". */
export function centsToDecimal(cents: Cents): string {
  return (cents / 100).toFixed(2);
}
