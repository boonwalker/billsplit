import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3290", DATA_DIR: SP + "/data-push" }, stdio: "ignore" });
await wait(1500);
const BASE = "http://localhost:3290";
const sw = await fetch(BASE + "/sw.js");
console.log("sw.js:", sw.status, sw.headers.get("content-type"), sw.headers.get("cache-control"));
console.log("key:", (await (await fetch(BASE + "/api/push/key")).json()).publicKey?.length);
const bad = await fetch(BASE + "/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json", "x-billsplit-key": "k-1234567890abcdefgh" }, body: JSON.stringify({ endpoint: "https://evil.example/x", keys: { p256dh: "a", auth: "b" } }) });
console.log("foreign endpoint:", bad.status, (await bad.json()).error);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addInitScript(() => {
  localStorage.setItem("billsplit.deviceKey", JSON.stringify("push-key-1234567890abcdef"));
  localStorage.setItem("billsplit.profile", JSON.stringify({ name: "Niklas", paypalMe: "nik", paypalEmail: "" }));
});
const p = await ctx.newPage();
await p.goto(BASE + "/#/dashboard"); await wait(1500);
console.log("prompt:", (await p.locator(".push-prompt").count()) ? (await p.locator(".push-prompt").innerText()).replace(/\n/g, " | ") : "(none)");
await p.locator(".push-prompt").screenshot({ path: `${SP}/shots/push-prompt.png` });
console.log("sw registered:", await p.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())));
await p.getByRole("button", { name: "Nicht jetzt" }).click(); await wait(200);
await p.reload(); await wait(1200);
console.log("prompt after dismiss:", await p.locator(".push-prompt").count());
await p.goto(BASE + "/#/profile"); await wait(1000);
console.log("setting:", (await p.locator(".push-setting").innerText()).replace(/\n/g, " | "));
await p.locator(".push-section").screenshot({ path: `${SP}/shots/push-setting.png` });
await p.screenshot({ path: `${SP}/shots/profile-bottom.png`, fullPage: true });

// A push arriving at the service worker shows a notification.
const cdp = await ctx.newCDPSession(p);
const versions = [];
cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => versions.push(...e.registrations));
await cdp.send("ServiceWorker.enable");
const reg = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).scope);
await ctx.grantPermissions(["notifications"], { origin: BASE });
await wait(500);
const regId = versions.find((r) => r.scopeURL === reg)?.registrationId;
await cdp.send("ServiceWorker.deliverPushMessage", { origin: BASE, registrationId: regId, data: JSON.stringify({ title: "Niklas hat Dir 8,00 € gesendet", body: "Bestätige den Eingang im Dashboard.", path: "/dashboard" }) });
await wait(800);
console.log("notifications:", await p.evaluate(async () => (await (await navigator.serviceWorker.getRegistration()).getNotifications()).map((n) => `${n.title} – ${n.body} – ${n.data.path}`)));
// Turning it on (Chromium without a push service may refuse; the app says so).
await p.locator(".push-switch input").check().catch(() => {}); await wait(2500);
console.log("after switch:", (await p.locator(".push-setting").innerText()).replace(/\n/g, " | "), "| checked:", await p.locator(".push-switch input").isChecked());
await browser.close(); srv.kill();
