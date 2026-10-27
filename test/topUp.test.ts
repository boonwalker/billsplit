import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";
import { myOpen } from "../src/lib/balances";
import { ownerSummary } from "../src/components/OwnerPanel";

const data: BillData = {
  title: "Hallmackenreuther",
  date: "2026-10-27",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "peter" },
  items: [
    { id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 },
    { id: "weizen", name: "Weizen Alkoholfrei", qty: 2, total: 1000 },
  ],
};

/** Niklas paid his cocoa (4,10 €), Peter confirmed it. */
function setup() {
  const store = new BillStore(null);
  const notices: { to: string; title: string }[] = [];
  store.onNotice((to, n) => notices.push({ to, title: n.title.text }));
  const id = store.createBill(data, "peter", "Peter");
  store.setClaims(id, "peter", { weizen: [1] });
  store.join(id, "nik", "Niklas");
  store.setClaims(id, "nik", { kakao: [0] });
  expect(store.recordPayClick(id, "nik")).toBe(410);
  store.setMarkedPaid(id, "nik", true);
  store.setReceived(id, "peter", "nik", true);
  return { store, id, notices };
}

describe("ticked more after paying: the difference is a payment of its own (TopUp)", () => {
  it("shows what came on top as open – for Niklas and for Peter", () => {
    const { store, id } = setup();
    expect(myOpen(store.snapshot(id, "nik"))).toBe(0);
    store.setClaims(id, "nik", { kakao: [0], weizen: [0] });
    expect(myOpen(store.snapshot(id, "nik"))).toBe(500);
    expect(ownerSummary(store.snapshot(id, "peter")).missing).toBe(500);
  });

  it("pays it on its own: pay click, marked as paid (Peter is told), confirmed separately", () => {
    const { store, id, notices } = setup();
    store.setClaims(id, "nik", { kakao: [0], weizen: [0] });
    expect(store.recordPayClick(id, "nik")).toBe(500);
    let snap = store.snapshot(id, "nik");
    expect(snap.myTopUps).toMatchObject([{ amount: 500 }]);
    // The first payment stays as it was.
    expect(snap.myPayment).toMatchObject({ amount: 410 });
    expect(snap.myReceived).toBe(true);
    expect(myOpen(snap)).toBe(500);

    store.setMarkedPaid(id, "nik", true);
    expect(notices.at(-1)).toEqual({ to: "peter", title: "{name} hat nachgezahlt" });
    expect(myOpen(store.snapshot(id, "nik"))).toBe(0);
    const owner = store.snapshot(id, "peter");
    expect(owner.debtors?.[0]).toMatchObject({ payAmount: 410, received: true, topUps: [{ amount: 500, markedPaidAt: expect.any(String) }] });
    expect(ownerSummary(owner).missing).toBe(500);

    store.setReceived(id, "peter", "nik", true, 0);
    snap = store.snapshot(id, "nik");
    expect(snap.myTopUps?.[0].received).toBe(true);
    expect(ownerSummary(store.snapshot(id, "peter")).missing).toBe(0);
    expect(snap.myRefund).toBeUndefined();
  });

  it("a second round makes a second top-up; tapping again before marking keeps one", () => {
    const { store, id } = setup();
    store.setClaims(id, "nik", { kakao: [0], weizen: [0] });
    store.recordPayClick(id, "nik");
    store.setClaims(id, "peter", {});
    store.setClaims(id, "nik", { kakao: [0], weizen: [0, 1] });
    expect(store.recordPayClick(id, "nik")).toBe(1000);
    expect(store.snapshot(id, "nik").myTopUps).toMatchObject([{ amount: 1000 }]);
    store.setMarkedPaid(id, "nik", true);
    store.setClaims(id, "nik", { kakao: [0], weizen: [0, 1] });
    expect(store.recordPayClick(id, "nik")).toBe(0);
    expect(store.snapshot(id, "nik").myTopUps).toHaveLength(1);
  });

  it("marking only the first payment, then ticking more, also makes a top-up – not a bigger first payment", () => {
    const store = new BillStore(null);
    const id = store.createBill(data, "peter", "Peter");
    store.join(id, "nik", "Niklas");
    store.setClaims(id, "nik", { kakao: [0] });
    store.recordPayClick(id, "nik");
    store.setMarkedPaid(id, "nik", true);
    store.setClaims(id, "nik", { kakao: [0], weizen: [0] });
    store.recordPayClick(id, "nik");
    const owner = store.snapshot(id, "peter").debtors![0];
    expect(owner).toMatchObject({ payAmount: 410, topUps: [{ amount: 500 }] });
  });

  it("before marking anything, a new pay click still just updates the amount", () => {
    const store = new BillStore(null);
    const id = store.createBill(data, "peter", "Peter");
    store.join(id, "nik", "Niklas");
    store.setClaims(id, "nik", { kakao: [0] });
    store.recordPayClick(id, "nik");
    store.setClaims(id, "nik", { kakao: [0], weizen: [0] });
    expect(store.recordPayClick(id, "nik")).toBe(910);
    expect(store.snapshot(id, "nik").myTopUps).toBeUndefined();
  });
});
