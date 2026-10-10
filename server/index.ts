import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { isAiConfigured } from "./parseReceipt.ts";
import { PushService } from "./push.ts";
import { BillStore } from "./store.ts";

try {
  process.loadEnvFile();
} catch {
  // No .env file – configuration comes from the environment.
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 8787);
// Railway mounts the attached volume at RAILWAY_VOLUME_MOUNT_PATH.
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || "data";
const DATA_FILE = path.resolve(root, DATA_DIR, "bills.json");
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

const server = createServer(createApp(store, path.join(root, "dist"), { trustProxy: TRUST_PROXY, push }));

server.listen(PORT, () => {
  console.log(
    `billsplit läuft auf http://localhost:${PORT} (KI-Belegerkennung: ${isAiConfigured() ? "aktiv" : "aus"}, Daten: ${path.dirname(DATA_FILE)}, Speicher: ${store.storage})`,
  );
});

async function shutdown(): Promise<void> {
  await store.flush();
  store.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
