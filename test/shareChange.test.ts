import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";
import { BillError } from "../src/lib/billCore";

const data: BillData = {
  title: "Hallmackenreuther",
  date: "2026-10-27",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "peter" },
  items: [
    { id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 },
    { id: "cola", name: "Coca Cola", qty: 1, total: 350 },
  ],
};

function setup() {
  const store = new BillStore(null);
  const notices: { to: string; title: string }[] = [];
  store.onNotice((to, n) => notices.push({ to, title: String(typeof n.title === "string" ? n.title : n.title.text) }));
  const id = store.createBill(data, "peter", "Peter");
  store.join(id, "anna", "Anna");
  store.setClaims(id, "anna", { kakao: [0] });
  // Anna paid her 4,10 €, Peter confirmed it.
  store.recordPayClick(id, "anna");
  store.setReceived(id, "peter", "anna", true);
  store.join(id, "andy", "Andy");
  return { store, id, notices };
}

describe("a share made smaller after paying: what changed, and taking it back", () => {
  it("tells Anna that Andy shared the cocoa afterwards – Peter owes her the half", () => {
    const { store, id } = setup();
    store.setClaims(id, "andy", { kakao: [0] });
    const snap = store.snapshot(id, "anna");
    expect(snap.myRefund).toBe(205);
    expect(snap.myShareChange).toMatchObject({ byId: "andy", byName: "Andy", kind: "shared", items: [{ id: "kakao", name: "Kakao mit Sahne" }] });
    // Andy sees nothing of it.
    expect(store.snapshot(id, "andy").myShareChange).toBeUndefined();
  });

  it("lets Anna take it back („Stimmt nicht?“) – only her, only that line", () => {
    const { store, id, notices } = setup();
    store.setClaims(id, "andy", { kakao: [0], cola: [0] });
    expect(() => store.contestShare(id, "andy", "anna", "kakao")).toThrow(BillError);
    expect(() => store.contestShare(id, "anna", "andy", "cola")).toThrow(BillError);
    store.contestShare(id, "anna", "andy", "kakao");
    const snap = store.snapshot(id, "anna");
    expect(snap.myRefund).toBeUndefined();
    expect(snap.myShareChange).toBeUndefined();
    expect(snap.participants.find((p) => p.id === "andy")?.claims).toEqual({ cola: [0] });
    expect(notices.at(-1)).toEqual({ to: "andy", title: "{name} hat „{item}“ allein bezahlt" });
    // Done once: there is nothing left to take back.
    expect(() => store.contestShare(id, "anna", "andy", "kakao")).toThrow(BillError);
  });

  it("names the payer when the payer changed the bill – nothing to take back there", () => {
    const { store, id } = setup();
    store.updateData(id, "peter", { ...data, items: [{ ...data.items[0], total: 300 }, data.items[1]] });
    const snap = store.snapshot(id, "anna");
    expect(snap.myRefund).toBe(110);
    expect(snap.myShareChange).toMatchObject({ byId: "peter", byName: "Peter", kind: "changed" });
  });
});

describe("admin page: Anteil entfernen (BillCore.removeShare)", () => {
  it("takes one person's ticks off one line – the friend's credit and its note go with it", () => {
    const { store, id } = setup();
    store.setClaims(id, "andy", { kakao: [0], cola: [0] });
    expect(store.summaries().find((b) => b.id === id)?.shares).toContainEqual({ participantId: "andy", itemId: "kakao", itemName: "Kakao mit Sahne", units: 1, qty: 1 });
    expect(store.removeShare(id, "andy", "kakao")).toEqual({ name: "Andy", item: "Kakao mit Sahne" });
    const snap = store.snapshot(id, "anna");
    expect(snap.myRefund).toBeUndefined();
    expect(snap.myShareChange).toBeUndefined();
    expect(snap.participants.find((p) => p.id === "andy")?.claims).toEqual({ cola: [0] });
    // Nothing (left) to remove.
    expect(store.removeShare(id, "andy", "kakao")).toBeNull();
    expect(store.removeShare(id, "nobody", "kakao")).toBeNull();
  });
});

describe("payer holds a guest's name: Anteil entfernen (BillCore.removeGuestShare)", () => {
  it("only the payer, only guests – the guest is told, a paid guest is owed the difference", () => {
    const { store, id, notices } = setup();
    store.setClaims(id, "andy", { kakao: [0], cola: [0] });
    expect(() => store.removeGuestShare(id, "andy", "anna", "kakao")).toThrow(BillError);
    expect(() => store.removeGuestShare(id, "peter", "peter", "kakao")).toThrow(BillError);

    // Anna paid the whole cocoa: with Andy's half gone, nothing is owed back.
    store.removeGuestShare(id, "peter", "andy", "kakao");
    expect(store.snapshot(id, "anna").myRefund).toBeUndefined();
    expect(store.snapshot(id, "anna").myShareChange).toBeUndefined();
    expect(store.snapshot(id, "andy").participants.find((p) => p.id === "andy")?.claims).toEqual({ cola: [0] });
    expect(notices.at(-1)).toEqual({ to: "andy", title: "{name} hat Deinen Anteil an „{item}“ entfernt" });

    // Anna's own cocoa: she paid it, so Peter owes it back – and her bill says he changed it.
    store.removeGuestShare(id, "peter", "anna", "kakao");
    const snap = store.snapshot(id, "anna");
    expect(snap.myRefund).toBe(410);
    expect(snap.myShareChange).toMatchObject({ byId: "peter", kind: "changed" });
  });
});
