import type { Cents } from "./money";

export interface BillItem {
  /** Stable id, so claims survive when the payer edits the bill later. */
  id: string;
  name: string;
  /** Number of units on the receipt line, e.g. 3 for "3x Bier". */
  qty: number;
  /** Total price of the whole line in cents (qty × unit price). */
  total: Cents;
}

/** A fee on the bill (delivery, service, …). Fees are shared equally per person, like the tip. */
export interface BillFee {
  id: string;
  name: string;
  /** Amount in cents; negative for a discount on the fees. */
  amount: Cents;
}

/** Where friends send their money to. */
export interface PaymentInfo {
  /** PayPal.Me name – the only PayPal link type that presets recipient and amount. */
  paypalMe?: string;
  /** PayPal e-mail address, shown as fallback for a manual transfer. */
  paypalEmail?: string;
}

/** The bill itself as recognized from the receipt and reviewed by the payer. */
export interface BillData {
  title: string;
  /** ISO date (YYYY-MM-DD) or empty. */
  date: string;
  currency: string;
  /** Tip in percent of the bill. Ignored when `tipAmount` is set. */
  tipPercent: number;
  /** Tip as a fixed amount (from the receipt or entered by the payer). */
  tipAmount?: Cents;
  /**
   * Number of people (payer included) that tip and fees are split among, as expected by the payer.
   * Without it, everyone who joined the bill counts; with it, people who scan late are covered.
   */
  tipSplitCount?: number;
  /** Delivery, service and similar fees – split equally per person. */
  fees?: BillFee[];
  items: BillItem[];
  payment: PaymentInfo;
}

/** Units a participant took, per item id. */
export type ItemClaims = Record<string, number>;

/** What every participant sees about the others: who took what. */
export interface PublicParticipant {
  id: string;
  name: string;
  isOwner: boolean;
  claims: ItemClaims;
}

/** What only the payer sees about a friend. */
export interface Debtor {
  id: string;
  name: string;
  joinedAt: string;
  /** Current share according to the claims, including tip and fees. */
  amount: Cents;
  /** Set when the friend tapped "Bezahlen"; the amount at that moment. */
  payClickedAt?: string;
  payAmount?: Cents;
  /** The payer confirmed the money arrived on PayPal. */
  received: boolean;
}

export interface BillSnapshot {
  id: string;
  createdAt: string;
  data: BillData;
  ownerName: string;
  participants: PublicParticipant[];
  /** Participant id of the requesting device, if it joined. */
  me: string | null;
  isOwner: boolean;
  /** Payment status of the friends – only included for the payer. */
  debtors?: Debtor[];
  /** Pay click of the requesting participant. */
  myPayment?: { at: string; amount: Cents };
}

export interface ShareSummary {
  /** Claimed items. */
  subtotal: Cents;
  /** This person's part of tip and fees. */
  shared: Cents;
  total: Cents;
}

export function subtotal(items: BillItem[]): Cents {
  return items.reduce((sum, it) => sum + it.total, 0);
}

/** The whole tip in cents. */
export function tipTotal(data: BillData): Cents {
  if (data.tipAmount !== undefined && data.tipAmount > 0) return data.tipAmount;
  return Math.round((subtotal(data.items) * data.tipPercent) / 100);
}

export function feesTotal(data: BillData): Cents {
  return (data.fees ?? []).reduce((sum, f) => sum + f.amount, 0);
}

/** Costs that everyone shares equally: tip plus fees. */
export function sharedTotal(data: BillData): Cents {
  return tipTotal(data) + feesTotal(data);
}

export function billTotal(data: BillData): Cents {
  return subtotal(data.items) + sharedTotal(data);
}

/**
 * People tip and fees are split among: everyone who joined (payer included), or the
 * payer's expected head count while people are still missing.
 */
export function splitHeadCount(data: BillData, participants: PublicParticipant[]): number {
  return Math.max(1, participants.length, data.tipSplitCount ?? 0);
}

/** Every person pays the same part of tip and fees. */
export function sharedPerPerson(data: BillData, participants: PublicParticipant[]): Cents {
  return Math.round(sharedTotal(data) / splitHeadCount(data, participants));
}

export function hasTip(data: BillData): boolean {
  return (data.tipAmount ?? 0) > 0 || data.tipPercent > 0;
}

/** Units of an item claimed by all participants together. */
export function claimedUnits(itemId: string, participants: PublicParticipant[]): number {
  return participants.reduce((sum, p) => sum + (p.claims[itemId] ?? 0), 0);
}

/** An item is fully assigned once at least as many units as on the receipt are claimed. */
export function isFullyAssigned(item: BillItem, participants: PublicParticipant[]): boolean {
  return claimedUnits(item.id, participants) >= item.qty;
}

/**
 * Price of the units one participant claimed. If more units are claimed than the
 * line has (several people tick the same pizza), the line is shared: everyone pays
 * proportionally, so the line is never charged more than once in total.
 */
export function claimCost(item: BillItem, units: number, totalUnits: number): Cents {
  if (units <= 0) return 0;
  return Math.round((item.total * units) / Math.max(item.qty, totalUnits));
}

export function participantShare(data: BillData, participants: PublicParticipant[], participantId: string): ShareSummary {
  const me = participants.find((p) => p.id === participantId);
  if (!me) return { subtotal: 0, shared: 0, total: 0 };
  const sub = data.items.reduce(
    (sum, item) => sum + claimCost(item, me.claims[item.id] ?? 0, claimedUnits(item.id, participants)),
    0,
  );
  const shared = sharedPerPerson(data, participants);
  return { subtotal: sub, shared, total: sub + shared };
}

/** Value of all units nobody has claimed yet, plus the tip and fee parts of people who have not joined yet. */
export function unassignedAmount(data: BillData, participants: PublicParticipant[]): Cents {
  const sub = data.items.reduce((sum, item) => {
    const open = Math.max(0, item.qty - claimedUnits(item.id, participants));
    return sum + Math.round((item.total * open) / item.qty);
  }, 0);
  const missingPeople = splitHeadCount(data, participants) - participants.length;
  return sub + missingPeople * sharedPerPerson(data, participants);
}

/** Drops claims for removed items and clamps units to the item quantity. */
export function sanitizeClaims(claims: ItemClaims, items: BillItem[]): ItemClaims {
  const out: ItemClaims = {};
  for (const item of items) {
    const units = Math.floor(Number(claims[item.id] ?? 0));
    if (units > 0) out[item.id] = Math.min(units, item.qty);
  }
  return out;
}

/** Link that is encoded in the QR code. The recipient is part of it, too. */
export function billUrl(id: string, base: string, payment?: PaymentInfo): string {
  const root = base.replace(/#.*$/, "");
  const to = payment?.paypalMe || payment?.paypalEmail;
  return `${root}#/b/${id}${to ? `?to=${encodeURIComponent(to)}` : ""}`;
}

/** Extracts the bill id from a scanned QR code / link, or null if it is not a billsplit link. */
export function billIdFromUrl(text: string): string | null {
  const m = text.match(/#\/b\/([A-Za-z0-9_-]{6,40})/);
  return m ? m[1] : null;
}

let idCounter = 0;
export function newItemId(): string {
  idCounter = (idCounter + 1) % 1296;
  return Date.now().toString(36).slice(-5) + idCounter.toString(36).padStart(2, "0") + Math.random().toString(36).slice(2, 5);
}
