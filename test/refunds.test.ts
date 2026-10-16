import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import { participantShare, type BillData } from "../src/lib/bill";
import { newRefunds } from "../src/lib/refunds";

/** Niklas paid: pizza 12,00 €, wine 8,00 € shared equally by Niklas and Anna. */
const data: BillData = {
  title: "Trattoria",
  date: "2026-10-12",
  currency: "EUR",
  tipPercent: 0,
  equalSplit: true,
  tipSplitCount: 2,
  payment: { paypalMe: "niklas" },
  items: [
    { id: "pizza", name: "Pizza", qty: 1, total: 1200 },
    { id: "wein", name: "Wein", qty: 1, total: 800 },
  ],
};

function setup() {
  const store = new BillStore(null);
  const bill = store.createBill(data, "niklas", "Niklas");
  store.join(bill, "anna", "Anna");
  return { store, bill };
}

describe("paid too much after a change", () => {
  it("owes the difference back – in the bill and as a share the other way round", () => {
    const { store, bill } = setup();
    // Anna pays her 10,00 €, then Niklas crosses out the wine.
    store.recordPayClick(bill, "anna");
    store.setMarkedPaid(bill, "anna", true);
    store.updateData(bill, "niklas", { ...data, items: [data.items[0], { ...data.items[1], excluded: true }] });
    expect(store.snapshot(bill, "niklas").debtors?.[0]).toMatchObject({ amount: 600, refund: 400 });
    expect(store.snapshot(bill, "anna").myRefund).toBe(400);
    expect(store.network("anna").map((e) => [e.debtorName, e.creditorName, e.amount])).toEqual([["Niklas", "Anna", 400]]);

    // Niklas pays it back with a settlement payment: nothing open any more.
    store.createTransfer("niklas", {
      toId: "anna",
      amount: 400,
      currency: "EUR",
      allocations: [{ billId: bill, debtorId: "niklas", creditorId: "anna", amount: 400 }],
    });
    expect(store.snapshot(bill, "anna").myRefund).toBeUndefined();
    expect(store.network("anna")).toEqual([]);
  });

  it("remembers what was open when the payer ticked „erhalten“ without a pay click", () => {
    const { store, bill } = setup();
    store.setReceived(bill, "niklas", "anna", true);
    store.updateData(bill, "niklas", { ...data, items: [data.items[0]] });
    expect(store.snapshot(bill, "niklas").debtors?.[0]).toMatchObject({ receivedAmount: 1000, refund: 400 });
    // Unticked again: nothing paid, nothing owed back.
    store.setReceived(bill, "niklas", "anna", false);
    expect(store.snapshot(bill, "niklas").debtors?.[0].refund).toBeUndefined();
  });

  it("warns before a change that leaves someone having paid too much – not before others", () => {
    const { store, bill } = setup();
    store.recordPayClick(bill, "anna");
    store.setMarkedPaid(bill, "anna", true);
    const snap = store.snapshot(bill, "niklas");
    const cheaper = { ...data, items: [data.items[0]] };
    expect(newRefunds(snap, cheaper)).toEqual([{ id: "anna", name: "Anna", paid: 1000, share: 600, extra: 400 }]);
    expect(participantShare(cheaper, snap.participants, "anna").total).toBe(600);
    // More expensive: she just owes the rest, no question.
    expect(newRefunds(snap, { ...data, items: [...data.items, { id: "dessert", name: "Dessert", qty: 1, total: 600 }] })).toEqual([]);
  });
});
