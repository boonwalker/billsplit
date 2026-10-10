import { participantShare, type BillSnapshot, type PaymentInfo } from "./bill";
import { ownerSummary } from "../components/OwnerPanel";
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
  const settled = d.received ? (d.payAmount ?? d.amount) : d.markedPaidAt ? (d.payAmount ?? 0) : 0;
  return Math.max(0, d.amount - settled);
}

/** My open amount in someone else's bill (0 once the payer confirmed it as received). */
function myOpen(snap: BillSnapshot): Cents {
  if (!snap.me || snap.myReceived) return 0;
  const share = participantShare(snap.data, snap.participants, snap.me).total;
  const paid = snap.myPayment?.markedPaidAt ? snap.myPayment.amount : 0;
  return Math.max(0, share - paid);
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
    const name = rawName.trim() || "Unbekannt";
    let p = b.byId.get(id);
    if (!p) {
      p = { id, name, lent: 0, owed: 0, bills: 0, entries: [] };
      b.byId.set(id, p);
    }
    return p;
  };

  for (const snap of snapshots) {
    const b = sheet(snap.data.currency);
    const bill = { billId: snap.id, title: snap.data.title || "Rechnung", createdAt: snap.createdAt };
    if (snap.isOwner) {
      const { missing, unassigned } = ownerSummary(snap);
      for (const d of snap.debtors ?? []) {
        const p = person(b, d.id, d.name);
        p.bills++;
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
