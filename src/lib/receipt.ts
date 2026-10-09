import type { BillItem } from "./bill";
import { parseMoney, type Cents } from "./money";

/** A recognized receipt line; ids are assigned when the bill is created. */
export type ReceiptItem = Omit<BillItem, "id">;

/** Result of reading a receipt photo, independent of the recognition engine. */
export interface ParsedReceipt {
  merchant: string;
  /** ISO date (YYYY-MM-DD) or empty. */
  date: string;
  currency: string;
  items: ReceiptItem[];
  /** Total of the purchased items printed on the receipt (before tip), if found; used to warn about missed lines. */
  total: Cents | null;
  /** Tip printed on the receipt, if any. */
  tip: Cents | null;
  engine: "ai" | "ocr";
}

/** What Claude is asked to do with a receipt photo (server and demo). */
export const RECEIPT_INSTRUCTIONS = `This is a photo of a restaurant or shop receipt. Extract every purchased line item so that a group can split the bill.

- One entry per receipt line. Keep the item name as printed, but remove quantity prefixes ("2x", "3 x") and unit-price annotations ("à 4,50", "@ 4.50") from the name.
- quantity is the number of units on the line. Receipts show it in many ways: "3 Bier 13,50", "3x Bier", "Bier 3 x 4,50 13,50", or a separate line like "3 x 4,50" above or below the item. If no quantity is shown, use 1.
- line_total is the price of the whole line (all units together). If only a unit price is printed, multiply it by the quantity.
- Include discounts, vouchers and deposit refunds as items with a negative line_total. Include service charges that are part of the total.
- Do not include subtotals, totals, taxes/VAT breakdowns, payment method lines, change given, or table/waiter/date information.
- A tip is not an item: put its amount in tip. Look for it carefully, it appears in several ways:
  - a printed or handwritten line such as "Trinkgeld", "Tip", "Tipp" or "Gratuity";
  - a handwritten new total next to or below the printed total (the tip is the difference);
  - a card or cash payment that is higher than the total without change given back, e.g. "Summe 36,50" and "Kartenzahlung 40,00" or "EC 40,00" means a tip of 3,50 (if "Rückgeld"/"Change" is printed, that difference is change, not tip).
  Use 0 only if none of these is present.
- receipt_total is the printed total of the purchased items before any tip, or 0 if not readable.
- Use a dot as decimal separator in numbers, regardless of how the receipt prints them.
- If the image is not a receipt or is unreadable, return an empty items list.`;

const PRICE = String.raw`-?\d{1,5}(?:[.,]\d{3})*[.,]\d{2}-?`;
/** Price at the end of a line, optionally followed by a VAT class letter ("A", "B", "1", "*"). */
const TRAILING_PRICE = new RegExp(String.raw`(${PRICE})\s*(?:€|EUR)?\s*(?:[A-D12*])?\s*$`, "i");
/** "2 x 4,50", "2x4.50", "2 * 4,50", "2 à 4,50", "2 @ 4,50" */
const QTY_TIMES_UNIT = new RegExp(String.raw`(\d{1,3})\s*(?:x|×|\*|à|a|@)\s*(${PRICE})`, "i");
/** Leading quantity: "2x Bier", "2 x Bier", "2 Bier" */
const LEADING_QTY = /^(\d{1,3})\s*(?:x|×|\*)?\s+(?=\D)/i;
/** Unit price annotation inside a name, e.g. "à 5,00" or "@ 5,00". */
const UNIT_PRICE = new RegExp(String.raw`(?:^|\s)(?:à|a|@|x|×|\*)\s*${PRICE}(?![\w])`, "gi");
/** A price standing on its own (not part of e.g. "0,25l"). */
const STANDALONE_PRICE = new RegExp(String.raw`(?<![\w.,])${PRICE}(?![\w.,])`, "g");

const TIP_WORDS = /\b(trinkgeld|tip|tipp|gratuity)\b/i;
const TOTAL_WORDS = /\b(summe|gesamt(?:betrag)?|total|zu zahlen|endbetrag|betrag)\b/i;
const SKIP_WORDS = new RegExp(
  [
    "zwischensumme", "subtotal", "mwst", "mw\\.?-?st", "ust", "umsatzsteuer", "steuer", "netto", "brutto",
    "tax", "vat", "bar\\b", "gegeben", "rückgeld", "rueckgeld", "wechselgeld", "change", "ec[- ]?karte",
    "kartenzahlung", "karte", "visa", "mastercard", "girocard", "maestro", "amex", "kredit", "saldo", "datum", "uhrzeit", "tisch", "bon[- ]?nr", "beleg", "kasse", "bediener",
    "rechnung(?:s)?[- ]?nr", "st\\.?-?nr", "steuernummer", "terminal", "tse", "transaktion", "signatur",
  ].join("|"),
  "i",
);

function cleanName(name: string): string {
  return name
    .replace(/[|_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.:*-]+|[\s.:*-]+$/g, "")
    .trim();
}

function findDate(text: string): string {
  const m = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  const day = Number(d);
  const month = Number(mo);
  if (day < 1 || day > 31 || month < 1 || month > 12) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Heuristic parser for raw OCR text of a (mostly German) restaurant receipt.
 * It is the offline fallback when the AI recognition is not configured; results
 * are always shown in an editor so the payer can correct them.
 */
export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items: ReceiptItem[] = [];
  let total: Cents | null = null;
  let tip: Cents | null = null;
  let pendingQty: number | null = null;
  let merchant = "";

  for (const line of lines) {
    // A line that only holds "2 x 4,50" belongs to the next item, which carries the line total.
    const quOnly = line.match(QTY_TIMES_UNIT);
    if (quOnly && cleanName(line.replace(quOnly[0], "")).length < 2) {
      pendingQty = Number(quOnly[1]);
      continue;
    }

    const priceMatch = line.match(TRAILING_PRICE);
    if (!priceMatch) {
      if (!merchant && items.length === 0 && /[A-Za-zÄÖÜäöü]{3,}/.test(line) && !SKIP_WORDS.test(line)) {
        merchant = cleanName(line);
      }
      continue;
    }

    const lineTotal = parseMoney(priceMatch[1]);
    if (lineTotal === null) continue;
    let rest = line.slice(0, priceMatch.index).trim();

    if (TIP_WORDS.test(rest)) {
      // "Gesamt inkl. Trinkgeld" is a grand total, not the tip itself.
      if (!TOTAL_WORDS.test(rest) && lineTotal > 0) tip = (tip ?? 0) + lineTotal;
      pendingQty = null;
      continue;
    }
    if (TOTAL_WORDS.test(rest) && !/zwischen/i.test(rest)) {
      if (total === null) total = lineTotal;
      pendingQty = null;
      continue;
    }
    if (SKIP_WORDS.test(rest)) {
      pendingQty = null;
      continue;
    }

    let qty = 1;
    const qu = rest.match(QTY_TIMES_UNIT);
    if (qu) {
      qty = Number(qu[1]);
      rest = rest.replace(qu[0], " ");
    } else {
      const lead = rest.match(LEADING_QTY);
      if (lead) {
        qty = Number(lead[1]);
        rest = rest.slice(lead[0].length);
      } else if (pendingQty !== null) {
        qty = pendingQty;
      }
    }
    pendingQty = null;

    // Strip unit prices and stray price columns left in the name.
    const name = cleanName(rest.replace(UNIT_PRICE, " ").replace(STANDALONE_PRICE, " "));
    if (name.length < 2 || !/[A-Za-zÄÖÜäöüß]/.test(name)) continue;

    items.push({ name, qty: Math.max(1, qty), total: lineTotal });
  }

  return { merchant, date: findDate(text), currency: "EUR", items, total, tip, engine: "ocr" };
}
