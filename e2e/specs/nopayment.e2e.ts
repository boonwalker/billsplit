import { expect, test } from "@playwright/test";
import { api, joinAndClaim, key, phone } from "./helpers";

test("Ohne Zahlungsdaten: der Rechnungssteller sieht trotzdem, wer welchen Anteil hat – bar bezahlt, „erhalten“", async ({ browser }) => {
  const niklas = key("niklas");
  const anna = { key: key("anna"), name: "Anna" };
  // The payer skipped "Wie willst Du bezahlt werden?": the bill has no payment details.
  const { id } = await api<{ id: string }>(niklas, "POST", "/api/bills", {
    name: "Niklas",
    data: {
      title: "Trattoria",
      date: "2026-10-20",
      currency: "EUR",
      tipPercent: 0,
      payment: {},
      items: [
        { id: "pizza", name: "Pizza", qty: 1, total: 950 },
        { id: "pasta", name: "Pasta", qty: 1, total: 1180 },
      ],
    },
  });
  await joinAndClaim(anna, id, { pizza: [0] });

  const owner = await phone(browser, niklas, { profile: { name: "Niklas" }, recent: [{ id, title: "Trattoria", role: "owner" }], seen: [id] });
  await owner.goto(`/#/b/${id}`);
  const row = owner.locator(".debtor", { hasText: "Anna" });
  await expect(row.locator(".debtor-status")).toHaveText("ist beigetreten");
  await expect(row.locator(".debtor-amount")).toHaveText("9,50 €");
  // Nobody has the pasta yet: it counts as missing, too.
  await expect(owner.locator(".owner-sums")).toContainText("Dir fehlen noch21,30 €");

  // Anna pays in cash and marks it.
  const annaPhone = await phone(browser, anna.key, { profile: { name: "Anna" }, seen: [id] });
  await annaPhone.goto(`/#/b/${id}`);
  const bar = annaPhone.locator(".paybar");
  await expect(bar).toContainText("Niklas hat keine Zahlungsdaten hinterlegt. Gib den Betrag direkt, z.B. bar – und markiere ihn dann als bezahlt.");
  await bar.getByRole("button", { name: "Als bezahlt markieren" }).click();
  await expect(bar.getByRole("button", { name: "✓ Als bezahlt markiert" })).toBeVisible();

  // The payer sees it and ticks "erhalten".
  await expect(row.locator(".debtor-status")).toContainText("als bezahlt markiert");
  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toBeChecked();
  await expect(bar).toContainText("Niklas hat Deinen Anteil als erhalten markiert.");
});
