import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

test("Positionen bearbeiten: Preis und neue Position ändern die Rechnung – Abgehaktes bleibt", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna" };
  const id = await createBill(niklas, "Trattoria", [
    { id: "pizza", name: "Pizza", qty: 1, total: 950 },
    { id: "wein", name: "Wein", qty: 1, total: 600 },
  ]);
  await joinAndClaim(anna, id, { pizza: [0] });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Trattoria", role: "owner" }], seen: [id] });
  await page.goto(`/#/b/${id}`);
  await page.getByRole("button", { name: "Positionen bearbeiten" }).click();
  await expect(page.getByRole("heading", { name: "Positionen bearbeiten" })).toBeVisible();

  const prices = page.getByLabel("Preis gesamt");
  await expect(prices).toHaveCount(2);
  await prices.first().fill("10,50");
  await page.getByRole("button", { name: /Position hinzufügen/ }).click();
  await page.getByLabel("Bezeichnung").last().fill("Espresso");
  await page.getByLabel("Preis gesamt").last().fill("2,50");
  await page.getByRole("button", { name: "Änderungen speichern" }).click();

  // Back on the bill: the new prices, and Anna still has her pizza.
  await expect(page).toHaveURL(new RegExp(`#/b/${id}$`));
  const receipt = page.locator(".receipt");
  await expect(receipt).toContainText("Espresso");
  await expect(receipt).toContainText("10,50");
  await expect(receipt.locator(".rline", { hasText: "Pizza" })).toContainText("Anna");
  await expect(page.locator(".debtor", { hasText: "Anna" })).toBeVisible();
});
