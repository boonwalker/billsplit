import type { NetworkEdge, PaymentInfo, TransferAllocation } from "./bill";
import type { Cents } from "./money";

/** Everything open between me and one person, in one currency (from the open shares on the server). */
export interface PersonSettlement {
  /** The open shares bill by bill: mine in their bills and theirs in mine, newest first. */
  edges: NetworkEdge[];
  /** I owe them (their bills). */
  owed: Cents;
  /** They owe me (my bills). */
  lent: Cents;
  /** Positive: they owe me on balance · negative: I owe them. */
  net: Cents;
  /** What a settlement payment between us settles: all of the shares above. */
  allocations: TransferAllocation[];
  /** How they want to be paid: from their newest bill in which I owe them something. */
  payment?: PaymentInfo;
}

/** Settling up with one person: their open shares with me and mine with them, all at once. */
export function settlementWith(me: string, personId: string, edges: NetworkEdge[], currency: string): PersonSettlement {
  const mine = edges
    .filter(
      (e) =>
        e.currency === currency &&
        ((e.debtorId === me && e.creditorId === personId) || (e.debtorId === personId && e.creditorId === me)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const owed = mine.filter((e) => e.debtorId === me).reduce((s, e) => s + e.amount, 0);
  const lent = mine.filter((e) => e.debtorId === personId).reduce((s, e) => s + e.amount, 0);
  return {
    edges: mine,
    owed,
    lent,
    net: lent - owed,
    allocations: mine.map(({ billId, debtorId, creditorId, amount }) => ({ billId, debtorId, creditorId, amount })),
    payment: mine.find((e) => e.debtorId === me)?.payment,
  };
}

/** The same shares with the same amounts (in any order). */
export function sameAllocations(a: TransferAllocation[], b: TransferAllocation[]): boolean {
  const key = (x: TransferAllocation) => `${x.billId}:${x.debtorId}:${x.creditorId}:${x.amount}`;
  const x = a.map(key).sort();
  const y = b.map(key).sort();
  return x.length === y.length && x.every((k, i) => k === y[i]);
}
