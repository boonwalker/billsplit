import { expect, test, type Browser } from "@playwright/test";
import { createBill, key } from "./helpers";

/** 127.0.0.1 plays the old address, localhost the new one (PUBLIC_URL in playwright.config.ts). */
const OLD = "http://127.0.0.1:4173";
const NEW = "http://localhost:4173";

/** A phone that used klicksplit at the old address only; `standalone`: as the home-screen app. */
async function oldPhone(browser: Browser, deviceKey: string, recent: { id: string; title: string }[], standalone = false) {
  const context = await browser.newContext();
  await context.addInitScript(
    ([k, recent, standalone]) => {
      localStorage.setItem("billsplit.pushAsked", "1");
      localStorage.setItem("billsplit.profileAsked", "1");
      if (location.hostname !== "127.0.0.1") return;
      if (standalone) Object.defineProperty(navigator, "standalone", { get: () => true });
      if (localStorage.getItem("billsplit.deviceKey")) return;
      localStorage.setItem("billsplit.deviceKey", JSON.stringify(k));
      localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" }));
      localStorage.setItem("billsplit.recent", JSON.stringify(recent.map((b) => ({ ...b, role: "owner", createdAt: new Date().toISOString() }))));
    },
    [deviceKey, recent, standalone] as const,
  );
  return context;
}

test("Umzug: die alte Adresse leitet weiter und nimmt Gerätekennung, Profil und Rechnungen mit", async ({ browser }) => {
  const me = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(me, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const context = await oldPhone(browser, me.key, [{ id: bill, title: "Trattoria" }]);
  const page = await context.newPage();

  // An old link opens the same bill at the new address – still as its payer.
  await page.goto(`${OLD}/#/b/${bill}`);
  await expect(page).toHaveURL(`${NEW}/#/b/${bill}`);
  await expect(page.locator(".qr-hero svg").first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("billsplit.deviceKey") ?? "null"))).toBe(me.key);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("billsplit.profile") ?? "{}").name)).toBe("Niklas");
  await page.goto(`${NEW}/#/`);
  await expect(page.locator("main")).toContainText("Trattoria");
  await context.close();
});

test("Umzug: die Home-Bildschirm-App an der alten Adresse zeigt einen Hinweis mit Übergabe-Link", async ({ browser }) => {
  const me = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(me, "Kino", [{ id: "tickets", name: "Tickets", qty: 1, total: 2400 }]);
  const context = await oldPhone(browser, me.key, [{ id: bill, title: "Kino" }], true);
  const app = await context.newPage();
  await app.goto(`${OLD}/#/`);
  // The app stays where it is and keeps working …
  await expect(app).toHaveURL(`${OLD}/#/`);
  const notice = app.getByRole("dialog", { name: "klicksplit ist umgezogen" });
  await expect(notice).toContainText("Ab jetzt findest Du klicksplit unter localhost:4173");
  const link = notice.getByRole("link", { name: "localhost:4173 öffnen" });
  await expect(link).toHaveAttribute("href", /^http:\/\/localhost:4173\/#\/umzug\/[A-Za-z0-9_-]{24}\?ziel=%2F&app=1$/);
  const href = (await link.getAttribute("href"))!;
  await notice.getByRole("button", { name: "Später" }).click();
  await expect(notice).toBeHidden();
  await expect(app.locator("main")).toContainText("Kino");

  // … and the link takes its data to the new address.
  const browserTab = await context.newPage();
  await browserTab.goto(href);
  await expect(browserTab).toHaveURL(`${NEW}/#/`);
  await expect(browserTab.locator("main")).toContainText("Kino");
  expect(await browserTab.evaluate(() => JSON.parse(localStorage.getItem("billsplit.deviceKey") ?? "null"))).toBe(me.key);
  await context.close();
});
