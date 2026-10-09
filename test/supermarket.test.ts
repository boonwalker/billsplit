import { describe, expect, it } from "vitest";
import { applyMarks, isStrikeThrough } from "../src/components/SupermarketSheet";
import { parseReceiptText } from "../src/lib/receipt";

const items = [
  { id: "milch", name: "Vollmilch 1l", qty: 1, total: 119 },
  { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
  { id: "dusch", name: "Duschgel", qty: 1, total: 195 },
];

describe("supermarket receipts", () => {
  it("leaves crossed-out lines out and bills divided lines in part", () => {
    expect(applyMarks(items, { milch: { divisor: 4 }, dusch: { struck: true } })).toEqual([
      { id: "milch", name: "Vollmilch 1l", qty: 1, total: 30, fullTotal: 119, divisor: 4 },
      { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
    ]);
    expect(applyMarks(items, { nudeln: { divisor: 1 } })).toEqual(items);
  });

  it("tells a crossing-out stroke from writing", () => {
    const flat = [{ x: 10, y: 50 }, { x: 150, y: 56 }, { x: 290, y: 48 }];
    expect(isStrikeThrough([flat], 300)).toBe(true);
    expect(isStrikeThrough([[{ x: 10, y: 80 }, { x: 40, y: 20 }]], 300)).toBe(false);
    expect(isStrikeThrough([flat, flat], 300)).toBe(false);
  });

  it("recognises a supermarket in the OCR fallback", () => {
    expect(parseReceiptText("REWE Markt GmbH\nVollmilch 1,19\nSUMME 1,19").supermarket).toBe(true);
    expect(parseReceiptText("Trattoria Roma\nPizza 9,50\nSumme 9,50").supermarket).toBe(false);
  });
});
