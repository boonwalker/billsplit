import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

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

  // Still open (I owe Anna 8,00 €): ✕ explains why the bill stays.
  const remove = () => page.locator(".list-item", { hasText: "Sushi Bar" }).getByRole("button", { name: "Aus Liste entfernen" }).click();
  const dialog = page.getByRole("alertdialog");
  await remove();
  await expect(dialog).toContainText("Diese Rechnung ist noch offen");
  await dialog.getByRole("button", { name: "OK" }).click();
  await expect(page.locator(".list-title")).toHaveText(["Sushi Bar", "Trattoria"]);

  // Paid: now ✕ asks first – "Abbrechen" keeps the bill, "Löschen" takes it off the list.
  await api(niklas.key, "POST", `/api/bills/${hers}/pay`);
  await api(niklas.key, "POST", `/api/bills/${hers}/paid`, { paid: true });
  await page.reload();
  await expect(page.locator(".list-item", { hasText: "Sushi Bar" })).toContainText("als bezahlt markiert");
  await remove();
  await expect(dialog).toContainText("Bist Du sicher, dass Du diese Rechnung löschen möchtest?");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.locator(".list-title")).toHaveText(["Sushi Bar", "Trattoria"]);
  await remove();
  await dialog.getByRole("button", { name: "Löschen" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".list-title")).toHaveText(["Trattoria"]);
  // … and it stays away, also after the list was brought up to date with the server.
  await page.reload();
  await expect(page.locator(".list-title")).toHaveText(["Trattoria"]);
});

test("Dashboard: zählt auch Rechnungen, die nicht in der Liste auf dem Gerät stehen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const katia = { key: key("katia"), name: "Katia", paypal: "katia" };
  const mine = await createBill(niklas, "Bar", [{ id: "bier", name: "Bier", qty: 1, total: 482 }]);
  await joinAndClaim(katia, mine, { bier: [0] });

  // This phone never opened the bill (e.g. made on another device): the balance has it anyway.
  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.goto("/#/dashboard");
  await expect(page.locator(".balance-legend")).toContainText("4,82 €");
  await expect(page.locator(".person-rings")).toContainText("Katia");
  await expect(page.locator(".plan-incoming")).toContainText("Katia 4,82 €");
});
