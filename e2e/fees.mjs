import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const items = [{ name: "Pizza Salami", qty: 1, total: 1150 }, { name: "Pizza Funghi", qty: 1, total: 1090 }, { name: "Cola 0,33l", qty: 3, total: 750 }];
const fees = [{ name: "Liefergebühr", amount: 299 }, { name: "Servicegebühr", amount: 99 }];
async function run(label, receipt, act) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/parse-receipt", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ merchant: "Pizzeria Lieferservice", date: "2026-10-09", currency: "EUR", engine: "ai", ...receipt }) }));
  await page.goto("http://localhost:8814/");
  await page.locator("label.action-card", { hasText: "Screenshot hochladen" }).locator("input").setInputFiles(`${SP}/shots/app-receipt.png`);
  await page.waitForTimeout(2000);
  const sheet = page.locator(".sheet");
  console.log(`[${label}] Fenster: ${await sheet.count() > 0 ? (await sheet.locator("h2").allTextContents()).join(" + ") : "keins"}`);
  await act?.(page, sheet);
  await page.waitForTimeout(1500);
  if (page.url().includes("#/b/")) {
    console.log(`[${label}] Beleg:`, (await page.locator(".receipt-sums").innerText()).replace(/\n+/g, " | "));
    if (await page.locator(".tip-split-panel").count()) console.log(`[${label}] Karte:`, (await page.locator(".tip-split-panel").innerText()).replace(/\n+/g, " "));
  }
  if (errors.length) console.log(`[${label}] Fehler:`, errors);
  await ctx.close();
}
await run("A Lieferung ohne Trinkgeld", { items, fees, delivery: true, tip: null, total: 2990 + 398 }, async (page, sheet) => {
  await sheet.getByLabel("Eine Person mehr").click(); // ? -> 2
  await sheet.getByLabel("Eine Person mehr").click(); // -> 3
  await page.screenshot({ path: `${SP}/shots/50-delivery-sheet.png` });
  await sheet.getByRole("radio", { name: "als Betrag" }).click();
  await sheet.getByLabel("Trinkgeld als Betrag").fill("2,00");
  console.log("[A] Vorschau:", (await sheet.locator(".tip-preview").innerText()).replace(/\n+/g, " | "));
  await sheet.getByRole("button", { name: "QR-Code erstellen" }).click();
});
await run("B Lieferung mit Fahrer-Trinkgeld", { items, fees, delivery: true, tip: 150, total: 2990 + 398 }, async (page, sheet) => {
  await sheet.getByLabel("Anzahl Personen").fill("4");
  await sheet.getByRole("button", { name: "QR-Code erstellen" }).click();
});
await run("C Restaurant mit Trinkgeld", { items, fees: [], delivery: false, tip: 300, total: 2990 });
await browser.close();
