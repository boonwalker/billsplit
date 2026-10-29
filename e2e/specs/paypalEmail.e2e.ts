import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";
import { PAYPAL_SEND_URL } from "../../src/lib/payment";

test("PayPal nur per E-Mail: erst „Anteil begleichen“ (Betrag kopiert), dann Sprechblase und „In PayPal bezahlen“", async ({ browser }) => {
  const peter = { key: key("peter"), name: "Peter" };
  const { id } = await api<{ id: string }>(peter.key, "POST", "/api/bills", {
    name: peter.name,
    data: {
      title: "Hallmackenreuther",
      date: "2026-10-29",
      currency: "EUR",
      tipPercent: 0,
      payment: { paypalEmail: "peter@example.com" },
      items: [{ id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 }],
    },
  });
  const anna = { key: key("anna"), name: "Anna" };
  await joinAndClaim(anna, id, { kakao: [0] });
  const page = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Hallmackenreuther", role: "guest" }], seen: [id] });
  await page.goto(`/#/b/${id}`);

  // No bubble yet – only after the first tap.
  await expect(page.getByRole("button", { name: "Anteil begleichen · 4,10 €" })).toBeVisible();
  await expect(page.locator(".paybar-bubble")).toHaveCount(0);
  await page.getByRole("button", { name: "Anteil begleichen · 4,10 €" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("4,10");
  await expect(page.locator(".paybar")).toContainText("4,10 € in die Zwischenablage kopiert –");
  await expect(page.locator(".paybar-bubble")).toBeVisible();
  await expect(page.getByRole("link", { name: "In PayPal bezahlen · 4,10 €" })).toHaveAttribute("href", PAYPAL_SEND_URL);
  // The address in a tap of its own.
  await page.getByRole("button", { name: "Adresse kopieren" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("peter@example.com");
});

test("PayPal.Me: die Sprechblase erscheint erst nach dem ersten Tipp auf „Anteil begleichen“", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const anna = { key: key("anna"), name: "Anna" };
  await joinAndClaim(anna, id, { pizza: [0] });
  const page = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Trattoria", role: "guest" }], seen: [id] });
  await page.goto(`/#/b/${id}`);
  await expect(page.getByRole("button", { name: "Anteil begleichen · 9,50 €" })).toBeVisible();
  await expect(page.locator(".paybar-bubble")).toHaveCount(0);
  await page.getByRole("button", { name: "Anteil begleichen · 9,50 €" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("9,50");
  await expect(page.locator(".paybar-bubble")).toBeVisible();
});
