import { expect, test } from "@playwright/test";
import { createBill, key, phone } from "./helpers";

// 16.10.2026: the server started without its data after a deploy (DATA_DIR outside the volume).
// The app must not empty the list or sign out silently because of that.
test("Server kennt Rechnungen und Konto nicht mehr: Liste bleibt, Hinweis statt stillem Abmelden", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const known = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const page = await phone(browser, niklas.key, {
    profile: { name: "Niklas", paypalMe: "nik" },
    recent: [
      { id: "verlorenXYZ123", title: "Sushi Bar", role: "owner" },
      { id: known, title: "Trattoria", role: "owner" },
    ],
  });
  // Signed in on this device – the server has never heard of the account.
  await page.addInitScript(() => {
    if (!localStorage.getItem("billsplit.account")) localStorage.setItem("billsplit.account", JSON.stringify("niklas@example.com"));
  });
  await page.goto("/");

  const lost = page.locator(".list-item", { hasText: "Sushi Bar" });
  await expect(lost).toContainText("nicht mehr verfügbar");
  await expect(page.locator(".list-title")).toHaveText(["Sushi Bar", "Trattoria"]);
  await page.reload();
  await expect(lost).toContainText("nicht mehr verfügbar");

  // Not silently signed out: a notice, and signing in again has the address filled in.
  const notice = page.locator(".account-lost");
  await expect(notice).toContainText("Der Server kannte Dein Konto niklas@example.com nicht mehr");
  await notice.getByRole("button", { name: "Wieder anmelden" }).click();
  await expect(page).toHaveURL(/#\/anmelden/);
  await expect(page.getByRole("textbox").first()).toHaveValue("niklas@example.com");

  // ✕ on a bill that is gone anyway: no question, it just leaves the list.
  await page.goto("/");
  await lost.getByRole("button", { name: "Aus Liste entfernen" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.locator(".list-title")).toHaveText(["Trattoria"]);
});
