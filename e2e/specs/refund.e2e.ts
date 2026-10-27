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
  await expect(hers.locator(".paybar-refund")).toContainText("Niklas hat die Rechnung nachträglich geändert und schuldet Dir jetzt 4,00 € zurück.");
  await expect(hers.getByRole("button", { name: "Stimmt nicht?" })).toHaveCount(0);
});

test("Nachträglich mitgeteilt: die Meldung nennt, wer was geteilt hat – „Stimmt nicht?“ klickt den Anteil wieder weg", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas" };
  const anna = { key: key("anna"), name: "Anna" };
  const andy = { key: key("andy"), name: "Andy" };
  const { id } = await api<{ id: string }>(niklas.key, "POST", "/api/bills", {
    name: niklas.name,
    data: {
      title: "Café",
      date: "2026-10-27",
      currency: "EUR",
      tipPercent: 0,
      payment: { paypalMe: "nik" },
      items: [
        { id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 },
        { id: "kuchen", name: "Kuchen", qty: 1, total: 390 },
      ],
    },
  });
  // Anna had the cocoa and pays 4,10 €; afterwards Andy ticks it as well.
  await api(anna.key, "POST", `/api/bills/${id}/join`, { name: anna.name });
  await api(anna.key, "PUT", `/api/bills/${id}/claims`, { claims: { kakao: [0] } });
  await api(anna.key, "POST", `/api/bills/${id}/pay`, {});
  await api(anna.key, "POST", `/api/bills/${id}/paid`, { paid: true });
  await api(andy.key, "POST", `/api/bills/${id}/join`, { name: andy.name });
  await api(andy.key, "PUT", `/api/bills/${id}/claims`, { claims: { kakao: [0], kuchen: [0] } });

  const page = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Café", role: "guest" }], seen: [id] });
  await page.goto(`/#/b/${id}`);
  const refund = page.locator(".paybar-refund-box");
  await expect(refund).toContainText("Andy hat „Kakao mit Sahne“ nachträglich mit Dir geteilt – darum schuldet Dir Niklas jetzt wieder 2,05 € zurück.");
  await expect(refund).toContainText("gerät nicht in Vergessenheit");

  // "Stimmt nicht?" – the hint, then Andy's half is tapped away (only in that line).
  await refund.getByRole("button", { name: "Stimmt nicht?" }).click();
  await expect(refund).toContainText("Tippe in der Rechnung bei „Kakao mit Sahne“ auf Andy, um den Anteil wegzuklicken.");
  await expect(page.locator(".rline-hint.contest")).toContainText("Hattest Du „Kakao mit Sahne“ allein?");
  await page.getByRole("button", { name: "Anteil von Andy wegklicken" }).click();
  await expect(refund).toHaveCount(0);
  await expect(page.locator(".claim-btn.contest")).toHaveCount(0);

  // Andy keeps his cake.
  const his = await api<{ me: string; participants: { id: string; claims: Record<string, number[]> }[] }>(andy.key, "GET", `/api/bills/${id}`);
  expect(his.participants.find((p) => p.id === his.me)?.claims).toEqual({ kuchen: [0] });
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
});
