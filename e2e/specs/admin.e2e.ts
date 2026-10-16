import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

test("Betriebsseite: Besuche, Geräte, Konten und Rechnungen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(niklas, "Admin-Test Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  await joinAndClaim({ key: key("anna"), name: "Anna Admintest" }, bill, { pizza: [0] });

  // Opening the app counts as a visit of this device.
  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" } });
  const visit = page.waitForRequest((r) => r.url().endsWith("/api/visit"));
  await page.goto("/");
  await visit;

  // Without the token: a form asks for it.
  await page.goto("/api/admin");
  await page.getByLabel("Admin-Token").fill("e2e-admin-token-123456");
  await page.getByRole("button", { name: "Öffnen" }).click();
  await expect(page.locator("h1")).toHaveText("klicksplit · Betrieb");
  await expect(page.locator(".tiles")).toContainText("Aktiv (24 h)");
  await expect(page.locator("#nutzung + p + .scroll tbody tr").first()).not.toContainText("Noch keine Daten");
  await expect(page.locator("#geraete + p + .scroll")).toContainText("Niklas");
  await expect(page.locator("#rechnungen + .scroll")).toContainText("Admin-Test Trattoria");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null", fullPage: true }).catch(() => undefined);
});
