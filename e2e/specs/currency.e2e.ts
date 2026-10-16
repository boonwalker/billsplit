import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

test("Bilanz über mehrere Währungen: alles in der Heimwährung, ausgleichen je Währung", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna", paypal: "anna" };
  // Niklas paid in euro: Anna owes him 5,00 €.
  const trattoria = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 500 }]);
  await joinAndClaim(anna, trattoria, { pizza: [0] });
  // Anna paid in New York: Niklas owes her 10,80 $ (= 10,00 € at 1,08).
  const { id: diner } = await api<{ id: string }>(anna.key, "POST", "/api/bills", {
    name: anna.name,
    data: { title: "Diner", date: "2026-10-10", currency: "USD", items: [{ id: "burger", name: "Burger", qty: 1, total: 1080 }], tipPercent: 0, payment: { paypalMe: "anna" } },
  });
  await joinAndClaim(niklas, diner, { burger: [0] });

  const page = await phone(browser, niklas.key, {
    profile: { name: "Niklas", paypalMe: "nik" },
    recent: [
      { id: trattoria, title: "Trattoria", role: "owner" },
      { id: diner, title: "Diner", role: "guest" },
    ],
  });
  await page.goto("/#/dashboard");
  await expect(page.locator("main")).toContainText("Alle Währungen in EUR umgerechnet");
  await expect(page.locator(".dashboard-section").first()).toContainText("5,00");
  await expect(page.locator(".dashboard-section").first()).toContainText("10,00");
  await expect(page.locator("main")).toContainText("Ausgleichen in USD");
  await expect(page.locator("main")).toContainText("Ausgleichen in EUR");
});
