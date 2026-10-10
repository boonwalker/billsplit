import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

/** Participant id of a device key (as the server derives it). */
const pid = (deviceKey: string) => createHash("sha256").update(deviceKey).digest("base64url").slice(0, 16);

test("Benachrichtigung „hat bezahlt“: öffnet die Rechnung direkt beim Freund in der Liste", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna" };
  const id = await createBill(niklas, "Steakhouse", [
    { id: "steak", name: "Rib Eye", qty: 1, total: 3290 },
    { id: "wein", name: "Rotwein", qty: 1, total: 2800 },
    { id: "dessert", name: "Crème brûlée", qty: 1, total: 900 },
  ]);
  await joinAndClaim(anna, id, { steak: [0] });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Steakhouse", role: "owner" }], seen: [id] });
  // The path the notification carries.
  await page.goto(`/#/b/${id}?an=${pid(anna.key)}`);
  const row = page.locator(`.debtor[data-id="${pid(anna.key)}"]`);
  await expect(row).toBeInViewport();
  await expect(row).toHaveClass(/focus-flash/);
});

test("Liste im Dashboard: Rechnungszeile öffnet die Rechnung an der Stelle – „Zurück“ führt zur Liste", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const carl = { key: key("carl"), name: "Carl" };
  const bar = await createBill(niklas, "Bar", [
    { id: "wein", name: "Wein", qty: 1, total: 634 },
    { id: "bier", name: "Bier", qty: 4, total: 1800 },
  ]);
  await joinAndClaim(carl, bar, { wein: [0] });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: bar, title: "Bar", role: "owner" }], seen: [bar] });
  await page.goto("/#/dashboard");
  await page.locator(".person-ring", { hasText: "Carl" }).locator(".person-ring-hit").click();
  await page.locator(".settle-sheet").getByRole("button", { name: /Bar: Carl schuldet Dir – Rechnung öffnen/ }).click();

  await expect(page).toHaveURL(new RegExp(`#/b/${bar}\\?an=`));
  await expect(page.locator(`.debtor[data-id="${pid(carl.key)}"]`)).toBeInViewport();
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(/#\/dashboard$/);
  await expect(page.locator(".settle-sheet")).toContainText("Mit Carl ausgleichen");
});
