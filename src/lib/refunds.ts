import { overpaidShare, participantShare, settledInBill, type BillData, type BillSnapshot } from "./bill";
import type { Cents } from "./money";

/** A friend who would have paid too much after a change of the bill. */
export interface NewRefund {
  id: string;
  name: string;
  /** What they paid so far (in the bill and by settlement payments). */
  paid: Cents;
  /** Their share after the change. */
  share: Cents;
  /** What the change adds to what the payer owes them back. */
  extra: Cents;
}

/** Who paid already and would get money back if the payer saved `next` (the payer is asked first). */
export function newRefunds(snap: BillSnapshot, next: BillData): NewRefund[] {
  return (snap.debtors ?? []).flatMap((d) => {
    const credited = (d.credited ?? 0) + (d.creditPending ?? 0);
    const before = participantShare(snap.data, snap.participants, d.id).total;
    const after = participantShare(next, snap.participants, d.id).total;
    const extra = overpaidShare(after, d, credited) - overpaidShare(before, d, credited);
    return extra > 0 ? [{ id: d.id, name: d.name, paid: settledInBill(before, d) + credited, share: after, extra }] : [];
  });
}
