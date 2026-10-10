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
    ...debtors.map((d, i) => ({ id: `d${i}`, name: d.name, isOwner: false, claims: { [d.item]: [0] } })),
  ],
  me: "me",
  isOwner: true,
  debtors: debtors.map((d, i) => ({ id: `d${i}`, name: d.name, joinedAt: "", amount: d.amount, received: Boolean(d.received) })),
});

const guest = (ownerName: string, markedPaid = false): BillSnapshot => ({
  id: "g",
  createdAt: "",
  data: data(),
  ownerName,
  participants: [
    { id: "o", name: ownerName, isOwner: true, claims: {} },
    { id: "me", name: "Niklas", isOwner: false, claims: { b: [0] } },
  ],
  me: "me",
  isOwner: false,
  myPayment: markedPaid ? { at: "", amount: 800, markedPaidAt: "x" } : undefined,
});

describe("balances over all bills", () => {
  it("adds up what is lent and owed, per person by name", () => {
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
});
