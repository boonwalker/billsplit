import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

test("Startseite: „Du schuldest“ zeigt den aktuell offenen Betrag, „Du leihst“ den fehlenden", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna", paypal: "anna" };
  const mine = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  await joinAndClaim(anna, mine, { pizza: [0] });
  const hers = await createBill(anna, "Sushi Bar", [{ id: "maki", name: "Maki", qty: 1, total: 800 }]);
  await joinAndClaim(niklas, hers, { maki: [0] });

  const page = await phone(browser, niklas.key, {
    profile: { name: "Niklas", paypalMe: "nik" },
    recent: [
      { id: hers, title: "Sushi Bar", role: "guest" },
      { id: mine, title: "Trattoria", role: "owner" },
    ],
  });
  await page.goto("/");
  await expect(page.locator(".list-item", { hasText: "Sushi Bar" })).toContainText("Du schuldest · 8,00 €");
  await expect(page.locator(".list-item", { hasText: "Trattoria" })).toContainText("Du leihst · 9,50 €");
});
