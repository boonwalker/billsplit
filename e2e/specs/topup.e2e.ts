import { expect, test } from "@playwright/test";
import { api, createBill, followPaypal, key, leaveAndReturn, phone } from "./helpers";

test("Nach dem Bezahlen mehr abgehakt: der Rest wird nachgezahlt – beim Rechnungssteller als eigene Zeile mit eigenem „erhalten“", async ({ browser }) => {
  const peter = { key: key("peter"), name: "Peter", paypal: "peter" };
  const niklas = { key: key("niklas"), name: "Niklas" };
  const id = await createBill(peter, "Hallmackenreuther", [
    { id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 },
    { id: "weizen", name: "Weizen Alkoholfrei", qty: 2, total: 1000 },
  ]);
  await api(peter.key, "PUT", `/api/bills/${id}/claims`, { claims: { weizen: [1] } });
  // Niklas paid his cocoa, Peter confirmed it.
  const { me } = await api<{ me: string }>(niklas.key, "POST", `/api/bills/${id}/join`, { name: niklas.name });
  await api(niklas.key, "PUT", `/api/bills/${id}/claims`, { claims: { kakao: [0] } });
  await api(niklas.key, "POST", `/api/bills/${id}/pay`, {});
  await api(niklas.key, "POST", `/api/bills/${id}/paid`, { paid: true });
  await api(peter.key, "POST", `/api/bills/${id}/received`, { participantId: me, received: true });

  const nik = await phone(browser, niklas.key, { profile: { name: "Niklas" }, recent: [{ id, title: "Hallmackenreuther", role: "guest" }], seen: [id] });
  await nik.goto(`/#/b/${id}`);
  const bar = nik.locator(".paybar");
  await expect(bar).toContainText("Peter hat Deinen Anteil als erhalten markiert.");

  // Afterwards he ticks a beer as well: the 5,00 € on top are open, PayPal is offered again.
  await api(niklas.key, "PUT", `/api/bills/${id}/claims`, { claims: { kakao: [0], weizen: [0] } });
  await expect(bar).toContainText("Dein Anteil ist nach Deiner Zahlung gestiegen – es fehlen noch 5,00 €.");
  await expect(bar).toContainText("4,10 € bezahlt – von Peter bestätigt");
  await expect(bar).not.toContainText("als erhalten markiert.");

  // Peter sees it below Niklas, as a line of its own.
  const owner = await phone(browser, peter.key, { profile: { name: "Peter", paypalMe: "peter" }, recent: [{ id, title: "Hallmackenreuther", role: "owner" }], seen: [id] });
  await owner.goto(`/#/b/${id}`);
  const topUp = owner.locator(".debtor-topup");
  await expect(topUp).toContainText("Niklas · Nachzahlung");
  await expect(topUp).toContainText("Auswahl nach der Zahlung erweitert – noch offen");
  await expect(topUp).toContainText("5,00 €");
  await expect(owner.locator(".owner-sums")).toContainText("5,00 €");

  await bar.getByRole("button", { name: "Anteil begleichen · 5,00 €" }).click();
  expect(await followPaypal(nik, /Mit PayPal bezahlen · 5,00/)).toBe("https://www.paypal.com/paypalme/peter/5.00EUR");
  await leaveAndReturn(nik);
  const ask = nik.locator(".paybar-ask");
  await expect(ask).toContainText("Hast Du 5,00 € an Peter gesendet?");
  await ask.getByRole("button", { name: "✓ Ja, gesendet" }).click();
  await expect(nik.getByRole("button", { name: "✓ Als bezahlt markiert" })).toBeVisible();

  // Peter: marked as paid – he ticks "erhalten" for the top-up alone; the first payment stays as it was.
  await expect(topUp).toContainText("als bezahlt markiert");
  await expect(owner.locator(".debtor").first()).toContainText("4,10 €");
  await owner.getByLabel("Nachzahlung von Niklas erhalten").click();
  await expect(topUp).toContainText("Zahlungseingang bestätigt");
  await expect(owner.locator(".owner-sums dd.strong")).toHaveText("0,00 €");
  await owner.screenshot({ path: process.env.SHOT_OWNER ?? "/dev/null", fullPage: true }).catch(() => undefined);

  // Niklas: both payments confirmed, nothing left to pay.
  await expect(bar).toContainText("5,00 € bezahlt – von Peter bestätigt");
  await expect(bar).toContainText("4,10 € bezahlt – von Peter bestätigt");
  await expect(bar.getByRole("button", { name: /Anteil begleichen/ })).toHaveCount(0);
});
