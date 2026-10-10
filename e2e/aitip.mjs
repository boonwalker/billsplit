import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function run(label, tip) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/parse-receipt", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      merchant: "Sushi Sana", date: "2026-10-09", currency: "EUR",
      items: [{ name: "Takoyaki", qty: 1, total: 650 }, { name: "Ramen", qty: 2, total: 2480 }],
      total: 3130, tip, engine: "ai" }) }));
  await page.goto("http://localhost:8812/");
  await page.locator(".action-card.primary input[type=file]").setInputFiles(`${SP}/shots/receipt.png`);
  await page.waitForTimeout(2500);
  const sheet = await page.locator(".sheet").count();
  console.log(`[${label}] URL: ${page.url().replace(/^.*#/, "#")} | Trinkgeld-Frage sichtbar: ${sheet > 0}`);
  if (page.url().includes("#/b/")) console.log(`[${label}] Belegsummen:`, (await page.locator(".receipt-sums").innerText()).replace(/\n+/g, " | "));
  if (errors.length) console.log(`[${label}] Fehler:`, errors);
  await ctx.close();
}
await run("ohne Trinkgeld", null);
await run("mit Trinkgeld", 300);
await run("Feld fehlt", undefined);
await browser.close();
