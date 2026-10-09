import { describe, expect, it } from "vitest";
import { applyMarks, orderForMarking } from "../src/components/SupermarketSheet";
import { looksPersonal } from "../src/lib/personal";
import { parseReceiptText } from "../src/lib/receipt";

const items = [
  { id: "milch", name: "Vollmilch 1l", qty: 1, total: 119 },
  { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
  { id: "dusch", name: "Duschgel", qty: 1, total: 195 },
];

describe("supermarket receipts", () => {
  it("leaves crossed-out lines out", () => {
    expect(applyMarks(items, { dusch: { struck: true }, milch: { struck: false } }).map((i) => i.id)).toEqual(["milch", "nudeln"]);
    expect(applyMarks(items, {})).toEqual(items);
  });

  it("lists items that are probably not shared first", () => {
    expect(orderForMarking(items, (i) => looksPersonal(i.name)).map((i) => i.id)).toEqual(["milch", "dusch", "nudeln"]);
    for (const name of ["Balea Duschgel", "Zewa Küchenrolle", "Jodsalz", "Gewürzmischung", "Vollmilch 3,5%"]) expect(looksPersonal(name)).toBe(true);
    for (const name of ["Spaghetti", "Gewürzgurken", "Salzstangen", "Milchschokolade", "Kokosmilch", "Tortilla Chips"]) expect(looksPersonal(name)).toBe(false);
  });

  it("recognises a supermarket in the OCR fallback", () => {
    expect(parseReceiptText("REWE Markt GmbH\nVollmilch 1,19\nSUMME 1,19").supermarket).toBe(true);
    expect(parseReceiptText("Trattoria Roma\nPizza 9,50\nSumme 9,50").supermarket).toBe(false);
  });
});
