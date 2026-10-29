import { expect, test, type Page } from "@playwright/test";
import { api, createBill, joinAndClaim, key, phone } from "./helpers";

/** Every friend's row: name/status and the block on the right never overlap, nothing sticks out, the text stays readable. */
async function checkRows(page: Page, label: string) {
  // The rows slide in scaled down: measure once the (finite) animations are over.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))),
  );
  const problems = await page.locator(".debtor").evaluateAll((rows) =>
    rows.flatMap((row, i) => {
      const box = (sel: string) => row.querySelector(sel)?.getBoundingClientRect();
      const main = box(".debtor-main")!;
      const side = box(".debtor-side");
      const out: string[] = [];
      if (side && side.width > 0 && main.right > side.left + 1 && main.bottom > side.top + 1 && side.bottom > main.top + 1) out.push(`row ${i}: text and amount overlap`);
      if (main.width < 120) out.push(`row ${i}: text only ${Math.round(main.width)}px wide`);
      if (row.scrollWidth > row.clientWidth + 1) out.push(`row ${i}: sticks out sideways`);
      const mainEl = row.querySelector(".debtor-main") as HTMLElement;
      if (mainEl.scrollWidth > mainEl.clientWidth + 1) out.push(`row ${i}: text overflows`);
      return out;
    }),
  );
  expect(problems, label).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label}: page scrolls sideways`).toBe(true);
}

test("Freundesliste: auf jedem Bildschirm sauber – Betrag, „Erinnern“ und „erhalten“ rutschen gemeinsam unter den Namen", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "PiZz Neapolitanisches Restaurant", [
    { id: "pizza", name: "Pizza", qty: 4, total: 6344 },
  ]);
  // Like the bill from the screenshot: one just joined, two tapped pay – plus a very long name.
  await joinAndClaim({ key: key("david"), name: "David" }, id, { pizza: [0] });
  for (const name of ["Niklas", "Peter"]) {
    const friend = { key: key(name), name };
    await joinAndClaim(friend, id, { pizza: [name === "Niklas" ? 1 : 2] });
    await api(friend.key, "POST", `/api/bills/${id}/pay`, {});
  }
  await joinAndClaim({ key: key("max"), name: "Maximilian-Alexander von Hohenzollern" }, id, { pizza: [3] });

  const page = await phone(browser, niklas.key, { profile: { name: "Niklas", paypalMe: "nik" }, recent: [{ id, title: "PiZz", role: "owner" }], seen: [id] });
  await page.goto(`/#/b/${id}`);
  await expect(page.locator(".debtor")).toHaveCount(4);
  for (const width of [320, 360, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(150);
    await checkRows(page, `${width}px`);
  }
  // Large text (accessibility setting): the same on a mini.
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
  await page.waitForTimeout(150);
  await checkRows(page, "375px, große Schrift");
  await page.locator(".debtors").scrollIntoViewIfNeeded();
  await page.screenshot({ path: process.env.SHOT ?? "/dev/null", fullPage: true }).catch(() => undefined);
});

test("Kein Bildschirm zu schmal: Hauptseiten stehen bei 320 px und großer Schrift nirgends seitlich über", async ({ browser }) => {
  const niklas = { key: key("niklas"), name: "Niklas", paypal: "nik" };
  const id = await createBill(niklas, "PiZz Neapolitanisches Restaurant mit langem Namen", [
    { id: "pizza", name: "Pizza Margherita mit Büffelmozzarella und Basilikum", qty: 2, total: 3180 },
    { id: "wein", name: "Wein", qty: 1, total: 2400 },
  ]);
  const anna = { key: key("anna"), name: "Anna-Katharina" };
  await joinAndClaim(anna, id, { pizza: [0] });
  await api(anna.key, "POST", `/api/bills/${id}/pay`, {});
  const pages = [
    { who: niklas, role: "owner" as const, routes: ["/", `/#/b/${id}`, "/#/dashboard", "/#/profile"] },
    { who: anna, role: "guest" as const, routes: ["/", `/#/b/${id}`, "/#/dashboard"] },
  ];
  for (const { who, role, routes } of pages) {
    const page = await phone(browser, who.key, { profile: { name: who.name, paypalMe: role === "owner" ? "nik" : "" }, recent: [{ id, title: "PiZz", role }], seen: [id] });
    for (const big of [false, true]) {
      await page.setViewportSize({ width: 320, height: 700 });
      for (const route of routes) {
        await page.goto(route);
        if (big) await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
        await page.waitForTimeout(400);
        // The page itself and the scrolling middle of the bill page (it scrolls on its own).
        const wide = await page.evaluate(() =>
          Math.max(document.documentElement.scrollWidth - window.innerWidth, ...[...document.querySelectorAll(".bill-scroll")].map((el) => el.scrollWidth - el.clientWidth)),
        );
        expect(wide, `${role} ${route}${big ? " (große Schrift)" : ""}: ${wide}px zu breit`).toBeLessThanOrEqual(0);
      }
    }
  }
});
