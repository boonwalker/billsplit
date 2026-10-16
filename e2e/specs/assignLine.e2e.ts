import { expect, test, type Page } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

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
  // Andy finds it in his list (never opened).
  const andyPhone = await phone(browser, andy.key, { profile: { name: "Andy" }, recent: [{ id: earlier, title: "Pizzeria", role: "guest" }] });
  await andyPhone.goto("/");
  await expect(andyPhone.locator("ul.list")).toContainText("Trattoria");
  // Shared with Ben: half each.
  await people.getByRole("button", { name: /Ben/ }).click();
  await expect(people.getByRole("button", { name: /Ben/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".debtor", { hasText: "Andy" })).toContainText("6,00 € offen");
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null" }).catch(() => undefined);
  // Andy after all not: Ben has all of it.
  await people.getByRole("button", { name: /Andy/ }).click();
  await expect(people.getByRole("button", { name: /Andy/ })).toHaveAttribute("aria-pressed", "false");
  // He had done nothing in it yet: he leaves the bill – and Andy's list – again.
  await expect(page.locator(".debtor", { hasText: "Andy" })).toHaveCount(0);
  await andyPhone.reload();
  await expect(andyPhone.locator("ul.list")).toContainText("Pizzeria");
  await expect(andyPhone.locator("ul.list")).not.toContainText("Trattoria");
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

test("Gleichverteilung: gedrückt halten gibt eine Position direkt einem Freund – der Rest bleibt gleich verteilt", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const andy = { key: key("andy"), name: "Andy" };
  const ben = { key: key("ben"), name: "Ben" };
  const earlier = await createBill(niklas, "Pizzeria", [{ id: "pizza", name: "Pizza", qty: 1, total: 900 }]);
  await joinAndClaim(andy, earlier, { pizza: [0] });
  const { id: bill } = await api<{ id: string }>(niklas.key, "POST", "/api/bills", {
    name: "Niklas",
    data: {
      title: "Einkauf",
      date: "2026-10-16",
      currency: "EUR",
      tipPercent: 0,
      equalSplit: true,
      payment: { paypalMe: "nik" },
      items: [
        { id: "brot", name: "Brot", qty: 1, total: 300 },
        { id: "kaese", name: "Käse", qty: 1, total: 600 },
        { id: "duschgel", name: "Duschgel", qty: 1, total: 300 },
      ],
    },
  });
  await api(ben.key, "POST", `/api/bills/${bill}/join`, { name: "Ben" });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, seen: [bill] });
  await page.goto(`/#/b/${bill}`);
  await expect(page.locator(".tip-split-panel")).toContainText("Rechnung 12,00 €");
  await hold(page, "Duschgel");
  const people = page.getByRole("group", { name: "Wer hatte das?" });
  await people.getByRole("button", { name: /Andy/ }).click();
  await expect(people.getByRole("button", { name: /Andy/ })).toHaveAttribute("aria-pressed", "true");
  // Andy pays the shower gel alone and his third of the rest: 3 + 3 = 6 €.
  await expect(page.locator(".debtor", { hasText: "Andy" })).toContainText("6,00 € offen");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator("li[data-item='duschgel'] .rline-for")).toHaveText("Andy");
  await expect(page.locator(".tip-split-panel")).toContainText("Rechnung 9,00 €");
  await page.screenshot({ path: process.env.SHOT_EQUAL ?? "/dev/null", fullPage: true }).catch(() => undefined);

  // Taken back: Andy leaves the bill again, the line is everyone's.
  await hold(page, "Duschgel");
  await people.getByRole("button", { name: /Andy/ }).click();
  await expect(people.getByRole("button", { name: /Andy/ })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator(".debtor", { hasText: "Andy" })).toHaveCount(0);
  await expect(page.locator("li[data-item='duschgel'] .rline-for")).toHaveCount(0);
  await expect(page.locator(".tip-split-panel")).toContainText("Rechnung 12,00 €");
});
