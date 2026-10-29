import type { Msg } from "../i18n";
import type { Cents } from "./money";

export interface BillItem {
  /** Stable id, so claims survive when the payer edits the bill later. */
  id: string;
  name: string;
  /** Number of units on the receipt line, e.g. 3 for "3x Bier". */
  qty: number;
  /** Total price of the whole line in cents (qty × unit price); after a division the billed part. */
  total: Cents;
  /** Set when the payer divided the line (tapped it in the supermarket view): the price on the receipt … */
  fullTotal?: Cents;
  /** … and the divisor; only total / divisor is billed. */
  divisor?: number;
  /** Crossed out by the payer: stays visible on the receipt, but is not billed. */
  excluded?: boolean;
  /** Some of the units crossed out by the payer (1 … qty − 1): only the rest is billed. */
  struck?: number;
  /** Supermarket, "Alles aufteilen": probably not a shared expense – listed first for the payer, ready to cross out. */
  maybePersonal?: boolean;
  /**
   * Equal split: the payer gave the line to these people (long press, "Wer hatte das?") – they
   * share it alone, the rest of the bill is split equally (see lineFor). Ignored with ticking.
   */
  for?: string[];
}

/** A fee on the bill (delivery, service, …). Fees are shared equally per person, like the tip. */
export interface BillFee {
  id: string;
  name: string;
  /** Amount in cents; negative for a discount on the fees. */
  amount: Cents;
  /** Crossed out by the payer: stays visible, but is not billed. */
  excluded?: boolean;
}

/** Where friends send their money to. */
export interface PaymentInfo {
  /** PayPal.Me name – the only PayPal link type that presets recipient and amount. */
  paypalMe?: string;
  /** PayPal e-mail address, shown as fallback for a manual transfer. */
  paypalEmail?: string;
  /** Bank transfer (any bank, e.g. Trade Republic): IBAN without spaces and the account holder. */
  iban?: string;
  holder?: string;
  /** Wero: the mobile number or e-mail address the payer's Wero is registered with. */
  wero?: string;
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
  /** The payer crossed the tip out: it stays visible on the receipt, but is not billed. */
  tipExcluded?: boolean;
  /**
   * The tip follows what everyone had: it raises every item by the same percentage (see
   * itemShare). Set for every bill since 16.10.2026; older bills keep their tip per head.
   */
  tipByShare?: boolean;
  /**
   * A discount that belongs to a fee ("Lieferrabatt" → "Lieferung") takes that fee back first;
   * what is left of the fee is shared per head, only a discount beyond it lowers the items (see
   * feeSplit). Set for every bill since 29.10.2026; older bills keep their discounts on the items.
   */
  feeOffsets?: boolean;
  /**
   * Number of people (payer included) that tip and fees are split among, as expected by the payer.
   * Without it, everyone who joined the bill counts; with it, people who scan late are covered.
   */
  tipSplitCount?: number;
  /** Delivery, service and similar fees – split equally per person. */
  fees?: BillFee[];
  /** Recognised as a supermarket purchase. */
  supermarket?: boolean;
  /** The payer answered "Manches nicht": some items are billed not or only partly. */
  partial?: boolean;
  /**
   * Equal split (e.g. a supermarket receipt): nobody ticks items, everyone pays the
   * same part of the whole bill, counted like tip and fees (splitHeadCount).
   */
  equalSplit?: boolean;
  /**
   * The payer paid for others and is not part of the split ("Ausgabe zuweisen": „Andy zahlt
   * 5,00 €“): only the other participants count as heads and the payer's own share is 0.
   * Applies to the equal split only; with ticking, the claims say who pays what.
   */
  ownerExcluded?: boolean;
  items: BillItem[];
  payment: PaymentInfo;
}

/**
 * Units a participant took, per item id: the indices of the item's units ("slots", 0 … qty-1)
 * in the order they were taken. People holding the same slot share that unit.
 */
export type ItemClaims = Record<string, number[]>;

/** Claims as sent by a client or found in older stored bills, where a claim was a plain unit count. */
export type ClaimsInput = Record<string, number | number[]>;

/** What every participant sees about the others: who took what. */
export interface PublicParticipant {
  id: string;
  name: string;
  isOwner: boolean;
  claims: ItemClaims;
  /**
   * Units (of those in claims) the participant wants to share: they count as split in
   * two even while nobody else has joined yet; the other half stays open until then.
   */
  splits?: ItemClaims;
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
  /** What was open when the payer confirmed it without a pay click (see PaidState). */
  receivedAmount?: Cents;
  /** Paid more than the share is now: what the payer owes them back. */
  refund?: Cents;
  /** The payer assigned them their part directly (see BillCore.assign). */
  assigned?: boolean;
  /** The friend marked their share as paid. */
  markedPaidAt?: string;
  /** Paid on top later, when their share grew after paying (see TopUp). */
  topUps?: TopUp[];
  /** Settled by settlement payments (see Transfer): confirmed by their recipient … */
  credited?: Cents;
  /** … and still waiting for that confirmation. */
  creditPending?: Cents;
  /** What those payments were, e.g. "4,00 € von Niklas an Katia gezahlt". */
  creditNotes?: Msg[];
  /** Notifications reach this friend ("Erinnern" sends one instead of opening WhatsApp). */
  reachable?: boolean;
  /** Last reminder sent as a notification. */
  remindedAt?: string;
}

/** What settlement payments (Transfer) covered of a share: confirmed, waiting, and what they were. */
export interface ShareCredit {
  confirmed: Cents;
  pending: Cents;
  /** What each payment was, in the reader's language (see tMsg). */
  notes: Msg[];
}

/**
 * Open part of a friend's share: the share, less what they settled in the bill (confirmed as
 * received by the payer: with the amount of their pay click, or all of it without one;
 * marked as paid by them: with the amount of their pay click), less what settlement payments
 * covered (confirmed or still waiting). Whatever was added to the share afterwards stays open.
 */
export function openShare(share: Cents, state: PaidState, credited: Cents = 0): Cents {
  return Math.max(0, share - settledInBill(share, state) - credited);
}

/**
 * A payment on top of one already made: the share grew after the friend had paid (e.g. ticked
 * one more beer), so the difference is paid – and confirmed by the payer – on its own.
 */
export interface TopUp {
  amount: Cents;
  payClickedAt: string;
  markedPaidAt?: string;
  received?: boolean;
}

/** How a friend settled their share in the bill itself (see openShare). */
export interface PaidState {
  received?: boolean;
  payAmount?: Cents;
  /** What was open when the payer ticked "erhalten" without a pay click before. */
  receivedAmount?: Cents;
  markedPaidAt?: string;
  topUps?: TopUp[];
}

/** Paid in the bill and marked or confirmed: the first payment (base) or a later top-up. */
export const isSettledPayment = (state: { received?: boolean; markedPaidAt?: string }) => Boolean(state.received || state.markedPaidAt);

/**
 * What a friend paid in the bill itself: the amount of their pay click, or what was open when it
 * was confirmed – plus the top-ups marked as paid or confirmed since.
 */
export function settledInBill(share: Cents, state: PaidState): Cents {
  const base = state.received ? (state.payAmount ?? state.receivedAmount ?? share) : state.markedPaidAt ? (state.payAmount ?? 0) : 0;
  return base + (state.topUps ?? []).filter(isSettledPayment).reduce((sum, t) => sum + t.amount, 0);
}

/**
 * What a friend paid beyond their share – when the payer crossed out or changed something
 * afterwards. The payer owes it back (see BillCore.refundOf).
 */
export function overpaidShare(share: Cents, state: PaidState, credited: Cents = 0): Cents {
  return Math.max(0, settledInBill(share, state) + credited - share);
}

/** One share a settlement payment covers: what `debtorId` owed `creditorId` (the payer) in a bill. */
export interface TransferAllocation {
  billId: string;
  debtorId: string;
  creditorId: string;
  amount: Cents;
}

export type TransferStatus = "pending" | "confirmed" | "rejected" | "cancelled";

/**
 * A settlement payment: `fromId` sends `amount` to `toId` (outside the app, e.g. via PayPal),
 * and that settles the listed shares in one or more bills – possibly shares between other
 * people too (Niklas pays Katia what he owed Andy, which settles Andy's debt with Katia).
 * For everyone involved the allocations add up to nothing gained or lost. Only the recipient
 * confirms it; until then it waits (and the shares count as being paid).
 */
export interface Transfer {
  id: string;
  createdAt: string;
  currency: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: Cents;
  allocations: (TransferAllocation & { billTitle: string; debtorName: string; creditorName: string })[];
  status: TransferStatus;
  decidedAt?: string;
  /** The recipient recorded it (money that arrived outside the app); it was confirmed right away. */
  recordedByRecipient?: boolean;
}

/** Settlement payments as seen by one device, with that device's participant id. */
export interface TransferList {
  me: string;
  transfers: Transfer[];
}

/** A table of a restaurant (restaurant mode): its QR code leads to the bill open at it. */
export interface VenueTable {
  id: string;
  name: string;
  billId: string | null;
  openedAt?: string;
}

/** A restaurant with its tables, as its owner sees it. */
export interface Venue {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  tables: VenueTable[];
}

/** What a guest's QR code scan learns about a table (no bill open: the page waits for one). */
export interface TableInfo {
  venue: string;
  table: string;
  billId: string | null;
}

/** A bill a device takes part in (to rebuild the list of bills on a new device). */
export interface MyBill {
  id: string;
  title: string;
  createdAt: string;
  role: "owner" | "guest";
  currency: string;
}

/** An open share between two people in a bill the viewer takes part in (for settling up). */
/** Someone I shared bills with (see BillCore.contacts): "Ausgabe zuweisen" can assign them an expense directly. */
export interface Contact {
  /** Their participant id (the same in all bills from their device). */
  id: string;
  name: string;
  /** Bills we share. */
  bills: number;
  /** When the newest of them was created. */
  lastAt: string;
}

export interface NetworkEdge {
  billId: string;
  title: string;
  createdAt: string;
  currency: string;
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amount: Cents;
  /** How the creditor (payer of that bill) wants to be paid. */
  payment: PaymentInfo;
}

/**
 * Someone made a friend's share smaller after the friend had paid. "shared": another guest ticked
 * units the friend had (the friend can take them back: "Stimmt nicht?") · "changed": anything else
 * (the payer edited the bill or gave a line to someone).
 */
export interface ShareChange {
  at: string;
  byId: string;
  byName: string;
  items: { id: string; name: string }[];
  kind: "shared" | "changed";
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
  /** Pay click of the requesting participant; markedPaidAt once they marked it as paid. */
  myPayment?: { at: string; amount: Cents; markedPaidAt?: string };
  /** The payer confirmed this participant's share as received (also when it was offset against another bill). */
  myReceived?: boolean;
  /** What was open when the payer confirmed my share without a pay click (see PaidState). */
  myReceivedAmount?: Cents;
  /** My payments on top after my share grew (see TopUp). */
  myTopUps?: TopUp[];
  /** What settlement payments covered of this participant's share. */
  myCredit?: ShareCredit;
  /** Paid more than my share is now (the payer changed the bill): what the payer owes me back. */
  myRefund?: Cents;
  /** What made my share smaller after I had paid (shown with myRefund). */
  myShareChange?: ShareChange;
  /** The photo or screenshot the bill was read from is stored and can be viewed. */
  hasReceiptImage?: boolean;
  /** How many people of this bill have the app open right now (anywhere in the app). */
  online?: number;
}

export interface ShareSummary {
  /** Claimed items. */
  subtotal: Cents;
  /** This person's part of tip and fees (per head) and of discounts (by the value of their items). */
  shared: Cents;
  total: Cents;
}

/** A line as it is billed: with units crossed out, only the remaining ones at their share of the price. */
export function billedItem(item: BillItem): BillItem {
  const struck = Math.min(item.qty - 1, item.struck ?? 0);
  if (struck <= 0) return item;
  const qty = item.qty - struck;
  const rest = { ...item, qty, total: Math.round((item.total * qty) / item.qty) };
  delete rest.struck;
  return rest;
}

/** The lines that are actually billed (crossed-out ones are left out, partly crossed-out ones reduced). */
export function billedItems(data: Pick<BillData, "items">): BillItem[] {
  return data.items.filter((item) => !item.excluded).map(billedItem);
}

export function subtotal(items: BillItem[]): Cents {
  return items.reduce((sum, it) => sum + it.total, 0);
}

/** The whole tip in cents. */
/** The tip as it stands on the receipt (also when the payer crossed it out). */
export function tipOnReceipt(data: BillData): Cents {
  if (data.tipAmount !== undefined && data.tipAmount > 0) return data.tipAmount;
  return Math.round((subtotal(billedItems(data)) * data.tipPercent) / 100);
}

/** The tip that is billed. */
export function tipTotal(data: BillData): Cents {
  return data.tipExcluded ? 0 : tipOnReceipt(data);
}

/** Fees that are billed (crossed-out ones are left out). */
export function feesTotal(data: BillData): Cents {
  return (data.fees ?? []).reduce((sum, f) => sum + (f.excluded ? 0 : f.amount), 0);
}

/** Kinds of fees a discount can take back – by the words in their names (German, English, Spanish). */
const FEE_KINDS = [
  /liefer|versand|zustell|porto|deliver|shipping|env[ií]o|entrega|domicilio/i,
  /service|servicio|bearbeitung|handling|plattform|platform/i,
  /verpackung|packaging|embalaje|t[üu]te|bag|bolsa/i,
  /mindestbestell|kleinbestell|small order|minimum order|pedido m[ií]nimo/i,
];
const feeKind = (name: string) => FEE_KINDS.findIndex((kind) => kind.test(name));

/** A discount that took back (part of) a fee (see feeSplit). */
export interface FeeOffset {
  discount: BillFee;
  fee: BillFee;
  /** How much of the fee it took back (cents, above zero). */
  amount: Cents;
}

/**
 * How the fees are split. Fees above zero (delivery, service, …) are shared per head like the
 * tip; discounts (fees below zero, e.g. "Rabatt -5,00") lower the items in proportion to their
 * price – split per head, someone with a small order would end up below zero. With feeOffsets a
 * discount of the same kind as a fee ("Lieferrabatt", "Lieferung") – or, without a kind, of
 * exactly its amount – takes that fee back first: a free delivery is no cost at all, a part of
 * it leaves the rest per head, and only what goes beyond the fee lowers the items.
 */
export function feeSplit(data: Pick<BillData, "fees" | "feeOffsets">): { perHead: Cents; discount: Cents; offsets: FeeOffset[] } {
  const billed = (data.fees ?? []).filter((f) => !f.excluded);
  const left = new Map(billed.filter((f) => f.amount > 0).map((f) => [f, f.amount]));
  let discount = 0;
  const offsets: FeeOffset[] = [];
  for (const d of billed.filter((f) => f.amount < 0)) {
    let rest = -d.amount;
    if (data.feeOffsets) {
      const kind = feeKind(d.name);
      const open = [...left].filter(([, amount]) => amount > 0).map(([fee]) => fee);
      const fee = kind >= 0 ? open.find((f) => feeKind(f.name) === kind) : open.find((f) => left.get(f) === rest);
      if (fee) {
        const taken = Math.min(rest, left.get(fee)!);
        left.set(fee, left.get(fee)! - taken);
        offsets.push({ discount: d, fee, amount: taken });
        rest -= taken;
      }
    }
    discount -= rest;
  }
  return { perHead: [...left.values()].reduce((sum, amount) => sum + amount, 0), discount, offsets };
}

/** Fees shared per head (see feeSplit). */
export function perHeadFees(data: BillData): Cents {
  return feeSplit(data).perHead;
}

/** Discounts that lower the items in proportion to their price (see feeSplit). */
export function discountTotal(data: BillData): Cents {
  return feeSplit(data).discount;
}

/** The part of the discounts that falls on items worth `items` cents. */
export function discountShare(data: BillData, items: Cents): Cents {
  const discount = discountTotal(data);
  const all = subtotal(billedItems(data));
  return discount && all > 0 ? Math.round((discount * items) / all) : 0;
}

/**
 * The part of discounts – and of the tip (tipByShare) – that falls on items worth `items` cents:
 * both change every item by the same percentage, so whoever had more pays more tip and saves more.
 */
export function itemShare(data: BillData, items: Cents): Cents {
  const byValue = discountTotal(data) + (data.tipByShare ? tipTotal(data) : 0);
  const all = subtotal(billedItems(data));
  return byValue && all > 0 ? Math.round((byValue * items) / all) : 0;
}

/** The tip split per head – only on bills from before 16.10.2026 (see tipByShare). */
export function tipPerHead(data: BillData): Cents {
  return data.tipByShare ? 0 : tipTotal(data);
}

/** Costs that everyone shares equally: fees above zero (and the tip on older bills, see tipPerHead). */
export function sharedTotal(data: BillData): Cents {
  return tipPerHead(data) + perHeadFees(data);
}

export function billTotal(data: BillData): Cents {
  return subtotal(billedItems(data)) + tipTotal(data) + feesTotal(data);
}

/**
 * People tip and fees are split among: everyone who joined (payer included), or the
 * payer's expected head count while people are still missing.
 */
export function splitHeadCount(data: BillData, participants: PublicParticipant[]): number {
  return Math.max(1, splitPeople(data, participants).length, data.tipSplitCount ?? 0);
}

/** The participants the bill is split among: everyone, or in an equal split without the payer everyone else. */
export function splitPeople(data: BillData, participants: PublicParticipant[]): PublicParticipant[] {
  return data.equalSplit && data.ownerExcluded ? participants.filter((p) => !p.isOwner) : participants;
}

/** Every person pays the same part of tip and fees. */
export function sharedPerPerson(data: BillData, participants: PublicParticipant[]): Cents {
  return Math.round(sharedTotal(data) / splitHeadCount(data, participants));
}

export function hasTip(data: BillData): boolean {
  return (data.tipAmount ?? 0) > 0 || data.tipPercent > 0;
}

/** Slot index → ids of everyone holding that unit of the item. */
export function slotHolders(itemId: string, participants: PublicParticipant[]): Map<number, string[]> {
  const holders = new Map<number, string[]>();
  for (const p of participants) {
    for (const slot of p.claims[itemId] ?? []) holders.set(slot, [...(holders.get(slot) ?? []), p.id]);
  }
  return holders;
}

/** True when one of the unit's holders offered it for sharing. */
export function isSplitOffered(itemId: string, slot: number, participants: PublicParticipant[]): boolean {
  return participants.some((p) => (p.claims[itemId] ?? []).includes(slot) && (p.splits?.[itemId] ?? []).includes(slot));
}

/** Into how many parts a unit is split: one per holder, but at least two once it was offered for sharing. */
export function slotParts(itemId: string, slot: number, participants: PublicParticipant[], holders = slotHolders(itemId, participants)): number {
  const count = holders.get(slot)?.length ?? 0;
  return Math.max(count, isSplitOffered(itemId, slot, participants) ? 2 : 1);
}

/** Units of an item that are paid for by someone (a unit waiting for a second sharer counts half). */
export function assignedUnits(item: BillItem, participants: PublicParticipant[]): number {
  const holders = slotHolders(item.id, participants);
  let sum = 0;
  for (const [slot, ids] of holders) {
    if (slot < item.qty) sum += ids.length / slotParts(item.id, slot, participants, holders);
  }
  return sum;
}

/** An item is fully assigned once every unit is completely paid for. */
export function isFullyAssigned(item: BillItem, participants: PublicParticipant[]): boolean {
  return assignedUnits(item, participants) >= item.qty - 1e-9;
}

/** Units of an item one participant pays for; a unit split in n parts counts 1/n. */
export function unitShare(item: BillItem, participants: PublicParticipant[], participantId: string): number {
  const me = participants.find((p) => p.id === participantId);
  const holders = slotHolders(item.id, participants);
  return (me?.claims[item.id] ?? []).reduce((sum, slot) => sum + 1 / slotParts(item.id, slot, participants, holders), 0);
}

/** Price of a (possibly fractional) number of units of an item. */
export function claimCost(item: BillItem, units: number): Cents {
  if (units <= 0) return 0;
  return Math.round((item.total * units) / item.qty);
}

/** Equal split: who a line was given to on its own – those of them still in the bill (else nobody: it is shared). */
export function lineFor(item: BillItem, participants: PublicParticipant[]): string[] {
  return (item.for ?? []).filter((id) => participants.some((p) => p.id === id));
}

/** Equal split: the lines given to particular people, at their billed price. */
export function personalTotal(data: BillData, participants: PublicParticipant[]): Cents {
  return billedItems(data).reduce((sum, item) => sum + (lineFor(item, participants).length ? item.total : 0), 0);
}

/** Equal split: what one person pays for lines given to them (a line given to several is split among them). */
export function personalShare(data: BillData, participants: PublicParticipant[], participantId: string): Cents {
  return billedItems(data).reduce((sum, item) => {
    const people = lineFor(item, participants);
    return sum + (people.includes(participantId) ? Math.round(item.total / people.length) : 0);
  }, 0);
}

/** Equal split: what is split per head – the whole bill but the lines given to particular people. */
export function poolTotal(data: BillData, participants: PublicParticipant[]): Cents {
  return billTotal(data) - personalTotal(data, participants);
}

/** In an equal split: what every person pays of the shared part of the bill. */
export function equalShare(data: BillData, participants: PublicParticipant[]): Cents {
  return Math.round(poolTotal(data, participants) / splitHeadCount(data, participants));
}

export function participantShare(data: BillData, participants: PublicParticipant[], participantId: string): ShareSummary {
  if (!splitPeople(data, participants).some((p) => p.id === participantId)) return { subtotal: 0, shared: 0, total: 0 };
  if (data.equalSplit) {
    // Everything is split per head here, the tip included – plus the lines given to this person.
    const total = equalShare(data, participants) + personalShare(data, participants, participantId);
    const shared = Math.round((tipTotal(data) + perHeadFees(data)) / splitHeadCount(data, participants));
    return { subtotal: total - shared, shared, total };
  }
  const sub = billedItems(data).reduce((sum, item) => sum + claimCost(item, unitShare(item, participants, participantId)), 0);
  const shared = sharedPerPerson(data, participants) + itemShare(data, sub);
  return { subtotal: sub, shared, total: sub + shared };
}

/** Value of all units nobody has claimed yet, plus the tip and fee parts of people who have not joined yet. */
export function unassignedAmount(data: BillData, participants: PublicParticipant[]): Cents {
  // Equal split: only the parts of people who have not joined yet are open.
  const missingPeople = splitHeadCount(data, participants) - splitPeople(data, participants).length;
  if (data.equalSplit) return missingPeople * equalShare(data, participants);
  const sub = billedItems(data).reduce((sum, item) => sum + claimCost(item, item.qty - assignedUnits(item, participants)), 0);
  return sub + itemShare(data, sub) + missingPeople * sharedPerPerson(data, participants);
}

/**
 * Turns one item claim into valid slots. A list of slots is kept as sent (that is how
 * someone joins a unit another person holds). A plain count (older clients and stored
 * bills) keeps the participant's previous slots and adds free ones; a single item that
 * is already taken is shared. Nobody gets more units of an item than it has.
 */
export function claimSlots(value: number | number[] | undefined, item: BillItem, previous: number[] = [], taken: Set<number> = new Set()): number[] {
  const valid = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < item.qty;
  if (Array.isArray(value)) return [...new Set(value.filter(valid))];
  const count = Math.min(Math.max(0, Math.floor(Number(value ?? 0))), item.qty);
  const slots = [...new Set(previous.filter(valid))].slice(0, count);
  for (let slot = 0; slot < item.qty && slots.length < count; slot++) {
    if (!taken.has(slot) && !slots.includes(slot)) slots.push(slot);
  }
  if (slots.length === 0 && count > 0 && item.qty === 1) slots.push(0);
  return slots;
}

/** Claims of one participant, limited to the bill's items and their units. */
export function sanitizeClaims(
  claims: ClaimsInput,
  items: BillItem[],
  previous: ItemClaims = {},
  othersClaims: ItemClaims[] = [],
): ItemClaims {
  const out: ItemClaims = {};
  for (const item of items) {
    const taken = new Set(othersClaims.flatMap((c) => c[item.id] ?? []));
    const slots = claimSlots(claims[item.id], item, previous[item.id], taken);
    if (slots.length) out[item.id] = slots;
  }
  return out;
}

/**
 * After the payer changed an item's quantity: renumbers the taken units without gaps,
 * in the order they are numbered now, and drops those that no longer exist.
 */
export function compactClaims(allClaims: ItemClaims[], items: BillItem[], allSplits: ItemClaims[] = []): { claims: ItemClaims[]; splits: ItemClaims[] } {
  const claims = allClaims.map((): ItemClaims => ({}));
  const splits = allClaims.map((): ItemClaims => ({}));
  for (const item of items) {
    const used = [...new Set(allClaims.flatMap((c) => c[item.id] ?? []))].sort((a, b) => a - b);
    const renumber = new Map(used.map((slot, i) => [slot, i]));
    const remap = (slots: number[] = []) =>
      slots.filter((slot) => renumber.has(slot)).map((slot) => renumber.get(slot)!).filter((slot) => slot < item.qty);
    allClaims.forEach((c, i) => {
      const mine = remap(c[item.id]);
      if (mine.length) claims[i][item.id] = mine;
      const split = remap(allSplits[i]?.[item.id]).filter((slot) => mine.includes(slot));
      if (split.length) splits[i][item.id] = split;
    });
  }
  return { claims, splits };
}

/** Units offered for sharing, limited to units the participant actually holds. */
export function sanitizeSplits(splits: ClaimsInput, claims: ItemClaims): ItemClaims {
  const out: ItemClaims = {};
  for (const [itemId, slots] of Object.entries(claims)) {
    const value = splits[itemId];
    const offered = Array.isArray(value) ? [...new Set(value)].filter((slot) => slots.includes(slot)) : [];
    if (offered.length) out[itemId] = offered;
  }
  return out;
}

/** Link that is encoded in the QR code. The recipient is part of it, too. */
/**
 * The link to share: `https://www.klicksplit.de/b/<id>` – a real path, so link previews
 * (WhatsApp, …) can show the bill (see server/preview.ts); the app turns it into its hash
 * route on start (openPathLink). `hashOnly`: the old form `…/#/b/<id>` (the demo, which runs
 * inside another page). Both forms are read by billIdFromUrl.
 */
export function billUrl(id: string, base: string, payment?: PaymentInfo, hashOnly = false): string {
  const to = payment?.paypalMe || payment?.paypalEmail;
  const query = to ? `?to=${encodeURIComponent(to)}` : "";
  if (hashOnly) return `${base.replace(/#.*$/, "")}#/b/${id}${query}`;
  return `${new URL(base).origin}/b/${id}${query}`;
}

/** Extracts the bill id from a scanned QR code / link (`…/b/<id>` or `…#/b/<id>`), or null if it is not one. */
export function billIdFromUrl(text: string): string | null {
  const m = text.match(/(?:#|https?:\/\/[^/\s#?]+)\/b\/([A-Za-z0-9_-]{6,40})/);
  return m ? m[1] : null;
}

let idCounter = 0;
export function newItemId(): string {
  idCounter = (idCounter + 1) % 1296;
  return Date.now().toString(36).slice(-5) + idCounter.toString(36).padStart(2, "0") + Math.random().toString(36).slice(2, 5);
}
