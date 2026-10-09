import { describe, expect, it } from "vitest";
import { BillStore, participantIdFromKey, StoreError } from "../server/store";
import type { BillData } from "../src/lib/bill";

const data: BillData = {
  title: "Trattoria",
  date: "",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "niklas" },
  items: [
    { id: "pizza", name: "Pizza", qty: 1, total: 1000 },
    { id: "bier", name: "Bier", qty: 3, total: 1200 },
  ],
};

function setup() {
  const store = new BillStore(null);
  const owner = participantIdFromKey("owner-key-0123456789");
  const anna = participantIdFromKey("anna-key-0123456789");
  const id = store.createBill(data, owner, "Niklas");
  return { store, owner, anna, id };
}

describe("BillStore", () => {
  it("lets friends join by scanning and shows them to the payer immediately", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    const ownerView = store.snapshot(id, owner);
    expect(ownerView.isOwner).toBe(true);
    expect(ownerView.debtors).toEqual([
      expect.objectContaining({ id: anna, name: "Anna", amount: 0, received: false, payAmount: undefined }),
    ]);
  });

  it("shares claims with everyone but payment details only with the payer", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    store.setClaims(id, anna, { bier: 2 });
    const annaView = store.snapshot(id, anna);
    expect(annaView.isOwner).toBe(false);
    expect(annaView.debtors).toBeUndefined();
    expect(annaView.participants.find((p) => p.id === anna)?.claims).toEqual({ bier: 2 });
    expect(store.snapshot(id, owner).debtors?.[0].amount).toBe(800);
  });

  it("records the amount when a friend taps pay", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    store.setClaims(id, anna, { bier: 1, pizza: 1 });
    expect(store.recordPayClick(id, anna)).toBe(1400);
    expect(store.snapshot(id, anna).myPayment?.amount).toBe(1400);
    const debtor = store.snapshot(id, owner).debtors![0];
    expect(debtor.payAmount).toBe(1400);
    expect(debtor.payClickedAt).toBeTruthy();
  });

  it("only allows the payer to confirm receipts and edit the bill", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    expect(() => store.setReceived(id, anna, anna, true)).toThrow(StoreError);
    store.setReceived(id, owner, anna, true);
    expect(store.snapshot(id, owner).debtors![0].received).toBe(true);
    expect(() => store.updateData(id, anna, data)).toThrow(StoreError);
  });

  it("keeps claims of remaining items when the payer edits the bill", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    store.setClaims(id, anna, { bier: 3, pizza: 1 });
    store.updateData(id, owner, { ...data, items: [{ id: "bier", name: "Bier", qty: 2, total: 800 }] });
    expect(store.snapshot(id, anna).participants.find((p) => p.id === anna)?.claims).toEqual({ bier: 2 });
  });

  it("rejects claims from devices that did not join", () => {
    const { store, anna, id } = setup();
    expect(() => store.setClaims(id, anna, { bier: 1 })).toThrow(StoreError);
  });

  it("notifies listeners on changes", () => {
    const { store, anna, id } = setup();
    const seen: string[] = [];
    store.onChange((billId) => seen.push(billId));
    store.join(id, anna, "Anna");
    store.join(id, anna, "Anna"); // no-op
    expect(seen).toEqual([id]);
  });
});
