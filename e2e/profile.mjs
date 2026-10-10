import { chromium } from "playwright-core";
const SP = process.argv[2];
const ctx = await chromium.launchPersistentContext(`${SP}/chrome-profile`, {
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "de-DE",
});
let page = await ctx.newPage();
await page.goto("http://localhost:8810/");
await page.getByRole("button", { name: "Profil" }).click();
await page.getByPlaceholder("z. B. Niklas").fill("Niklas");
await page.getByPlaceholder("du@beispiel.de").fill("niklas@web.de");
await page.getByRole("button", { name: "Speichern" }).click();
await page.waitForTimeout(500);
console.log("nach Speichern, URL:", page.url(), "| localStorage:", await page.evaluate(() => localStorage.getItem("billsplit.profile")));
await page.close();
page = await ctx.newPage();
await page.goto("http://localhost:8810/");
await page.waitForTimeout(500);
console.log("neuer Tab | localStorage:", await page.evaluate(() => localStorage.getItem("billsplit.profile")));
console.log("Avatar:", await page.getByRole("button", { name: "Profil" }).innerText());
await page.getByRole("button", { name: "Profil" }).click();
console.log("Profilfelder:", await page.getByPlaceholder("z. B. Niklas").inputValue(), "|", await page.getByPlaceholder("du@beispiel.de").inputValue());
await ctx.close();
