import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

test("Gerät wechseln: QR-Link vom alten Handy übernimmt Rechnungen und Profil, nur einmal", async ({ browser }) => {
  const me = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const mine = await createBill(me, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const anna = { key: key("anna"), name: "Anna", paypal: "anna" };
  const hers = await createBill(anna, "Sushi Bar", [{ id: "maki", name: "Maki", qty: 1, total: 800 }]);
  await joinAndClaim(me, hers, { maki: [0] });

  const old = await phone(browser, me.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: mine, title: "Trattoria", role: "owner" }] });
  await old.goto("/#/profile");
  await old.getByRole("button", { name: "Auf neues Gerät übertragen" }).click();
  await expect(old.locator(".device-panel .qr svg")).toBeVisible();
  await old.getByRole("button", { name: /Link kopieren/ }).click();
  const link = await old.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#\/geraet\/[A-Za-z0-9_-]{24}$/);

  // The new phone pastes the link in the scanner and takes over.
  const fresh = await phone(browser, key("new-phone"));
  await fresh.goto("/#/scan");
  await fresh.getByPlaceholder("https://…/#/b/…").fill(link);
  await fresh.getByRole("button", { name: "Gerät übernehmen" }).click();
  await fresh.getByRole("button", { name: "Übernehmen" }).click();
  await expect(fresh.locator(".device-card")).toContainText("Deine 2 Rechnungen sind jetzt auf diesem Gerät");
  await fresh.getByRole("button", { name: "Zu Deinen Rechnungen" }).click();
  await expect(fresh.locator("main")).toContainText("Trattoria");
  await expect(fresh.locator("main")).toContainText("Sushi Bar");
  expect(await fresh.evaluate(() => JSON.parse(localStorage.getItem("billsplit.profile") ?? "{}").paypalMe)).toBe("nik");

  // The code works once only.
  await fresh.goto(`/#/geraet/${link.split("/").pop()}`);
  await fresh.getByRole("button", { name: "Übernehmen" }).click();
  await expect(fresh.locator(".alert").last()).toContainText("abgelaufen oder wurde schon benutzt");
});

test("Wiederherstellungs-Code: auf einem anderen Gerät eingeben holt die Rechnungen zurück", async ({ browser }) => {
  const me = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(me, "Biergarten", [{ id: "bier", name: "Bier", qty: 1, total: 450 }]);
  const old = await phone(browser, me.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: bill, title: "Biergarten", role: "owner" }] });
  await old.goto("/#/profile");
  await old.getByRole("button", { name: "Wiederherstellungs-Code anzeigen" }).click();
  const code = await old.locator(".recovery-code").innerText();
  expect(code).toBe(me.key);

  const other = await phone(browser, key("other"), { profile: { name: "Niklas" } });
  await other.goto("/#/profile");
  await other.getByRole("button", { name: "Wiederherstellungs-Code eingeben" }).click();
  await other.locator(".recovery-input").fill("kein-code");
  await other.getByRole("button", { name: "Rechnungen wiederherstellen" }).click();
  await expect(other.locator(".device-transfer .alert")).toContainText("kein Wiederherstellungs-Code");
  await other.locator(".recovery-input").fill(code);
  await other.getByRole("button", { name: "Rechnungen wiederherstellen" }).click();
  await expect(other.locator(".device-panel")).toContainText("1 Rechnung wiederhergestellt");
});
