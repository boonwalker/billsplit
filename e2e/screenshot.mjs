import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
// 1) A transparent "app" screenshot of a digital receipt
const mk = await browser.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 3 });
await mk.setContent(`<body style="margin:0;background:transparent;font-family:sans-serif">
<div style="padding:18px 20px;color:#111">
<div style="display:flex;justify-content:space-between;color:#888"><span>‹ Bestellungen</span><span>Hilfe</span></div>
<h2 style="margin:18px 0 4px">Sushi Sana</h2><div style="color:#666">Bestellung #48213 · 09.10.2026</div>
<div style="margin:16px 0;border-top:1px solid #ddd"></div>
${[["1x","Takoyaki (4 Stk.)","6,50"],["2x","Ramen Shoyu","24,80"],["1x","Edamame","4,90"],["3x","Asahi 0,33l","13,50"]]
  .map(([q,n,p])=>`<div style="display:flex;justify-content:space-between;margin:10px 0"><span>${q} ${n}</span><span>${p} €</span></div>`).join("")}
<div style="margin:16px 0;border-top:1px solid #ddd"></div>
<div style="display:flex;justify-content:space-between;font-weight:bold"><span>Gesamt</span><span>49,70 €</span></div>
<div style="margin-top:28px;background:#ff6a00;color:#fff;text-align:center;padding:14px;border-radius:12px">Erneut bestellen</div>
</div></body>`);
await mk.screenshot({ path: `${SP}/shots/app-receipt.png`, omitBackground: true });
await mk.close();

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
const page = await ctx.newPage();
let sent = null;
await page.route("**/api/parse-receipt", async (route) => {
  sent = JSON.parse(route.request().postData());
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    merchant: "Sushi Sana", date: "2026-10-09", currency: "EUR",
    items: [{ name: "Takoyaki (4 Stk.)", qty: 1, total: 650 }, { name: "Ramen Shoyu", qty: 2, total: 2480 }, { name: "Edamame", qty: 1, total: 490 }, { name: "Asahi 0,33l", qty: 3, total: 1350 }],
    total: 4970, tip: null, engine: "ai" }) });
});
await page.goto("http://localhost:8813/");
await page.waitForTimeout(500);
await page.screenshot({ path: `${SP}/shots/40-home-screenshot-option.png` });
const card = page.locator("label.action-card", { hasText: "Screenshot hochladen" });
console.log("Option sichtbar:", await card.count() === 1, "| Kamera erzwungen:", await card.locator("input").getAttribute("capture"));
await card.locator("input").setInputFiles(`${SP}/shots/app-receipt.png`);
await page.waitForTimeout(2500);
writeFileSync(`${SP}/shots/sent-to-server.jpg`, Buffer.from(sent.image, "base64"));
console.log("an Server gesendet:", sent.mediaType, Math.round(sent.image.length * 0.75 / 1024), "KB");
console.log("Trinkgeld-Frage:", await page.locator(".sheet").count() > 0);
await browser.close();
