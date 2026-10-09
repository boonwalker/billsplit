import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";
import { isAiConfigured } from "./parseReceipt.ts";
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

const server = createServer(createApp(store, path.join(root, "dist"), { trustProxy: TRUST_PROXY }));

server.listen(PORT, () => {
  console.log(
    `billsplit läuft auf http://localhost:${PORT} (KI-Belegerkennung: ${isAiConfigured() ? "aktiv" : "aus"}, Daten: ${DATA_FILE})`,
  );
});

async function shutdown(): Promise<void> {
  await store.flush();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
