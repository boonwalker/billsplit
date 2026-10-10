import { expect, test } from "@playwright/test";
import { key, phone } from "./helpers";

const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("Supermarkt „Alles aufteilen“: „/ N“-Auswahl, dann „Vielleicht nicht für alle?“ oben auf der Rechnung", async ({ browser }) => {
  const page = await phone(browser, key("niklas"), { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.route("**/api/parse-receipt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        merchant: "Lidl",
        date: "2026-10-08",
        currency: "EUR",
        items: [
          { name: "Zucchini", qty: 1, total: 51 },
          { name: "Duschgel", qty: 1, total: 195, personal: true },
          { name: "Speisekartoffeln", qty: 1, total: 289 },
          { name: "Alpenmilch 3,8%", qty: 1, total: 119, personal: true },
        ],
        total: 654,
        tip: null,
        fees: [],
        delivery: false,
        supermarket: true,
        engine: "ai",
      }),
    }),
  );
  await page.goto("/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles({ name: "bon.png", mimeType: "image/png", buffer: PHOTO });

  const sheet = page.locator(".shop-sheet");
  await expect(sheet.getByRole("heading", { name: "Supermarkt-Einkauf" })).toBeVisible({ timeout: 15_000 });
  await sheet.getByRole("button", { name: "Alles aufteilen" }).click();
  await expect(sheet).toContainText("Wie viele teilen sich den Einkauf?");
  await sheet.getByRole("button", { name: "Eine Person mehr" }).click();
  await sheet.getByRole("button", { name: "Eine Person mehr" }).click();
  await expect(sheet.locator(".divide-by-value")).toHaveText("3");
  await expect(sheet).toContainText("Abgerechnet werden 6,54 €");
  await sheet.getByRole("button", { name: "Rechnung erstellen" }).click();

  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".receipt-lines .rline-group")).toHaveText(["Vielleicht nicht für alle?", "Für alle"]);
  await expect(page.locator(".receipt-lines li[data-item]").first()).toContainText("Duschgel");
});
