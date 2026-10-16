import { openShare, participantShare, type BillSnapshot, type PaymentInfo } from "./bill";
import { ownerSummary } from "../components/OwnerPanel";
import { t } from "./i18n";
import { convert, type Rates } from "./currency";
import type { Cents } from "./money";

/** One open amount between me and a person, in one bill. */
export interface BalanceEntry {
  billId: string;
  title: string;
  createdAt: string;
  /** lent: they owe me (my bill) · owed: I owe them (their bill). */
  direction: "lent" | "owed";
  amount: Cents;
  /** lent only: their participant id in my bill (to confirm their share as received). */
  debtorId?: string;
}

/** What is open with one person across all bills, in one currency. */
export interface PersonBalance {
  /** Their participant id: the same in every bill they joined from the same device. */
  id: string;
  name: string;
  /** They still owe me (from bills I paid). */
  lent: Cents;
  /** I still owe them (from bills they paid). */
  owed: Cents;
  /** Number of bills with this person. */
  bills: number;
  /** The open amounts bill by bill (lent and owed), newest first. */
  entries: BalanceEntry[];
  /** How they want to be paid: from their newest bill in which I owe them something. */
  payment?: PaymentInfo;
}

export interface Balances {
  currency: string;
  /** Still owed to me in total. */
  lent: Cents;
  /** I still owe in total. */
  owed: Cents;
  /** Part of `lent` that nobody ticked yet, so it belongs to no one in particular. */
  unassigned: Cents;
  people: PersonBalance[];
}

/**
 * Open amount of a friend in my bill: their share, less what they settled. Confirmed as
 * received counts with the amount of their pay click (or completely without one); marked as
 * paid by them counts with the amount of their pay click. Whatever was added to their share
 * afterwards stays open.
 */
function debtorOpen(d: NonNullable<BillSnapshot["debtors"]>[number]): Cents {
  return openShare(d.amount, d, (d.credited ?? 0) + (d.creditPending ?? 0));
}

/** My open amount in someone else's bill (0 once the payer confirmed it as received). */
export function myOpen(snap: BillSnapshot): Cents {
  if (!snap.me || snap.myReceived) return 0;
  const share = participantShare(snap.data, snap.participants, snap.me).total;
  const credit = snap.myCredit ? snap.myCredit.confirmed + snap.myCredit.pending : 0;
  return openShare(share, { payAmount: snap.myPayment?.amount, markedPaidAt: snap.myPayment?.markedPaidAt }, credit);
}

/**
 * Sums up the open amounts of all bills on this device, per currency, and keeps every amount
 * with its bill, so that settling with a person can be booked bill by bill.
 */
export function computeBalances(snapshots: BillSnapshot[]): Balances[] {
  const byCurrency = new Map<string, Balances & { byId: Map<string, PersonBalance & { paymentAt?: string }> }>();
  const sheet = (currency: string) => {
    let b = byCurrency.get(currency);
    if (!b) {
      b = { currency, lent: 0, owed: 0, unassigned: 0, people: [], byId: new Map() };
      byCurrency.set(currency, b);
    }
    return b;
  };
  // People are matched by their participant id (derived from their device), never by name:
  // two friends called Anna stay apart, so a settlement is never booked with the wrong one.
  const person = (b: ReturnType<typeof sheet>, id: string, rawName: string) => {
    const name = rawName.trim() || t("Unbekannt");
    let p = b.byId.get(id);
    if (!p) {
      p = { id, name, lent: 0, owed: 0, bills: 0, entries: [] };
      b.byId.set(id, p);
    }
    return p;
  };

  for (const snap of snapshots) {
    const b = sheet(snap.data.currency);
    const bill = { billId: snap.id, title: snap.data.title || t("Rechnung"), createdAt: snap.createdAt };
    if (snap.isOwner) {
      const { missing, unassigned } = ownerSummary(snap);
      for (const d of snap.debtors ?? []) {
        const p = person(b, d.id, d.name);
        p.bills++;
        // They paid more than their share is now: I owe it back.
        if (d.refund) {
          p.owed += d.refund;
          b.owed += d.refund;
          p.entries.push({ ...bill, direction: "owed", amount: d.refund });
        }
        const open = debtorOpen(d);
        if (open === 0) continue;
        p.lent += open;
        b.lent += open;
        p.entries.push({ ...bill, direction: "lent", amount: open, debtorId: d.id });
      }
      const rest = Math.min(missing, unassigned);
      b.lent += rest;
      b.unassigned += rest;
    } else if (snap.me) {
      const payer = snap.participants.find((x) => x.isOwner);
      const p = person(b, payer?.id ?? `owner:${snap.id}`, snap.ownerName);
      p.bills++;
      // I paid more than my share is now: the payer owes it back.
      if (snap.myRefund) {
        p.lent += snap.myRefund;
        b.lent += snap.myRefund;
        p.entries.push({ ...bill, direction: "lent", amount: snap.myRefund });
      }
      const open = myOpen(snap);
      if (open === 0) continue;
      p.owed += open;
      b.owed += open;
      p.entries.push({ ...bill, direction: "owed", amount: open });
      if (!p.paymentAt || snap.createdAt > p.paymentAt) {
        p.payment = snap.data.payment;
        p.paymentAt = snap.createdAt;
      }
    }
  }

  return [...byCurrency.values()]
    .map(({ byId, ...b }) => ({
      ...b,
      // Biggest open amounts first (either way), settled people last.
      people: [...byId.values()]
        .map(({ paymentAt: _, ...p }) => ({ ...p, entries: p.entries.sort((x, y) => y.createdAt.localeCompare(x.createdAt)) }))
        .sort((x, y) => Math.abs(y.lent - y.owed) - Math.abs(x.lent - x.owed) || x.name.localeCompare(y.name, "de")),
    }))
    .sort((x, y) => y.lent + y.owed - (x.lent + x.owed));
}

/** A friend's line in the list of bills: what is still open, or that it is marked as paid / settled. */
export function guestStatus(snap: BillSnapshot): { markedPaid: boolean; owed: Cents; settled: boolean; currency: string } {
  const owed = myOpen(snap);
  const covered = Boolean(snap.myReceived) || (snap.myCredit ? snap.myCredit.confirmed + snap.myCredit.pending > 0 : false);
  return { markedPaid: Boolean(snap.myPayment?.markedPaidAt), owed, settled: owed === 0 && covered, currency: snap.data.currency };
}


/**
 * Something in the bill still concerns me: money open between me and someone (either way), or
 * a friend marked their share as paid and waits for my "erhalten". Such a bill cannot be
 * removed from the list (✕) – see also the settlement payments to confirm (Home).
 */
export function stillOpen(snap: BillSnapshot): boolean {
  if (snap.isOwner) return (snap.debtors ?? []).some((d) => debtorOpen(d) > 0 || (d.refund ?? 0) > 0 || (Boolean(d.markedPaidAt) && !d.received));
  return Boolean(snap.me) && (myOpen(snap) > 0 || (snap.myRefund ?? 0) > 0);
}

/** A balance in the home currency: all currencies converted and added up (see mergeBalances). */
export interface MergedBalances extends Balances {
  /** Per person: the currency most of it is in (settling happens in a bill's own currency). */
  mainCurrency: Record<string, string>;
  /** Day of the exchange rates. */
  ratesDate: string;
}

/**
 * Adds up the balances of all currencies in the home currency, with the rates of the day –
 * null when there is only the home currency anyway, or a rate is missing.
 */
export function mergeBalances(list: Balances[], home: string, rates: Rates): MergedBalances | null {
  if (!list.length || (list.length === 1 && list[0].currency === home)) return null;
  const merged: MergedBalances = { currency: home, lent: 0, owed: 0, unassigned: 0, people: [], mainCurrency: {}, ratesDate: rates.date };
  const people = new Map<string, PersonBalance>();
  const weight = new Map<string, Map<string, number>>();
  for (const b of list) {
    const to = (cents: Cents) => convert(cents, b.currency, home, rates);
    const [lent, owed, unassigned] = [to(b.lent), to(b.owed), to(b.unassigned)];
    if (lent === null || owed === null || unassigned === null) return null;
    merged.lent += lent;
    merged.owed += owed;
    merged.unassigned += unassigned;
    for (const p of b.people) {
      const pl = to(p.lent)!;
      const po = to(p.owed)!;
      const m = people.get(p.id) ?? { id: p.id, name: p.name, lent: 0, owed: 0, bills: 0, entries: [] };
      m.lent += pl;
      m.owed += po;
      m.bills += p.bills;
      m.entries = [...m.entries, ...p.entries.map((e) => ({ ...e, amount: to(e.amount)! }))];
      m.payment ??= p.payment;
      people.set(p.id, m);
      const w = weight.get(p.id) ?? new Map<string, number>();
      w.set(b.currency, (w.get(b.currency) ?? 0) + pl + po);
      weight.set(p.id, w);
    }
  }
  for (const [id, w] of weight) merged.mainCurrency[id] = [...w].sort((x, y) => y[1] - x[1])[0][0];
  merged.people = [...people.values()].sort((x, y) => Math.abs(y.lent - y.owed) - Math.abs(x.lent - x.owed) || x.name.localeCompare(y.name, "de"));
  return merged;
}
