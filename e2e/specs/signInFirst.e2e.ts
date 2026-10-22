import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, mailedCode, phone } from "./helpers";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** An account for this device key (as if made in the app earlier). */
async function account(deviceKey: string, email: string, profile: Record<string, string>) {
  await api(deviceKey, "POST", "/api/account/code", { email, name: profile.name });
  await api(deviceKey, "POST", "/api/account/verify", { email, code: await mailedCode(email), profile });
}

test("WhatsApp-Link in einem fremden Safari: „Schon ein Konto? Anmelden“ – Anna tritt als sie selbst bei, nicht doppelt", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna" };
  const email = `anna-zurueck-${Date.now()}@example.de`;
  const earlier = await createBill(niklas, "Pizzeria", [{ id: "pizza", name: "Pizza", qty: 1, total: 900 }]);
  await joinAndClaim(anna, earlier, { pizza: [0] });
  await account(anna.key, email, { name: "Anna", paypalMe: "anna" });
  const bill = await createBill(niklas, "Trattoria", [{ id: "pasta", name: "Pasta", qty: 1, total: 1200 }]);

  // A browser that does not know her (e.g. Safari deleted its data).
  const safari = await phone(browser, key("anna-safari"), { seen: [bill], userAgent: IPHONE });
  await safari.goto(`/#/b/${bill}`);
  await expect(safari.getByRole("heading", { name: "Wie heißt Du?" })).toBeVisible();
  await safari.getByRole("button", { name: /Schon ein Konto\? Anmelden/ }).click();
  await safari.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
  await safari.getByRole("button", { name: "Code senden" }).click();
  await safari.getByLabel("Code aus der Mail").fill(await mailedCode(email));

  // No second question: she is in the bill under her account, her earlier bill is in the list.
  await expect(safari.getByRole("heading", { name: "Wie heißt Du?" })).toHaveCount(0);
  await safari.locator(".rline-main", { hasText: "Pasta" }).click();
  await expect(safari.getByRole("button", { name: /Anteil begleichen · 12,00/ })).toBeVisible();
  expect(await safari.evaluate(() => JSON.parse(localStorage.getItem("billsplit.deviceKey")!))).toBe(anna.key);

  // Niklas: one Anna – the same one as in the pizzeria.
  const owner = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, seen: [bill] });
  await owner.goto(`/#/b/${bill}`);
  await expect(owner.locator(".debtor")).toHaveCount(1);
  await expect(owner.locator(".debtor")).toContainText("Anna");
  const contacts = await api<{ contacts: { name: string }[] }>(niklas.key, "GET", "/api/contacts");
  expect(contacts.contacts.filter((c) => c.name === "Anna")).toHaveLength(1);

  await safari.goto("/");
  await expect(safari.locator(".list-title")).toHaveText(["Trattoria", "Pizzeria"]);
});

test("Rechnungssteller auf neuem Gerät: im Profil-Assistenten „Schon ein Konto?“ – die Rechnung gehört gleich dem Konto", async ({ browser }) => {
  const niklasKey = key("niklas");
  const email = `niklas-neu-${Date.now()}@example.de`;
  await account(niklasKey, email, { name: "Niklas", paypalMe: "nik" });

  const page = await phone(browser, key("niklas-new-phone"));
  await page.goto("/#/ausgabe");
  await page.getByLabel("Betrag in Euro").fill("10");
  await page.getByRole("button", { name: "Essen" }).click();
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();

  const wizard = page.locator(".wizard");
  await expect(wizard.getByRole("heading", { name: "Wie heißt Du?" })).toBeVisible();
  await wizard.getByRole("button", { name: /Schon ein Konto\? Anmelden/ }).click();
  // "Zurück" leads back to the name.
  await wizard.getByRole("button", { name: "Zurück" }).click();
  await expect(wizard.getByRole("heading", { name: "Wie heißt Du?" })).toBeVisible();
  await wizard.getByRole("button", { name: /Schon ein Konto\? Anmelden/ }).click();
  await wizard.getByLabel("E-Mail-Adresse").fill(email);
  await wizard.getByRole("button", { name: "Code senden" }).click();
  await wizard.getByLabel("Code aus der Mail").fill(await mailedCode(email));

  // The account knows his name and PayPal: no more questions, the bill is his account's.
  await expect(page).toHaveURL(/#\/b\//, { timeout: 15_000 });
  await expect(wizard).toHaveCount(0);
  const id = page.url().match(/#\/b\/([A-Za-z0-9_-]+)/)![1];
  const mine = await api<{ bills: { id: string; role: string }[] }>(niklasKey, "GET", "/api/my-bills");
  expect(mine.bills).toContainEqual(expect.objectContaining({ id, role: "owner" }));
});
