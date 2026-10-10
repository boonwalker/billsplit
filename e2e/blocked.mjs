import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
await ctx.addInitScript(() => {
  Storage.prototype.setItem = function () { throw new DOMException("blocked", "SecurityError"); };
});
const page = await ctx.newPage();
await page.goto("http://localhost:8810/");
await page.getByRole("button", { name: "Profil" }).click();
await page.getByPlaceholder("z. B. Niklas").fill("Niklas");
await page.getByPlaceholder("du@beispiel.de").fill("niklas@web.de");
await page.getByRole("button", { name: "Speichern" }).click();
await page.waitForTimeout(300);
console.log("Hinweis:", (await page.locator(".alert").allTextContents()).join(" ").slice(0, 80) + "…");
await page.getByRole("button", { name: "Speichern" }).click();
await page.waitForTimeout(300);
console.log("weiter zur Startseite:", page.url().endsWith("#/"), "| Avatar:", await page.getByRole("button", { name: "Profil" }).innerText());
await browser.close();
