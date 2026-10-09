import { describe, expect, it } from "vitest";
import { applyChoices } from "../src/components/SupermarketSheet";
import { parseReceiptText } from "../src/lib/receipt";

const items = [
  { id: "milch", name: "Vollmilch 1l", qty: 1, total: 119 },
  { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
  { id: "dusch", name: "Duschgel", qty: 1, total: 195 },
];

describe("supermarket receipts", () => {
  it("bills items fully, partly or not at all", () => {
    const billed = applyChoices(items, {
      milch: { mode: "part", percent: "25" },
      dusch: { mode: "none", percent: "25" },
    });
    expect(billed).toEqual([
      { id: "milch", name: "Vollmilch 1l (¼)", qty: 1, total: 30 },
      { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
    ]);
    expect(applyChoices(items, { nudeln: { mode: "part", percent: "40" } })[1]).toMatchObject({ name: "Spaghetti (40 %)", total: 103 });
  });

  it("recognises a supermarket in the OCR fallback", () => {
    expect(parseReceiptText("REWE Markt GmbH\nVollmilch 1,19\nSUMME 1,19").supermarket).toBe(true);
    expect(parseReceiptText("Trattoria Roma\nPizza 9,50\nSumme 9,50").supermarket).toBe(false);
  });
});
