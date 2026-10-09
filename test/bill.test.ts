import { describe, expect, it } from "vitest";
import { billId, billUrl, claimAmount, computeShare, decodeBill, encodeBill, type Bill } from "../src/lib/bill";

const bill: Bill = {
  title: "Trattoria Da Mario",
  date: "2026-10-08",
  currency: "EUR",
  payerName: "Niklas",
  tipPercent: 10,
  payment: { paypal: "niklas", iban: "DE89370400440532013000", accountHolder: "Niklas B.", cash: true },
  items: [
    { name: "Pizza Margherita", qty: 1, total: 950 },
    { name: "Bier 0,5l", qty: 3, total: 1350 },
    { name: "Tiramisu", qty: 2, total: 1000 },
  ],
};

describe("encodeBill / decodeBill", () => {
  it("round-trips a bill", () => {
    const encoded = encodeBill(bill);
    expect(encoded).toMatch(/^[A-Za-z0-9+\-$]+$/);
    expect(decodeBill(encoded)).toEqual(bill);
  });

  it("omits empty payment fields", () => {
    const decoded = decodeBill(encodeBill({ ...bill, payment: { paypal: "x" } }));
    expect(decoded?.payment).toEqual({ paypal: "x", iban: undefined, accountHolder: undefined, cash: false });
  });

  it("rejects garbage", () => {
    expect(decodeBill("not-a-bill")).toBeNull();
    expect(decodeBill("")).toBeNull();
  });

  it("keeps a typical 25-item bill small enough for a scannable QR code", () => {
    const big: Bill = {
      ...bill,
      items: Array.from({ length: 25 }, (_, i) => ({ name: `Gericht Nummer ${i} mit Beilage`, qty: (i % 3) + 1, total: 1000 + i * 37 })),
    };
    const url = billUrl(encodeBill(big), "https://billsplit.example.com/");
    expect(url.length).toBeLessThan(1500);
  });

  it("derives a stable id", () => {
    const encoded = encodeBill(bill);
    expect(billId(encoded)).toBe(billId(encoded));
    expect(billId(encoded)).not.toBe(billId(encodeBill({ ...bill, title: "Other" })));
  });
});

describe("billUrl", () => {
  it("replaces an existing hash", () => {
    expect(billUrl("abc", "https://x.de/app/#/share/zzz")).toBe("https://x.de/app/#/b/abc");
  });
});

describe("shares", () => {
  it("charges per claimed unit of multi-quantity lines", () => {
    expect(claimAmount(bill.items[1], { units: 1, shareCount: 1 })).toBe(450);
    expect(claimAmount(bill.items[1], { units: 2, shareCount: 1 })).toBe(900);
    expect(claimAmount(bill.items[1], { units: 5, shareCount: 1 })).toBe(1350);
    expect(claimAmount(bill.items[1], { units: 0, shareCount: 1 })).toBe(0);
  });

  it("splits shared items", () => {
    expect(claimAmount(bill.items[0], { units: 1, shareCount: 2 })).toBe(475);
  });

  it("sums up claims and adds the tip", () => {
    const share = computeShare(bill, {
      0: { units: 1, shareCount: 1 },
      1: { units: 2, shareCount: 1 },
    });
    expect(share).toEqual({ subtotal: 1850, tip: 185, total: 2035 });
  });
});
