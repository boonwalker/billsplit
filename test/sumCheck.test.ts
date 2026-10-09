import { describe, expect, it, vi } from "vitest";
import { readWithSumCheck, reconcileHint, sumsMatch, type ParsedReceipt } from "../src/lib/receipt";

// The Saitong Thai-Imbiss order: the "+2,00" ingredient line is already part of the 13,00.
const base = { merchant: "Saitong Thai-Imbiss", date: "2026-09-27", currency: "EUR", tip: null, delivery: true, supermarket: false, engine: "ai" as const };
const wrong: ParsedReceipt = {
  ...base,
  items: [
    { name: "572. Pad Thai", qty: 1, total: 1300 },
    { name: "Deine Zutat: Hähnchenfleisch", qty: 1, total: 200 },
    { name: "502. Poh Pia Pak", qty: 1, total: 700 },
  ],
  fees: [
    { name: "Servicegebühr", amount: 120 },
    { name: "Rabatte", amount: -500 },
  ],
  total: 1620,
};
const right: ParsedReceipt = { ...wrong, items: [wrong.items[0], wrong.items[2]] };

describe("total check", () => {
  it("detects lines that do not add up to the printed total", () => {
    expect(sumsMatch(wrong)).toBe(false);
    expect(sumsMatch(right)).toBe(true);
    expect(sumsMatch({ ...wrong, total: null })).toBe(true);
  });

  it("tells the second reading what does not add up", () => {
    const hint = reconcileHint(wrong);
    expect(hint).toContain("add up to 18.20");
    expect(hint).toContain("printed total (before tip) is 16.20");
    expect(hint).toContain("difference of 2.00");
    expect(hint).toContain("Deine Zutat: Hähnchenfleisch: 2.00");
  });

  it("reads again with the hint when the sum is off and keeps the corrected result", async () => {
    const read = vi.fn(async (hint?: string) => (hint ? right : wrong));
    await expect(readWithSumCheck(read)).resolves.toBe(right);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls[1][0]).toContain("16.20");
  });

  it("reads only once when the sum matches", async () => {
    const read = vi.fn(async () => right);
    await expect(readWithSumCheck(read)).resolves.toBe(right);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps the first reading when the second one is worse or fails", async () => {
    const worse: ParsedReceipt = { ...wrong, items: [...wrong.items, { name: "Cola", qty: 1, total: 300 }] };
    await expect(readWithSumCheck(async (hint) => (hint ? worse : wrong))).resolves.toBe(wrong);
    await expect(
      readWithSumCheck(async (hint) => {
        if (hint) throw new Error("rate limited");
        return wrong;
      }),
    ).resolves.toBe(wrong);
  });
});
