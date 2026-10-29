import { expect, test } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

test("Rechnungssteller hakt „erhalten“ jederzeit ab – auch bevor der Freund auf Bezahlen getippt hat (z.B. bar)", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Kiosk", [
    { id: "bier", name: "Bier", qty: 1, total: 350 },
    { id: "chips", name: "Chips", qty: 1, total: 250 },
  ]);
  const anna = { key: key("anna"), name: "Anna" };
  await joinAndClaim(anna, id, { bier: [0] });
  await joinAndClaim({ key: key("ben"), name: "Ben" }, id, {});

  const owner = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Kiosk", role: "owner" }], seen: [id] });
  await owner.goto(`/#/b/${id}`);
  const annaRow = owner.locator(".debtor", { hasText: "Anna" });
  await expect(annaRow).toContainText("3,50 €");
  // Ben has nothing ticked yet: nothing to receive.
  await expect(owner.locator(".debtor", { hasText: "Ben" }).getByRole("checkbox")).toHaveCount(0);

  await annaRow.getByRole("checkbox", { name: "Anteil von Anna erhalten" }).click();
  await expect(annaRow.getByRole("checkbox")).toBeChecked();
  await expect(annaRow).toContainText("Zahlungseingang bestätigt");

  // Anna sees it – nothing left to pay.
  const hers = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Kiosk", role: "guest" }], seen: [id] });
  await hers.goto(`/#/b/${id}`);
  await expect(hers.locator(".paybar")).toContainText("Niklas hat Deinen Anteil als erhalten markiert.");
  await expect(hers.getByRole("button", { name: /Anteil begleichen/ })).toHaveCount(0);
});
