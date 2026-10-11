import { expect, test } from "@playwright/test";
import { createBill, key, leaveAndReturn, mailedCode, phone } from "./helpers";

test("Konto: Anna legt es nach dem Bezahlen an und meldet sich auf einem neuen Gerät an – Rechnung und Profil sind da", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const annaKey = key("anna");
  const anna = await phone(browser, annaKey, { askProfile: true, seen: [id] });
  await anna.goto(`/#/b/${id}`);
  await anna.getByPlaceholder("Dein Name").fill("Anna");
  await anna.getByRole("button", { name: "Zur Rechnung" }).click();
  await anna.locator(".rline-main", { hasText: "Pizza" }).click();
  await anna.getByRole("button", { name: /Anteil begleichen · 9,50/ }).click();
  const [popup] = await Promise.all([anna.context().waitForEvent("page"), anna.getByRole("link", { name: /Mit PayPal bezahlen/ }).click()]);
  await popup.close();
  await leaveAndReturn(anna);
  await anna.locator(".paybar-ask").getByRole("button", { name: "✓ Ja, gesendet" }).click();

  // After paying: the e-mail address – a code comes by mail – then how she wants to be paid.
  const email = `anna-${Date.now()}@example.de`;
  const wizard = anna.locator(".wizard");
  await wizard.getByLabel("E-Mail-Adresse").fill(email);
  await wizard.getByRole("button", { name: "Code senden" }).click();
  await expect(wizard).toContainText(`Code an ${email} geschickt`);
  await wizard.getByLabel("Code aus der Mail").fill(await mailedCode(email));
  await expect(wizard).toContainText("Und wenn Du mal eine Rechnung zahlst:");
  await wizard.getByRole("button", { name: /^PayPal/ }).click();
  await wizard.getByLabel("PayPal.Me-Name oder E-Mail-Adresse").fill("anna");
  await wizard.getByRole("button", { name: "Profil speichern" }).click();
  await expect(wizard).toHaveCount(0);

  // A new phone: "Schon ein Konto? Anmelden" – and her bill and profile are there.
  const laptop = await phone(browser, key("anna-new"));
  await laptop.goto("/");
  await laptop.getByRole("button", { name: /Schon ein Konto\? Anmelden/ }).click();
  await laptop.getByLabel("E-Mail-Adresse").fill(email);
  await laptop.getByRole("button", { name: "Code senden" }).click();
  await laptop.getByLabel("Code aus der Mail").fill(await mailedCode(email));
  await expect(laptop.locator(".list-title")).toHaveText(["Trattoria"]);
  expect(await laptop.evaluate(() => JSON.parse(localStorage.getItem("billsplit.deviceKey")!))).toBe(annaKey);
  expect(await laptop.evaluate(() => JSON.parse(localStorage.getItem("billsplit.profile")!))).toMatchObject({ name: "Anna", paypalMe: "anna" });

  // The profile shows the account; signing out leaves an empty device.
  await laptop.goto("/#/profile");
  const account = laptop.locator(".account-card");
  await expect(account).toContainText(`Angemeldet als ${email}`);
  await account.getByRole("button", { name: "Abmelden" }).click();
  await account.getByRole("button", { name: "Ja, abmelden" }).click();
  await expect(laptop.getByRole("button", { name: /Schon ein Konto\? Anmelden/ })).toBeVisible();
  await expect(laptop.locator(".list-title")).toHaveCount(0);
});
