import { chromium } from "playwright-core";
const SP = process.argv[2];
const out = (n) => `${SP}/shots/demo/${n}.png`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "de-DE" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto("http://localhost:8790/");
await page.waitForTimeout(600);
await page.screenshot({ path: out("01-home") });

await page.getByRole("button", { name: /Beispielrechnung ansehen/ }).click();
await page.getByPlaceholder("z. B. Niklas").fill("Niklas");
await page.getByPlaceholder("deinname").fill("niklasb");
await page.getByRole("button", { name: "Weiter zur Beispielrechnung" }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: out("02-owner-top") });
console.log("owner panel:", (await page.locator(".owner-panel").innerText()).replace(/\n+/g, " | "));

// owner ticks Spaghetti
await page.locator(".rline-main", { hasText: "Spaghetti" }).click();
await page.waitForTimeout(800);
await page.locator("#receipt").screenshot({ path: out("03-owner-receipt") });
console.log("ownerbar:", (await page.locator(".ownerbar").innerText()).replace(/\n+/g, " | "));

// switch to Ben
await page.getByRole("radio", { name: /Ben/ }).click();
await page.waitForTimeout(800);
await page.locator(".rline-main", { hasText: "Wasser" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: out("04-ben"), fullPage: false });
console.log("ben paybar:", (await page.locator(".paybar").innerText()).replace(/\n+/g, " | "));
console.log("ben pay href:", await page.locator(".btn-paypal").getAttribute("href"));
console.log("ben sees owner panel:", await page.locator(".owner-panel").count());

// switch to Anna (already paid)
await page.getByRole("radio", { name: /Anna/ }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: out("05-anna") });

// back to owner
await page.getByRole("radio", { name: /Niklas/ }).click();
await page.waitForTimeout(800);
await page.locator(".owner-panel").screenshot({ path: out("06-owner-panel") });

// Home lists the bill; new photo flow without the claude runtime
await page.locator(".topbar .icon-btn").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: out("07-home-after") });
await page.locator(".action-card.primary").waitFor();
const fileInput = page.locator('.action-card input[type=file]');
await fileInput.setInputFiles(`${SP}/shots/receipt.png`);
await page.waitForTimeout(1500);
await page.screenshot({ path: out("08-photo-no-runtime"), fullPage: true });
console.log("alert:", await page.locator(".alert").allTextContents());

// dark theme forced by host
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await page.waitForTimeout(300);
await page.screenshot({ path: out("09-dark") });
console.log("errors:", errors);
await browser.close();
