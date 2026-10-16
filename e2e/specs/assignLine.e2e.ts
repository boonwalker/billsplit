import { expect, test, type Page } from "@playwright/test";
import { createBill, joinAndClaim, key, phone } from "./helpers";

/** Holds a finger on a receipt line until its sheet opens. */
async function hold(page: Page, name: string) {
  const line = page.locator("li[data-item]", { hasText: name }).locator(".rline-main");
  await line.scrollIntoViewIfNeeded();
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
}

test("Rechnungssteller: gedrückt halten ordnet eine Zeile direkt zu – mehrere teilen sie", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const andy = { key: key("andy"), name: "Andy" };
  const ben = { key: key("ben"), name: "Ben" };
  // Andy is one of Niklas' people from an earlier bill; Ben joined this one.
  const earlier = await createBill(niklas, "Pizzeria", [{ id: "pizza", name: "Pizza", qty: 1, total: 900 }]);
  await joinAndClaim(andy, earlier, { pizza: [0] });
  const bill = await createBill(niklas, "Trattoria", [
    { id: "pasta", name: "Pasta", qty: 1, total: 1200 },
    { id: "wein", name: "Wein", qty: 2, total: 1000 },
  ]);
  await joinAndClaim(ben, bill, {});

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, seen: [bill] });
  await page.goto(`/#/b/${bill}`);
  await hold(page, "Pasta");
  const people = page.getByRole("group", { name: "Wer hatte das?" });
  await expect(people.getByRole("button")).toHaveText(["DuDu", "BBen", "AAndy"]);
  // The "/ N" is still there below.
  await expect(page.getByRole("group", { name: "Geteilt durch" })).toBeVisible();

  // Andy had it: he is in the bill now, with all of it.
  await people.getByRole("button", { name: /Andy/ }).click();
  await expect(people.getByRole("button", { name: /Andy/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".debtor", { hasText: "Andy" })).toContainText("von Dir zugeordnet · 12,00 € offen");
  // Shared with Ben: half each.
  await people.getByRole("button", { name: /Ben/ }).click();
  await expect(people.getByRole("button", { name: /Ben/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".debtor", { hasText: "Andy" })).toContainText("6,00 € offen");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
  // Andy after all not: Ben has all of it.
  await people.getByRole("button", { name: /Andy/ }).click();
  await expect(people.getByRole("button", { name: /Andy/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".debtor", { hasText: "Andy" })).toContainText("0,00 € offen");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(people).toHaveCount(0);
  await expect(page.locator("li[data-item='pasta']")).toContainText("Ben");

  // The wine is mine: both glasses.
  await hold(page, "Wein");
  await people.getByRole("button", { name: /Du/ }).click();
  await expect(people.getByRole("button", { name: /Du/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator("li[data-item='wein']")).toHaveClass(/mine/);
  await expect(page.locator("li[data-item='wein'] .tick")).toHaveAttribute("style", /--fill: 1/);

  // Ben sees the pasta as his.
  const benPhone = await phone(browser, ben.key, { profile: { name: "Ben" }, seen: [bill] });
  await benPhone.goto(`/#/b/${bill}`);
  await expect(benPhone.locator("li[data-item='pasta']")).toHaveClass(/mine/);
});
