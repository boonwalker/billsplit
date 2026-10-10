import { expect, test } from "@playwright/test";
import { api, createBill, followPaypal, joinAndClaim, key, phone } from "./helpers";

test("Gesamtausgleich: eine Zahlung an Katia begleicht auch Andys Schuld – Katia bestätigt", async ({ browser }) => {
  const me = { key: key("niklas"), name: "Niklas" };
  const andy = { key: key("andy"), name: "Andy", paypal: "andy" };
  const katia = { key: key("katia"), name: "Katia", paypal: "katia" };
  // Andy paid the pizzeria (my pizza: 5 €); Katia paid the cinema (Andy's ticket 5 €, my popcorn 3 €).
  const pizzeria = await createBill(andy, "Pizzeria", [{ id: "pizza", name: "Pizza", qty: 1, total: 500 }]);
  await joinAndClaim(me, pizzeria, { pizza: [0] });
  const kino = await createBill(katia, "Kino", [
    { id: "ticket", name: "Ticket", qty: 1, total: 500 },
    { id: "popcorn", name: "Popcorn", qty: 1, total: 300 },
  ]);
  await joinAndClaim(andy, kino, { ticket: [0] });
  await joinAndClaim(me, kino, { popcorn: [0] });

  const page = await phone(browser, me.key, {
    profile: { name: "Niklas" },
    recent: [
      { id: kino, title: "Kino", role: "guest" },
      { id: pizzeria, title: "Pizzeria", role: "guest" },
    ],
  });
  await page.goto("/#/dashboard");
  const plan = page.locator(".plan-card");
  await expect(plan).toContainText("Alles ausgleichen mit einer Zahlung statt 2");
  await expect(plan).toContainText("begleicht auch 5,00 € von Andy bei Katia");
  await plan.getByRole("button", { name: "Zahlen" }).click();

  const sheet = page.locator(".settle-sheet");
  await expect(sheet).toContainText("8,00 € an Katia");
  await sheet.getByRole("button", { name: /8,00 € an Katia zahlen/ }).click();
  expect(await followPaypal(page, /Mit PayPal bezahlen · 8,00/)).toBe("https://www.paypal.com/paypalme/katia/8.00EUR");
  await sheet.getByRole("button", { name: /Gesendet – Katia bestätigen lassen/ }).click();
  await expect(sheet).toContainText("wartet auf die Bestätigung von Katia");
  await sheet.getByRole("button", { name: "Fertig" }).click();
  await expect(page.locator(".transfer-inbox")).toContainText("8,00 € an Katia · wartet auf Bestätigung");

  // Katia confirms on her dashboard; the start page told her about it.
  const katiaPage = await phone(browser, katia.key, { profile: { name: "Katia", paypalMe: "katia" }, recent: [{ id: kino, title: "Kino", role: "owner" }] });
  await katiaPage.goto("/");
  await expect(katiaPage.getByRole("button", { name: /Dashboard/ })).toContainText("1 Eingang bestätigen");
  await katiaPage.goto("/#/dashboard");
  const incoming = katiaPage.locator(".inbox-card.incoming");
  await expect(incoming).toContainText("Niklas hat Dir 8,00 € gesendet");
  await incoming.getByRole("button", { name: "✓ Erhalten" }).click();
  await expect(incoming).toHaveCount(0);

  // Everything is settled – in Andy's bill too.
  await expect(page.locator(".transfer-inbox")).toContainText("Katia hat 8,00 € erhalten");
  const andyView = await api<{ debtors: { name: string; credited?: number }[] }>(andy.key, "GET", `/api/bills/${pizzeria}`);
  expect(andyView.debtors.find((d) => d.name === "Niklas")?.credited).toBe(500);
});

test("Ausgleich mit einer Person: Erhaltenes selbst eintragen – die Person sieht es", async ({ browser }) => {
  const me = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const carl = { key: key("carl"), name: "Carl" };
  const bar = await createBill(me, "Bar", [{ id: "wein", name: "Wein", qty: 1, total: 634 }]);
  await joinAndClaim(carl, bar, { wein: [0] });

  const page = await phone(browser, me.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: bar, title: "Bar", role: "owner" }] });
  await page.goto("/#/dashboard");
  await page.locator(".person-ring", { hasText: "Carl" }).locator(".person-ring-hit").click();
  const sheet = page.locator(".settle-sheet");
  await expect(sheet).toContainText("Carl zahlt Dir 6,34 €");
  await sheet.getByRole("button", { name: "✓ 6,34 € erhalten – eintragen" }).click();
  await expect(sheet).toContainText("als erhalten eingetragen");
  await sheet.getByRole("button", { name: "Fertig" }).click();
  await expect(page.locator(".person-ring", { hasText: "Carl" })).toContainText("ausgeglichen");

  const carlPage = await phone(browser, carl.key, { profile: { name: "Carl" }, recent: [{ id: bar, title: "Bar", role: "guest" }] });
  await carlPage.goto("/#/dashboard");
  await expect(carlPage.locator(".transfer-inbox")).toContainText("Niklas hat 6,34 € von Dir als erhalten eingetragen");
});
