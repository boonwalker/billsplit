import { expect, test } from "@playwright/test";
import { api, createBill, key, mailedCode, phone } from "./helpers";

test("Betriebsseite: Konto verwalten – Profil zurücksetzen, dann alle Daten löschen; die App sagt es einmal", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const bill = await createBill(niklas, "Löschtest Trattoria", [{ id: "pizza", name: "Pizza", qty: 1, total: 950 }]);
  const anna = { key: key("anna"), name: "Anna Löschtest" };
  await api(anna.key, "POST", `/api/bills/${bill}/join`, { name: anna.name });
  await api(anna.key, "PUT", `/api/bills/${bill}/claims`, { claims: { pizza: [0] } });
  const email = `loeschen-${Date.now()}@example.de`;
  await api(anna.key, "POST", "/api/account/code", { email, name: anna.name });
  await api(anna.key, "POST", "/api/account/verify", { email, code: await mailedCode(email), profile: { name: anna.name, paypalMe: "anna" } });

  const admin = await phone(browser, key("admin"));
  await admin.goto("/api/admin?token=e2e-admin-token-123456");
  const row = admin.locator("#konten + p + .scroll tr", { hasText: email });
  await row.getByText("Verwalten").click();
  await row.getByRole("button", { name: "Profil zurücksetzen" }).click();
  await expect(admin.locator(".notice")).toContainText(`Profil von ${email} zurückgesetzt`);

  // Erasing needs the address typed once more.
  await admin.locator("#konten + p + .scroll tr", { hasText: email }).getByText("Verwalten").click();
  const erase = admin.locator("#konten + p + .scroll tr", { hasText: email }).locator("form", { has: admin.getByRole("button", { name: "Alle Daten löschen" }) });
  await erase.getByLabel("E-Mail zur Bestätigung").fill(email);
  await erase.getByRole("button", { name: "Alle Daten löschen" }).click();
  await expect(admin.locator(".notice")).toContainText(email);
  await expect(admin.locator("#konten + p + .scroll")).not.toContainText(email);
  await expect(admin.locator("#rechnungen + .scroll")).not.toContainText("Anna Löschtest");

  // Niklas sees "Gelöscht" in his bill.
  const owner = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, seen: [bill] });
  await owner.goto(`/#/b/${bill}`);
  await expect(owner.locator(".debtor").first()).toContainText("Gelöscht");

  // Anna's phone: signed out, a fresh device, told once.
  const phoneOfAnna = await phone(browser, anna.key, { profile: { name: anna.name }, recent: [{ id: bill, title: "Löschtest Trattoria", role: "guest" }] });
  await phoneOfAnna.goto("/");
  await phoneOfAnna.evaluate((e) => localStorage.setItem("billsplit.account", JSON.stringify(e)), email);
  await phoneOfAnna.reload();
  const notice = phoneOfAnna.locator(".account-lost", { hasText: "gelöscht" });
  await expect(notice).toContainText(`Dein Konto ${email} und Deine Daten wurden gelöscht.`);
  expect(await phoneOfAnna.evaluate(() => localStorage.getItem("billsplit.deviceKey"))).not.toBe(JSON.stringify(anna.key));
  await notice.getByRole("button", { name: "OK" }).click();
  await phoneOfAnna.reload();
  await expect(phoneOfAnna.locator(".account-lost")).toHaveCount(0);
});
