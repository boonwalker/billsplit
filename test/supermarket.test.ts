import { describe, expect, it } from "vitest";
import { applyMarks, markDivisor, orderForMarking } from "../src/components/SupermarketSheet";
import { looksPersonal } from "../src/lib/personal";
import { parseReceiptText } from "../src/lib/receipt";

const items = [
  { id: "milch", name: "Vollmilch 1l", qty: 1, total: 119 },
  { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
  { id: "dusch", name: "Duschgel", qty: 1, total: 195 },
];

describe("supermarket receipts", () => {
  it("leaves crossed-out lines out and divides tapped lines by the number of people", () => {
    expect(applyMarks(items, { milch: { perPerson: true }, dusch: { struck: true } }, 4)).toEqual([
      { id: "milch", name: "Vollmilch 1l", qty: 1, total: 30, fullTotal: 119, divisor: 4 },
      { id: "nudeln", name: "Spaghetti", qty: 2, total: 258 },
    ]);
    expect(applyMarks(items, {})).toEqual(items);
  });

  it("follows the head count set below", () => {
    expect(applyMarks(items, { dusch: { perPerson: true } }, 3)[2]).toMatchObject({ total: 65, fullTotal: 195, divisor: 3 });
    // Without a head count the price stays as it is until one is set.
    expect(applyMarks(items, { dusch: { perPerson: true } })[2]).toEqual(items[2]);
    expect(markDivisor({ struck: true }, 2)).toBe(1);
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
