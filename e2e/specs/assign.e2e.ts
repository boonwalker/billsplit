import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

test("Ausgabe zuweisen: 5 € Taxi direkt Andy zuordnen – oder 10 € mit Andy teilen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const andy = { key: key("andy"), name: "Andy" };
  // An earlier bill together: Andy is one of Niklas' people now.
  const earlier = await createBill(niklas, "Pizzeria", [{ id: "pizza", name: "Pizza", qty: 1, total: 900 }]);
  await joinAndClaim(andy, earlier, { pizza: [0] });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: earlier, title: "Pizzeria", role: "owner" }] });
  await page.goto("/#/ausgabe");
  await page.getByLabel("Betrag in Euro").fill("5");
  await page.getByRole("button", { name: "Taxi" }).click();
  const people = page.getByRole("group", { name: "Direkt zuordnen" });
  await people.getByRole("button", { name: /Andy/ }).click();
  await expect(page.locator(".expense-each")).toContainText("Andy zahlt 5,00 €");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page).toHaveURL(/#\/b\//);
  await expect(page.locator(".debtors")).toContainText("Andy");
  await expect(page.locator(".debtors")).toContainText("5,00 €");
  // An equal split without me: Andy pays all of it.
  await expect(page.locator(".tip-split-panel")).toContainText("5,00 € für eine Person – Du bist nicht dabei");
  await page.screenshot({ path: process.env.SHOT_BILL ?? "/dev/null", fullPage: true }).catch(() => undefined);

  // 10 € shared with Andy: half each.
  await page.goto("/#/ausgabe");
  await page.getByLabel("Betrag in Euro").fill("10");
  await page.getByRole("button", { name: "Taxi" }).click();
  await page.getByRole("group", { name: "Direkt zuordnen" }).getByRole("button", { name: /Andy/ }).click();
  await page.getByRole("button", { name: /Du bist auch dabei/ }).click();
  await expect(page.locator(".expense-each")).toContainText("5,00 € pro Person · 2 Personen");
  await page.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page).toHaveURL(/#\/b\//);
  await expect(page.locator(".debtors")).toContainText("5,00 €");

  // Andy never opened the taxis – they are in his list anyway (and open, as an equal split).
  const andyPhone = await phone(browser, andy.key, { profile: { name: "Andy" }, recent: [{ id: earlier, title: "Pizzeria", role: "guest" }] });
  await andyPhone.goto("/");
  const list = andyPhone.locator("ul.list");
  await expect(list.getByText("Taxi", { exact: true })).toHaveCount(2);
  await expect(list).toContainText("Du schuldest · 5,00 €");
  // Not opened yet: highlighted until Andy opens it.
  const taxis = list.locator(".list-item", { hasText: "Taxi" });
  await expect(taxis.and(andyPhone.locator(".unread"))).toHaveCount(2);
  await expect(list.locator(".list-item", { hasText: "Pizzeria" })).not.toHaveClass(/unread/);
  await andyPhone.screenshot({ path: process.env.SHOT_ANDY ?? "/dev/null", fullPage: true }).catch(() => undefined);
  await taxis.first().locator(".list-main").click();
  await expect(andyPhone).toHaveURL(/#\/b\//);
  await andyPhone.goto("/");
  await expect(taxis.and(andyPhone.locator(".unread"))).toHaveCount(1);
});
