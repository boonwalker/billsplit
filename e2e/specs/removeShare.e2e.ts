import { expect, test } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

test("Rechnungssteller: Namen eines Gastes gedrückt halten – Anteil entfernen (Annas Guthaben verschwindet live)", async ({ browser }) => {
  const peter = { key: key("peter"), name: "Peter", paypal: "peter" };
  const anna = { key: key("anna"), name: "Anna" };
  const andy = { key: key("andy"), name: "Andy" };
  const id = await createBill(peter, "Hallmackenreuther", [
    { id: "kakao", name: "Kakao mit Sahne", qty: 1, total: 410 },
    { id: "cola", name: "Coca Cola", qty: 1, total: 350 },
  ]);
  // Anna paid her cocoa; afterwards Andy ticked it too.
  await joinAndClaim(anna, id, { kakao: [0] });
  await api(anna.key, "POST", `/api/bills/${id}/pay`, {});
  await api(anna.key, "POST", `/api/bills/${id}/paid`, { paid: true });
  await joinAndClaim(andy, id, { kakao: [0], cola: [0] });

  const hers = await phone(browser, anna.key, { profile: { name: "Anna" }, recent: [{ id, title: "Hallmackenreuther", role: "guest" }], seen: [id] });
  await hers.goto(`/#/b/${id}`);
  await expect(hers.locator(".paybar-refund")).toContainText("2,05 €");

  const owner = await phone(browser, peter.key, { profile: { name: "Peter", paypalMe: "peter" }, recent: [{ id, title: "Hallmackenreuther", role: "owner" }], seen: [id] });
  await owner.goto(`/#/b/${id}`);
  const chip = owner.locator("li[data-item]", { hasText: "Kakao mit Sahne" }).locator(".rline-claims li", { hasText: "Andy" });
  await chip.hover();
  await owner.mouse.down();
  await owner.waitForTimeout(700);
  await owner.mouse.up();
  const ask = owner.getByRole("alertdialog", { name: "Anteil von Andy entfernen?" });
  await expect(ask).toContainText("Andy hat „Kakao mit Sahne“ abgehakt (2,05 €).");
  await owner.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
  await ask.getByRole("button", { name: "Anteil entfernen" }).click();
  await expect(ask).toBeHidden();

  // Andy's name is gone from the cocoa (not from his cola); Anna's credit too – live.
  await expect(owner.locator("li[data-item]", { hasText: "Kakao mit Sahne" }).locator(".rline-claims")).not.toContainText("Andy");
  await expect(owner.locator("li[data-item]", { hasText: "Coca Cola" }).locator(".rline-claims")).toContainText("Andy");
  await expect(hers.locator(".paybar-refund")).toHaveCount(0);
});
