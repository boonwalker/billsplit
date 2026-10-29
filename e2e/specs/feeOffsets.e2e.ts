import { expect, test } from "@playwright/test";
import { api, joinAndClaim, key, phone } from "./helpers";

test("Lieferrabatt hebt die Lieferung auf: nicht pro Kopf berechnet, kein Rabatt auf die Positionen", async ({ browser }) => {
  const freddy = { key: key("freddy"), name: "Freddy R." };
  const { id } = await api<{ id: string }>(freddy.key, "POST", "/api/bills", {
    name: freddy.name,
    data: {
      title: "PiZz Neapolitanisches Restaurant",
      date: "2026-10-29",
      currency: "EUR",
      tipPercent: 0,
      tipAmount: 285,
      tipByShare: true,
      feeOffsets: true,
      payment: { paypalMe: "freddy" },
      items: [
        { id: "a", name: "Pizza Margherita", qty: 1, total: 1500 },
        { id: "b", name: "Pizza Capricciosa", qty: 1, total: 1600 },
        { id: "c", name: "Pizza Cosacca", qty: 1, total: 1300 },
        { id: "d", name: "Pizza Diavola", qty: 1, total: 1300 },
      ],
      fees: [
        { id: "f1", name: "Lieferung", amount: 99 },
        { id: "f2", name: "Servicegebühr", amount: 359 },
        { id: "f3", name: "Lieferrabatt", amount: -99 },
      ],
    },
  });
  await api(freddy.key, "PUT", `/api/bills/${id}/claims`, { claims: { a: [0] } });
  await joinAndClaim({ key: key("david"), name: "David" }, id, { b: [0] });
  await joinAndClaim({ key: key("niklas"), name: "Niklas" }, id, { d: [0] });
  const peter = { key: key("peter"), name: "Peter" };
  await joinAndClaim(peter, id, { c: [0] });

  const page = await phone(browser, peter.key, { profile: { name: "Peter" }, recent: [{ id, title: "PiZz", role: "guest" }], seen: [id] });
  await page.goto(`/#/b/${id}`);
  const sums = page.locator(".receipt-sums");
  await expect(sums).toContainText("Lieferrabatt mit Lieferung verrechnet");
  await expect(sums).toContainText("Gebühren ÷ 4 Personen");
  await expect(sums).toContainText("je 0,90 €");
  await expect(sums).not.toContainText("Rabatt auf jede Position");
  // 13,00 € + 5 % tip + 0,90 € service fee.
  await expect(page.locator(".paybar-total")).toHaveText("14,55 €");
  await sums.scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
});
