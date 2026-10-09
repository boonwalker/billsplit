import { describe, expect, it } from "vitest";
import {
  billIdFromUrl,
  billTotal,
  billUrl,
  claimCost,
  isFullyAssigned,
  participantShare,
  sanitizeClaims,
  unassignedAmount,
  type BillData,
  type PublicParticipant,
} from "../src/lib/bill";

const data: BillData = {
  title: "Trattoria Da Mario",
  date: "2026-10-08",
  currency: "EUR",
  tipPercent: 10,
  payment: { paypalMe: "niklas" },
  items: [
    { id: "pizza", name: "Pizza Margherita", qty: 1, total: 950 },
    { id: "bier", name: "Bier 0,5l", qty: 3, total: 1350 },
    { id: "tira", name: "Tiramisu", qty: 2, total: 1000 },
  ],
};

const p = (id: string, claims: Record<string, number>, isOwner = false): PublicParticipant => ({ id, name: id, isOwner, claims });

describe("claims", () => {
  it("charges per claimed unit of multi-quantity lines", () => {
    expect(claimCost(data.items[1], 1, 1)).toBe(450);
    expect(claimCost(data.items[1], 2, 3)).toBe(900);
    expect(claimCost(data.items[1], 0, 3)).toBe(0);
  });

  it("splits a line when more units are claimed than exist", () => {
    // Two people tick the same pizza -> each pays half.
    expect(claimCost(data.items[0], 1, 2)).toBe(475);
  });

  it("detects fully assigned lines", () => {
    const ps = [p("a", { bier: 2 }), p("b", { bier: 1, pizza: 1 })];
    expect(isFullyAssigned(data.items[1], ps)).toBe(true);
    expect(isFullyAssigned(data.items[0], ps)).toBe(true);
    expect(isFullyAssigned(data.items[2], ps)).toBe(false);
  });

  it("computes shares including tip and the unassigned rest", () => {
    const ps = [p("owner", { pizza: 1 }, true), p("anna", { bier: 2, tira: 1 })];
    expect(participantShare(data, ps, "anna")).toEqual({ subtotal: 1400, tip: 140, total: 1540 });
    expect(participantShare(data, ps, "owner").total).toBe(1045);
    expect(participantShare(data, ps, "nobody").total).toBe(0);
    // 1 Bier + 1 Tiramisu are left: 950 + 10 %
    expect(unassignedAmount(data, ps)).toBe(1045);
    expect(billTotal(data)).toBe(3630);
  });

  it("splits a fixed tip in proportion to the shares", () => {
    const fixed: BillData = { ...data, tipPercent: 0, tipAmount: 330 }; // 3,30 € on 33,00 €
    const ps = [p("owner", { pizza: 1 }, true), p("anna", { bier: 2, tira: 1 })];
    expect(billTotal(fixed)).toBe(3630);
    expect(participantShare(fixed, ps, "anna")).toEqual({ subtotal: 1400, tip: 140, total: 1540 });
    expect(participantShare(fixed, ps, "owner")).toEqual({ subtotal: 950, tip: 95, total: 1045 });
    expect(unassignedAmount(fixed, ps)).toBe(1045);
  });

  it("prefers the fixed tip over the percentage", () => {
    expect(billTotal({ ...data, tipPercent: 10, tipAmount: 500 })).toBe(3800);
    expect(billTotal({ ...data, tipPercent: 0, tipAmount: undefined })).toBe(3300);
  });

  it("drops unknown items and clamps units", () => {
    expect(sanitizeClaims({ bier: 7, gone: 1, pizza: 0, tira: 1.7 }, data.items)).toEqual({ bier: 3, tira: 1 });
  });
});

describe("links", () => {
  it("puts bill id and recipient into the QR link", () => {
    const url = billUrl("AbCdEf123", "https://billsplit.app/#/old", { paypalMe: "niklas" });
    expect(url).toBe("https://billsplit.app/#/b/AbCdEf123?to=niklas");
    expect(billIdFromUrl(url)).toBe("AbCdEf123");
    expect(billIdFromUrl("https://example.com")).toBeNull();
  });
});
