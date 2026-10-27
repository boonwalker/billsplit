import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AccountStore } from "./accounts.ts";
import { adminSecret, createApp } from "./app.ts";
import { dataDir, ephemeralDataProblem } from "./dataDir.ts";
import { Monitor } from "./monitor.ts";
import { AuditLog } from "./audit.ts";
import { isAiConfigured } from "./parseReceipt.ts";
import { PushService } from "./push.ts";
import { RateService } from "./rates.ts";
import { VisitLog } from "./visits.ts";
import { VenueStore } from "./venues.ts";
import { BillStore } from "./store.ts";
import { operatorFromEnv } from "./operator";

try {
  process.loadEnvFile();
} catch {
  // No .env file – configuration comes from the environment.
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
// Railway mounts the attached volume at RAILWAY_VOLUME_MOUNT_PATH.
const DATA_DIR = dataDir(process.env, root);
const dataProblem = ephemeralDataProblem(process.env, DATA_DIR);
if (dataProblem) {
  // Better no new version than one that starts empty: Railway keeps the old one running.
  console.error(`klicksplit startet nicht: ${dataProblem}`);
  process.exit(1);
}
const DATA_FILE = path.join(DATA_DIR, "bills.json");
// Render and Railway put a proxy in front; the client address is then in X-Forwarded-For.
const TRUST_PROXY = process.env.TRUST_PROXY === "1" || Boolean(process.env.RAILWAY_ENVIRONMENT);

const store = new BillStore(DATA_FILE);
await store.load();
// One backup per day next to the data (checked every few hours, kept for two weeks).
const backup = () => store.backup().catch((error: unknown) => console.error("Backup fehlgeschlagen", error));
void backup();
setInterval(() => void backup(), 6 * 60 * 60 * 1000).unref();
// Push keys and subscriptions live next to the bills (on the volume).
const push = new PushService(path.dirname(DATA_FILE));
await push.init();

// Errors and AI usage per day, for the admin page (/api/admin?token=ADMIN_TOKEN).
const monitor = new Monitor(path.join(path.dirname(DATA_FILE), "monitor.json"));
await monitor.load();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim() || undefined;
// Optional e-mail accounts (sign-in codes go out through Resend, see mail.ts).
const accounts = new AccountStore(path.join(path.dirname(DATA_FILE), "accounts.json"));
await accounts.load();

// App starts per day and the devices behind them (admin page).
const visits = new VisitLog(path.join(path.dirname(DATA_FILE), "visits.json"));
const audit = new AuditLog(path.join(path.dirname(DATA_FILE), "audit.json"));
await audit.load();
await visits.load();

// Restaurant mode: restaurants, their tables and the bill open at each.
const venues = new VenueStore(path.join(path.dirname(DATA_FILE), "venues.json"));
await venues.load();

// Exchange rates (ECB, daily) for balances in the home currency, kept next to the bills.
const rates = new RateService(path.dirname(DATA_FILE));
await rates.load();
const server = createServer(createApp(store, path.join(root, "dist"), { trustProxy: TRUST_PROXY, push, monitor, adminToken: ADMIN_TOKEN, accounts, rates, visits, venues, audit }));

server.listen(PORT, () => {
  console.log(
    `klicksplit läuft auf http://localhost:${PORT} (KI-Belegerkennung: ${isAiConfigured() ? "aktiv" : "aus"}, Daten: ${path.dirname(DATA_FILE)}, Speicher: ${store.storage}, Admin-Seite: ${adminSecret(ADMIN_TOKEN) ? "an" : ADMIN_TOKEN ? "aus (ADMIN_TOKEN kürzer als 12 Zeichen)" : "aus"}, Mail: ${process.env.RESEND_API_KEY && process.env.MAIL_FROM ? "Resend" : "nur Log"}, Impressum: ${operatorFromEnv()?.name ? "an" : "OPERATOR_NAME fehlt"})`,
  );
});

async function shutdown(): Promise<void> {
  await Promise.all([store.flush(), monitor.flush(), accounts.flush(), visits.flush(), venues.flush(), audit.flush()]);
  store.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
