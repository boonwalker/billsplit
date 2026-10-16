import { describe, expect, it } from "vitest";
import { BillStore, StoreError } from "../server/store";
import { participantShare, type BillData } from "../src/lib/bill";
import type { Notice } from "../src/lib/billCore";

const taxi = (total: number): BillData => ({
  title: "Taxi",
  date: "2026-10-16",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "niklas" },
  items: [{ id: "taxi", name: "Taxi", qty: 1, total }],
});

function setup() {
  const store = new BillStore(null);
  const notices: [string, Notice][] = [];
  store.onNotice((to, n) => notices.push([to, n]));
  // Niklas and Andy were in a bill together before.
  const earlier = store.createBill(taxi(2000), "niklas", "Niklas");
  store.join(earlier, "andy", "Andy");
  return { store, notices };
}

describe("Ausgabe eingeben: directly to people from earlier bills", () => {
  it("lists the people I share bills with", () => {
    const { store } = setup();
    expect(store.contacts("niklas").map((c) => [c.id, c.name, c.bills])).toEqual([["andy", "Andy", 1]]);
    expect(store.contacts("andy").map((c) => c.name)).toEqual(["Niklas"]);
  });

  it("gives Andy the whole taxi – or half of it, when I was in it too", () => {
    const { store, notices } = setup();
    const whole = store.createBill(taxi(500), "niklas", "Niklas");
    store.assign(whole, "niklas", [{ id: "andy", claims: { taxi: [0] } }]);
    const snap = store.snapshot(whole, "niklas");
    expect(participantShare(snap.data, snap.participants, "andy").total).toBe(500);
    expect(notices.at(-1)?.[0]).toBe("andy");

    const half = store.createBill(taxi(1000), "niklas", "Niklas");
    store.assign(half, "niklas", [
      { id: "andy", claims: { taxi: [0] } },
      { id: "niklas", claims: { taxi: [0] } },
    ]);
    const shared = store.snapshot(half, "niklas");
    expect(participantShare(shared.data, shared.participants, "andy").total).toBe(500);
    expect(participantShare(shared.data, shared.participants, "niklas").total).toBe(500);
    // Andy sees it in his open shares.
    expect(store.network("andy").find((e) => e.billId === half)?.amount).toBe(500);
  });

  it("only assigns people I know – and only as the payer", () => {
    const { store } = setup();
    const bill = store.createBill(taxi(500), "niklas", "Niklas");
    expect(() => store.assign(bill, "niklas", [{ id: "stranger", claims: { taxi: [0] } }])).toThrow(StoreError);
    expect(() => store.assign(bill, "andy", [{ id: "andy", claims: { taxi: [0] } }])).toThrow(StoreError);
  });
});
