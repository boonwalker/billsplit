import type { NetworkEdge, PaymentInfo, TransferAllocation } from "./bill";
import type { Cents } from "./money";

/** One payment of the plan: what to send whom, and exactly which shares in which bills it settles. */
export interface PlannedTransfer {
  toId: string;
  toName: string;
  currency: string;
  amount: Cents;
  allocations: TransferAllocation[];
  /** How the recipient wants to be paid (from their newest bill). */
  payment: PaymentInfo;
  /** Other people whose debts with the recipient this payment settles, and by how much. */
  onBehalfOf: { id: string; name: string; amount: Cents }[];
}

export interface SettlementPlan {
  currency: string;
  /** What I pay – as few payments to as few people as the open shares allow. */
  transfers: PlannedTransfer[];
  /** How many payments it would take without routing through friends (one per person I owe). */
  directCount: number;
  /** People who still owe me something after the plan (they settle up from their side). */
  incoming: { id: string; name: string; amount: Cents }[];
}

const keyOf = (e: Pick<NetworkEdge, "billId" | "debtorId">) => `${e.billId}:${e.debtorId}`;

/** A chain of shares, each settled by the same amount: me → X → … → target. */
interface Piece {
  amount: Cents;
  edges: NetworkEdge[];
}

const target = (p: Piece) => p.edges[p.edges.length - 1].creditorId;

/** Longest chain me → … → recipient; more hops would be hard to follow for the people involved. */
const MAX_HOPS = 4;

/**
 * Plans how I settle all my open shares with as few payments to as few people as possible:
 *
 * 1. With every person, debts in both directions are offset first.
 * 2. What I still owe someone is passed on along their own open debts: if I owe Andy 5 € and
 *    Andy owes Katia 5 €, I pay Katia directly – one payment settles both. A debt is only
 *    passed on when that does not add a recipient (it moves completely, or to someone I pay
 *    anyway), so the plan never needs more payments than paying everyone directly.
 * 3. Everything going to the same person is bundled into one payment.
 *
 * Every payment lists the shares it settles; for everyone involved they add up to nothing
 * gained or lost (the server checks exactly that before recording it).
 */
export function planSettlement(me: string, edges: NetworkEdge[]): SettlementPlan[] {
  const currencies = [...new Set(edges.map((e) => e.currency))];
  return currencies.map((currency) => planOne(me, edges.filter((e) => e.currency === currency), currency));
}

function planOne(me: string, edges: NetworkEdge[], currency: string): SettlementPlan {
  const cap = new Map(edges.map((e) => [keyOf(e), e.amount]));
  const names = new Map<string, string>();
  for (const e of edges) {
    names.set(e.debtorId, e.debtorName);
    names.set(e.creditorId, e.creditorName);
  }
  const take = (e: NetworkEdge, amount: Cents) => cap.set(keyOf(e), (cap.get(keyOf(e)) ?? 0) - amount);

  // 1. Offset with every person: my debts to X against X's debts to me.
  const people = new Set(edges.filter((e) => e.debtorId === me || e.creditorId === me).map((e) => (e.debtorId === me ? e.creditorId : e.debtorId)));
  const pieces: Piece[] = [];
  const offsets: { person: string; allocations: TransferAllocation[] }[] = [];
  const incoming = new Map<string, Cents>();
  let directCount = 0;
  for (const x of people) {
    const mine = edges.filter((e) => e.debtorId === me && e.creditorId === x);
    const theirs = edges.filter((e) => e.debtorId === x && e.creditorId === me);
    const myDebt = mine.reduce((s, e) => s + e.amount, 0);
    const theirDebt = theirs.reduce((s, e) => s + e.amount, 0);
    if (myDebt <= theirDebt) {
      if (theirDebt > myDebt) incoming.set(x, theirDebt - myDebt);
      // My debts to them cancel against part of theirs; that rides along with any payment I make.
      if (myDebt > 0) {
        const allocations = mine.map((e) => alloc(e, e.amount));
        let left = myDebt;
        for (const e of theirs) {
          const offset = Math.min(left, e.amount);
          if (offset > 0) allocations.push(alloc(e, offset));
          left -= offset;
        }
        for (const a of allocations) cap.set(`${a.billId}:${a.debtorId}`, (cap.get(`${a.billId}:${a.debtorId}`) ?? 0) - a.amount);
        offsets.push({ person: x, allocations });
      }
      continue;
    }
    directCount++;
    // The part that cancels out: their debts to me in full, the same amount of mine.
    const allocations: TransferAllocation[] = [];
    let left = theirDebt;
    for (const e of theirs) {
      allocations.push(alloc(e, e.amount));
      take(e, e.amount);
    }
    for (const e of mine) {
      const offset = Math.min(left, e.amount);
      if (offset > 0) {
        allocations.push(alloc(e, offset));
        take(e, offset);
        left -= offset;
      }
      const rest = e.amount - offset;
      if (rest > 0) {
        pieces.push({ amount: rest, edges: [e] });
        take(e, rest);
      }
    }
    if (allocations.length) offsets.push({ person: x, allocations });
  }

  // 2. Pass debts on along the open debts of the people I owe.
  for (let changed = true, rounds = 0; changed && rounds < 500; rounds++) {
    changed = false;
    pieces.sort((a, b) => b.amount - a.amount);
    for (const piece of [...pieces]) {
      if (piece.edges.length >= MAX_HOPS) continue;
      const x = target(piece);
      const visited = new Set([me, ...piece.edges.map((e) => e.debtorId), x]);
      const targets = new Set(pieces.map(target));
      const onlyPieceToX = pieces.filter((p) => target(p) === x).length === 1;
      const candidates = edges
        // Not on to people who owe me themselves: there it would only cancel out against their
        // debt and leave a payment of nothing (they settle that from their side).
        .filter((e) => e.debtorId === x && !visited.has(e.creditorId) && !incoming.has(e.creditorId) && (cap.get(keyOf(e)) ?? 0) > 0)
        .sort((a, b) => Number(targets.has(b.creditorId)) - Number(targets.has(a.creditorId)) || (cap.get(keyOf(b)) ?? 0) - (cap.get(keyOf(a)) ?? 0));
      for (const e of candidates) {
        const amount = Math.min(piece.amount, cap.get(keyOf(e)) ?? 0);
        const whole = amount === piece.amount;
        if (!targets.has(e.creditorId) && !(whole && onlyPieceToX)) continue;
        take(e, amount);
        if (whole) {
          piece.edges.push(e);
        } else {
          piece.amount -= amount;
          pieces.push({ amount, edges: [...piece.edges, e] });
        }
        changed = true;
        break;
      }
      if (changed) break;
    }
  }

  // 3. Bundle per recipient.
  const byTarget = new Map<string, Piece[]>();
  for (const p of pieces) byTarget.set(target(p), [...(byTarget.get(target(p)) ?? []), p]);
  const transfers: PlannedTransfer[] = [];
  for (const [to, list] of byTarget) {
    const allocations: TransferAllocation[] = [];
    const amount = list.reduce((s, p) => s + p.amount, 0);
    for (const p of list) for (const e of p.edges) allocations.push(alloc(e, p.amount));
    const ownBills = edges.filter((e) => e.creditorId === to).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    transfers.push({ toId: to, toName: names.get(to) ?? "", currency, amount, allocations, payment: ownBills[0]?.payment ?? {}, onBehalfOf: [] });
  }

  // Offsets with a person leave everyone even, so they ride along with a payment: preferably
  // the one going to that person or passing through them.
  for (const o of offsets) {
    const t =
      transfers.find((t) => t.toId === o.person) ??
      transfers.find((t) => t.allocations.some((a) => a.debtorId === o.person || a.creditorId === o.person)) ??
      transfers[0];
    if (t) t.allocations.push(...o.allocations);
  }

  for (const t of transfers) {
    t.allocations = mergeAllocations(t.allocations);
    const behalf = new Map<string, Cents>();
    for (const a of t.allocations) if (a.creditorId === t.toId && a.debtorId !== me) behalf.set(a.debtorId, (behalf.get(a.debtorId) ?? 0) + a.amount);
    t.onBehalfOf = [...behalf].map(([id, amount]) => ({ id, name: names.get(id) ?? "", amount }));
  }

  return {
    currency,
    transfers: transfers.sort((a, b) => b.amount - a.amount),
    directCount,
    incoming: [...incoming].filter(([, a]) => a > 0).map(([id, amount]) => ({ id, name: names.get(id) ?? "", amount })),
  };
}

function alloc(e: NetworkEdge, amount: Cents): TransferAllocation {
  return { billId: e.billId, debtorId: e.debtorId, creditorId: e.creditorId, amount };
}

/** One allocation per share. */
function mergeAllocations(list: TransferAllocation[]): TransferAllocation[] {
  const merged = new Map<string, TransferAllocation>();
  for (const a of list) {
    const k = `${a.billId}:${a.debtorId}`;
    const m = merged.get(k);
    if (m) m.amount += a.amount;
    else merged.set(k, { ...a });
  }
  return [...merged.values()];
}
