import { expect, test } from "@playwright/test";
import { key, phone } from "./helpers";

test("Datenschutz und Impressum: von der Startseite erreichbar, mit den Angaben zum Betreiber", async ({ browser }) => {
  const page = await phone(browser, key("legal"), { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Rechtliches" }).getByRole("button", { name: "Datenschutz" }).click();
  await expect(page).toHaveURL(/#\/datenschutz$/);
  await expect(page.locator(".legal-title")).toHaveText("Datenschutzerklärung");
  await expect(page.locator(".legal-operator")).toContainText("Erika Muster");
  await expect(page.locator(".legal-operator")).toContainText("12345 Musterstadt");
  await expect(page.locator(".legal")).toContainText("Anthropic");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null", fullPage: true }).catch(() => undefined);

  await page.getByRole("button", { name: "Impressum" }).click();
  await expect(page.locator(".legal-title")).toHaveText("Impressum");
  await expect(page.locator(".legal-operator")).toContainText("hallo@example.org");
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(/\/(#\/?)?$/);
});
