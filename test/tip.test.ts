import { describe, expect, it } from "vitest";
import { tipCents, type TipValue } from "../src/components/TipControl";

const base: TipValue = { mode: "percent", percent: "10", total: "", amount: "", persons: "" };

describe("tip input", () => {
  it("takes the tip as an absolute amount, a percentage or the final amount paid", () => {
    expect(tipCents({ ...base, mode: "amount", amount: "5,50" }, 2000, 100)).toBe(550);
    expect(tipCents({ ...base, mode: "amount", amount: "" }, 2000)).toBe(0);
    expect(tipCents(base, 2000)).toBe(200);
    expect(tipCents({ ...base, mode: "total", total: "25" }, 2000, 100)).toBe(400);
  });
});

import { participantShare, unassignedAmount, type BillData, type PublicParticipant } from "../src/lib/bill";

describe("tip in proportion to what everyone had (tipByShare)", () => {
  // Kowalski, 15.10.2026: 208,00 € and 22,00 € tip. Schnitzel 31,50 for Andy, Linguine 23,50 for Peter.
  const data: BillData = {
    title: "C.C. Kowalski",
    date: "2026-10-15",
    currency: "EUR",
    tipPercent: 0,
    tipAmount: 2200,
    tipByShare: true,
    payment: { paypalMe: "nik" },
    items: [
      { id: "schnitzel", name: "Wiener Schnitzel", qty: 4, total: 12600 },
      { id: "linguine", name: "Linguine", qty: 1, total: 2350 },
      { id: "rest", name: "Rest", qty: 1, total: 5850 },
    ],
  };
  const people: PublicParticipant[] = [
    { id: "niklas", name: "Niklas", isOwner: true, claims: { rest: [0] } },
    { id: "andy", name: "Andy", isOwner: false, claims: { schnitzel: [0] } },
    { id: "peter", name: "Peter", isOwner: false, claims: { linguine: [0] } },
  ];

  it("raises every share by the same percentage (22/208 = 10,6 %)", () => {
    expect(participantShare(data, people, "andy")).toEqual({ subtotal: 3150, shared: 333, total: 3483 });
    expect(participantShare(data, people, "peter")).toEqual({ subtotal: 2350, shared: 249, total: 2599 });
    // The three unclaimed Schnitzel carry their tip with them.
    expect(unassignedAmount(data, people)).toBe(9450 + 1000);
  });

  it("keeps the tip per head on bills from before (no flag)", () => {
    const old = { ...data, tipByShare: undefined };
    // 22,00 € / 3 people = 7,33 € each, whatever they had.
    expect(participantShare(old, people, "andy").shared).toBe(733);
    expect(participantShare(old, people, "peter").shared).toBe(733);
  });
});
