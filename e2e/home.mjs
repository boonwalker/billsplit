import { chromium } from "playwright-core";
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "niklasb", paypalEmail: "" })));
  const page = await ctx.newPage();
  await page.goto("http://localhost:3191/");
  await page.locator(".actions").scrollIntoViewIfNeeded();
  await page.locator(".actions").screenshot({ path: `${SP}/shots/home-${scheme}.png` });
  await ctx.close();
}
await browser.close();
