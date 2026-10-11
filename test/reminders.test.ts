import { describe, expect, it } from "vitest";
import { BillStore } from "../server/store";
import type { BillData } from "../src/lib/bill";
import { REMIND_COOLDOWN_MS, type Notice } from "../src/lib/billCore";

const data = (title: string, items: [string, number][]): BillData => ({
  title,
  date: "",
  currency: "EUR",
  tipPercent: 0,
  payment: { paypalMe: "niklas" },
  items: items.map(([id, total]) => ({ id, name: id, qty: 1, total })),
});

/** Niklas paid two bills; Anna has push, Ben has not. Anna had the pizza, nothing ticked in the cinema yet. */
function setup() {
  const store = new BillStore(null);
  const sent: { to: string; notice: Notice }[] = [];
  // Amounts come with a non-breaking space ("9,50 €"); compared with a plain one.
  store.onNotice((to, notice) => sent.push({ to, notice: { ...notice, body: notice.body.replace(/\s/g, " ") } }));
  store.setReachability((id) => id === "anna");
  const pizza = store.createBill(data("Trattoria", [["pizza", 950], ["bier", 450]]), "niklas", "Niklas");
  store.join(pizza, "anna", "Anna");
  store.setClaims(pizza, "anna", { pizza: [0] });
  store.join(pizza, "ben", "Ben");
  store.setClaims(pizza, "ben", { bier: [0] });
  const kino = store.createBill(data("Kino", [["ticket", 1200]]), "niklas", "Niklas");
  store.join(kino, "anna", "Anna");
  return { store, sent, pizza, kino };
}

describe("Erinnern", () => {
  it("tells the payer whom notifications reach", () => {
    const { store, pizza } = setup();
    const debtors = store.snapshot(pizza, "niklas").debtors!;
    expect(debtors.map((d) => [d.name, d.reachable])).toEqual([
      ["Anna", true],
      ["Ben", false],
    ]);
  });

  it("reminds of the open amount – or to tick, when nothing is ticked yet – once in 12 hours", () => {
    const { store, sent, pizza, kino } = setup();
    const now = Date.parse("2026-10-11T10:00:00Z");
    store.remind(pizza, "niklas", "anna", now);
    expect(sent.at(-1)).toEqual({
      to: "anna",
      notice: { title: "Niklas erinnert Dich", body: "Für „Trattoria“ sind bei Dir noch 9,50 € offen.", path: `/b/${pizza}?an=anna` },
    });
    expect(store.snapshot(pizza, "niklas").debtors![0].remindedAt).toBe("2026-10-11T10:00:00.000Z");
    expect(() => store.remind(pizza, "niklas", "anna", now + 60_000)).toThrow("vor Kurzem");
    store.remind(pizza, "niklas", "anna", now + REMIND_COOLDOWN_MS + 1);

    store.remind(kino, "niklas", "anna", now);
    expect(sent.at(-1)!.notice.body).toBe("Bitte hake in „Kino“ ab, was Du hattest.");
  });

  it("refuses when notifications do not reach, for others than the payer and once paid", () => {
    const { store, pizza } = setup();
    expect(() => store.remind(pizza, "niklas", "ben")).toThrow("keine Benachrichtigungen");
    expect(() => store.remind(pizza, "anna", "ben")).toThrow("Nur wer die Rechnung bezahlt hat");
    store.setMarkedPaid(pizza, "anna", true);
    expect(() => store.remind(pizza, "niklas", "anna")).toThrow("schon bezahlt");
  });

  it("reminds a person of everything they owe across the payer's bills", () => {
    const { store, sent, pizza, kino } = setup();
    store.setClaims(kino, "anna", { ticket: [0] });
    store.remindPerson("niklas", "anna", Date.parse("2026-10-11T10:00:00Z"));
    expect(sent.at(-1)!.notice).toEqual({ title: "Niklas erinnert Dich", body: "Bei Dir sind noch 21,50 € aus 2 Rechnungen offen.", path: "/dashboard" });
    const status = store.reminderStatus("niklas");
    expect(status.reachable).toEqual(["anna"]);
    expect(status.remindedAt.anna).toBe("2026-10-11T10:00:00.000Z");
    expect(() => store.remindPerson("niklas", "anna", Date.parse("2026-10-11T11:00:00Z"))).toThrow("vor Kurzem");
    expect(() => store.remind(pizza, "niklas", "anna", Date.parse("2026-10-11T11:00:00Z"))).toThrow("vor Kurzem");
  });
});
