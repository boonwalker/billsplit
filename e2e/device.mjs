import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3280", DATA_DIR: SP + "/data-device" }, stdio: "ignore" });
await wait(1500);
const BASE = "http://localhost:3280";
const call = (path, key, method, body) => fetch(BASE + path, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then((r) => r.json());
const ME = "old-phone-key-1234567890abcdef";
const items = [{ id: "a", name: "Pizza", qty: 1, total: 1290 }, { id: "b", name: "Pasta", qty: 1, total: 1150 }];
const b1 = (await call("/api/bills", ME, "POST", { name: "Niklas", data: { title: "Trattoria", date: "2026-10-09", currency: "EUR", items, tipPercent: 0, payment: { paypalMe: "nik" } } })).id;
const b2 = (await call("/api/bills", "anna-key-1234567890abcdefgh", "POST", { name: "Anna", data: { title: "Sushi Bar", date: "2026-10-08", currency: "EUR", items, tipPercent: 0, payment: { paypalMe: "anna" } } })).id;
await call(`/api/bills/${b2}/join`, ME, "POST", { name: "Niklas" });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const device = async (key, profile, recent = []) => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", permissions: ["clipboard-read", "clipboard-write"] });
  await c.addInitScript(([k, p, r]) => {
    if (k && !localStorage.getItem("billsplit.deviceKey")) localStorage.setItem("billsplit.deviceKey", JSON.stringify(k));
    if (p && !localStorage.getItem("billsplit.profile")) localStorage.setItem("billsplit.profile", JSON.stringify(p));
    if (!localStorage.getItem("billsplit.recent")) localStorage.setItem("billsplit.recent", JSON.stringify(r));
  }, [key, profile, recent]);
  return c.newPage();
};

// Old phone: Profile → "Auf neues Gerät übertragen"
const old = await device(ME, { name: "Niklas", paypalMe: "nik", paypalEmail: "", iban: "DE89370400440532013000" }, [{ id: b1, title: "Trattoria", role: "owner", createdAt: "2026-10-09T18:00:00Z" }]);
await old.goto(BASE + "/#/profile"); await wait(500);
await old.getByRole("button", { name: "Auf neues Gerät übertragen" }).click(); await old.waitForSelector(".device-panel .qr svg");
console.log("panel:", (await old.locator(".device-panel").innerText()).replace(/\n/g, " | "));
await old.locator(".device-section").screenshot({ path: `${SP}/shots/device-qr.png` });
await old.getByRole("button", { name: /Link kopieren/ }).click();
const link = await old.evaluate(() => navigator.clipboard.readText());
console.log("link:", link.replace(/[A-Za-z0-9_-]{24}$/, "<code>"));

// New phone (already has one bill of its own): scan → paste link
const neu = await device(null, null, [{ id: "zzzzzzzz", title: "Alt", role: "guest", createdAt: "2026-10-01T18:00:00Z" }]);
await neu.goto(BASE + "/#/scan"); await wait(400);
await neu.getByPlaceholder("https://…/#/b/…").fill(link);
await neu.getByRole("button", { name: "Gerät übernehmen" }).click(); await wait(400);
console.log("ask:", (await neu.locator(".device-card").innerText()).replace(/\n/g, " | "));
await neu.locator(".content").screenshot({ path: `${SP}/shots/device-ask.png` });
await neu.getByRole("button", { name: "Übernehmen" }).click(); await neu.waitForSelector(".settle-done");
console.log("done:", (await neu.locator(".device-card").innerText()).replace(/\n/g, " | "));
await neu.getByRole("button", { name: "Zu Deinen Rechnungen" }).click(); await wait(800);
console.log("new home bills:", (await neu.locator(".bill-list, .recent, ul").first().innerText()).replace(/\n/g, " | ").slice(0, 200));
console.log("new profile:", await neu.evaluate(() => localStorage.getItem("billsplit.profile")));
console.log("same key:", (await neu.evaluate(() => JSON.parse(localStorage.getItem("billsplit.deviceKey")))) === ME);
// Using the code again fails
await neu.goto(BASE + "/#/geraet/" + link.split("/").pop()); await wait(300);
await neu.getByRole("button", { name: "Übernehmen" }).click(); await wait(600);
console.log("reuse:", await neu.locator(".alert").last().innerText());

// Recovery code: show on old phone, enter on a third device
await old.getByRole("button", { name: "Wiederherstellungs-Code anzeigen" }).click(); await wait(200);
const code = await old.locator(".recovery-code").innerText();
console.log("code shown:", code === ME);
const third = await device(null, { name: "Niklas", paypalMe: "", paypalEmail: "" });
await third.goto(BASE + "/#/profile"); await wait(400);
await third.getByRole("button", { name: "Wiederherstellungs-Code eingeben" }).click();
await third.locator(".recovery-input").fill("falsch");
await third.getByRole("button", { name: "Rechnungen wiederherstellen" }).click(); await wait(200);
console.log("invalid:", await third.locator(".device-transfer .alert").innerText());
await third.locator(".recovery-input").fill(code.slice(0, 30) + "\n" + code.slice(30));
await third.getByRole("button", { name: "Rechnungen wiederherstellen" }).click(); await third.waitForSelector(".device-panel .settle-done");
console.log("restored:", await third.locator(".device-panel .settle-done").innerText());
await third.locator(".device-section").screenshot({ path: `${SP}/shots/device-restored.png` });
console.log("third recent:", await third.evaluate(() => JSON.parse(localStorage.getItem("billsplit.recent")).map((b) => `${b.title}/${b.role}`).join(", ")));
await browser.close(); srv.kill();
