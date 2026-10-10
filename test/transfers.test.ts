import { describe, expect, it } from "vitest";
import { BillStore, StoreError } from "../server/store";
import type { BillData } from "../src/lib/bill";
import { sameAllocations, settlementWith } from "../src/lib/settle";

const bill = (title: string, items: [string, number][]): BillData => ({
  title,
  date: "",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: title.toLowerCase() },
  items: items.map(([id, total]) => ({ id, name: id, qty: 1, total })),
});

/**
 * Andy paid "Pizzeria": I (me) had the pizza (5 €). Katia paid "Kino": Andy had a ticket (5 €),
 * and I was there too (my popcorn, 3 €). So I owe Andy 5 €, Andy owes Katia 5 € – and as I
 * take part in Katia's bill, I can see that.
 */
function setup() {
  const store = new BillStore(null);
  const [me, andy, katia] = ["me", "andy", "katia"];
  const pizzeria = store.createBill(bill("Pizzeria", [["pizza", 500]]), andy, "Andy");
  store.join(pizzeria, me, "Niklas");
  store.setClaims(pizzeria, me, { pizza: [0] });
  const kino = store.createBill(bill("Kino", [["ticket", 500], ["popcorn", 300]]), katia, "Katia");
  store.join(kino, andy, "Andy");
  store.setClaims(kino, andy, { ticket: [0] });
  store.join(kino, me, "Niklas");
  store.setClaims(kino, me, { popcorn: [0] });
  return { store, me, andy, katia, pizzeria, kino };
}

describe("settlement payments", () => {
  it("shows the open shares of every bill the viewer takes part in", () => {
    const { store, me, pizzeria, kino } = setup();
    const edges = store.network(me).map((e) => [e.billId, e.debtorName, e.creditorName, e.amount]);
    expect(edges).toEqual([
      [pizzeria, "Niklas", "Andy", 500],
      [kino, "Andy", "Katia", 500],
      [kino, "Niklas", "Katia", 300],
    ]);
  });

  it("lets me pay Katia what I owe Andy, settling Andy's debt with Katia once she confirms", () => {
    const { store, me, andy, katia, pizzeria, kino } = setup();
    const id = store.createTransfer(me, {
      toId: katia,
      amount: 800,
      currency: "EUR",
      allocations: [
        { billId: pizzeria, debtorId: me, creditorId: andy, amount: 500 },
        { billId: kino, debtorId: andy, creditorId: katia, amount: 500 },
        { billId: kino, debtorId: me, creditorId: katia, amount: 300 },
      ],
    });
    // While it waits, nothing is open any more (nobody pays twice) …
    expect(store.network(me)).toEqual([]);
    expect(store.snapshot(kino, andy).myCredit).toMatchObject({ confirmed: 0, pending: 500 });
    // … and the recipient sees it in her bill.
    expect(store.snapshot(kino, katia).debtors?.find((d) => d.id === andy)).toMatchObject({ creditPending: 500, credited: 0 });
    expect(() => store.decideTransfer(andy, id, "confirm")).toThrow(StoreError);
    store.decideTransfer(katia, id, "confirm");
    expect(store.snapshot(pizzeria, andy).debtors?.[0]).toMatchObject({ id: me, credited: 500, creditPending: 0 });
    expect(store.listTransfers(andy)[0]).toMatchObject({ status: "confirmed", fromName: "Niklas", toName: "Katia" });
  });

  it("gives the shares back when the recipient says the money did not arrive", () => {
    const { store, me, andy, katia, pizzeria, kino } = setup();
    const id = store.createTransfer(me, {
      toId: katia,
      amount: 500,
      currency: "EUR",
      allocations: [
        { billId: pizzeria, debtorId: me, creditorId: andy, amount: 500 },
        { billId: kino, debtorId: andy, creditorId: katia, amount: 500 },
      ],
    });
    store.decideTransfer(katia, id, "reject");
    expect(store.network(me).map((e) => e.amount)).toEqual([500, 500, 300]);
  });

  it("refuses anything that does not add up or is not open", () => {
    const { store, me, andy, katia, pizzeria, kino } = setup();
    const attempt = (amount: number, allocations: { billId: string; debtorId: string; creditorId: string; amount: number }[], toId = katia) => () =>
      store.createTransfer(me, { toId, amount, currency: "EUR", allocations });
    // Paying Katia less than the shares it is to settle.
    expect(attempt(400, [{ billId: kino, debtorId: me, creditorId: katia, amount: 300 }, { billId: kino, debtorId: andy, creditorId: katia, amount: 100 }])).toThrow(/geht nicht auf/);
    // Settling Andy's debt with Katia without paying anything for him (Andy would gain).
    expect(attempt(800, [{ billId: kino, debtorId: me, creditorId: katia, amount: 300 }, { billId: kino, debtorId: andy, creditorId: katia, amount: 500 }])).toThrow(/geht nicht auf/);
    // More than is open.
    expect(attempt(600, [{ billId: pizzeria, debtorId: me, creditorId: andy, amount: 600 }], andy)).toThrow(/geändert/);
    // A wrong creditor.
    expect(attempt(300, [{ billId: kino, debtorId: me, creditorId: andy, amount: 300 }], andy)).toThrow(/Ungültige/);
    // Bills the payer does not take part in.
    const other = store.createBill(bill("Bar", [["wine", 900]]), katia, "Katia");
    store.join(other, andy, "Andy");
    store.setClaims(other, andy, { wine: [0] });
    expect(attempt(500, [{ billId: pizzeria, debtorId: me, creditorId: andy, amount: 500 }, { billId: other, debtorId: andy, creditorId: katia, amount: 500 }])).toThrow(/teilnimmst/);
  });

  it("lets only the payer take a waiting payment back", () => {
    const { store, me, andy, katia, kino } = setup();
    const id = store.createTransfer(me, { toId: katia, amount: 300, currency: "EUR", allocations: [{ billId: kino, debtorId: me, creditorId: katia, amount: 300 }] });
    expect(() => store.decideTransfer(andy, id, "cancel")).toThrow(StoreError);
    store.decideTransfer(me, id, "cancel");
    expect(() => store.decideTransfer(katia, id, "confirm")).toThrow(/abgeschlossen/);
  });

  it("lets the recipient record money that arrived outside the app – confirmed right away", () => {
    const { store, me, andy, pizzeria } = setup();
    const notices: [string, string][] = [];
    store.onNotice((pid, n) => notices.push([pid, n.title]));
    // Andy records that I paid him the 5 € for the pizza.
    store.createTransfer(andy, { fromId: me, toId: andy, amount: 500, currency: "EUR", allocations: [{ billId: pizzeria, debtorId: me, creditorId: andy, amount: 500 }] });
    expect(store.listTransfers(me)[0]).toMatchObject({ status: "confirmed", recordedByRecipient: true, fromName: "Niklas", toName: "Andy" });
    expect(store.snapshot(pizzeria, andy).debtors?.[0]).toMatchObject({ credited: 500, creditPending: 0 });
    expect(notices).toEqual([[me, "Andy hat Deinen Ausgleich eingetragen"]]);
    // Only for money to oneself, and never as an offset of nothing.
    expect(() => store.createTransfer(andy, { fromId: me, toId: "katia", amount: 300, currency: "EUR", allocations: [] })).toThrow(/an Dich/);
  });

  it("offsets debts that cancel out exactly once the other side agrees", () => {
    const store = new BillStore(null);
    const [me, anna] = ["me", "anna"];
    const mine = store.createBill(bill("Bar", [["wine", 700]]), me, "Niklas");
    store.join(mine, anna, "Anna");
    store.setClaims(mine, anna, { wine: [0] });
    const hers = store.createBill(bill("Café", [["cake", 700]]), anna, "Anna");
    store.join(hers, me, "Niklas");
    store.setClaims(hers, me, { cake: [0] });
    const notices: [string, string][] = [];
    store.onNotice((pid, n) => notices.push([pid, n.title]));
    const id = store.createTransfer(me, {
      toId: anna,
      amount: 0,
      currency: "EUR",
      allocations: [
        { billId: hers, debtorId: me, creditorId: anna, amount: 700 },
        { billId: mine, debtorId: anna, creditorId: me, amount: 700 },
      ],
    });
    expect(store.network(me)).toEqual([]);
    expect(notices).toEqual([[anna, "Niklas möchte gegenseitig verrechnen"]]);
    store.decideTransfer(anna, id, "confirm");
    expect(notices[1]).toEqual([me, "Anna hat die Verrechnung bestätigt ✓"]);
    // A zero payment that settles only one side does not add up.
    expect(() =>
      store.createTransfer(me, { toId: anna, amount: 0, currency: "EUR", allocations: [{ billId: hers, debtorId: me, creditorId: anna, amount: 1 }] }),
    ).toThrow();
  });

  it("tells the people involved what needs them", () => {
    const { store, me, andy, katia, pizzeria, kino } = setup();
    const notices: [string, string][] = [];
    store.onNotice((pid, n) => notices.push([pid, n.title.replace(/\s/g, " ")]));
    store.recordPayClick(pizzeria, me);
    store.setMarkedPaid(pizzeria, me, true);
    store.setMarkedPaid(pizzeria, me, true);
    const id = store.createTransfer(me, { toId: katia, amount: 300, currency: "EUR", allocations: [{ billId: kino, debtorId: me, creditorId: katia, amount: 300 }] });
    store.decideTransfer(katia, id, "reject");
    expect(notices).toEqual([
      [andy, "Niklas hat bezahlt"],
      [katia, "Niklas hat Dir 3,00 € gesendet"],
      [me, "Katia hat 3,00 € nicht erhalten"],
    ]);
  });

  it("settles everything with one person in one payment, from their side or mine", () => {
    const { store, me, andy, pizzeria } = setup();
    // Andy also owes me 2 € from my bill.
    const mine = store.createBill(bill("Eis", [["eis", 200]]), me, "Niklas");
    store.join(mine, andy, "Andy");
    store.setClaims(mine, andy, { eis: [0] });
    const s = settlementWith(me, andy, store.network(me), "EUR");
    expect([s.owed, s.lent, s.net]).toEqual([500, 200, -300]);
    expect(s.payment).toEqual({ paypalMe: "pizzeria" });
    expect(s.edges.map((e) => e.billId).sort()).toEqual([mine, pizzeria].sort());
    // Andy sees the same from his side and records the 3 € he got from me.
    const his = settlementWith(andy, me, store.network(andy), "EUR");
    expect(his.net).toBe(300);
    expect(sameAllocations(his.allocations, s.allocations)).toBe(true);
    store.createTransfer(andy, { fromId: me, toId: andy, amount: his.net, currency: "EUR", allocations: his.allocations });
    expect(settlementWith(me, andy, store.network(me), "EUR").edges).toEqual([]);
    expect(sameAllocations(s.allocations, [{ ...s.allocations[0], amount: 1 }, s.allocations[1]])).toBe(false);
  });
});
