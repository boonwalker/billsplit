import { participantShare, type BillSnapshot } from "./bill";
import { ownerSummary } from "../components/OwnerPanel";
import type { Cents } from "./money";

/** What is open with one person across all bills, in one currency. */
export interface PersonBalance {
  name: string;
  /** They still owe me (from bills I paid). */
  lent: Cents;
  /** I still owe them (from bills they paid). */
  owed: Cents;
  /** Number of bills with this person. */
  bills: number;
}

export interface Balances {
  currency: string;
  /** Still owed to me in total: everything the payer page shows as "Dir fehlen noch". */
  lent: Cents;
  /** I still owe in total. */
  owed: Cents;
  /** Part of `lent` that nobody ticked yet, so it belongs to no one in particular. */
  unassigned: Cents;
  people: PersonBalance[];
}

/**
 * Sums up the open amounts of all bills on this device, per currency. As payer, a friend's
 * share counts until it is confirmed as received; as guest, my share counts until I marked it
 * as paid. People are matched by name across bills.
 */
export function computeBalances(snapshots: BillSnapshot[]): Balances[] {
  const byCurrency = new Map<string, Balances & { byName: Map<string, PersonBalance> }>();
  const sheet = (currency: string) => {
    let b = byCurrency.get(currency);
    if (!b) {
      b = { currency, lent: 0, owed: 0, unassigned: 0, people: [], byName: new Map() };
      byCurrency.set(currency, b);
    }
    return b;
  };
  const person = (b: ReturnType<typeof sheet>, rawName: string) => {
    const name = rawName.trim() || "Unbekannt";
    const key = name.toLocaleLowerCase("de-DE");
    let p = b.byName.get(key);
    if (!p) {
      p = { name, lent: 0, owed: 0, bills: 0 };
      b.byName.set(key, p);
    }
    return p;
  };

  for (const snap of snapshots) {
    const b = sheet(snap.data.currency);
    if (snap.isOwner) {
      const { missing, unassigned } = ownerSummary(snap);
      for (const d of snap.debtors ?? []) {
        const p = person(b, d.name);
        p.bills++;
        if (!d.received) p.lent += d.amount;
      }
      b.lent += missing;
      b.unassigned += Math.min(missing, unassigned);
    } else if (snap.me) {
      const p = person(b, snap.ownerName);
      p.bills++;
      if (snap.myPayment?.markedPaidAt) continue;
      const due = participantShare(snap.data, snap.participants, snap.me).total;
      p.owed += due;
      b.owed += due;
    }
  }

  return [...byCurrency.values()]
    .map(({ byName, ...b }) => ({
      ...b,
      // Biggest open amounts first (either way), settled people last.
      people: [...byName.values()].sort((x, y) => Math.abs(y.lent - y.owed) - Math.abs(x.lent - x.owed) || x.name.localeCompare(y.name, "de")),
    }))
    .sort((x, y) => y.lent + y.owed - (x.lent + x.owed));
}
