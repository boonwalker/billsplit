import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";

const bill = (title: string, items: [string, number, number][]): BillData => ({
  title,
  date: "",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "x" },
  items: items.map(([id, qty, total]) => ({ id, name: id, qty, total })),
});

describe("Safari and the home-screen app become one person", () => {
  it("moves bills, ticks and payments from the Safari identity to the app's", () => {
    const store = new BillStore(null);
    const trattoria = store.createBill(bill("Trattoria", [["pizza", 1, 950], ["bier", 3, 1350]]), "niklas", "Niklas");
    store.join(trattoria, "anna-safari", "Anna");
    store.setClaims(trattoria, "anna-safari", { pizza: [0] });
    store.recordPayClick(trattoria, "anna-safari");
    store.setMarkedPaid(trattoria, "anna-safari", true);

    expect(store.mergeParticipant("anna-safari", "anna-app")).toEqual([trattoria]);
    const view = store.snapshot(trattoria, "anna-app");
    expect(view.me).toBe("anna-app");
    expect(view.participants.map((p) => [p.id, p.name])).toEqual([
      ["niklas", "Niklas"],
      ["anna-app", "Anna"],
    ]);
    expect(view.myPayment).toMatchObject({ amount: 950 });
    expect(store.snapshot(trattoria, "niklas").debtors?.[0]).toMatchObject({ id: "anna-app", markedPaidAt: expect.any(String) });
    expect(store.myBills("anna-app")).toHaveLength(1);
    expect(store.myBills("anna-safari")).toHaveLength(0);
  });

  it("combines what both did in the same bill, keeping the earlier place", () => {
    const store = new BillStore(null);
    const id = store.createBill(bill("Biergarten", [["bier", 3, 1350], ["brezn", 1, 300]]), "niklas", "Niklas");
    store.join(id, "anna-safari", "Anna");
    store.setClaims(id, "anna-safari", { bier: [0] });
    store.join(id, "ben", "Ben");
    store.join(id, "anna-app", "Anna");
    store.setClaims(id, "anna-app", { bier: [2], brezn: [0] });
    store.mergeParticipant("anna-safari", "anna-app");
    const view = store.snapshot(id, "anna-app");
    expect(view.participants.map((p) => p.id)).toEqual(["niklas", "anna-app", "ben"]);
    expect(view.participants.find((p) => p.id === "anna-app")?.claims).toEqual({ bier: [0, 2], brezn: [0] });
  });

  it("keeps settlement payments and their shares with the person", () => {
    const store = new BillStore(null);
    const id = store.createBill(bill("Kino", [["ticket", 1, 900]]), "katia", "Katia");
    store.join(id, "me-safari", "Niklas");
    store.setClaims(id, "me-safari", { ticket: [0] });
    store.createTransfer("me-safari", { toId: "katia", amount: 900, currency: "EUR", allocations: [{ billId: id, debtorId: "me-safari", creditorId: "katia", amount: 900 }] });
    store.mergeParticipant("me-safari", "me-app");
    expect(store.listTransfers("me-app")[0]).toMatchObject({ fromId: "me-app", toId: "katia", status: "pending" });
    expect(store.listTransfers("me-app")[0].allocations[0]).toMatchObject({ debtorId: "me-app" });
    expect(store.network("me-app")).toEqual([]);
  });

  it("hands a bill the Safari identity paid to the app", () => {
    const store = new BillStore(null);
    const id = store.createBill(bill("Café", [["kuchen", 1, 400]]), "me-safari", "Niklas");
    store.mergeParticipant("me-safari", "me-app");
    expect(store.snapshot(id, "me-app").isOwner).toBe(true);
  });
});
