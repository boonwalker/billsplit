import { describe, expect, it } from "vitest";
import {
  billIdFromUrl,
  billTotal,
  billUrl,
  claimCost,
  isFullyAssigned,
  participantShare,
  feesTotal,
  sanitizeClaims,
  sharedTotal,
  splitHeadCount,
  sharedPerPerson,
  tipTotal,
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

  it("splits the tip equally among everyone who joined", () => {
    // 10 % of 33,00 € = 3,30 € tip, 2 people -> 1,65 € each
    const ps = [p("owner", { pizza: 1 }, true), p("anna", { bier: 2, tira: 1 })];
    expect(billTotal(data)).toBe(3630);
    expect(splitHeadCount(data, ps)).toBe(2);
    expect(participantShare(data, ps, "anna")).toEqual({ subtotal: 1400, shared: 165, total: 1565 });
    expect(participantShare(data, ps, "owner")).toEqual({ subtotal: 950, shared: 165, total: 1115 });
    expect(participantShare(data, ps, "nobody").total).toBe(0);
    // 1 Bier + 1 Tiramisu are left, nobody else is expected
    expect(unassignedAmount(data, ps)).toBe(950);
  });

  it("uses the payer's expected head count while people are missing", () => {
    const fixed: BillData = { ...data, tipPercent: 0, tipAmount: 400, tipSplitCount: 4 };
    const ps = [p("owner", {}, true), p("anna", { bier: 1 })];
    expect(splitHeadCount(fixed, ps)).toBe(4);
    expect(participantShare(fixed, ps, "anna")).toEqual({ subtotal: 450, shared: 100, total: 550 });
    // all items except one beer are open, plus the tip parts of the 2 missing people
    expect(unassignedAmount(fixed, ps)).toBe(3300 - 450 + 200);
    // more people than expected joined -> everyone counts
    const five = [...ps, p("ben", {}), p("clara", {}), p("dora", {})];
    expect(splitHeadCount(fixed, five)).toBe(5);
    expect(sharedPerPerson(fixed, five)).toBe(80);
  });

  it("splits delivery and service fees equally per person, together with the tip", () => {
    const delivery: BillData = {
      ...data,
      tipPercent: 0,
      tipAmount: 200,
      tipSplitCount: 3,
      fees: [
        { id: "f1", name: "Liefergebühr", amount: 299 },
        { id: "f2", name: "Servicegebühr", amount: 101 },
      ],
    };
    const ps = [p("owner", { pizza: 1 }, true), p("anna", { bier: 2 })];
    expect(feesTotal(delivery)).toBe(400);
    expect(sharedTotal(delivery)).toBe(600);
    expect(billTotal(delivery)).toBe(3300 + 600);
    // 3 people expected: 6,00 € / 3 = 2,00 € each
    expect(participantShare(delivery, ps, "anna")).toEqual({ subtotal: 900, shared: 200, total: 1100 });
    // open items (1 Bier, 2 Tiramisu = 1450) plus the share of the person still missing
    expect(unassignedAmount(delivery, ps)).toBe(1450 + 200);
  });

  it("prefers the fixed tip over the percentage", () => {
    expect(tipTotal({ ...data, tipPercent: 10, tipAmount: 500 })).toBe(500);
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
