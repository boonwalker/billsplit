import { expect, test } from "@playwright/test";
import { api, key, phone } from "./helpers";

test("Nach dem Bezahlen gestrichen: erst nachfragen, dann schuldet der Rechnungssteller die Differenz zurück", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas" };
  const anna = { key: key("anna"), name: "Anna" };
  const { id } = await api<{ id: string }>(niklas.key, "POST", "/api/bills", {
    name: niklas.name,
    data: {
      title: "Trattoria",
      date: "2026-10-12",
      currency: "EUR",
      tipPercent: 0,
      equalSplit: true,
      tipSplitCount: 2,
      payment: { paypalMe: "nik" },
      items: [
        { id: "pizza", name: "Pizza", qty: 1, total: 1200 },
        { id: "wein", name: "Wein", qty: 1, total: 800 },
      ],
    },
  });
  // Anna pays her 10,00 € and marks it as paid.
  await api(anna.key, "POST", `/api/bills/${id}/join`, { name: anna.name });
  await api(anna.key, "POST", `/api/bills/${id}/pay`, {});
  await api(anna.key, "POST", `/api/bills/${id}/paid`, { paid: true });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Trattoria", role: "owner" }], seen: [id] });
  await page.goto(`/#/b/${id}`);
  // Crossing out the wine would leave Anna having paid 4,00 € too much: Niklas is asked first.
  await page.locator(".rline-main", { hasText: "Wein" }).click();
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText("Anna hat schon bezahlt");
  await expect(ask).toContainText("danach wären es nur 6,00");
  await ask.getByRole("button", { name: "Abbrechen" }).click();
  await expect(ask).toBeHidden();
  await expect(page.locator(".debtor-refund")).toHaveCount(0);

  await page.locator(".rline-main", { hasText: "Wein" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Trotzdem ändern" }).click();
  await expect(page.locator(".debtor-refund")).toContainText("Du schuldest Anna 4,00 € zurück");

  // Anna sees it too.
  const hers = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Trattoria", role: "guest" }], seen: [id] });
  await hers.goto(`/#/b/${id}`);
  await expect(hers.locator(".paybar-refund")).toContainText("Niklas schuldet Dir 4,00 €");
});
