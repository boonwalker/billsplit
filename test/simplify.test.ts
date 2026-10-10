import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";
import { planSettlement } from "../src/lib/simplify";

const NAMES: Record<string, string> = { me: "Niklas", andy: "Andy", katia: "Katia", bea: "Bea", carl: "Carl", dora: "Dora" };

/** A bill paid by `owner` in which each listed person had one item of the given price. */
function addBill(store: BillStore, owner: string, shares: Record<string, number>, title = `Rechnung von ${NAMES[owner]}`) {
  const people = Object.keys(shares);
  const data: BillData = {
    title,
    date: "",
    currency: "EUR",
    tipPercent: 0,
    payment: { paypalMe: owner },
    items: people.map((p) => ({ id: `i-${p}`, name: p, qty: 1, total: shares[p] })),
  };
  const id = store.createBill(data, owner, NAMES[owner]);
  for (const p of people) {
    if (p !== owner) store.join(id, p, NAMES[p]);
    store.setClaims(id, p, { [`i-${p}`]: [0] });
  }
  return id;
}

/** Plans for `me`, records every payment (the server checks each one) and confirms them. */
function settle(store: BillStore, me = "me") {
  const [plan] = planSettlement(me, store.network(me));
  for (const t of plan?.transfers ?? []) {
    store.createTransfer(me, { toId: t.toId, amount: t.amount, currency: t.currency, allocations: t.allocations });
  }
  for (const t of store.listTransfers(me)) if (t.status === "pending") store.decideTransfer(t.toId, t.id, "confirm");
  return plan;
}

describe("settling up with as few payments as possible", () => {
  it("pays Katia directly what I owe Andy when Andy owes Katia", () => {
    const store = new BillStore(null);
    addBill(store, "andy", { me: 500 });
    addBill(store, "katia", { andy: 500, me: 300 });
    const [plan] = planSettlement("me", store.network("me"));
    expect(plan.directCount).toBe(2);
    expect(plan.transfers).toHaveLength(1);
    expect(plan.transfers[0]).toMatchObject({ toId: "katia", amount: 800, onBehalfOf: [{ id: "andy", name: "Andy", amount: 500 }] });
    settle(store);
    // Me, Andy and Katia are all settled by that one payment.
    expect(store.network("me")).toEqual([]);
  });

  it("offsets debts in both directions with the same person", () => {
    const store = new BillStore(null);
    addBill(store, "andy", { me: 1000 });
    addBill(store, "me", { andy: 400 });
    const [plan] = planSettlement("me", store.network("me"));
    expect(plan.transfers.map((t) => [t.toId, t.amount])).toEqual([["andy", 600]]);
    settle(store);
    expect(store.network("me")).toEqual([]);
  });

  it("bundles debts that lead to the same person into one payment", () => {
    const store = new BillStore(null);
    addBill(store, "andy", { me: 500 });
    addBill(store, "bea", { me: 500 });
    addBill(store, "katia", { andy: 500, bea: 500, me: 200 });
    const [plan] = planSettlement("me", store.network("me"));
    expect(plan.directCount).toBe(3);
    expect(plan.transfers.map((t) => [t.toId, t.amount])).toEqual([["katia", 1200]]);
    settle(store);
    expect(store.network("me")).toEqual([]);
  });

  it("does not split a payment into more recipients just to pass part of it on", () => {
    const store = new BillStore(null);
    addBill(store, "andy", { me: 500 });
    addBill(store, "katia", { andy: 300, me: 0 });
    const [plan] = planSettlement("me", store.network("me"));
    expect(plan.transfers.map((t) => [t.toId, t.amount])).toEqual([["andy", 500]]);
  });

  it("never needs more payments than paying everyone directly, and every planned payment adds up", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const people = ["me", "andy", "katia", "bea", "carl", "dora"];
    for (let round = 0; round < 60; round++) {
      const store = new BillStore(null);
      for (let b = 0; b < 2 + Math.floor(random() * 6); b++) {
        const owner = people[Math.floor(random() * people.length)];
        const shares: Record<string, number> = { me: Math.floor(random() * 3000) };
        for (const p of people) if (p !== "me" && random() < 0.6) shares[p] = 1 + Math.floor(random() * 3000);
        shares[owner] ??= 100;
        addBill(store, owner, shares);
      }
      const before = store.network("me");
      const myDebt = before.filter((e) => e.debtorId === "me").reduce((s, e) => s + e.amount, 0);
      const plan = settle(store);
      if (!plan) continue;
      expect(plan.transfers.length).toBeLessThanOrEqual(plan.directCount);
      // Everything I owed is settled; what I paid is what I owed less what was offset.
      // (Without any payment of mine, debts to people who owe me more stay until they settle up.)
      if (plan.transfers.length) expect(store.network("me").filter((e) => e.debtorId === "me")).toEqual([]);
      expect(plan.transfers.reduce((s, t) => s + t.amount, 0)).toBeLessThanOrEqual(myDebt);
    }
  });
});
