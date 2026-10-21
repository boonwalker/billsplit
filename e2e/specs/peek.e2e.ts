import { expect, test, type Page } from "@playwright/test";
import { createBill, key, phone } from "./helpers";

const scrollTop = (page: Page) => page.locator(".bill-scroll").evaluate((el) => el.scrollTop);

/** A finger stroke upwards that starts at (x, y). */
async function stroke(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - i * 25 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("Neue Rechnung: auch auf dem hochgezogenen Bon lässt sich die Seite scrollen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "Trattoria", [
    { id: "pizza", name: "Pizza", qty: 1, total: 950 },
    { id: "pasta", name: "Pasta", qty: 1, total: 1180 },
  ]);
  // First opening: the receipt peeks up from behind the bar (no "seen" flags for it).
  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Trattoria", role: "owner" }] });
  await page.goto(`/#/b/${id}`);
  const peek = page.locator(".receipt-peek");
  await expect(peek).toBeVisible();
  await page.waitForTimeout(1600); // it has slid up
  const box = (await peek.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 30;
  expect(await scrollTop(page)).toBe(0);

  // A finger stroke upwards that starts on the snippet moves the page.
  await stroke(page, x, y);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(150);
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);

  // Back up, and the same with the mouse wheel.
  await page.locator(".bill-scroll").evaluate((el) => el.scrollTo(0, 0));
  if (await peek.isVisible()) {
    const top = await scrollTop(page);
    const wheelBox = (await peek.boundingBox())!;
    await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + 30);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(top + 50);
  }
});

test("Auch auf den Leisten unten lässt sich die Seite scrollen – beim Rechnungssteller und bei Freunden", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Position ${i + 1}`, qty: 1, total: 500 + i * 10 }));
  const id = await createBill(niklas, "Großer Tisch", items);

  const owner = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "Großer Tisch", role: "owner" }], seen: [id] });
  await owner.goto(`/#/b/${id}`);
  const ownerBar = (await owner.locator(".ownerbar").boundingBox())!;
  await owner.waitForTimeout(600);
  await stroke(owner, ownerBar.x + ownerBar.width / 2, ownerBar.y + ownerBar.height / 2);
  await expect.poll(() => scrollTop(owner)).toBeGreaterThan(150);

  const anna = await phone(browser, key("anna"), { profile: { name: "Anna" }, seen: [id] });
  await anna.goto(`/#/b/${id}`);
  await expect(anna.locator(".paybar")).toBeVisible();
  await anna.waitForTimeout(600);
  const payBar = (await anna.locator(".paybar").boundingBox())!;
  await stroke(anna, payBar.x + payBar.width / 2, payBar.y + 40);
  await expect.poll(() => scrollTop(anna)).toBeGreaterThan(150);
});
