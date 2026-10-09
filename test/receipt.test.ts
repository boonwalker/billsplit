import { describe, expect, it } from "vitest";
import { parseReceiptText } from "../src/lib/receipt";

describe("parseReceiptText", () => {
  it("parses a typical German restaurant receipt", () => {
    const text = `
      Trattoria Da Mario
      Hauptstraße 12, 10115 Berlin
      Tisch 7      Bediener: Anna
      08.10.2026  20:41
      1 Pizza Margherita        9,50 A
      3 x Bier 0,5l              13,50 A
      2x Tiramisu à 5,00        10,00 A
      Spaghetti Carbonara      12,90
      2 x 2,80
      Wasser 0,25l               5,60
      Zwischensumme             51,50
      SUMME EUR                 51,50
      MwSt 19%                   8,22
      Gegeben Karte             51,50
    `;
    const r = parseReceiptText(text);
    expect(r.merchant).toBe("Trattoria Da Mario");
    expect(r.date).toBe("2026-10-08");
    expect(r.total).toBe(5150);
    expect(r.items).toEqual([
      { name: "Pizza Margherita", qty: 1, total: 950 },
      { name: "Bier 0,5l", qty: 3, total: 1350 },
      { name: "Tiramisu", qty: 2, total: 1000 },
      { name: "Spaghetti Carbonara", qty: 1, total: 1290 },
      { name: "Wasser 0,25l", qty: 2, total: 560 },
    ]);
    expect(r.items.reduce((s, i) => s + i.total, 0)).toBe(r.total);
  });

  it("keeps discounts as negative lines", () => {
    const r = parseReceiptText("Pizza 10,00\nRabatt -2,00\nTotal 8,00");
    expect(r.items).toEqual([
      { name: "Pizza", qty: 1, total: 1000 },
      { name: "Rabatt", qty: 1, total: -200 },
    ]);
    expect(r.total).toBe(800);
  });
});
