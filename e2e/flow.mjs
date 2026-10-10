import { chromium } from "playwright-core";
const SP = process.argv[2];
const BASE = "http://localhost:8787/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const device = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" };

// 1) A receipt photo
const r = await browser.newPage({ viewport: { width: 420, height: 700 } });
await r.setContent(`<body style="margin:0;background:#ddd;display:flex;justify-content:center;padding:20px">
<pre style="background:#fff;padding:24px 22px;font:20px/1.5 'DejaVu Sans Mono',monospace;color:#111;transform:rotate(-0.6deg)">
   Trattoria Da Mario
 Hauptstrasse 12, Berlin
   08.10.2026  20:41

1 Pizza Margherita    9,50
3 x Bier 0,5l        13,50
2 x Tiramisu         10,00
1 Spaghetti Carbonara 12,90
1 Wasser 0,25l        2,80

SUMME EUR            48,70
MwSt 19%              7,78
</pre></body>`);
await r.screenshot({ path: `${SP}/shots/receipt.png` });
await r.close();

const ownerCtx = await browser.newContext(device);
const owner = await ownerCtx.newPage();
owner.on("console", (m) => m.type() === "error" && console.log("[owner console]", m.text()));
await owner.goto(BASE);
await owner.waitForTimeout(500);
await owner.screenshot({ path: `${SP}/shots/01-home.png` });

await owner.getByRole("button", { name: "Rechnung fotografieren" }).click();
await owner.getByPlaceholder("z. B. Niklas").fill("Niklas");
await owner.getByPlaceholder("du@beispiel.de").fill("niklas@web.de");
await owner.getByPlaceholder("deinname").fill("niklasb");
await owner.screenshot({ path: `${SP}/shots/02-profile.png` });
await owner.getByRole("button", { name: "Weiter zur Kamera" }).click();
await owner.locator('input[type=file]:not([capture])').setInputFiles(`${SP}/shots/receipt.png`);
await owner.waitForTimeout(1500);
await owner.screenshot({ path: `${SP}/shots/03-scanning.png` });
await owner.getByRole("button", { name: "QR-Code erstellen" }).waitFor({ timeout: 120000 });
await owner.waitForTimeout(400);
await owner.screenshot({ path: `${SP}/shots/04-review.png`, fullPage: true });
const names = await owner.locator('input[aria-label="Bezeichnung"]').evaluateAll((els) => els.map((e) => e.value));
const prices = await owner.locator('input[aria-label="Preis gesamt"]').evaluateAll((els) => els.map((e) => e.value));
const qtys = await owner.locator('input[aria-label="Anzahl"]').evaluateAll((els) => els.map((e) => e.value));
console.log("OCR items:", names.map((n, i) => `${qtys[i]}x ${n} = ${prices[i]}`));
await owner.getByRole("button", { name: "QR-Code erstellen" }).click();
await owner.getByRole("button", { name: "Ohne Trinkgeld weiter" }).click();
await owner.waitForURL(/#\/b\//);
await owner.waitForTimeout(1200);
await owner.screenshot({ path: `${SP}/shots/05-owner-qr.png` });
const billUrl = owner.url();
console.log("bill url", billUrl);

// 2) Friend opens the link (= scans the QR code)
const annaCtx = await browser.newContext(device);
const anna = await annaCtx.newPage();
anna.on("console", (m) => m.type() === "error" && console.log("[anna console]", m.text()));
await anna.goto(billUrl);
await anna.getByPlaceholder("Dein Name").fill("Anna");
await anna.screenshot({ path: `${SP}/shots/06-anna-name.png` });
await anna.getByRole("button", { name: "Zur Rechnung" }).click();
await anna.waitForTimeout(1500);
await anna.screenshot({ path: `${SP}/shots/07-anna-bill.png` });

// owner sees Anna appear
await owner.locator(".debtor").first().waitFor({ timeout: 5000 });
console.log("owner sees debtor:", await owner.locator(".debtor-name").allTextContents());

// Anna claims pizza and 2 beers
const lines = anna.locator(".rline-main");
const texts = await lines.allTextContents();
console.log("lines:", texts);
const idx = (s) => texts.findIndex((t) => t.toLowerCase().includes(s));
await lines.nth(idx("pizza")).click();
await lines.nth(idx("bier")).click(); // takes all 3
await anna.waitForTimeout(300);
await anna.getByRole("button", { name: "Eins weniger" }).click(); // -> 2
await anna.waitForTimeout(1200);

// Ben joins too
const benCtx = await browser.newContext(device);
const ben = await benCtx.newPage();
await ben.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Ben", paypalMe: "", paypalEmail: "" })));
await ben.goto(billUrl);
await ben.waitForTimeout(1200);
const blines = ben.locator(".rline-main");
const btexts = await blines.allTextContents();
const bidx = (s) => btexts.findIndex((t) => t.toLowerCase().includes(s));
await blines.nth(bidx("bier")).click(); // last beer
await blines.nth(bidx("tiramisu")).click();
await ben.waitForTimeout(1200);

// Owner ticks own spaghetti
await owner.locator(".rline-main").nth(idx("spaghetti")).click();
await owner.waitForTimeout(1500);
await anna.screenshot({ path: `${SP}/shots/08-anna-live.png`, fullPage: true });
await anna.locator("#receipt").screenshot({ path: `${SP}/shots/08b-anna-receipt.png` });

// Anna pays
console.log("pay href:", await anna.locator(".btn-paypal").getAttribute("href"));
const [popup] = await Promise.all([annaCtx.waitForEvent("page"), anna.locator(".btn-paypal").click()]);
console.log("paypal link:", popup.url());
await popup.close().catch(() => {});
await anna.waitForTimeout(1500);
await anna.screenshot({ path: `${SP}/shots/09-anna-paid.png` });

await owner.waitForTimeout(500);
await owner.screenshot({ path: `${SP}/shots/10-owner-full.png`, fullPage: true });
await owner.locator(".owner-panel").screenshot({ path: `${SP}/shots/10b-owner-panel.png` });
console.log("owner panel:", (await owner.locator(".owner-panel").innerText()).replace(/\n+/g, " | "));
console.log("owner bar:", (await owner.locator(".ownerbar").innerText()).replace(/\n+/g, " | "));
console.log("anna sees owner panel?", await anna.locator(".owner-panel").count());
console.log("done lines on anna:", await anna.locator(".rline.done").count());
await browser.close();
