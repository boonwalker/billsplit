import { spawn } from "node:child_process";
const SP = process.argv[2];
const ROOT = new URL("..", import.meta.url).pathname; // Repo-Wurzel (Server läuft aus dist-server/)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn("node", ["dist-server/index.js"], { cwd: ROOT, env: { ...process.env, PORT: "3244", DATA_DIR: SP + "/data-ownoffer" }, stdio: "ignore" });
await wait(1500);
const call = (path, key, method, body) => fetch(`http://localhost:3244${path}`, { method, headers: { "content-type": "application/json", "x-billsplit-key": key }, body: body && JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json() }));
const OK = "ownerkey-1234567890abcdef", BEN = "benkey-1234567890abcdefgh";
const { json: { id } } = await call("/api/bills", OK, "POST", { name: "Niklas", data: { title: "A", date: "2026-10-10", currency: "EUR", items: [{ id: "s", name: "Salad", qty: 1, total: 590 }, { id: "b", name: "Butter", qty: 1, total: 390 }], tipPercent: 0, payment: { paypalMe: "nik" } } });
console.log((await call(`/api/bills/${id}/claims`, OK, "PUT", { claims: { s: [0], b: [0] }, splits: { b: [0] } })).status);
await call(`/api/bills/${id}/join`, BEN, "POST", { name: "Ben" });
const r = await call(`/api/bills/${id}/claims`, BEN, "PUT", { claims: { b: [0] }, splits: {} });
console.log(r.status, JSON.stringify(r.json.participants?.map((p) => [p.name, p.claims, p.splits])), r.json.error);
srv.kill();
