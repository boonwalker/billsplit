import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

test("Betriebsseite: Rechnung löschen – sie verschwindet live und aus den Listen aller, als hätte es sie nie gegeben", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const anna = { key: key("anna"), name: "Anna" };
  const kept = await createBill(niklas, "Bleibt Pizzeria", [{ id: "pizza", name: "Pizza", qty: 1, total: 900 }]);
  const doomed = await createBill(niklas, "Löschtest Bar", [{ id: "bier", name: "Bier", qty: 1, total: 450 }]);
  await joinAndClaim(anna, kept, { pizza: [0] });
  await joinAndClaim(anna, doomed, { bier: [0] });

  // Niklas has the bill open, Anna sees it in her list.
  const owner = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, seen: [kept, doomed] });
  await owner.goto(`/#/b/${doomed}`);
  await expect(owner.locator(".debtor", { hasText: "Anna" })).toBeVisible();
  const annaPhone = await phone(browser, anna.key, {
    profile: { name: "Anna" },
    recent: [
      { id: doomed, title: "Löschtest Bar", role: "guest" },
      { id: kept, title: "Bleibt Pizzeria", role: "guest" },
    ],
  });
  await annaPhone.goto("/");
  await expect(annaPhone.locator(".list-title")).toHaveText(["Löschtest Bar", "Bleibt Pizzeria"]);

  // Deleted on the admin page (with the tick).
  const admin = await phone(browser, key("admin"));
  await admin.goto("/api/admin?token=e2e-admin-token-123456");
  const row = admin.locator("#rechnungen + .scroll tr", { hasText: "Löschtest Bar" });
  await row.getByText("Löschen", { exact: true }).click();
  await row.getByLabel("Endgültig löschen").check();
  await row.getByRole("button", { name: "Rechnung löschen" }).click();
  await expect(admin.locator(".notice")).toContainText("Rechnung „Löschtest Bar“");
  await expect(admin.locator("#rechnungen + .scroll")).not.toContainText("Löschtest Bar");

  // Live: Niklas' open bill says so; Anna's list loses it without a trace (no "nicht mehr verfügbar").
  await expect(owner.getByRole("heading", { name: "Diese Rechnung wurde gelöscht." })).toBeVisible();
  await expect(annaPhone.locator(".list-title")).toHaveText(["Bleibt Pizzeria"]);
  await owner.goto("/");
  await expect(owner.locator(".list-title")).toHaveText(["Bleibt Pizzeria"]);
  expect(await annaPhone.evaluate(() => localStorage.getItem("billsplit.recent"))).not.toContain("Löschtest");

  // The balance only knows the pizza.
  await annaPhone.goto("/#/dashboard");
  await expect(annaPhone.locator("body")).toContainText("9,00 €");
  await expect(annaPhone.locator("body")).not.toContainText("13,50 €");
});

test("Betriebsseite: Anteil entfernen – Andys Hälfte am Kakao fällt weg, Annas Guthaben verschwindet live", async ({ browser }) => {
  const peter = { key: key("peter"), name: "Peter", paypal: "peter" };
  const anna = { key: key("anna"), name: "Anna" };
  const andy = { key: key("andy"), name: "Andy" };
  const id = await createBill(peter, "Anteiltest Café", [
    { id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 },
    { id: "kuchen", name: "Kuchen", qty: 1, total: 390 },
  ]);
  await joinAndClaim(anna, id, { kakao: [0] });
  await api(anna.key, "POST", `/api/bills/${id}/pay`, {});
  await api(anna.key, "POST", `/api/bills/${id}/paid`, { paid: true });
  await joinAndClaim(andy, id, { kakao: [0], kuchen: [0] });

  const hers = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Anteiltest Café", role: "guest" }], seen: [id] });
  await hers.goto(`/#/b/${id}`);
  await expect(hers.locator(".paybar-refund")).toContainText("schuldet Dir Peter jetzt wieder 2,05 € zurück");

  const admin = await phone(browser, key("admin"));
  await admin.goto("/api/admin?token=e2e-admin-token-123456");
  const row = admin.locator("#rechnungen + .scroll tr", { hasText: "Anteiltest Café" });
  await row.getByText("Anteil entfernen", { exact: true }).click();
  await row.getByLabel("Person und Position").selectOption({ label: "Andy · Kakao mit Sahne" });
  await row.getByRole("button", { name: "Entfernen" }).click();
  await expect(admin.locator(".notice")).toContainText("Anteil von Andy an „Kakao mit Sahne“ in „Anteiltest Café“ entfernt.");

  // Live on Anna's phone: the credit is gone, Andy keeps his cake.
  await expect(hers.locator(".paybar-refund")).toHaveCount(0);
  const snap = await api<{ participants: { name: string; claims: Record<string, number[]> }[] }>(anna.key, "GET", `/api/bills/${id}`);
  expect(snap.participants.find((p) => p.name === "Andy")?.claims).toEqual({ kuchen: [0] });
});
