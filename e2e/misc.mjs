import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 3274;
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: SP + "/data-misc" }, stdio: "ignore" });
try {
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:${PORT}${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const NIK = "nikkey-1234567890abcdefghij";
const id = (await call("/api/bills", NIK, "POST", { name: "Niklas", data: { title: "REWE Ridders oHG", date: "2026-10-10", currency: "EUR", items: [{ id: "a", name: "Spezi", qty: 1, total: 95 }], tipPercent: 0, payment: { paypalMe: "nik" } } })).id;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: "dark" });
await ctx.addInitScript(([k]) => { localStorage.setItem("billsplit.deviceKey", JSON.stringify(k)); localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" })); }, [NIK]);
const p = await ctx.newPage();
await p.goto(`http://localhost:${PORT}/#/b/${id}`); await p.waitForSelector(".share-row"); await wait(800);
await p.locator(".share-row").screenshot({ path: `${SP}/shots/share-row.png` });
await p.locator(".topbar").screenshot({ path: `${SP}/shots/topbar-long.png` });
const g = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: "dark", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" });
const gp = await g.newPage();
await gp.goto(`http://localhost:${PORT}/#/b/${id}`); await gp.waitForSelector(".sheet h2"); await wait(600);
await gp.locator(".sheet").screenshot({ path: `${SP}/shots/name-prompt.png` });
await browser.close();
} finally { srv.kill(); }
