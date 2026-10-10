import { expect, test } from "@playwright/test";
import { createBill, followPaypal, key, phone } from "./helpers";

test("Rechnung: Freund tritt bei, hakt ab, zahlt per PayPal – der Rechnungssteller hakt „erhalten“ an", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Trattoria", [
    { id: "pizza", name: "Pizza Margherita", qty: 1, total: 950 },
    { id: "bier", name: "Bier 0,5l", qty: 3, total: 1350 },
  ]);

  const owner = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Trattoria", role: "owner" }], seen: [id] });
  await owner.goto(`/#/b/${id}`);
  await expect(owner.locator(".qr svg")).toBeVisible();

  // Anna opens the link (= scans the QR code) and joins with her name.
  const anna = await phone(browser, key("anna"), { seen: [id] });
  await anna.goto(`/#/b/${id}`);
  await anna.getByPlaceholder("Dein Name").fill("Anna");
  await anna.getByRole("button", { name: "Zur Rechnung" }).click();
  await expect(owner.locator(".debtor-name")).toHaveText(["Anna"]);

  // She ticks the pizza; the payer sees it live.
  await anna.locator(".rline-main", { hasText: "Pizza" }).click();
  await expect(owner.locator(".receipt")).toContainText("Anna");

  // Pay: the amount goes to the clipboard first, then PayPal opens with recipient and amount.
  await anna.getByRole("button", { name: /Anteil begleichen · 9,50/ }).click();
  await expect(anna.locator(".paybar-copied")).toContainText("9,50 € in die Zwischenablage kopiert");
  expect(await anna.evaluate(() => navigator.clipboard.readText())).toBe("9,50");
  expect(await followPaypal(anna, /Mit PayPal bezahlen · 9,50/)).toBe("https://www.paypal.com/paypalme/nik/9.50EUR");
  await anna.getByRole("button", { name: "Als bezahlt markieren" }).click();
  await expect(anna.getByRole("button", { name: "✓ Als bezahlt markiert" })).toBeVisible();

  // The payer checks PayPal and ticks "erhalten"; Anna sees it.
  const debtor = owner.locator(".debtor", { hasText: "Anna" });
  await expect(debtor).toContainText("9,50 €");
  // The box follows the server's answer (it is not ticked locally first).
  await debtor.getByRole("checkbox").click();
  await expect(debtor.getByRole("checkbox")).toBeChecked();
  await expect(anna.locator(".paybar")).toContainText("Niklas hat Deinen Anteil als erhalten markiert.");
});

test("Rechnung: Bei Mehrfach-Positionen nimmt jeder sein Stück, danach ist die Position vergeben", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Biergarten", [{ id: "bier", name: "Bier", qty: 2, total: 900 }]);
  const anna = await phone(browser, key("anna"), { profile: { name: "Anna" }, seen: [id] });
  const ben = await phone(browser, key("ben"), { profile: { name: "Ben" }, seen: [id] });
  // With a profile, opening the link joins right away.
  for (const p of [anna, ben]) {
    await p.goto(`/#/b/${id}`);
    await expect(p.locator(".paybar")).toBeVisible();
  }
  await anna.locator(".rline-main", { hasText: "Bier" }).click();
  await expect(anna.getByRole("button", { name: /Anteil begleichen · 4,50/ })).toBeVisible();
  // Ben sees live that one beer is Anna's, and takes the other one.
  await expect(ben.locator(".rline", { hasText: "Bier" })).toContainText("Anna");
  await ben.locator(".rline-main", { hasText: "Bier" }).click();
  await expect(ben.getByRole("button", { name: /Anteil begleichen · 4,50/ })).toBeVisible();
  // Both units are taken: the line is crossed out for everyone.
  await expect(anna.locator(".rline", { hasText: "Bier" })).toHaveClass(/\bdone\b/);
  await expect(ben.getByRole("button", { name: /Anteil begleichen · 4,50/ })).toBeVisible();
});
