import { api } from "./api";
import type { BillSnapshot } from "./bill";
import { ownerSummary } from "../components/OwnerPanel";

/**
 * Restaurant mode (see server/venues.ts): tables with QR codes of their own, the bill open at
 * each, and a traffic light per table for the staff.
 */

const PENDING_KEY = "billsplit.pendingTable";
/** A bill created later than this after "Rechnung anlegen" no longer goes to the table. */
const PENDING_TTL_MS = 30 * 60 * 1000;

/** The staff chose "Rechnung anlegen" at a table: the next bill created on this device opens there. */
export function setPendingTable(tableId: string): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ tableId, at: Date.now() }));
  } catch {
    // private mode: the bill can still be opened at the table by hand
  }
}

/** After a bill was created: opens it at the table chosen before (if any); true when it did. */
export async function attachPendingTable(billId: string): Promise<boolean> {
  let pending: { tableId: string; at: number } | null;
  try {
    pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as { tableId: string; at: number } | null;
    localStorage.removeItem(PENDING_KEY);
  } catch {
    return false;
  }
  if (!pending || Date.now() - pending.at > PENDING_TTL_MS) return false;
  return api
    .setTableBill(pending.tableId, billId)
    .then(() => true)
    .catch(() => false);
}

/** The table's traffic light: red = nothing paid, yellow = partly, green = all of it. */
export type Light = "free" | "red" | "yellow" | "green";

export function tableLight(snapshot: BillSnapshot | null | undefined): { light: Light; missing: number; received: number; guests: number } {
  if (!snapshot) return { light: "free", missing: 0, received: 0, guests: 0 };
  const { missing, received } = ownerSummary(snapshot);
  const guests = (snapshot.debtors ?? []).length;
  const light: Light = guests > 0 && missing === 0 ? "green" : received > 0 ? "yellow" : "red";
  return { light, missing, received, guests };
}

/** The address a table's QR code leads to (server: /t/<id> → the bill open there). */
export const tableUrl = (tableId: string) => `${window.location.origin}/t/${tableId}`;
