import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3233", DATA_DIR: SP + "/data-inbox" }, stdio: "ignore" });
await wait(1500);
const res = await fetch("http://localhost:3233/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Andy", data: { title: "Gültig", date: "2026-10-09", currency: "EUR", items: [{ id: "a", name: "Pizza", qty: 1, total: 1000 }], tipPercent: 0, payment: { paypalMe: "andy" } } }) });
const { id } = await res.json();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ locale: "de-DE" });
await ctx.addInitScript((id) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Andy", paypalMe: "andy", paypalEmail: "" }));
  localStorage.setItem("billsplit.deviceKey", JSON.stringify("ownerkey-1234567890abcdef"));
  const now = new Date().toISOString();
  localStorage.setItem("billsplit.recent", JSON.stringify([
    { id, title: "Gültig", role: "owner", createdAt: now },
    { id: "ungueltig123", title: "Abgelaufen", role: "guest", createdAt: now },
    { id: "weg456789ab", title: "Gelöscht", role: "owner", createdAt: now },
  ]));
}, id);
const page = await ctx.newPage();
await page.goto("http://localhost:3233/");
await wait(300);
console.log("first paint:", await page.locator(".list-title").allTextContents());
await wait(1500);
console.log("after check:", await page.locator(".list-title").allTextContents());
await page.reload(); await wait(800);
console.log("after reload:", await page.locator(".list-title").allTextContents());
await browser.close();
srv.kill();
