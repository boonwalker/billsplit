import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function open(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addInitScript((seed) => {
    localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" }));
    if (seed) {
      localStorage.setItem("billsplit.demo.bills", JSON.stringify([seed]));
      localStorage.setItem("billsplit.recent", JSON.stringify([{ id: seed.id, title: seed.data.title, role: "owner", createdAt: seed.createdAt }]));
    }
  }, seed);
  return { ctx, page: await ctx.newPage() };
}
const pos = (page) => page.evaluate(() => {
  const y = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
  return { tip: y(".tip-split-panel"), instruction: y(".receipt-instruction"), receipt: y(".receipt") };
});

// 1) Beispielrechnung mit Freunden
let { ctx, page } = await open(null);
await page.goto("http://localhost:8792/");
await page.getByRole("button", { name: /Beispielrechnung ansehen/ }).click();
await page.waitForTimeout(1000);
let o = await pos(page);
console.log("[mit Freunden] Trinkgeld über Anweisung über Rechnung:", o.tip > 0 && o.tip < o.instruction && o.instruction < o.receipt);
console.log("[mit Freunden] Abgleich-Hinweis sichtbar:", (await page.getByText("Gleiche die Beträge").count()) > 0);
await page.locator(".tip-split-panel").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await page.waitForTimeout(400);
await page.screenshot({ path: `${SP}/shots/demo/30-tip-above.png` });
await ctx.close();

// 2) Rechnung ohne Freunde, mit Trinkgeld
const now = new Date().toISOString();
const seed = { id: "solo-bill-1", createdAt: now, ownerId: "demo-device-me",
  data: { title: "Pizzeria Roma", date: "2026-10-09", currency: "EUR", tipPercent: 0, tipAmount: 400,
    items: [{ id: "p1", name: "Pizza", qty: 1, total: 1200 }], payment: { paypalMe: "niklasb" } },
  participants: { "demo-device-me": { name: "Niklas", joinedAt: now, claims: {} } } };
({ ctx, page } = await open(seed));
await page.goto("http://localhost:8792/");
await page.getByText("Pizzeria Roma").click();
await page.waitForTimeout(1000);
o = await pos(page);
console.log("[ohne Freunde] Trinkgeld-Einstellung oben:", o.tip > 0 && o.tip < o.instruction);
console.log("[ohne Freunde] Abgleich-Hinweis sichtbar:", (await page.getByText("Gleiche die Beträge").count()) > 0);
await ctx.close();
await browser.close();
