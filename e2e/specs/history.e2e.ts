import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

test("Dashboard: auch bei „✓ ausgeglichen“ zeigt der Ring die gemeinsamen Rechnungen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna", paypal: "anna" };
  const bill = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  await joinAndClaim(anna, bill, { pizza: [0] });
  const snap = await api<{ debtors: { id: string }[] }>(niklas.key, "GET", `/api/bills/${bill}`);
  // The money arrived: all settled with Anna.
  await api(niklas.key, "POST", `/api/bills/${bill}/received`, { participantId: snap.debtors[0].id, received: true });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id: bill, title: "Trattoria", role: "owner" }] });
  await page.goto("/#/dashboard");
  const ring = page.locator(".person-ring", { hasText: "Anna" });
  await expect(ring).toContainText("✓ ausgeglichen");
  await ring.getByRole("button", { name: "Gemeinsame Rechnungen mit Anna" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.locator("h2")).toHaveText("Du und Anna");
  await expect(sheet).toContainText("✓ Mit Anna ist alles ausgeglichen.");
  await expect(sheet).toContainText("Gemeinsame Rechnungen");
  await expect(sheet.locator(".settle-entries")).toContainText("Trattoria");
  await expect(sheet.locator(".settle-entries")).toContainText("Du hast bezahlt · Anteil Anna 9,50 €");
  await expect(sheet.locator(".settle-entries")).toContainText("✓ beglichen");
  await page.waitForTimeout(600);
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
});

test("Dashboard: Gesamtbilanz Rechnung für Rechnung – leihen links, schulden rechts", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna", paypal: "anna" };
  const mine = await createBill(niklas, "Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  await joinAndClaim(anna, mine, { pizza: [0] });
  const snap = await api<{ debtors: { id: string }[] }>(niklas.key, "GET", `/api/bills/${mine}`);
  await api(niklas.key, "POST", `/api/bills/${mine}/received`, { participantId: snap.debtors[0].id, received: true });
  const hers = await createBill(anna, "Kino", [{ id: "ticket", name: "Ticket", qty: 2, total: 1200 }]);
  await joinAndClaim(niklas, hers, { ticket: [0] });

  const page = await phone(browser, niklas.key, {
    profile: { name: "Niklas", paypalMe: "nik" },
    recent: [
      { id: hers, title: "Kino", role: "guest" },
      { id: mine, title: "Trattoria", role: "owner" },
    ],
  });
  await page.goto("/#/dashboard");
  await page.getByRole("button", { name: "Alle Rechnungen ansehen ›" }).click();
  const sheet = page.getByRole("dialog", { name: "Deine Bilanz" });
  const lent = sheet.getByRole("region", { name: "Du leihst" });
  const owed = sheet.getByRole("region", { name: "Du schuldest" });
  await expect(lent).toContainText("Trattoria");
  await expect(lent).toContainText("Anteile 9,50 €");
  await expect(lent).toContainText("✓ beglichen");
  await expect(owed).toContainText("Kino");
  await expect(owed).toContainText("Dein Anteil 6,00 €");
  await expect(owed).toContainText("6,00 € offen");
  await expect(owed.locator("header")).toContainText("6,00 €");
  await page.waitForTimeout(600);
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);

  // Into the bill and back: the overview is open again.
  await owed.getByRole("button", { name: /Kino/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/b/${hers}`));
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page.getByRole("dialog", { name: "Deine Bilanz" })).toBeVisible();

  // The middle of the ring opens it too.
  await page.getByRole("dialog", { name: "Deine Bilanz" }).getByRole("button", { name: "Schließen" }).click();
  await page.getByRole("button", { name: "Alle Rechnungen ansehen", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Deine Bilanz" })).toBeVisible();
});
