import { describe, expect, it } from "vitest";
import { computeBalances } from "../src/lib/balances";
import type { BillData, BillSnapshot } from "../src/lib/bill";

const data = (over: Partial<BillData> = {}): BillData => ({
  title: "T",
  date: "2026-10-10",
  currency: "EUR",
  items: [
    { id: "a", name: "Pizza", qty: 1, total: 1000 },
    { id: "b", name: "Pasta", qty: 1, total: 800 },
    { id: "c", name: "Wein", qty: 1, total: 600 },
  ],
  tipPercent: 0,
  payment: { paypalMe: "nik" },
  ...over,
});

const owner = (debtors: { name: string; amount: number; item: string; received?: boolean }[]): BillSnapshot => ({
  id: "o",
  createdAt: "",
  data: data(),
  ownerName: "Niklas",
  participants: [
    { id: "me", name: "Niklas", isOwner: true, claims: { a: [0] } },
    ...debtors.map((d) => ({ id: `d-${d.name.toLowerCase()}`, name: d.name, isOwner: false, claims: { [d.item]: [0] } })),
  ],
  me: "me",
  isOwner: true,
  debtors: debtors.map((d) => ({ id: `d-${d.name.toLowerCase()}`, name: d.name, joinedAt: "", amount: d.amount, received: Boolean(d.received) })),
});

/** In someone else's bill; their participant id is the one they have in every bill. */
const guest = (ownerName: string, markedPaid = false, ownerId = `d-${ownerName.trim().toLowerCase()}`): BillSnapshot => ({
  id: "g",
  createdAt: "",
  data: data(),
  ownerName,
  participants: [
    { id: ownerId, name: ownerName, isOwner: true, claims: {} },
    { id: "me", name: "Niklas", isOwner: false, claims: { b: [0] } },
  ],
  me: "me",
  isOwner: false,
  myPayment: markedPaid ? { at: "", amount: 800, markedPaidAt: "x" } : undefined,
});

describe("balances over all bills", () => {
  it("adds up what is lent and owed, per person (by participant id, not by name)", () => {
    // Owner paid 24 €, has the pizza himself; Anna owes the pasta, Ben already paid the wine.
    const [eur] = computeBalances([
      owner([
        { name: "Anna", amount: 800, item: "b" },
        { name: "Ben", amount: 600, item: "c", received: true },
      ]),
      guest("anna "),
      guest("Ben", true),
    ]);
    expect(eur.lent).toBe(800);
    expect(eur.owed).toBe(800);
    expect(eur.unassigned).toBe(0);
    const anna = eur.people.find((p) => p.name === "Anna")!;
    expect(anna).toMatchObject({ lent: 800, owed: 800, bills: 2 });
    expect(eur.people.find((p) => p.name === "Ben")).toMatchObject({ lent: 0, owed: 0, bills: 2 });
  });

  it("keeps what nobody ticked yet as lent but not with a person", () => {
    const [eur] = computeBalances([owner([{ name: "Anna", amount: 800, item: "b" }])]);
    expect(eur.lent).toBe(1400);
    expect(eur.unassigned).toBe(600);
  });

  it("keeps every open amount with its bill, for settling bill by bill", () => {
    const [eur] = computeBalances([owner([{ name: "Anna", amount: 800, item: "b" }]), { ...guest("Anna"), id: "g2" }]);
    const anna = eur.people[0];
    expect(anna.entries.map((e) => [e.billId, e.direction, e.amount, e.debtorId])).toEqual([
      ["o", "lent", 800, "d-anna"],
      ["g2", "owed", 800, undefined],
    ]);
    expect(anna.lent - anna.owed).toBe(0);
    expect(anna.payment).toEqual({ paypalMe: "nik" });
  });

  it("counts only what was added after paying, and nothing once the payer confirmed it", () => {
    const paidLess: BillSnapshot = { ...guest("Lisa"), myPayment: { at: "", amount: 500, markedPaidAt: "x" } };
    expect(computeBalances([paidLess])[0].owed).toBe(300);
    expect(computeBalances([{ ...guest("Lisa"), myReceived: true }])[0].owed).toBe(0);
    // A friend who marked their share as paid counts as settled for that amount.
    const marked = owner([{ name: "Anna", amount: 800, item: "b" }]);
    marked.debtors![0] = { ...marked.debtors![0], payAmount: 800, markedPaidAt: "x" };
    expect(computeBalances([marked])[0].people[0].lent).toBe(0);
  });

  it("keeps two people with the same name apart", () => {
    const [eur] = computeBalances([guest("Anna", false, "anna-1"), { ...guest("Anna", false, "anna-2"), id: "g2" }]);
    expect(eur.people.map((p) => [p.id, p.owed])).toEqual([
      ["anna-1", 800],
      ["anna-2", 800],
    ]);
  });
});
