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
const DATA_FILE = path.resolve(root, process.env.DATA_DIR ?? "data", "bills.json");

const store = new BillStore(DATA_FILE);
await store.load();

const server = createServer(createApp(store, path.join(root, "dist"), { trustProxy: process.env.TRUST_PROXY === "1" }));

server.listen(PORT, () => {
  console.log(`billsplit läuft auf http://localhost:${PORT} (KI-Belegerkennung: ${isAiConfigured() ? "aktiv" : "aus"})`);
});

async function shutdown(): Promise<void> {
  await store.flush();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
