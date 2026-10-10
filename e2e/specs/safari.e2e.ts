import { expect, test } from "@playwright/test";
import { createBill, key } from "./helpers";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("WhatsApp-Link in Safari: Abgehaktes kommt mit „In der App öffnen“ in die Home-Bildschirm-App", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Trattoria", [
    { id: "pizza", name: "Pizza", qty: 1, total: 950 },
    { id: "wein", name: "Wein", qty: 1, total: 600 },
  ]);

  // Safari: separate storage, its own device key.
  const safariCtx = await browser.newContext({ userAgent: IPHONE, permissions: ["clipboard-read", "clipboard-write"] });
  await safariCtx.addInitScript((billId) => localStorage.setItem(`billsplit.claimDemo.${billId}`, "1"), id);
  const safari = await safariCtx.newPage();
  await safari.goto(`/#/b/${id}`);
  await safari.getByPlaceholder("Dein Name").fill("Anna");
  await safari.getByRole("button", { name: "Zur Rechnung" }).click();
  await safari.locator(".rline-main", { hasText: "Pizza" }).click();
  await expect(safari.getByRole("button", { name: /Anteil begleichen · 9,50/ })).toBeVisible();
  await safari.locator(".open-in-app").getByRole("button", { name: "In der App öffnen" }).click();
  await expect(safari.locator(".open-in-app")).toContainText("was Du hier abgehakt hast, kommt mit");
  const link = await safari.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/[?&]von=[A-Za-z0-9_-]{24}/);

  // The home-screen app: another key, no bills yet.
  const appCtx = await browser.newContext({ userAgent: IPHONE, permissions: ["clipboard-read", "clipboard-write"] });
  await appCtx.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { get: () => true });
    localStorage.setItem("billsplit.pushAsked", "1");
  });
  const app = await appCtx.newPage();
  await app.goto("/");
  await app.evaluate((text) => navigator.clipboard.writeText(text), link);
  await app.getByRole("button", { name: "Kopierten Link öffnen" }).click();

  // Anna is in the bill with her pizza – without joining a second time.
  await expect(app).toHaveURL(new RegExp(`#/b/${id}`));
  await expect(app.getByRole("button", { name: /Anteil begleichen · 9,50/ })).toBeVisible();
  await expect(app.getByPlaceholder("Dein Name")).toHaveCount(0);
  await app.goto("/");
  await expect(app.locator("main")).toContainText("Trattoria");
  expect(await app.evaluate(() => JSON.parse(localStorage.getItem("billsplit.profile") ?? "{}").name)).toBe("Anna");
});
