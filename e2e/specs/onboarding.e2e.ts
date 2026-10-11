import { expect, test } from "@playwright/test";
import { createBill, key, leaveAndReturn, phone } from "./helpers";

const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("Erste Rechnung: Name und „Wie willst Du bezahlt werden?“ während der Beleg gelesen wird", async ({ browser }) => {
  const page = await phone(browser, key("new-payer"));
  let release: () => void = () => {};
  const recognised = new Promise<void>((resolve) => (release = resolve));
  // The recognition takes its time – meanwhile the profile is set up.
  await page.route("**/api/parse-receipt", async (route) => {
    await recognised;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        merchant: "Trattoria",
        date: "2026-10-08",
        currency: "EUR",
        items: [{ name: "Pizza", qty: 1, total: 950 }],
        total: 950,
        tip: 100,
        fees: [],
        delivery: false,
        supermarket: false,
        engine: "ai",
      }),
    });
  });
  await page.goto("/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles({ name: "beleg.png", mimeType: "image/png", buffer: PHOTO });

  const wizard = page.locator(".wizard");
  await expect(wizard.getByRole("heading", { name: "Wie heißt Du?" })).toBeVisible();
  await expect(page.locator(".scanning")).toBeVisible();
  await wizard.getByPlaceholder("Dein Name").fill("Niklas");
  await wizard.getByRole("button", { name: "Weiter" }).click();
  // The e-mail account is optional.
  await expect(wizard.getByRole("heading", { name: "Deine E-Mail-Adresse" })).toBeVisible();
  await wizard.getByRole("button", { name: "Überspringen" }).click();
  await expect(wizard.getByRole("heading", { name: "Wie willst Du bezahlt werden?" })).toBeVisible();
  await wizard.getByRole("button", { name: /^PayPal/ }).click();
  await wizard.getByRole("button", { name: "Profil speichern" }).click();
  await expect(wizard).toContainText("PayPal.Me-Namen oder Deine PayPal-E-Mail-Adresse");
  await wizard.getByLabel("PayPal.Me-Name oder E-Mail-Adresse").fill("paypal.me/niklasb");
  await wizard.getByRole("button", { name: "Profil speichern" }).click();
  await expect(wizard).toHaveCount(0);

  // The receipt is read: tip on it, nothing to ask – straight to the bill with the PayPal.Me name.
  release();
  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".qr-hero")).toContainText("paypal.me/niklasb");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("billsplit.profile") ?? "{}"))).toMatchObject({ name: "Niklas", paypalMe: "niklasb" });
});

test("Freund im Safari: nach dem Bezahlen „Wie willst Du bezahlt werden?“, dann der Weg auf den Home-Bildschirm", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const anna = await phone(browser, key("anna"), { askProfile: true, seen: [id], userAgent: IPHONE });
  await anna.goto(`/#/b/${id}`);
  await anna.getByPlaceholder("Dein Name").fill("Anna");
  await anna.getByRole("button", { name: "Zur Rechnung" }).click();
  await anna.locator(".rline-main", { hasText: "Pizza" }).click();
  // Paying right after ticking: the amount noted must already include the pizza.
  await anna.getByRole("button", { name: /Anteil begleichen · 9,50/ }).click();
  const [popup] = await Promise.all([anna.context().waitForEvent("page"), anna.getByRole("link", { name: /Mit PayPal bezahlen/ }).click()]);
  await popup.close();
  await leaveAndReturn(anna);
  await expect(anna.locator(".paybar-ask")).toContainText("Hast Du 9,50 € an Niklas gesendet?");
  await anna.locator(".paybar-ask").getByRole("button", { name: "✓ Ja, gesendet" }).click();

  // A moment on the confirmation, then the start page (her initial on the profile button) –
  // and there, a little later, the profile assistant.
  await expect(anna.getByRole("button", { name: "✓ Als bezahlt markiert" })).toBeVisible();
  await expect(anna).toHaveURL(/#\/$/);
  await expect(anna.locator(".avatar-btn")).toHaveText("A");
  // Her name is known from joining: the (optional) account, then the way she wants to be paid.
  const wizard = anna.locator(".wizard");
  await expect(wizard).toContainText("✓ Erledigt. Damit Du Deine Rechnungen überall wiederfindest:");
  await wizard.getByRole("button", { name: "Überspringen" }).click();
  await expect(wizard).toContainText("Und wenn Du mal eine Rechnung zahlst:");
  await wizard.getByRole("button", { name: /^Überweisung/ }).click();
  await wizard.getByLabel("IBAN").fill("de89 3704 0044 0532 0130 00");
  await wizard.getByRole("button", { name: "Profil speichern" }).click();
  expect(await anna.evaluate(() => JSON.parse(localStorage.getItem("billsplit.profile") ?? "{}"))).toMatchObject({ name: "Anna", iban: "DE89370400440532013000" });

  // In Safari: how to get klicksplit onto the home screen, taking this bill along.
  const hint = anna.locator(".install-hint");
  await expect(hint).toContainText("klicksplit auf Deinen Home-Bildschirm");
  await hint.getByRole("button", { name: "In der App öffnen" }).click();
  expect(await anna.evaluate(() => navigator.clipboard.readText())).toMatch(/von=/);
});
