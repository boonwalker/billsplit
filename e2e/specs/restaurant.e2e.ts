import { expect, test } from "@playwright/test";
import { api, key, phone } from "./helpers";
import type { Venue } from "../../src/lib/bill";

/** A tiny valid PNG: what the photo shows does not matter, the recognition is simulated. */
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("Restaurant-Modus: Tische mit QR-Code, Kassenbon am Tisch, Ampel rot → gelb → freigegeben", async ({ browser }) => {
  const restaurantKey = key("brauhaus");
  const page = await phone(browser, restaurantKey, { profile: { name: "Brauhaus", paypalMe: "brauhaus" } });
  await page.route("**/api/parse-receipt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        merchant: "Brauhaus am Dom",
        date: "2026-10-27",
        currency: "EUR",
        items: [
          { name: "Kölsch", qty: 4, total: 1000 },
          { name: "Pommes", qty: 1, total: 500 },
        ],
        total: 1500,
        tip: 0,
        fees: [],
        delivery: false,
        supermarket: false,
        engine: "ai",
      }),
    }),
  );

  // From the profile: the restaurant with two tables.
  await page.goto("/#/profile");
  await page.getByRole("button", { name: "Restaurant-Modus öffnen" }).click();
  await page.getByLabel("Name des Restaurants").fill("Brauhaus am Dom");
  await page.getByLabel("Wie viele Tische?").fill("2");
  await page.getByRole("button", { name: "Restaurant anlegen" }).click();
  const cards = page.locator(".table-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Tisch 1");
  await expect(cards.first()).toContainText("frei");
  const [table1, table2] = (await api<{ venues: Venue[] }>(restaurantKey, "GET", "/api/venues")).venues[0].tables;

  // Table 1: the receipt photographed there – the bill opens at the table.
  await cards.first().locator("input[type=file]").setInputFiles({ name: "beleg.png", mimeType: "image/png", buffer: PHOTO });
  const sheet = page.locator(".sheet");
  const create = page.getByRole("button", { name: "Rechnung erstellen" }).first();
  await expect(sheet.or(create).first()).toBeVisible({ timeout: 15_000 });
  if (await sheet.isVisible()) await sheet.getByRole("button", { name: "Rechnung erstellen" }).click();
  else await create.click();
  await expect(page).toHaveURL(/#\/b\/[A-Za-z0-9_-]+\?zurueck=restaurant$/, { timeout: 15_000 });
  const billId = /#\/b\/([A-Za-z0-9_-]+)/.exec(page.url())![1];

  // Back to the board: red, everything open.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(cards.first()).toHaveClass(/light-red/);
  await expect(cards.first()).toContainText("noch 15,00 € offen");

  // A guest scans the table's QR code and lands in the bill.
  const anna = { key: key("anna"), name: "Anna" };
  const guest = await phone(browser, anna.key, { profile: { name: "Anna" }, seen: [billId] });
  await guest.goto(`/t/${table1.id}`);
  await expect(guest).toHaveURL(new RegExp(`#/b/${billId}`));
  await expect(guest.locator(".receipt")).toContainText("Kölsch");
  const snap = await api<{ me: string; data: { items: { id: string; name: string }[] } }>(anna.key, "GET", `/api/bills/${billId}`);
  const beer = snap.data.items.find((i) => i.name === "Kölsch")!.id;
  await api(anna.key, "PUT", `/api/bills/${billId}/claims`, { claims: { [beer]: [0, 1, 2, 3] } });

  // She pays the staff; the staff marks it as received – yellow, the fries are still open (live).
  const annaId = snap.me;
  await api(restaurantKey, "POST", `/api/bills/${billId}/received`, { participantId: annaId, received: true });
  await expect(cards.first()).toHaveClass(/light-yellow/);
  await expect(cards.first()).toContainText("noch 5,00 € offen");
  await expect(cards.first()).toContainText("1 Gast");

  // Freeing it asks first while money is open.
  await cards.first().getByRole("button", { name: "Tisch freigeben" }).click();
  await expect(cards.first()).toContainText("Noch 5,00 € offen – Tisch trotzdem freigeben?");
  await cards.first().getByRole("button", { name: "Freigeben" }).click();
  await expect(cards.first()).toHaveClass(/light-free/);

  // Table 2: the guest is early – waits, and lands in the bill once the staff opens it.
  const ben = await phone(browser, key("ben"), { profile: { name: "Ben" } });
  await ben.goto(`/t/${table2.id}`);
  await expect(ben.locator(".table-wait")).toContainText("Brauhaus am Dom · Tisch 2");
  await api(restaurantKey, "POST", `/api/venues/tables/${table2.id}`, { billId });
  await expect(ben).toHaveURL(new RegExp(`#/b/${billId}`), { timeout: 10_000 });

  // QR codes to print, one per table.
  await page.getByRole("button", { name: "QR-Codes drucken" }).click();
  await expect(page.locator(".qr-sheet-card")).toHaveCount(2);
  await expect(page.locator(".qr-sheet-card").first()).toContainText("Tisch 1");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null", fullPage: true }).catch(() => undefined);
});
