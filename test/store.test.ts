import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    expect(annaView.participants.find((p) => p.id === anna)?.claims).toEqual({ bier: [0, 1] });
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

  it("lets a friend mark their share as paid, visible to the payer", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    store.setClaims(id, anna, { pizza: [0] });
    store.recordPayClick(id, anna);
    store.setMarkedPaid(id, anna, true);
    expect(store.snapshot(id, anna).myPayment?.markedPaidAt).toBeTruthy();
    expect(store.snapshot(id, owner).debtors![0].markedPaidAt).toBeTruthy();
    store.setMarkedPaid(id, anna, false);
    expect(store.snapshot(id, owner).debtors![0].markedPaidAt).toBeUndefined();
    expect(() => store.setMarkedPaid(id, owner, true)).toThrow(StoreError);
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
    expect(store.snapshot(id, anna).participants.find((p) => p.id === anna)?.claims).toEqual({ bier: [0, 1] });
  });

  it("never hands out more units of a multi-quantity item than the bill has", () => {
    const { store, owner, anna, id } = setup();
    const ben = participantIdFromKey("ben-key-0123456789");
    store.join(id, anna, "Anna");
    store.join(id, ben, "Ben");
    store.setClaims(id, anna, { bier: 1 });
    store.setClaims(id, ben, { bier: 3 });
    const claims = (pid: string) => store.snapshot(id, owner).participants.find((p) => p.id === pid)?.claims;
    expect(claims(ben)).toEqual({ bier: [1, 2] });
    // Nothing left for the payer; a single item can still be shared.
    store.setClaims(id, owner, { bier: 1, pizza: 1 });
    store.setClaims(id, anna, { bier: 1, pizza: 1 });
    expect(claims(owner)).toEqual({ pizza: [0] });
    expect(claims(anna)).toEqual({ bier: [0], pizza: [0] });
  });

  it("keeps earlier claims when the payer lowers a quantity", () => {
    const { store, owner, anna, id } = setup();
    const ben = participantIdFromKey("ben-key-0123456789");
    store.join(id, anna, "Anna");
    store.join(id, ben, "Ben");
    store.setClaims(id, anna, { bier: 2 });
    store.setClaims(id, ben, { bier: 1 });
    store.updateData(id, owner, { ...data, items: [{ id: "bier", name: "Bier", qty: 2, total: 800 }] });
    const view = store.snapshot(id, owner);
    expect(view.participants.find((p) => p.id === anna)?.claims).toEqual({ bier: [0, 1] });
    expect(view.participants.find((p) => p.id === ben)?.claims).toEqual({});
  });

  it("shares exactly the unit someone joins and leaves the others alone", () => {
    const { store, owner, anna, id } = setup();
    const ben = participantIdFromKey("ben-key-0123456789");
    store.join(id, anna, "Anna");
    store.join(id, ben, "Ben");
    store.setClaims(id, owner, { bier: [0] });
    store.setClaims(id, anna, { bier: [1] });
    store.setClaims(id, ben, { bier: [2] });
    // Anna also shares Ben's beer.
    store.setClaims(id, anna, { bier: [1, 2] });
    const debtors = store.snapshot(id, owner).debtors!;
    expect(debtors.find((d) => d.id === anna)?.amount).toBe(400 + 200);
    expect(debtors.find((d) => d.id === ben)?.amount).toBe(200);
  });

  it("keeps offers to share only for units the participant holds", () => {
    const { store, owner, anna, id } = setup();
    store.join(id, anna, "Anna");
    store.setClaims(id, owner, { bier: [0] }, { bier: [0, 1], pizza: [0] });
    const ownerOf = () => store.snapshot(id, owner).participants.find((p) => p.id === owner)!;
    expect(ownerOf().splits).toEqual({ bier: [0] });
    expect(store.snapshot(id, owner).debtors![0].amount).toBe(0);
    // Anna takes the other half; omitting splits keeps the offer.
    store.setClaims(id, anna, { bier: [0] });
    expect(store.snapshot(id, owner).debtors![0].amount).toBe(200);
    store.setClaims(id, owner, {});
    expect(ownerOf().splits).toEqual({});
  });

  it("upgrades bills stored with plain unit counts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "billsplit-"));
    const file = join(dir, "bills.json");
    const owner = participantIdFromKey("owner-key-0123456789");
    const anna = participantIdFromKey("anna-key-0123456789");
    const now = new Date().toISOString();
    await writeFile(
      file,
      JSON.stringify([
        {
          id: "legacy123",
          createdAt: now,
          ownerId: owner,
          data,
          participants: {
            [owner]: { name: "Niklas", joinedAt: now, claims: { bier: 1, pizza: 1 } },
            [anna]: { name: "Anna", joinedAt: now, claims: { bier: 2, pizza: 1 } },
          },
        },
      ]),
    );
    const store = new BillStore(file);
    await store.load();
    const view = store.snapshot("legacy123", owner);
    expect(view.participants.find((p) => p.id === owner)?.claims).toEqual({ bier: [0], pizza: [0] });
    expect(view.participants.find((p) => p.id === anna)?.claims).toEqual({ bier: [1, 2], pizza: [0] });
    expect(view.debtors![0].amount).toBe(800 + 500);
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
