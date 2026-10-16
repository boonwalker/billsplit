import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import { ownerSummary } from "../src/components/OwnerPanel";
import type { BillData } from "../src/lib/bill";

const rewe = (over: Partial<BillData> = {}): BillData => ({
  title: "REWE City",
  date: "2026-10-16",
  currency: "EUR",
  tipPercent: 0,
  equalSplit: true,
  payment: { paypalMe: "nik" },
  items: [{ id: "halme", name: "Trinkhalme", qty: 1, total: 655 }],
  ...over,
});

describe("Dir fehlen noch: exactly what the friends are asked to pay", () => {
  it("6,55 € for two: Peter sends 3,28 €, so 3,28 € are missing – the payer carries the cent", () => {
    const store = new BillStore(null);
    const bill = store.createBill(rewe(), "niklas", "Niklas");
    store.join(bill, "peter", "Peter");
    const snap = store.snapshot(bill, "niklas");
    expect(snap.debtors?.[0].amount).toBe(328);
    const s = ownerSummary(snap);
    expect([s.total, s.own, s.missing]).toEqual([655, 327, 328]);
    // The lines still add up.
    expect(s.total - s.own - s.received).toBe(s.missing);
  });

  it("counts what nobody has yet – a person still to come, an item nobody ticked", () => {
    const store = new BillStore(null);
    const expected = store.createBill(rewe({ tipSplitCount: 3 }), "niklas", "Niklas");
    store.join(expected, "peter", "Peter");
    expect(ownerSummary(store.snapshot(expected, "niklas")).missing).toBe(218 + 218);

    const ticking = store.createBill(rewe({ equalSplit: undefined }), "niklas", "Niklas");
    store.join(ticking, "peter", "Peter");
    expect(ownerSummary(store.snapshot(ticking, "niklas")).missing).toBe(655);
  });
});
