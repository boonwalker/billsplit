import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3240", DATA_DIR: SP + "/data-wa" }, stdio: "ignore" });
await wait(1500);
const res = await fetch("http://localhost:3240/api/bills", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "ownerkey-1234567890abcdef" }, body: JSON.stringify({ name: "Niklas", data: { title: "Lidl", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Pizza", qty: 1, total: 1000 }], tipPercent: 0, payment: { paypalMe: "nik" } } }) });
const { id } = await res.json();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
await ctx.addInitScript(() => { localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); localStorage.setItem("billsplit.deviceKey", JSON.stringify("ownerkey-1234567890abcdef")); });
const p = await ctx.newPage();
await p.goto(`http://localhost:3240/#/b/${id}`); await p.waitForSelector(".qr-hero"); await wait(600);
const href = await p.locator(".btn-whatsapp").getAttribute("href");
console.log(href.slice(0, 22), "|", decodeURIComponent(href.split("text=")[1]));
await p.locator(".qr-hero").screenshot({ path: `${SP}/shots/wa.png` });
await browser.close(); srv.kill();
