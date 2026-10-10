import { api } from "./api";
import type { BalanceEntry, PersonBalance } from "./balances";

/** The open amounts with a person are the same as when they were shown (bill by bill). */
export function sameEntries(a: BalanceEntry[], b: BalanceEntry[]): boolean {
  const key = (e: BalanceEntry) => `${e.billId}:${e.direction}:${e.amount}:${e.debtorId ?? ""}`;
  const x = a.map(key).sort();
  const y = b.map(key).sort();
  return x.length === y.length && x.every((k, i) => k === y[i]);
}

/** Net amount with a person: positive = they owe me, negative = I owe them. */
export const netOf = (p: Pick<PersonBalance, "lent" | "owed">) => p.lent - p.owed;

/**
 * Books a settlement with a person in every bill it covers: my share in each of their bills is
 * recorded (pay click with the current amount, which the payer sees) and marked as paid; their
 * share in each of my bills is confirmed as received. Runs bill by bill; `onProgress` reports
 * how many are done. Throws on the first failure (what was booked until then stays booked).
 */
export async function bookSettlement(entries: BalanceEntry[], onProgress?: (done: number) => void): Promise<void> {
  let done = 0;
  for (const e of entries) {
    if (e.direction === "owed") {
      await api.pay(e.billId);
      await api.markPaid(e.billId, true);
    } else if (e.debtorId) {
      await api.setReceived(e.billId, e.debtorId, true);
    }
    onProgress?.(++done);
  }
}
