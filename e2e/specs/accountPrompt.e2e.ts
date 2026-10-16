import { expect, test } from "@playwright/test";
import { createBill, key, phone } from "./helpers";

test("Leerer Speicher auf der Startseite: einmal „Warst Du schon mal bei klicksplit?“", async ({ browser }) => {
  // A new phone (or the browser deleted its data): nothing stored yet.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Warst Du schon mal bei klicksplit?" });
  await expect(dialog).toContainText("holst Du Deine Rechnungen auf dieses Gerät zurück");
  await dialog.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/#\/anmelden/);
  // Asked once: not again.
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  await expect(dialog).toHaveCount(0);

  // Opened through a bill link with empty storage: a guest wants to pay, no question.
  const owner = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(owner, "Trattoria", [{ id: "p", name: "Pizza", qty: 1, total: 900 }]);
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`/#/b/${bill}`);
  await expect(guest.locator(".receipt")).toBeVisible();
  await expect(guest.getByRole("dialog", { name: "Warst Du schon mal bei klicksplit?" })).toHaveCount(0);
});

test("Zweite Nutzung ohne Konto, mit Rechnungen: einmal „Sichere Deine Rechnungen“", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(niklas, "Trattoria", [{ id: "p", name: "Pizza", qty: 1, total: 900 }]);
  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: bill, title: "Trattoria", role: "owner" }] });
  // Used once before, yesterday.
  await page.addInitScript(() => {
    if (!localStorage.getItem("billsplit.sessions")) localStorage.setItem("billsplit.sessions", JSON.stringify({ count: 1, at: Date.now() - 86_400_000 }));
  });
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Sichere Deine Rechnungen" });
  await expect(dialog).toContainText("auf jedem Gerät da");
  await dialog.getByRole("button", { name: "Später" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".list-title")).toHaveText(["Trattoria"]);
  await expect(dialog).toHaveCount(0);
});
