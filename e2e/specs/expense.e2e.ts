import { expect, test } from "@playwright/test";
import { key, phone } from "./helpers";

test("Ausgabe eingeben: Betrag, wofür, mit wie vielen – daraus wird eine Rechnung mit Gleichverteilung", async ({ browser }) => {
  const page = await phone(browser, key("niklas"), { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.goto("/");
  await page.getByRole("button", { name: "Ausgabe eingeben" }).click();
  await expect(page).toHaveURL(/#\/ausgabe$/);

  // Nothing entered yet: the button says what is missing.
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page.locator(".alert")).toHaveText("Bitte gib einen Betrag ein.");

  await page.getByLabel("Betrag in Euro").fill("36,00");
  await page.getByRole("button", { name: "Taxi" }).click();
  await expect(page.getByPlaceholder("z. B. Taxi zum Konzert")).toHaveValue("Taxi");
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
