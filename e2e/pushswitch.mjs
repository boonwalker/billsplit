import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
// Profile: the notification switch, off and on (light and dark).
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3291", DATA_DIR: SP + "/data-pushswitch" }, stdio: "ignore" });
await wait(1500);
const BASE = "http://localhost:3291";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
  await ctx.addInitScript(() => localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })));
  const p = await ctx.newPage();
  await p.goto(BASE + "/#/profile"); await wait(1200);
  await p.locator(".push-section").screenshot({ path: `${SP}/shots/pushswitch-${scheme}-off.png` });
  // Draw the "on" state without a push service.
  await p.evaluate(() => { const i = document.querySelector(".push-switch input"); if (i) i.checked = true; });
  await p.locator(".push-section").screenshot({ path: `${SP}/shots/pushswitch-${scheme}-on.png` });
  console.log(scheme, "switch:", await p.locator(".push-switch .switch").boundingBox());
  await ctx.close();
}
await browser.close();
srv.kill();
