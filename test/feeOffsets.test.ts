import { describe, expect, it } from "vitest";
import { feeSplit, participantShare, billTotal, type BillData, type BillFee, type PublicParticipant } from "../src/lib/bill";

const fee = (name: string, amount: number): BillFee => ({ id: name, name, amount });
const split = (fees: BillFee[], feeOffsets = true) => {
  const { perHead, discount, offsets } = feeSplit({ fees, feeOffsets });
  return { perHead, discount, offsets: offsets.map((o) => `${o.discount.name}→${o.fee.name}:${o.amount}`) };
};

describe("a discount that belongs to a fee takes it back first (feeOffsets)", () => {
  it("free delivery: no delivery cost at all, the service fee per head, no discount on the items", () => {
    expect(split([fee("Lieferung", 99), fee("Servicegebühr", 359), fee("Lieferrabatt", -99)])).toEqual({
      perHead: 359,
      discount: 0,
      offsets: ["Lieferrabatt→Lieferung:99"],
    });
  });

  it("partly paid back: the rest of the fee per head", () => {
    expect(split([fee("Liefergebühr", 299), fee("Lieferrabatt", -100)])).toMatchObject({ perHead: 199, discount: 0 });
  });

  it("more than the fee: the fee is gone, only the rest lowers the items", () => {
    expect(split([fee("Lieferung", 99), fee("Rabatt Lieferung", -200)])).toMatchObject({ perHead: 0, discount: -101 });
  });

  it("the same for the service fee", () => {
    expect(split([fee("Lieferung", 199), fee("Servicegebühr", 150), fee("Servicegebühr erlassen", -150)])).toMatchObject({ perHead: 199, discount: 0 });
  });

  it("English and Spanish receipts", () => {
    expect(split([fee("Delivery fee", 299), fee("Free delivery", -299)])).toMatchObject({ perHead: 0, discount: 0 });
    expect(split([fee("Gastos de envío", 250), fee("Descuento envío", -250)])).toMatchObject({ perHead: 0, discount: 0 });
  });

  it("a discount without a kind takes back a fee of exactly its amount – else it lowers the items", () => {
    expect(split([fee("Lieferung", 99), fee("Gratis", -99)])).toMatchObject({ perHead: 0, discount: 0 });
    expect(split([fee("Lieferung", 99), fee("Gutschein", -500)])).toMatchObject({ perHead: 99, discount: -500 });
  });

  it("older bills stay as they were (discounts on the items)", () => {
    expect(split([fee("Lieferung", 99), fee("Lieferrabatt", -99)], false)).toMatchObject({ perHead: 99, discount: -99 });
  });

  it("the pizza bill: shares add up to the total, delivery costs nobody anything", () => {
    const people = ["freddy", "david", "peter", "nik"];
    const data: BillData = {
      title: "PiZz",
      date: "2026-10-29",
      currency: "EUR",
      tipPercent: 0,
      tipAmount: 285,
      tipByShare: true,
      feeOffsets: true,
      payment: {},
      items: people.map((p, i) => ({ id: p, name: p, qty: 1, total: [1500, 1600, 1300, 1300][i] })),
      fees: [fee("Lieferung", 99), fee("Servicegebühr", 359), fee("Lieferrabatt", -99)],
    };
    const participants: PublicParticipant[] = people.map((p) => ({ id: p, name: p, isOwner: p === "freddy", claims: { [p]: [0] } }));
    const shares = people.map((p) => participantShare(data, participants, p));
    // 13,00 € + 5 % tip (0,65 €) + service fee per head (0,90 €).
    expect(shares[2].total).toBe(1300 + 65 + 90);
    expect(Math.abs(shares.reduce((s, x) => s + x.total, 0) - billTotal(data))).toBeLessThanOrEqual(2);
  });
});
