import type { BillItem } from "./bill";
import { parseMoney, type Cents } from "./money";

/**
 * A recognized receipt line; ids are assigned when the bill is created. personal: probably
 * not a shared expense (household, hygiene, pantry staples) – such lines are offered first
 * for crossing out on supermarket receipts.
 */
export type ReceiptItem = Omit<BillItem, "id"> & { personal?: boolean };

/** Result of reading a receipt photo, independent of the recognition engine. */
export interface ParsedReceipt {
  merchant: string;
  /** ISO date (YYYY-MM-DD) or empty. */
  date: string;
  currency: string;
  items: ReceiptItem[];
  /** Printed total including fees but before tip, if found; used to warn about missed lines. */
  total: Cents | null;
  /** Tip printed on the receipt, if any. */
  tip: Cents | null;
  /** Delivery, service and similar fees – shared per person, not items. */
  fees: ReceiptFee[];
  /** A delivery or takeaway order (ordered together, not a restaurant visit). */
  delivery: boolean;
  /** A supermarket, grocery or drugstore purchase (judged by shop name and products). */
  supermarket: boolean;
  engine: "ai" | "ocr";
}

export interface ReceiptFee {
  name: string;
  /** Cents; negative for a discount on the fees (e.g. free delivery). */
  amount: Cents;
}

/** What Claude is asked to do with a receipt photo (server and demo). */
export const RECEIPT_INSTRUCTIONS = `This is a photo of a restaurant or shop receipt, or a screenshot of a digital receipt or invoice (e.g. from an app, a delivery service or an e-mail). Extract every purchased line item so that a group can split the bill.

- One entry per receipt line. Keep the item name as printed, but remove quantity prefixes ("2x", "3 x") and unit-price annotations ("à 4,50", "@ 4.50") from the name.
- quantity is the number of units on the line. Receipts show it in many ways: "3 Bier 13,50", "3x Bier", "Bier 3 x 4,50 13,50", or a separate line like "3 x 4,50" above or below the item. If no quantity is shown, use 1.
- line_total is the price of the whole line (all units together). If only a unit price is printed, multiply it by the quantity.
- Lines that describe options, extras or ingredients of an item (often indented, smaller or greyed out, e.g. "Deine Zutat: Hähnchenfleisch +2,00", "Extra Käse +1,00", "mit Pommes") are not separate items. Their price is usually already included in the item's line total; only add it to the item if the printed line total clearly excludes it. Decide this with the total check below.
- A discount that belongs to one item (printed directly under it) is an item with a negative line_total. A discount on the whole order (e.g. "Rabatte", "Rabatt", "Gutschein", "Promo", "Rabattcode") goes into fees with a negative amount, together with deposit refunds that are not tied to an item.
- Fees are not items: delivery fees, service fees, small-order surcharges, packaging or bag fees and restaurant service charges (e.g. "Liefergebühr", "Lieferkosten", "Servicegebühr", "Service fee", "Bedienungszuschlag", "Mindestbestellwert-Zuschlag", "Verpackung") go into fees, each with its name as printed and its amount. A discount on a fee (e.g. "Gratis Lieferung -2,99") is a fee with a negative amount.
- Do not include subtotals, totals, taxes/VAT breakdowns, payment method lines, change given, or table/waiter/date information.
- A tip is not an item: put its amount in tip. Look for it carefully, it appears in several ways:
  - a printed or handwritten line such as "Trinkgeld", "Tip", "Tipp" or "Gratuity";
  - a handwritten new total next to or below the printed total (the tip is the difference);
  - a card or cash payment that is higher than the total without change given back, e.g. "Summe 36,50" and "Kartenzahlung 40,00" or "EC 40,00" means a tip of 3,50 (if "Rückgeld"/"Change" is printed, that difference is change, not tip).
  Use 0 only if none of these is present.
- receipt_total is the printed total including fees but before any tip (if the printed total already contains a tip, subtract it), or 0 if not readable.
- For each item, personal is true if it is most likely NOT part of a shared purchase (e.g. food for a meal or party together) but something one person keeps for their household: hygiene and drugstore products (shower gel, soap, shampoo, toothpaste, deodorant), household goods (toilet paper, kitchen roll, detergent, dish soap, bin bags, batteries) and pantry staples that last longer than one occasion (milk, spices, salt, pepper, oil, vinegar, flour, sugar, coffee, tea). Use brand names to decide (e.g. Balea, Nivea, Zewa, Hakle, Persil). False for everything else.
- supermarket is true for a purchase in a supermarket, discounter, grocery store, organic market, drugstore or similar shop (e.g. REWE, EDEKA, Aldi, Lidl, Penny, Netto, Kaufland, Norma, Globus, Real, Tegut, Alnatura, denn's, dm, Rossmann, Müller, Spar, Billa, Migros, Coop, Tesco, Carrefour, or a grocery delivery service). Judge by the shop name and by the products (groceries, household goods, deposit "Pfand" lines, prices per kg). It is false for restaurants, cafés, bars, food delivery and other shops.
- delivery is true for a food delivery or takeaway order (delivery app or website such as Lieferando, Wolt or Uber Eats, delivery address, delivery fee), false for a bill from a visit to a restaurant or shop.
- Use a dot as decimal separator in numbers, regardless of how the receipt prints them.
- Total check (do this before answering): add up all line_total values and all fee amounts. The result must equal receipt_total. If it does not, re-read the receipt and fix the cause – a sub-line price counted twice, a missed line, a discount, or a misread digit.
- In screenshots, ignore app interface elements such as buttons, navigation, ads and order status texts.
- If the image is not a receipt or is unreadable, return an empty items list.`;

/** Sum of items and fees, which must match the printed total (before tip). */
export function receiptSum(r: Pick<ParsedReceipt, "items" | "fees">): Cents {
  return r.items.reduce((sum, i) => sum + i.total, 0) + r.fees.reduce((sum, f) => sum + f.amount, 0);
}

/** True when the lines add up to the printed total, or when there is no total to check against. */
export function sumsMatch(r: ParsedReceipt): boolean {
  return r.total === null || r.total === receiptSum(r);
}

const dec = (cents: Cents) => (cents / 100).toFixed(2);

/** Feedback for a second reading when the lines do not add up to the printed total. */
export function reconcileHint(r: ParsedReceipt): string {
  const lines = [
    ...r.items.map((i) => `- ${i.qty} x ${i.name}: ${dec(i.total)}`),
    ...r.fees.map((f) => `- fee ${f.name}: ${dec(f.amount)}`),
  ].join("\n");
  return `A first reading of this receipt returned these lines:
${lines}
They add up to ${dec(receiptSum(r))}, but the printed total (before tip) is ${dec(r.total ?? 0)} – a difference of ${dec(receiptSum(r) - (r.total ?? 0))}.
Re-read the receipt and find the cause before answering: option, extra or ingredient sub-lines whose price is already included in the item's line total (often indented or greyed out) must not be counted again; also check for missed lines, discounts, fees and misread digits. Return the complete corrected result.`;
}

/**
 * Reads a receipt and checks the arithmetic: if items and fees do not add up to the
 * printed total, the receipt is read a second time with a hint about the difference.
 * Returns whichever reading fits the total better.
 */
export async function readWithSumCheck(read: (hint?: string) => Promise<ParsedReceipt>): Promise<ParsedReceipt> {
  const first = await read();
  if (first.items.length === 0 || sumsMatch(first)) return first;
  let second: ParsedReceipt;
  try {
    second = await read(reconcileHint(first));
  } catch {
    return first;
  }
  if (second.items.length === 0) return first;
  const off = (r: ParsedReceipt) => Math.abs(receiptSum(r) - (r.total ?? 0));
  return off(second) <= off(first) ? second : first;
}

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

/** Supermarket chains and typical grocery receipt lines, for the OCR fallback. */
const SUPERMARKET_WORDS =
  /\b(rewe|edeka|aldi|lidl|penny|netto|kaufland|norma|globus|tegut|alnatura|denn'?s|rossmann|dm-?drogerie|drogerie|spar|billa|migros|coop|tesco|carrefour|supermarkt|pfand|leergut)\b/i;

const FEE_WORDS = /(liefergeb|lieferkosten|lieferpauschale|liefer\w*zuschlag|servicegeb|service ?fee|delivery|bedienungszuschlag|bearbeitungsgeb|mindestbestell|kleinbestell|verpackung|tütengeb)/i;
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
  const fees: ReceiptFee[] = [];
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

    if (FEE_WORDS.test(rest) && !TOTAL_WORDS.test(rest)) {
      fees.push({ name: cleanName(rest) || "Gebühr", amount: lineTotal });
      pendingQty = null;
      continue;
    }
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

  const delivery = fees.length > 0 && /liefer|delivery|lieferando|wolt|uber ?eats/i.test(text);
  const supermarket = SUPERMARKET_WORDS.test(text);
  return { merchant, date: findDate(text), currency: "EUR", items, total, tip, fees, delivery, supermarket, engine: "ocr" };
}
