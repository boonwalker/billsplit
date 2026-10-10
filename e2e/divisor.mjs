import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3257", DATA_DIR: SP + "/data-divisor" }, stdio: "ignore" });
await wait(1500);
const OK = "ownerkey-1234567890abcdef";
const mk = (equalSplit) => fetch("http://localhost:3257/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": OK }, body: JSON.stringify({ name: "Niklas", data: { title: "REWE", date: "2026-10-10", currency: "EUR", items: [{ id: "m", name: "Vollmilch 1l", qty: 1, total: 119 }, { id: "b", name: "Brot", qty: 1, total: 250 }], tipPercent: 0, tipSplitCount: 2, equalSplit, payment: { paypalMe: "nik" } } }) }).then((r) => r.json());
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const equal of [true, false]) {
  const { id } = await mk(equal);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true });
  await ctx.addInitScript((id) => { localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); localStorage.setItem("billsplit.deviceKey", JSON.stringify("ownerkey-1234567890abcdef")); localStorage.setItem(`billsplit.tapDemo.${id}`, "1"); localStorage.setItem(`billsplit.claimDemo.${id}`, "1"); }, id);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3257/#/b/${id}`); await p.waitForSelector(".receipt .rline");
  const line = p.locator(".receipt .rline", { hasText: "Vollmilch" });
  await line.scrollIntoViewIfNeeded();
  const b = await line.locator(".rline-main").boundingBox();
  await p.mouse.move(b.x + 100, b.y + b.height / 2); await p.mouse.down(); await wait(700); await p.mouse.up(); await wait(300);
  console.log(equal ? "equal" : "normal", "– sheet open:", await p.locator(".divisor-sheet").count(), "| line class:", await line.getAttribute("class"));
  if (equal) await p.locator(".divisor-sheet").screenshot({ path: `${SP}/shots/divisor-sheet.png` });
  await p.getByRole("button", { name: "Kleinerer Teil" }).click();
  console.log("   preview:", await p.locator(".divisor-result").innerText());
  await p.getByRole("button", { name: "Übernehmen" }).click(); await wait(900);
  console.log("   line:", (await line.innerText()).replace(/\n/g, " "), "| total:", equal ? await p.locator(".fraction").getAttribute("aria-label") : await p.locator(".receipt-sums dd.grand").innerText());
  if (equal) await line.screenshot({ path: `${SP}/shots/divisor-line.png` });
  if (!equal) { await line.locator(".rline-main").click(); await wait(800); console.log("   short tap ticks:", await line.getAttribute("class")); }
  await ctx.close();
}
await browser.close(); srv.kill();
