import { describe, expect, it } from "vitest";
import type { BillData } from "../src/lib/bill";
import { setItemDivisor, toggleFeeExcluded, toggleItemExcluded, toggleTipExcluded } from "../src/lib/billEdits";

const data: BillData = {
  title: "Rewe",
  date: "",
  currency: "EUR",
  tipPercent: 0,
  payment: {},
  items: [
    { id: "milch", name: "Milch", qty: 1, total: 119 },
    { id: "bier", name: "Bier", qty: 2, total: 200 },
  ],
  fees: [{ id: "tuete", name: "Tüte", amount: 20 }],
};

describe("the payer's changes on the finished bill", () => {
  it("crosses out one unit more per tap and brings all back after the last", () => {
    const once = toggleItemExcluded(data, "bier");
    expect(once.items[1]).toMatchObject({ struck: 1 });
    const twice = toggleItemExcluded(once, "bier");
    expect(twice.items[1]).toMatchObject({ excluded: true });
    expect(twice.items[1].struck).toBeUndefined();
    expect(toggleItemExcluded(twice, "bier").items[1]).toEqual(data.items[1]);
  });

  it("bills only a part of a line and restores it with 1", () => {
    const half = setItemDivisor(data, "milch", 2);
    expect(half.items[0]).toMatchObject({ total: 60, fullTotal: 119, divisor: 2 });
    expect(setItemDivisor(half, "milch", 3).items[0]).toMatchObject({ total: 40, fullTotal: 119, divisor: 3 });
    expect(setItemDivisor(half, "milch", 1).items[0]).toEqual(data.items[0]);
  });

  it("crosses fees and the tip out and back in", () => {
    expect(toggleFeeExcluded(data, "tuete").fees?.[0].excluded).toBe(true);
    expect(toggleFeeExcluded(toggleFeeExcluded(data, "tuete"), "tuete").fees?.[0]).toEqual(data.fees?.[0]);
    expect(toggleTipExcluded(data).tipExcluded).toBe(true);
    expect(toggleTipExcluded(toggleTipExcluded(data)).tipExcluded).toBeUndefined();
  });
});
