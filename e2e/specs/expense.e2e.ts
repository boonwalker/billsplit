import { expect, test } from "@playwright/test";
import { key, phone } from "./helpers";

test("Ausgabe zuweisen: Betrag, wofür, mit wie vielen – daraus wird eine Rechnung mit Gleichverteilung", async ({ browser }) => {
  const page = await phone(browser, key("niklas"), { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.goto("/");
  await page.getByRole("button", { name: /Ausgabe zuweisen/ }).click();
  await expect(page).toHaveURL(/#\/ausgabe$/);

  // Nothing entered yet: the button says what is missing.
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page.locator(".alert")).toHaveText("Bitte gib einen Betrag ein.");

  await page.getByLabel("Betrag in Euro").fill("36,00");
  await page.getByRole("button", { name: "Taxi" }).click();
  await expect(page.getByPlaceholder("z.B. Taxi zum Konzert")).toHaveValue("Taxi");
  await expect(page.locator(".expense-each")).toContainText("18,00 € pro Person");
  await page.getByRole("button", { name: "Eine Person mehr" }).click();
  await expect(page.locator(".expense-each")).toContainText("12,00 € pro Person");

  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".qr-hero")).toBeVisible();
  await expect(page.locator(".receipt")).toContainText("Taxi");
  await expect(page.locator(".tip-split-panel")).toContainText("12,00 € pro Person");
  await page.goto("/");
  await expect(page.locator(".list-title")).toHaveText(["Taxi"]);
});

test("Ausgabe zuweisen ohne Profil: „Wie willst Du bezahlt werden?“ lässt sich überspringen – kein Sackgassen-Fenster", async ({ browser }) => {
  const page = await phone(browser, key("new-payer"));
  await page.goto("/#/ausgabe");
  await page.getByLabel("Betrag in Euro").fill("10");
  await page.getByRole("button", { name: "Essen" }).click();
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();

  const wizard = page.locator(".wizard");
  await wizard.getByPlaceholder("Dein Name").fill("Niklas");
  await wizard.getByRole("button", { name: "Weiter" }).click();
  await wizard.getByRole("button", { name: "Überspringen" }).click();
  await expect(wizard.getByRole("heading", { name: "Wie willst Du bezahlt werden?" })).toBeVisible();
  await wizard.getByRole("button", { name: "Überspringen" }).click();
  // The bill is made anyway.
  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".receipt")).toContainText("Essen");

  // Asked once: the next expense goes straight through.
  await page.goto("/#/ausgabe");
  await page.getByLabel("Betrag in Euro").fill("5");
  await page.getByRole("button", { name: "Taxi" }).click();
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".wizard")).toHaveCount(0);
});
