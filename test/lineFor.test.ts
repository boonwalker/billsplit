import { describe, expect, it } from "vitest";
import { equalShare, participantShare, poolTotal, unassignedAmount, type BillData, type PublicParticipant } from "../src/lib/bill";
import { setItemFor } from "../src/lib/billEdits";

const people = (...ids: string[]): PublicParticipant[] => ids.map((id, i) => ({ id, name: id, isOwner: i === 0, claims: {} }));

const shopping = (): BillData => ({
  title: "Einkauf",
  date: "2026-10-16",
  currency: "EUR",
  tipPercent: 0,
  equalSplit: true,
  payment: {},
  items: [
    { id: "brot", name: "Brot", qty: 1, total: 300 },
    { id: "kaese", name: "Käse", qty: 1, total: 600 },
    { id: "duschgel", name: "Duschgel", qty: 1, total: 300 },
  ],
});

describe("equal split: a line given to particular people", () => {
  it("bills it to them alone and splits the rest equally", () => {
    const all = people("niklas", "andy", "ben");
    const data = setItemFor(shopping(), "duschgel", ["andy"]);
    expect(poolTotal(data, all)).toBe(900);
    expect(equalShare(data, all)).toBe(300);
    expect(participantShare(data, all, "andy").total).toBe(600);
    expect(participantShare(data, all, "ben").total).toBe(300);
    expect(unassignedAmount(data, all)).toBe(0);
  });

  it("splits it among several – and the payer's own lines just leave the pool", () => {
    const all = people("niklas", "andy", "ben");
    const shared = setItemFor(shopping(), "kaese", ["andy", "ben"]);
    expect(participantShare(shared, all, "andy").total).toBe(200 + 300);
    const mine = setItemFor(shopping(), "duschgel", ["niklas"]);
    expect(participantShare(mine, all, "ben").total).toBe(300);
  });

  it("counts for nobody who left the bill – then it is shared again; old bills stay as they were", () => {
    const data = setItemFor(shopping(), "duschgel", ["gone"]);
    expect(equalShare(data, people("niklas", "andy"))).toBe(600);
    expect(equalShare(shopping(), people("niklas", "andy"))).toBe(600);
    expect(setItemFor(data, "duschgel", []).items[2]).not.toHaveProperty("for");
  });
});
