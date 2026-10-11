import { expect, test } from "@playwright/test";
import { key, phone } from "./helpers";

const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("Lieferbestellung: unter „absolut“ gibt es 0,50 € / 1 € / 2 € als Trinkgeld für den Fahrer", async ({ browser }) => {
  const page = await phone(browser, key("niklas"), { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.route("**/api/parse-receipt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        merchant: "Saitong Thai-Imbiss",
        date: "2026-10-08",
        currency: "EUR",
        items: [
          { name: "Pad Thai", qty: 1, total: 1300 },
          { name: "Poh Pia Pak", qty: 1, total: 700 },
        ],
        total: 2290,
        tip: null,
        fees: [{ name: "Liefergebühr", amount: 290 }],
        delivery: true,
        supermarket: false,
        engine: "ai",
      }),
    }),
  );
  await page.goto("/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles({ name: "beleg.png", mimeType: "image/png", buffer: PHOTO });

  const create = page.getByRole("button", { name: "Rechnung erstellen" }).first();
  await expect(create).toBeVisible({ timeout: 15_000 });
  const tip = page.locator(".tip-control").last();
  await expect(tip.getByRole("radio", { name: "absolut" })).toHaveAttribute("aria-checked", "true");
  const presets = tip.getByRole("group", { name: "Trinkgeld für den Lieferdienst" });
  await expect(presets.getByRole("button")).toHaveText(["0,50 €", "1 €", "2 €"]);
  await presets.getByRole("button", { name: "2 €" }).click();
  await expect(tip.getByLabel("Trinkgeld als Betrag")).toHaveValue("2,00");
  await expect(presets.getByRole("button", { name: "2 €" })).toHaveClass(/active/);
});
