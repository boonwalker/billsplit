import { expect, test } from "@playwright/test";
import { key, phone } from "./helpers";

/** A tiny valid PNG: what the photo shows does not matter, the recognition is simulated. */
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("Beleg fotografieren: Erkennung → Trinkgeld nachfragen → fertige Rechnung mit QR-Code", async ({ browser }) => {
  const page = await phone(browser, key("niklas"), { profile: { name: "Niklas", paypalMe: "nik" } });
  // The recognition answers like the AI would (no costs, always the same result).
  await page.route("**/api/parse-receipt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        merchant: "Trattoria Da Mario",
        date: "2026-10-08",
        currency: "EUR",
        items: [
          { name: "Pizza Margherita", qty: 1, total: 950 },
          { name: "Bier 0,5l", qty: 3, total: 1350 },
        ],
        total: 2300,
        tip: null,
        fees: [],
        delivery: false,
        supermarket: false,
        engine: "ai",
      }),
    }),
  );
  await page.goto("/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles({ name: "beleg.png", mimeType: "image/png", buffer: PHOTO });

  // A confident reading goes straight on; no tip on the receipt, so billsplit asks for it.
  const sheet = page.locator(".sheet");
  const create = page.getByRole("button", { name: "Rechnung erstellen" }).first();
  await expect(sheet.or(create).first()).toBeVisible({ timeout: 15_000 });
  if (!(await sheet.isVisible())) await create.click();
  await sheet.getByRole("radio", { name: "absolut" }).click();
  await sheet.getByLabel("Trinkgeld als Betrag").fill("2");
  await sheet.getByRole("button", { name: "Rechnung erstellen" }).click();

  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".qr svg")).toBeVisible();
  const sums = page.locator(".receipt-sums");
  await expect(sums).toContainText("Trinkgeld");
  await expect(sums).toContainText("25,00 €");
  await expect(page.locator(".receipt")).toContainText("Pizza Margherita");
  // The bill is in the list on the start page.
  await page.goto("/");
  await expect(page.locator("main")).toContainText("Trattoria Da Mario");
});
