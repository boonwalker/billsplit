import { expect, test } from "@playwright/test";
import { api, joinAndClaim, key, phone } from "./helpers";

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

  // A confident reading goes straight on; no tip on the receipt, so klicksplit asks for it.
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

test("Trinkgeld als Endbetrag: leeres Feld mit Frage, „230“ eintippen ergibt 22,00 € Trinkgeld – anteilig verteilt", async ({ browser }) => {
  const niklasKey = key("niklas");
  const page = await phone(browser, niklasKey, { profile: { name: "Niklas", paypalMe: "nik" } });
  await page.route("**/api/parse-receipt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        merchant: "C.C. Kowalski",
        date: "2026-10-15",
        currency: "EUR",
        items: [
          { name: "Wiener Schnitzel", qty: 4, total: 12600 },
          { name: "Hirschgulasch", qty: 1, total: 8200 },
        ],
        total: 20800,
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
  const sheet = page.locator(".sheet");
  const create = page.getByRole("button", { name: "Rechnung erstellen" }).first();
  await expect(sheet.or(create).first()).toBeVisible({ timeout: 15_000 });
  if (!(await sheet.isVisible())) await create.click();

  await sheet.getByRole("radio", { name: "als Endbetrag" }).click();
  const total = sheet.getByLabel("Endbetrag inklusive Trinkgeld");
  // Empty, with a question – not a grey "208,00" that looks filled in and locked.
  await expect(total).toHaveValue("");
  await expect(total).toHaveAttribute("placeholder", "Was hast Du bezahlt?");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
  await total.click();
  await page.keyboard.type("230");
  await expect(sheet.locator(".tip-preview")).toContainText("22,00 €");
  await sheet.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(page.locator(".receipt-sums")).toContainText("230,00 €");
  // The tip goes on every item by the same percentage (22/208 = 10,6 %), not per head.
  await expect(page.locator(".receipt-sums")).toContainText("Trinkgeld auf jede Position");
  await expect(page.locator(".receipt-sums")).toContainText("+10,6 %");
  const billId = page.url().match(/#\/b\/([^/?]+)/)![1];
  const items = (await api<{ data: { items: { id: string; name: string }[] } }>(niklasKey, "GET", `/api/bills/${billId}`)).data.items;
  const schnitzel = items.find((i) => i.name === "Wiener Schnitzel")!.id;
  // Andy had one Schnitzel (31,50 €): plus 10,6 % tip = 34,83 €.
  await joinAndClaim({ key: key("andy"), name: "Andy" }, billId, { [schnitzel]: [0] });
  const owner = await api<{ debtors: { name: string; amount: number }[] }>(niklasKey, "GET", `/api/bills/${billId}`);
  expect(owner.debtors.find((d) => d.name === "Andy")?.amount).toBe(3483);
  await page.locator(".receipt-sums").screenshot({ path: process.env.SHOT_BILL ?? "/dev/null" }).catch(() => undefined);
});
