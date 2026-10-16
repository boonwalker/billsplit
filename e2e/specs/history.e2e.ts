import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

test("Dashboard: auch bei „✓ ausgeglichen“ zeigt der Ring die gemeinsamen Rechnungen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna", paypal: "anna" };
  const bill = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  await joinAndClaim(anna, bill, { pizza: [0] });
  const snap = await api<{ debtors: { id: string }[] }>(niklas.key, "GET", `/api/bills/${bill}`);
  // The money arrived: all settled with Anna.
  await api(niklas.key, "POST", `/api/bills/${bill}/received`, { participantId: snap.debtors[0].id, received: true });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: bill, title: "Trattoria", role: "owner" }] });
  await page.goto("/#/dashboard");
  const ring = page.locator(".person-ring", { hasText: "Anna" });
  await expect(ring).toContainText("✓ ausgeglichen");
  await ring.getByRole("button", { name: "Gemeinsame Rechnungen mit Anna" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("h2")).toHaveText("Du und Anna");
  await expect(sheet).toContainText("✓ Mit Anna ist alles ausgeglichen.");
  await expect(sheet).toContainText("Gemeinsame Rechnungen");
  await expect(sheet.locator(".settle-entries")).toContainText("Trattoria");
  await expect(sheet.locator(".settle-entries")).toContainText("Du hast bezahlt · Anteil Anna 9,50 €");
  await expect(sheet.locator(".settle-entries")).toContainText("✓ beglichen");
  await page.waitForTimeout(600);
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
});
